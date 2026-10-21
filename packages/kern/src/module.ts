// Module der Lern-App: ein Lernziel mit einem oder mehreren PDFs. Ein Buch ist ein Modul mit einem PDF.
// Der Lesestand (welches PDF, welche Seite, wann) liegt pro Gerät in `lernen/stand/<geraet>.json`,
// damit zwei Geräte offline nie dieselbe Datei ändern (Vertrag 5.3).
import { linkZiel } from './frontmatter'
import { liesMarken } from './marken'
import { pfade } from './pfade'
import type { Bestand, Eintrag } from './bestand'

export interface Modul {
  id: string
  titel: string
  pfad: string
  /** Was mit dem Modul erreicht werden soll (frei, optional) */
  ziel: string
  /** Anhang-IDs der PDFs in Lesereihenfolge */
  quellen: string[]
  favorit: boolean
  abgeschlossen: boolean
}

/** Etwas, das man lernt: ein Modul oder ein PDF, das noch keinem Modul gehört (zählt wie ein Buch) */
export interface Lernziel {
  /** Modul-ID, bei einem losen PDF die Anhang-ID */
  id: string
  titel: string
  modul: Modul | null
  quellen: Eintrag[]
  favorit: boolean
  zuletzt: Lesestelle | null
}

export interface Lesestelle {
  anhang: string
  seite: number
  /** ISO-Zeit; aus älteren Markierungen nur das Datum */
  am: string
}

export type Lesestand = Record<string, { seite: number; am: string }>

export function istPdf(e: Eintrag): boolean {
  return /\.pdf$/i.test(String(e.felder.datei ?? ''))
}

/** Lern-PDFs: alles, was kein Plan eines Projekts ist (Skripte, Bücher, Datenblätter) */
export function lernPdfs(b: Bestand): Eintrag[] {
  return b.anhaenge().filter((a) => istPdf(a) && a.felder.art !== 'plan' && !a.felder.projekt)
}

export function module(b: Bestand): Modul[] {
  const out: Modul[] = []
  for (const e of b.dokumente.values()) {
    if (e.typ !== 'modul') continue
    const q = Array.isArray(e.felder.quellen) ? e.felder.quellen : e.felder.quellen ? [e.felder.quellen] : []
    out.push({
      id: e.id,
      titel: e.titel,
      pfad: e.pfad,
      ziel: typeof e.felder.ziel === 'string' ? e.felder.ziel : '',
      quellen: q.map((w) => linkZiel(w)).filter((x): x is string => !!x),
      favorit: e.felder.favorit === true,
      abgeschlossen: e.felder.status === 'abgeschlossen'
    })
  }
  return out.sort((a, c) => a.titel.localeCompare(c.titel, 'de'))
}

/** Lesestand aller Geräte zusammengeführt: pro PDF gewinnt der jüngste Eintrag */
export function lesestand(b: Bestand): Lesestand {
  const out: Lesestand = {}
  for (const [pfad, text] of b.texte) {
    if (!pfad.startsWith('lernen/stand/') || !pfad.endsWith('.json')) continue
    let s: Lesestand
    try {
      s = JSON.parse(text) as Lesestand
    } catch {
      continue
    }
    for (const [id, w] of Object.entries(s)) {
      if (!w || typeof w.am !== 'string' || typeof w.seite !== 'number') continue
      if (!out[id] || w.am > out[id].am) out[id] = { seite: w.seite, am: w.am }
    }
  }
  return out
}

/** Merkt im Stand eines Geräts, wo im PDF gerade gelesen wird (gibt den neuen Dateiinhalt zurück) */
export function merkeStelle(alt: string, anhang: string, seite: number, am: string): string {
  let s: Lesestand = {}
  try {
    s = alt.trim() ? (JSON.parse(alt) as Lesestand) : {}
  } catch {
    s = {}
  }
  s[anhang] = { seite, am }
  return JSON.stringify(s, null, 1) + '\n'
}

/** Letzte Stelle in einem PDF: aus dem Lesestand, sonst aus der jüngsten Markierung */
export function letzteStelle(b: Bestand, stand: Lesestand, anhang: string): Lesestelle | null {
  const s = stand[anhang]
  if (s) return { anhang, seite: s.seite, am: s.am }
  const marken = liesMarken(b.texte.get(pfade.marken('lernen', anhang)) ?? '')
  if (!marken.length) return null
  const m = marken.reduce((x, y) => (y.datum > x.datum ? y : x))
  return { anhang, seite: m.seite, am: m.datum }
}

function juengste(stellen: (Lesestelle | null)[]): Lesestelle | null {
  return stellen.reduce<Lesestelle | null>((x, y) => (y && (!x || y.am > x.am) ? y : x), null)
}

/** Alle Lernziele: jedes Modul und jedes PDF, das in keinem Modul steckt */
export function lernziele(b: Bestand, stand: Lesestand = lesestand(b)): Lernziel[] {
  const pdfs = new Map(lernPdfs(b).map((e) => [e.id, e]))
  const vergeben = new Set<string>()
  const out: Lernziel[] = []
  for (const m of module(b)) {
    const quellen = m.quellen.map((id) => pdfs.get(id) ?? b.dokumente.get(id)).filter((e): e is Eintrag => !!e)
    quellen.forEach((q) => vergeben.add(q.id))
    out.push({ id: m.id, titel: m.titel, modul: m, quellen, favorit: m.favorit, zuletzt: juengste(quellen.map((q) => letzteStelle(b, stand, q.id))) })
  }
  for (const e of pdfs.values()) {
    if (vergeben.has(e.id)) continue
    out.push({ id: e.id, titel: e.titel, modul: null, quellen: [e], favorit: false, zuletzt: letzteStelle(b, stand, e.id) })
  }
  return out.sort((a, c) => a.titel.localeCompare(c.titel, 'de'))
}

export interface LernzielListe {
  favoriten: Lernziel[]
  kuerzlich: Lernziel[]
  weitere: Lernziel[]
  abgeschlossen: Lernziel[]
}

/**
 * Wie die Projektliste der Arbeits-App: Favoriten (alphabetisch), dann zuletzt bearbeitet (neueste zuerst,
 * höchstens `anzahl`), dann der Rest alphabetisch. Abgeschlossene Module stehen ganz unten. Jedes Ziel nur einmal.
 */
export function ordneLernziele(ziele: Lernziel[], anzahl = 6): LernzielListe {
  const abgeschlossen = ziele.filter((z) => z.modul?.abgeschlossen)
  const offen = ziele.filter((z) => !z.modul?.abgeschlossen)
  const favoriten = offen.filter((z) => z.favorit)
  const rest = offen.filter((z) => !z.favorit)
  const kuerzlich = rest
    .filter((z) => z.zuletzt)
    .sort((x, y) => y.zuletzt!.am.localeCompare(x.zuletzt!.am))
    .slice(0, anzahl)
  const weitere = rest.filter((z) => !kuerzlich.includes(z))
  return { favoriten, kuerzlich, weitere, abgeschlossen }
}

/** In welchem Modul steckt ein PDF? */
export function modulVon(b: Bestand, anhang: string): Modul | undefined {
  return module(b).find((m) => m.quellen.includes(anhang))
}
