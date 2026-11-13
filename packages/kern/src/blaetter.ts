// Zeichenblätter neben dem Skript (Vertrag 5.3, „Blätter“): welche Ansichten nebeneinander stehen, in welcher
// Reihenfolge und Breite, und welche Lineatur ein Blatt hat. Die Tinte liegt pro Seite und Blatt als SVG daneben.

import { SEITE_BREITE } from './tinte'
import type { Bereich } from './marken'

/** Seitenverhältnis A4 (Höhe/Breite); ein Blatt wächst beim Verlängern um genau diese Höhe */
export const A4 = Math.SQRT2

export type Lineatur = 'kariert' | 'liniert' | 'punkte' | 'millimeter' | 'noten' | 'leer'

export const LINEATUREN: { art: Lineatur; name: string }[] = [
  { art: 'kariert', name: 'Kästchen' },
  { art: 'liniert', name: 'Linien' },
  { art: 'punkte', name: 'Punkte' },
  { art: 'millimeter', name: 'Millimeter' },
  { art: 'noten', name: 'Noten' },
  { art: 'leer', name: 'Leer' }
]

export const lineaturName = (l: Lineatur) => LINEATUREN.find((x) => x.art === l)?.name ?? 'Kästchen'

export interface Ansicht {
  /** pdf = das Skript selbst, buch = ein Notizbuch (ab Lernen 1.3), blatt = altes Zeichenblatt (bis 1.2, wird angehoben) */
  art: 'pdf' | 'blatt' | 'buch'
  /** „pdf“ fürs Skript, die ID des Notizbuchs; alte Blätter: das erste heißt „1“ (Tinte in S001.svg) */
  id: string
  lineatur?: Lineatur
  /** Anteil an der Breite, relativ zu den anderen offenen Ansichten */
  breite: number
  /** ausgeblendet; die Tinte bleibt, die Ansicht lässt sich wieder öffnen */
  zu?: boolean
}

export interface Anordnung {
  /** 2 ab Lernen 1.3 (Notizbücher); fehlt es, stammt die Anordnung aus der Zeit der Zeichenblätter */
  schema?: number
  ansichten: Ansicht[]
}

/** Gültige ID eines Notizbuchs: eine ULID */
export const istBuchId = (id: unknown): id is string => typeof id === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)

const ARTEN = new Set(LINEATUREN.map((l) => l.art))
const MIN_BREITE = 0.2
const MAX_BREITE = 20

const breiteOk = (b: unknown, sonst: number) => (typeof b === 'number' && Number.isFinite(b) ? Math.min(MAX_BREITE, Math.max(MIN_BREITE, b)) : sonst)

/** So sieht der Übungsplatz ohne eigene Anordnung aus: das Skript allein (Notizbücher kommen über „+ Buch“) */
export function standardAnordnung(): Anordnung {
  return { schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 3 }] }
}

/** Anordnung aus Lernen 1.2 ohne Datei: Skript und Blatt 1 mit Kästchen (Grundlage fürs Anheben) */
export function alteStandardAnordnung(): Anordnung {
  return {
    ansichten: [
      { art: 'pdf', id: 'pdf', breite: 3 },
      { art: 'blatt', id: '1', lineatur: 'kariert', breite: 2 }
    ]
  }
}

/** Liest die Anordnung robust: Unbekanntes fällt weg, das Skript steht genau einmal darin, eine Ansicht bleibt offen */
export function liesAnordnung(text: string | null | undefined): Anordnung {
  let roh: unknown
  try {
    roh = text ? JSON.parse(text) : null
  } catch {
    roh = null
  }
  const liste = roh && typeof roh === 'object' && Array.isArray((roh as Anordnung).ansichten) ? (roh as Anordnung).ansichten : null
  if (!liste) return text ? alteStandardAnordnung() : standardAnordnung()
  const schema = (roh as Anordnung).schema === 2 ? 2 : undefined
  const ansichten: Ansicht[] = []
  const ids = new Set<string>()
  for (const a of liste) {
    if (!a || typeof a !== 'object') continue
    const art = a.art === 'pdf' ? 'pdf' : a.art === 'blatt' && !schema ? 'blatt' : a.art === 'buch' ? 'buch' : null
    if (!art) continue
    const id = art === 'pdf' ? 'pdf' : art === 'buch' ? (istBuchId(a.id) ? a.id : null) : typeof a.id === 'string' && /^[a-z0-9]{1,12}$/.test(a.id) ? a.id : null
    if (!id || ids.has(id)) continue
    ids.add(id)
    const v: Ansicht = { art, id, breite: breiteOk(a.breite, art === 'pdf' ? 3 : 2) }
    if (art === 'blatt') v.lineatur = a.lineatur && ARTEN.has(a.lineatur) ? a.lineatur : 'kariert'
    if (a.zu === true) v.zu = true
    ansichten.push(v)
  }
  if (!ids.has('pdf')) ansichten.unshift({ art: 'pdf', id: 'pdf', breite: 3, zu: ansichten.some((a) => !a.zu) || undefined })
  if (!ansichten.some((a) => !a.zu)) delete ansichten[0].zu
  return schema ? { schema, ansichten } : { ansichten }
}

