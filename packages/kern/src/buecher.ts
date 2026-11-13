// Notizbücher (Vertrag Lernen 1.3, 5.3): Schreibseiten, die nicht an einer Skriptseite hängen. Steckbrief als
// Markdown, je Seite die Tinte (SVG) und eine JSON-Datei mit Bildern und Verweisen aufs Skript.
// Dazu das Anheben der alten Zeichenblätter (bis Lernen 1.2), deterministisch, damit zwei Geräte gleichzeitig
// anheben können und byte-gleiche Dateien schreiben.

import {
  A4,
  alteStandardAnordnung,
  anordnungJson,
  bildAus,
  liesAnordnung,
  liesBilder,
  lineaturName,
  platzFuerBild,
  type Anordnung,
  type Ansicht,
  type BlattBild,
  type Lineatur
} from './blaetter'
import { neuesDokument } from './frontmatter'
import { pfade } from './pfade'
import { liesTinte, tinteSvg, SEITE_BREITE } from './tinte'

export type BuchBild = Omit<BlattBild, 'blatt'>

/** Wohin eine Stelle der Buchseite im Skript zeigt */
export interface Verweis {
  id: string
  /** Höhe auf der Buchseite (Seitenkoordinaten, Breite 1000) */
  y: number
  anhang: string
  seite: number
  /** aus einer Markierung (Zeile in lernen/markierungen/<anhang>.md); sonst beim Schreiben gesetzt */
  marke?: string
  /** nur mit `marke`: ID des Ausschnitts auf derselben Seite, der zur Markierung gehört (ab Lernen 1.5) */
  bild?: string
  am?: string
}

export interface BuchSeite {
  bilder: BuchBild[]
  verweise: Verweis[]
  /** unbekannte Felder bleiben erhalten (Grundlagen 1.3) */
  rest: Record<string, unknown>
}

const zahl = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function liesBuchSeite(text: string | null | undefined): BuchSeite {
  let roh: Record<string, unknown> = {}
  try {
    const r = text ? JSON.parse(text) : null
    if (r && typeof r === 'object' && !Array.isArray(r)) roh = r
  } catch {
    /* kaputt: leer lesen, die Datei selbst bleibt */
  }
  const { bilder, verweise, ...rest } = roh
  const out: BuchSeite = { bilder: [], verweise: [], rest }
  if (Array.isArray(bilder)) for (const b of bilder) {
    const bild = bildAus(b)
    if (bild) out.bilder.push(bild)
  }
  if (Array.isArray(verweise)) for (const v of verweise) {
    if (!v || typeof v.id !== 'string' || typeof v.anhang !== 'string' || !zahl(v.y) || !zahl(v.seite) || v.seite < 1) continue
    const w: Verweis = { id: v.id, y: Math.max(0, v.y), anhang: v.anhang, seite: Math.round(v.seite) }
    if (typeof v.marke === 'string') w.marke = v.marke
    if (typeof v.bild === 'string') w.bild = v.bild
    if (typeof v.am === 'string') w.am = v.am
    out.verweise.push(w)
  }
  return out
}

export function buchSeiteJson(s: BuchSeite): string {
  const r = (n: number) => Math.round(n * 10) / 10
  const k = (n: number) => Math.round(n * 10000) / 10000
  return (
    JSON.stringify({
      ...s.rest,
      bilder: s.bilder.map((b) => ({ ...b, x: r(b.x), y: r(b.y), b: r(b.b), h: r(b.h), ...(b.bereich ? { bereich: { x: k(b.bereich.x), y: k(b.bereich.y), b: k(b.bereich.b), h: k(b.bereich.h) } } : {}) })),
      verweise: [...s.verweise].sort((a, b) => a.y - b.y).map((v) => ({ ...v, y: r(v.y) }))
    }) + '\n'
  )
}

/**
 * ✦-Marke entfernen (Vertrag Lernen 1.5, 5.3): nur der Nutzer, nur Verweise aus einer Markierung. Der zugehörige
 * Ausschnitt geht mit: über `bild`, bei älteren Marken ohne `bild` der Ausschnitt derselben Skriptseite auf derselben
 * Höhe, an die die App ihn gelegt hat. Findet sich keiner (verschoben oder schon entfernt), geht nur die Marke.
 * Alles andere auf der Seite bleibt, wie es ist. Liefert null, wenn es die Marke nicht gibt.
 */
