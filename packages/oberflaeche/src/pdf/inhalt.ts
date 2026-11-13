// Inhaltsverzeichnis aus dem PDF lesen: zuerst die eingebettete Gliederung (Lesezeichen), sonst die gedruckten
// Inhaltsseiten am Anfang. Läuft einmal pro PDF und landet in `lernen/inhalt/<id>.json` (siehe kern/inhalt.ts).
import {
  gedruckteEintraege,
  INHALT_VERSION,
  inhaltText,
  inhaltVeraltet,
  liesInhalt,
  ordneSeitenZu,
  pfade,
  vergleichsText,
  versatzAus,
  type Inhalt,
  type Kapitel
} from '@rl/kern'
import type { Speicher } from '../daten/speicher'
import { ladePdf, type PdfDokument } from './pdf'

const MAX_EBENE = 4
const MAX_KAPITEL = 600

interface Gliederungspunkt {
  title: string
  dest: string | unknown[] | null
  items: Gliederungspunkt[]
}

async function zielSeite(doc: PdfDokument, dest: Gliederungspunkt['dest']): Promise<number | null> {
  try {
    const d = typeof dest === 'string' ? await doc.getDestination(dest) : dest
    if (!Array.isArray(d) || d[0] == null) return null
    const ref = d[0]
    if (typeof ref === 'number') return ref + 1
    return (await doc.getPageIndex(ref as Parameters<PdfDokument['getPageIndex']>[0])) + 1
  } catch {
    return null
  }
}

async function ausGliederung(doc: PdfDokument): Promise<Kapitel[]> {
  const gliederung = (await doc.getOutline().catch(() => null)) as Gliederungspunkt[] | null
  if (!gliederung?.length) return []
  const out: Kapitel[] = []
  const gehe = async (punkte: Gliederungspunkt[], ebene: number) => {
    for (const p of punkte) {
      if (out.length >= MAX_KAPITEL) return
      const seite = await zielSeite(doc, p.dest)
      const titel = (p.title ?? '').replace(/\s+/g, ' ').trim()
      if (seite && titel) out.push({ titel, seite, ebene })
      if (p.items?.length && ebene < MAX_EBENE) await gehe(p.items, ebene + 1)
    }
  }
  await gehe(gliederung, 1)
  return out
}

/** Text einer Seite als Zeilen (Textstücke mit gleicher Höhe auf der Seite gehören zu einer Zeile) */
async function seitenZeilen(doc: PdfDokument, nr: number): Promise<string[]> {
  const inhalt = await (await doc.getPage(nr)).getTextContent()
  const stuecke = inhalt.items
    .filter((i): i is typeof i & { str: string; transform: number[]; height: number } => 'str' in i && !!i.str.trim())
    .map((i) => ({ text: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.height) || 8 }))
    .sort((a, b) => b.y - a.y || a.x - b.x)
  const zeilen: { y: number; h: number; teile: typeof stuecke }[] = []
  for (const s of stuecke) {
    const z = zeilen.find((z) => Math.abs(z.y - s.y) < Math.max(2, Math.min(z.h, s.h) * 0.5))
    if (z) z.teile.push(s)
    else zeilen.push({ y: s.y, h: s.h, teile: [s] })
  }
  return zeilen.map((z) =>
    z.teile
      .sort((a, b) => a.x - b.x)
      .map((t) => t.text)
      .join(' ')
  )
}

async function ausGedrucktemVerzeichnis(doc: PdfDokument): Promise<Kapitel[]> {
  const n = doc.numPages
  const cache = new Map<number, Promise<string[]>>()
  const zeilen = (nr: number) => {
    let p = cache.get(nr)
    if (!p) cache.set(nr, (p = seitenZeilen(doc, nr).catch(() => [])))
    return p
  }

  // Inhaltsseiten am Anfang suchen; ein Verzeichnis kann über mehrere Seiten gehen
  const eintraege: ReturnType<typeof gedruckteEintraege> = []
  let ende = 0
  for (let nr = 1; nr <= Math.min(n, 30); nr++) {
    const e = gedruckteEintraege(await zeilen(nr), eintraege.length ? 3 : 5)
    if (e.length) {
      eintraege.push(...e)
      ende = nr
    } else if (eintraege.length) break
  }
  if (!eintraege.length) return []

  // Gedruckte Seitenzahl → PDF-Seite: Seitenlabels, sonst Versatz an Stichproben prüfen
  const labels = await doc.getPageLabels().catch(() => null)
  const nutzbar = labels?.some((l, i) => l && l !== String(i + 1) && /^\d+$/.test(l)) ? labels : null
  let versatz = 0
  if (!nutzbar) {
    const proben: number[] = []
    const stichprobe = eintraege.filter((e) => e.ebene === 1).concat(eintraege.filter((e) => e.ebene > 1))
    for (const e of stichprobe.slice(0, 10)) {
      const suche = vergleichsText(e.titel.replace(/^((?:\d{1,2}|[A-Z])(?:\.\d{1,2})*)\.?\s+/, '')).slice(0, 24)
      if (suche.length < 4) continue
      for (let nr = Math.max(ende + 1, e.gedruckt - 3); nr <= Math.min(n, e.gedruckt + 60); nr++) {
        const kopf = vergleichsText((await zeilen(nr)).slice(0, 8).join(' '))
        if (kopf.includes(suche)) {
          proben.push(nr - e.gedruckt)
          break
        }
      }
      if (proben.length >= 4 && versatzAus(proben) !== null) break
    }
    versatz = versatzAus(proben) ?? 0
  }
  return ordneSeitenZu(eintraege, n, { labels: nutzbar, versatz }).slice(0, MAX_KAPITEL)
}

export async function leseInhalt(doc: PdfDokument): Promise<Inhalt> {
  const gliederung = await ausGliederung(doc)
  if (gliederung.length) return { herkunft: 'pdf', version: INHALT_VERSION, kapitel: gliederung }
  const gedruckt = await ausGedrucktemVerzeichnis(doc).catch(() => [])
  if (gedruckt.length) return { herkunft: 'gedruckt', version: INHALT_VERSION, kapitel: gedruckt }
  return { herkunft: 'keins', version: INHALT_VERSION, kapitel: [] }
}

const laufend = new Map<string, Promise<void>>()

/** Liest das Inhaltsverzeichnis einmal aus dem PDF und legt es ab. Ein selbst bearbeitetes bleibt unangetastet. */
export function sichereInhalt(speicher: Speicher, anhangId: string, pfad: string, vorhanden: string | undefined): Promise<void> {
  if (!inhaltVeraltet(liesInhalt(vorhanden))) return Promise.resolve()
  let p = laufend.get(anhangId)
  if (!p) {
    p = (async () => {
      const doc = await ladePdf(speicher, pfad)
      if (!doc) return
      const neu = await leseInhalt(doc)
      await speicher.aendere(pfade.inhalt(anhangId), (alt) => (inhaltVeraltet(liesInhalt(alt)) ? inhaltText(neu) : alt))
    })().finally(() => laufend.delete(anhangId))
    laufend.set(anhangId, p)
  }
  return p
}