export function anordnungJson(a: Anordnung): string {
  const ansichten = a.ansichten.map((v) => ({ ...v, breite: Math.round(v.breite * 100) / 100 }))
  return JSON.stringify(a.schema ? { schema: a.schema, ansichten } : { ansichten }, null, 1) + '\n'
}

export const offeneAnsichten = (a: Anordnung) => a.ansichten.filter((v) => !v.zu)

const ersetze = (a: Anordnung, id: string, f: (v: Ansicht) => Ansicht | null): Anordnung => ({
  ...a,
  ansichten: a.ansichten.flatMap((v) => {
    if (v.id !== id) return [v]
    const neu = f(v)
    return neu ? [neu] : []
  })
})

/** Neues Blatt hinten anfügen, so breit wie das schmalste offene Blatt (sonst 2) */
export function neuesBlatt(a: Anordnung, id: string, lineatur: Lineatur): Anordnung {
  const blaetter = offeneAnsichten(a).filter((v) => v.art === 'blatt')
  const breite = blaetter.length ? Math.min(...blaetter.map((v) => v.breite)) : 2
  return { ...a, ansichten: [...a.ansichten, { art: 'blatt', id, lineatur, breite }] }
}

/** Notizbuch neben das Skript stellen (hinten); steht es schon (auch ausgeblendet), wird es nur wieder gezeigt */
export function zeigeBuch(a: Anordnung, id: string): Anordnung {
  if (a.ansichten.some((v) => v.id === id)) return oeffneAnsicht(a, id)
  const andere = offeneAnsichten(a).filter((v) => v.art !== 'pdf')
  const breite = andere.length ? Math.min(...andere.map((v) => v.breite)) : 2
  return { ...a, schema: 2, ansichten: [...a.ansichten, { art: 'buch', id, breite }] }
}

/** Mit der benachbarten offenen Ansicht tauschen (-1 = nach vorn/links, 1 = nach hinten/rechts) */
export function verschiebeAnsicht(a: Anordnung, id: string, richtung: -1 | 1): Anordnung {
  const offen = a.ansichten.map((v, i) => ({ v, i })).filter((x) => !x.v.zu)
  const k = offen.findIndex((x) => x.v.id === id)
  const n = offen[k + richtung]
  if (k < 0 || !n) return a
  const ansichten = [...a.ansichten]
  ansichten[offen[k].i] = n.v
  ansichten[n.i] = offen[k].v
  return { ...a, ansichten }
}

export function setzeBreiten(a: Anordnung, breiten: Record<string, number>): Anordnung {
  return { ...a, ansichten: a.ansichten.map((v) => (v.id in breiten ? { ...v, breite: breiteOk(breiten[v.id], v.breite) } : v)) }
}

export const setzeLineatur = (a: Anordnung, id: string, lineatur: Lineatur): Anordnung => ersetze(a, id, (v) => ({ ...v, lineatur }))

/**
 * Ansicht schließen. Ein Blatt ohne Tinte auf irgendeiner Seite verschwindet ganz; eins mit Tinte wird nur
 * ausgeblendet, damit nichts Geschriebenes verloren geht. Die letzte offene Ansicht bleibt offen.
 */
export function schliesseAnsicht(a: Anordnung, id: string, hatTinte: boolean): Anordnung {
  if (offeneAnsichten(a).length <= 1) return a
  // Ein Notizbuch verschwindet aus der Anordnung, es bleibt ja als eigene Datei und lässt sich über „+ Buch“ wieder holen
  return ersetze(a, id, (v) => ((v.art === 'blatt' && !hatTinte) || v.art === 'buch' ? null : { ...v, zu: true }))
}