export function ohneMarkeImBuch(s: BuchSeite, verweisId: string): BuchSeite | null {
  const v = s.verweise.find((w) => w.id === verweisId)
  if (!v || v.marke === undefined) return null
  const gehoert = v.bild !== undefined
    ? (b: BuchBild) => b.id === v.bild
    : (b: BuchBild) => b.bereich !== undefined && b.anhang === v.anhang && b.seite === v.seite && Math.abs(b.y - v.y) < 0.5
  const bild = s.bilder.find(gehoert)
  return {
    ...s,
    bilder: bild ? s.bilder.filter((b) => b !== bild) : s.bilder,
    verweise: s.verweise.filter((w) => w !== v)
  }
}

/** Platz für ein Bild auf einer Buchseite (unter dem untersten Bild), wie bei den Blättern */
export function platzImBuch(bilder: BuchBild[], verhaeltnis: number, format: number) {
  return platzFuerBild(
    bilder.map((b) => ({ ...b, blatt: '' })),
    '',
    verhaeltnis,
    format
  )
}

/** Vorhandene Seitennummern eines Buchs, aufsteigend (eine Seite gibt es, sobald ihre Tinte oder JSON-Datei da ist) */
export function buchSeitenNummern(alle: Iterable<string>, id: string): number[] {
  const muster = new RegExp(`^lernen/buecher/${id}/S(\\d{3,})\\.(svg|json)$`)
  const n = new Set<number>()
  for (const p of alle) {
    const m = muster.exec(p)
    if (m) n.add(Number(m[1]))
  }
  return [...n].sort((a, b) => a - b)
}

/** Steckbrief eines neuen Notizbuchs */
export function buchDokument(b: { id: string; titel: string; lineatur: Lineatur; modul?: string | null; erstellt: string; geaendert?: string }): string {
  return neuesDokument([
    ['id', b.id],
    ['typ', 'notizbuch'],
    ['erstellt', b.erstellt],
    ['geaendert', b.geaendert ?? b.erstellt],
    ['titel', b.titel],
    ['lineatur', b.lineatur],
    ...(b.modul ? ([['modul', `[[${b.modul}]]`]] as [string, string][]) : [])
  ])
}

// ── Anheben der Zeichenblätter (Lernen 1.2 → 1.3) ─────────────────────────────────────────────────────────────