/** Ausgeblendete Ansicht wieder zeigen, hinten angefügt */
export function oeffneAnsicht(a: Anordnung, id: string): Anordnung {
  const v = a.ansichten.find((x) => x.id === id)
  if (!v) return a
  const { zu: _zu, ...offen } = v
  return { ...a, ansichten: [...a.ansichten.filter((x) => x.id !== id), offen] }
}

/** Nächste freie Blatt-ID: kurz, nur Kleinbuchstaben und Ziffern */
export function neueBlattId(a: Anordnung, zufall: string): string {
  const ids = new Set(a.ansichten.map((v) => v.id))
  const basis = zufall.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6) || 'b'
  let id = basis
  for (let i = 2; ids.has(id); i++) id = `${basis}${i}`
  return id
}

/** Höhe/Breite eines Blatts aus seiner Tinte: mindestens A4, nach dem Verlängern mehr */
export function blattFormat(svg: string | null | undefined): number {
  const h = svg ? Number(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)?.[1]) : NaN
  return Number.isFinite(h) && h > 0 ? Math.max(A4, h / SEITE_BREITE) : A4
}

/** Eine Schicht der Lineatur: ein Pfad in Seitenkoordinaten (Breite 1000) und wie kräftig er ist */
export interface LineaturSchicht {
  d: string
  /** fein, mittel, kräftig; Punkte werden als runde Striche der Länge 0 gezeichnet */
  staerke: 'fein' | 'mittel' | 'kraeftig' | 'punkt'
}

/** Seitenkoordinaten je Millimeter bei A4-Breite (210 mm = 1000) */
export const MM = SEITE_BREITE / 210

const r = (n: number) => Math.round(n * 10) / 10

function waagerecht(ys: number[], x0 = 0, x1 = SEITE_BREITE): string {
  return ys.map((y) => `M${r(x0)} ${r(y)}H${r(x1)}`).join('')
}
function senkrecht(xs: number[], hoehe: number): string {
  return xs.map((x) => `M${r(x)} 0V${r(hoehe)}`).join('')
}
function schritte(von: number, bis: number, schritt: number, ausser?: (i: number) => boolean): number[] {
  const out: number[] = []
  for (let i = 0; von + i * schritt <= bis + 1e-6; i++) if (!ausser?.(i)) out.push(von + i * schritt)
  return out
}

/**
 * Linien einer Lineatur in Seitenkoordinaten. Maße wie auf Papier, bezogen auf A4-Breite: Kästchen 5 mm,
 * Linien 8 mm, Punkte 5 mm, Millimeterpapier 1/5/10 mm, Noten 12 Systeme pro A4 (Linienabstand 2 mm).
 * Dieselben Linien zeichnet die App aufs Blatt und in ein leeres PDF, damit Tinte und Linien überall passen.
 */
export function lineaturSchichten(art: Lineatur, format: number): LineaturSchicht[] {
  const hoehe = SEITE_BREITE * format
  if (art === 'kariert') {
    const s = 5 * MM
    return [{ d: waagerecht(schritte(s, hoehe, s)) + senkrecht(schritte(s, SEITE_BREITE, s), hoehe), staerke: 'fein' }]
  }
  if (art === 'liniert') return [{ d: waagerecht(schritte(16 * MM, hoehe - 4 * MM, 8 * MM)), staerke: 'fein' }]
  if (art === 'punkte') {
    const s = 5 * MM
    const xs = schritte(s, SEITE_BREITE - 1, s)
    return [{ d: schritte(s, hoehe - 1, s).map((y) => xs.map((x) => `M${r(x)} ${r(y)}h0`).join('')).join(''), staerke: 'punkt' }]
  }
  if (art === 'millimeter') {
    const ys = (n: number, ausser?: (i: number) => boolean) => schritte(0, hoehe, n * MM, ausser)
    const xs = (n: number, ausser?: (i: number) => boolean) => schritte(0, SEITE_BREITE, n * MM, ausser)
    return [
      { d: waagerecht(ys(1, (i) => i % 5 === 0)) + senkrecht(xs(1, (i) => i % 5 === 0), hoehe), staerke: 'fein' },
      { d: waagerecht(ys(5, (i) => i % 2 === 0)) + senkrecht(xs(5, (i) => i % 2 === 0), hoehe), staerke: 'mittel' },
      { d: waagerecht(ys(10)) + senkrecht(xs(10), hoehe), staerke: 'kraeftig' }
    ]
  }
  if (art === 'noten') {
    // 12 Systeme auf eine A4-Seite: oben 20 mm Rand, dann alle 22,5 mm ein System aus fünf Linien im Abstand 2 mm
    const ys: number[] = []
    const seiten = Math.round((format / A4) * 100) / 100
    for (let s = 0; s < Math.ceil(seiten - 0.01); s++) {
      const oben = s * SEITE_BREITE * A4
      for (let k = 0; k < 12; k++) {
        const y0 = oben + 20 * MM + k * 22.5 * MM
        if (y0 + 8 * MM > hoehe) break
        for (let l = 0; l < 5; l++) ys.push(y0 + l * 2 * MM)
      }
    }
    return [{ d: waagerecht(ys, 12 * MM, SEITE_BREITE - 12 * MM), staerke: 'mittel' }]
  }
  return []
}

/** A4 in PDF-Punkten (1/72 Zoll) */
const PDF_B = 595.28
const PDF_H = 841.89
const PDF_TON = { fein: '0.82 0.79 0.9', mittel: '0.7 0.66 0.83', kraeftig: '0.58 0.53 0.75', punkt: '0.66 0.62 0.8' } as const
const PDF_STAERKE = { fein: 0.3, mittel: 0.45, kraeftig: 0.7, punkt: 1.1 } as const

/** Pfad der Lineatur (M, H, V, h0) in PDF-Zeichenbefehle; y läuft im PDF von unten nach oben */
function pdfLinien(d: string): string {
  const k = PDF_B / SEITE_BREITE
  const p = (n: number) => String(Math.round(n * k * 100) / 100)
  const y = (n: number) => String(Math.round((PDF_H - n * k) * 100) / 100)
  let out = ''
  for (const m of d.matchAll(/M([\d.]+) ([\d.]+)(H|V|h)([\d.]+)/g)) {
    const x0 = Number(m[1])
    const y0 = Number(m[2])
    const w = Number(m[4])
    const [x1, y1] = m[3] === 'H' ? [w, y0] : m[3] === 'V' ? [x0, w] : [x0 + w, y0]
    out += `${p(x0)} ${y(y0)} m ${p(x1)} ${y(y1)} l\n`
  }
  return out
}