const ZEICHEN = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** FNV-1a (32 Bit) mit Startwert; vier Läufe ergeben genug Bits für den Zufallsteil einer ULID */
function fnv(text: string, start: number): number {
  let h = start >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/**
 * ID des Notizbuchs, das aus einem alten Blatt entsteht: Zeitteil der Anhang-ID (eine ULID) plus 16 Zeichen aus einer
 * Prüfsumme über Anhang und Blatt. Jedes Gerät kommt auf dieselbe ID, ohne sich abzustimmen.
 */
export function buchIdAusBlatt(anhangId: string, blatt: string): string {
  const zeit = /^[0-9A-HJKMNP-TV-Z]{10}/.test(anhangId.toUpperCase()) ? anhangId.toUpperCase().slice(0, 10) : '0000000000'
  let rest = ''
  for (const start of [0x811c9dc5, 0x01000193, 0x2545f491, 0x9e3779b9]) {
    let h = fnv(`${anhangId}\u0000${blatt}`, start)
    for (let i = 0; i < 4; i++) {
      rest += ZEICHEN[h % 32]
      h = Math.floor(h / 32)
    }
  }
  return zeit + rest
}

export interface AltesSkript {
  anhangId: string
  titel: string
  /** vom Anhang übernommen, damit beide Geräte dasselbe schreiben */
  erstellt: string
  geaendert: string
  modul?: string | null
  /** Text von lernen/blaetter/<anhang>/anordnung.json oder null */
  anordnung: string | null
  /** alle Textdateien unter lernen/blaetter/<anhang>/ (Pfad → Inhalt) */
  dateien: Map<string, string>
}

export interface Anhebung {
  /** neue Dateien (Bücher, Seiten); nichts davon gibt es vorher */
  schreiben: { pfad: string; text: string }[]
  /** neue Anordnung mit schema 2 */
  anordnung: string
  /** Buch-ID je altem Blatt, z. B. für Meldungen */
  buecher: { blatt: string; id: string; seiten: number }[]
}

/** Muss dieses Skript angehoben werden? Ja, wenn alte Blätter oder eine alte Anordnung da sind. */
export function mussAnheben(anordnung: string | null, dateien: Map<string, string>): boolean {
  if (anordnung !== null) return liesAnordnung(anordnung).schema !== 2
  for (const p of dateien.keys()) if (/\/S\d{3}(-[a-z0-9]{1,12})?\.svg$|\/S\d{3}-bilder\.json$/.test(p)) return true
  return false
}

/**
 * Alte Zeichenblätter eines Skripts als Notizbücher. Rein: liefert nur, was zu schreiben ist. Die alten Dateien
 * bleiben unberührt. null, wenn nichts anzuheben ist.
 */
export function hebeBlaetterAn(s: AltesSkript): Anhebung | null {
  if (!mussAnheben(s.anordnung, s.dateien)) return null
  const alt: Anordnung = s.anordnung !== null ? liesAnordnung(s.anordnung) : alteStandardAnordnung()
  const ordner = `lernen/blaetter/${s.anhangId}/`

  // Blätter: aus der Anordnung und aus den Dateinamen (ein Blatt kann Tinte haben, ohne in der Anordnung zu stehen)
  const ansichten = new Map<string, Ansicht>(alt.ansichten.filter((v) => v.art === 'blatt').map((v) => [v.id, v]))
  const tinte = new Map<string, Map<number, string>>()
  const bilder = new Map<string, Map<number, BuchBild[]>>()
  for (const [pfad, text] of s.dateien) {
    if (!pfad.startsWith(ordner)) continue
    const name = pfad.slice(ordner.length)
    const t = /^S(\d{3})(?:-([a-z0-9]{1,12}))?\.svg$/.exec(name)
    if (t && t[2] !== 'bilder') {
      const blatt = t[2] ?? '1'
      if (!tinte.has(blatt)) tinte.set(blatt, new Map())
      tinte.get(blatt)!.set(Number(t[1]), text)
      continue
    }
    const b = /^S(\d{3})-bilder\.json$/.exec(name)
    if (b) for (const { blatt, ...bild } of liesBilder(text)) {
      if (!bilder.has(blatt)) bilder.set(blatt, new Map())
      const seite = bilder.get(blatt)!
      seite.set(Number(b[1]), [...(seite.get(Number(b[1])) ?? []), bild])
    }
  }
  for (const blatt of new Set([...tinte.keys(), ...bilder.keys()])) {
    if (!ansichten.has(blatt)) ansichten.set(blatt, { art: 'blatt', id: blatt, lineatur: 'kariert', breite: 2, zu: true })
  }

  const schreiben: Anhebung['schreiben'] = []
  const buecher: Anhebung['buecher'] = []
  const neueId = new Map<string, string>()
  const erstes = [...ansichten.keys()][0]
  for (const [blatt, v] of ansichten) {
    const t = tinte.get(blatt) ?? new Map<number, string>()
    const b = bilder.get(blatt) ?? new Map<number, BuchBild[]>()
    const seiten = [...new Set([...t.keys(), ...b.keys()])]
      .filter((n) => liesTinte(t.get(n) ?? '').length > 0 || (b.get(n)?.length ?? 0) > 0)
      .sort((x, y) => x - y)
    if (!seiten.length) continue
    const id = buchIdAusBlatt(s.anhangId, blatt)
    neueId.set(blatt, id)
    const lineatur = v.lineatur ?? 'kariert'
    const titel = blatt === erstes || ansichten.size === 1 ? s.titel : `${s.titel} – ${lineaturName(lineatur)}`
    schreiben.push({ pfad: pfade.buch(id), text: buchDokument({ id, titel, lineatur, modul: s.modul, erstellt: s.erstellt, geaendert: s.geaendert }) })
    seiten.forEach((skriptSeite, i) => {
      const nr = i + 1
      schreiben.push({ pfad: pfade.buchTinte(id, nr), text: t.get(skriptSeite) ?? tinteSvg([], SEITE_BREITE * A4) })
      const seite: BuchSeite = { bilder: b.get(skriptSeite) ?? [], verweise: [{ id: `s${skriptSeite}`, y: 0, anhang: s.anhangId, seite: skriptSeite }], rest: {} }
      schreiben.push({ pfad: pfade.buchSeite(id, nr), text: buchSeiteJson(seite) })
    })
    buecher.push({ blatt, id, seiten: seiten.length })
  }

  const neu: Anordnung = {
    schema: 2,
    ansichten: alt.ansichten.flatMap((v): Ansicht[] => {
      if (v.art !== 'blatt') return [v]
      const id = neueId.get(v.id)
      return id ? [{ art: 'buch', id, breite: v.breite, ...(v.zu ? { zu: true } : {}) }] : []
    })
  }
  // Blätter, die nur als Dateien da waren (nicht in der Anordnung): als ausgeblendete Bücher anhängen
  for (const [blatt, id] of neueId) if (!alt.ansichten.some((v) => v.art === 'blatt' && v.id === blatt)) neu.ansichten.push({ art: 'buch', id, breite: 2, zu: true })
  // Ein ausgeblendetes Skript ohne offenes Buch daneben: wieder zeigen, mindestens eine Ansicht bleibt offen
  if (!neu.ansichten.some((v) => !v.zu)) delete neu.ansichten.find((v) => v.art === 'pdf')!.zu
  return { schreiben, anordnung: anordnungJson(neu), buecher }
}