/** PDF-Textzeichenkette in UTF-16 als Hex, damit Umlaute im Titel ankommen und die Datei reines ASCII bleibt */
function pdfText(s: string): string {
  let hex = 'FEFF'
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${hex}>`
}

/**
 * Leeres PDF (A4 hoch) mit Lineatur auf jeder Seite, als ASCII-Text. Alle Seiten teilen sich denselben Inhalt,
 * deshalb bleiben auch 100 Seiten wenige Kilobyte groß. Grundlage für ein Heft ohne eigenes PDF (Buch auf Papier).
 */
export function leeresPdf(seiten: number, lineatur: Lineatur, titel = ''): string {
  const n = Math.max(1, Math.min(500, Math.round(seiten)))
  const inhalt =
    lineaturSchichten(lineatur, A4)
      .map((s) => `${PDF_TON[s.staerke]} RG ${PDF_STAERKE[s.staerke]} w ${s.staerke === 'punkt' ? 1 : 0} J\n${pdfLinien(s.d)}S\n`)
      .join('') || '% leer\n'
  const objekte: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '', // Seitenbaum, unten gefüllt
    `<< /Length ${inhalt.length} >>\nstream\n${inhalt}endstream`,
    `<< /Title ${pdfText(titel)} /Producer (RespawnedLearn) >>`
  ]
  const kinder: string[] = []
  for (let i = 0; i < n; i++) {
    objekte.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_B} ${PDF_H}] /Contents 3 0 R /Resources << >> >>`)
    kinder.push(`${objekte.length} 0 R`)
  }
  objekte[1] = `<< /Type /Pages /Kids [${kinder.join(' ')}] /Count ${n} >>`
  let out = '%PDF-1.4\n'
  const versatz: number[] = []
  objekte.forEach((o, i) => {
    versatz.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n${versatz.map((v) => `${String(v).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return out
}

/**
 * Bild auf einem Blatt: ein Foto (Kamera, Galerie, Einfügen) oder ein Ausschnitt aus einem PDF. Gespeichert wird nur
 * der Verweis, das Foto bzw. PDF bleibt unverändert in anhaenge/. Lage und Größe in Seitenkoordinaten (Breite 1000).
 */
export interface BlattBild {
  id: string
  /** auf welchem Blatt der Seite */
  blatt: string
  /** Sidecar-ID des Fotos oder PDFs */
  anhang: string
  /** nur bei PDFs: Seite und Bereich (Anteile der Seite) des Ausschnitts */
  seite?: number
  bereich?: Bereich
  x: number
  y: number
  b: number
  h: number
}

const zahl = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const anteil = (n: unknown) => zahl(n) && n >= 0 && n <= 1

export function liesBilder(text: string | null | undefined): BlattBild[] {
  let roh: unknown
  try {
    roh = text ? JSON.parse(text) : null
  } catch {
    return []
  }
  const liste = roh && typeof roh === 'object' && Array.isArray((roh as { bilder?: unknown }).bilder) ? (roh as { bilder: Partial<BlattBild>[] }).bilder : []
  const out: BlattBild[] = []
  for (const b of liste) {
    if (!b || typeof b.blatt !== 'string') continue
    const bild = bildAus(b)
    if (bild) out.push({ ...bild, blatt: b.blatt })
  }
  return out
}

/** Prüft ein Bild (Lage, Größe, Ausschnitt); das Feld `blatt` prüft der Aufrufer. Auch für Notizbücher (buecher.ts). */
export function bildAus(b: Partial<BlattBild> | null | undefined): Omit<BlattBild, 'blatt'> | null {
  if (!b || typeof b.id !== 'string' || typeof b.anhang !== 'string') return null
  if (![b.x, b.y, b.b, b.h].every(zahl) || b.b! <= 0 || b.h! <= 0) return null
  const bild: Omit<BlattBild, 'blatt'> = { id: b.id, anhang: b.anhang, x: b.x!, y: b.y!, b: b.b!, h: b.h! }
  if (b.seite !== undefined || b.bereich !== undefined) {
    const r = b.bereich
    if (!zahl(b.seite) || b.seite < 1 || !r || ![r.x, r.y, r.b, r.h].every(anteil)) return null
    bild.seite = b.seite
    bild.bereich = { x: r.x, y: r.y, b: r.b, h: r.h }
  }
  return bild
}

export function bilderJson(bilder: BlattBild[]): string {
  const r = (n: number) => Math.round(n * 10) / 10
  const k = (n: number) => Math.round(n * 10000) / 10000
  return (
    JSON.stringify({
      bilder: bilder.map((b) => ({
        ...b,
        x: r(b.x),
        y: r(b.y),
        b: r(b.b),
        h: r(b.h),
        ...(b.bereich ? { bereich: { x: k(b.bereich.x), y: k(b.bereich.y), b: k(b.bereich.b), h: k(b.bereich.h) } } : {})
      }))
    }) + '\n'
  )
}

/** Rand links/oben und Abstand zwischen Bildern, in Seitenkoordinaten (etwa 10 mm) */
const BILD_RAND = 48

/**
 * Platz für ein neues Bild auf einem Blatt: unter dem untersten Bild dieses Blatts, sonst oben. Breit wie 70 % des
 * Blatts, bei hohen Bildern schmaler (höchstens eine A4-Höhe). Liefert auch das Format, das das Blatt dafür braucht.
 */
export function platzFuerBild(bilder: BlattBild[], blatt: string, verhaeltnis: number, format: number): { x: number; y: number; b: number; h: number; format: number } {
  const v = zahl(verhaeltnis) && verhaeltnis > 0 ? verhaeltnis : 0.75
  let b = 700
  let h = b * v
  const maxH = SEITE_BREITE * A4 - 2 * BILD_RAND
  if (h > maxH) {
    h = maxH
    b = h / v
  }
  const unten = Math.max(0, ...bilder.filter((x) => x.blatt === blatt).map((x) => x.y + x.h))
  const y = unten ? unten + BILD_RAND / 2 : BILD_RAND
  let f = format
  while (SEITE_BREITE * f < y + h + BILD_RAND / 2) f += A4
  return { x: BILD_RAND, y, b, h, format: f }
}

/** Bild verschieben oder vergrößern, ohne dass es das Blatt verlässt; das Seitenverhältnis bleibt */
export function rueckeBild(bild: BlattBild, x: number, y: number, b: number, format: number): BlattBild {
  const breite = Math.min(SEITE_BREITE, Math.max(60, b))
  const h = (bild.h / bild.b) * breite
  const hoehe = SEITE_BREITE * format
  return { ...bild, b: breite, h, x: Math.min(SEITE_BREITE - breite, Math.max(0, x)), y: Math.min(Math.max(0, hoehe - h), Math.max(0, y)) }
}
