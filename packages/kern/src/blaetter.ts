// Zeichenblätter neben dem Skript (Vertrag 5.3, „Blätter“): welche Ansichten nebeneinander stehen, in welcher
// Reihenfolge und Breite, und welche Lineatur ein Blatt hat. Die Tinte liegt pro Seite und Blatt als SVG daneben.

import { SEITE_BREITE } from './tinte'

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
  /** pdf = das Skript selbst, blatt = ein Zeichenblatt */
  art: 'pdf' | 'blatt'
  /** „pdf“ fürs Skript; das erste Blatt heißt „1“ (seine Tinte liegt wie früher in S001.svg) */
  id: string
  lineatur?: Lineatur
  /** Anteil an der Breite, relativ zu den anderen offenen Ansichten */
  breite: number
  /** ausgeblendet; die Tinte bleibt, die Ansicht lässt sich wieder öffnen */
  zu?: boolean
}

export interface Anordnung {
  ansichten: Ansicht[]
}

const ARTEN = new Set(LINEATUREN.map((l) => l.art))
const MIN_BREITE = 0.2
const MAX_BREITE = 20

const breiteOk = (b: unknown, sonst: number) => (typeof b === 'number' && Number.isFinite(b) ? Math.min(MAX_BREITE, Math.max(MIN_BREITE, b)) : sonst)

/** So sieht der Übungsplatz ohne eigene Anordnung aus: Skript links, ein Blatt mit Kästchen rechts (wie bisher) */
export function standardAnordnung(): Anordnung {
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
  if (!liste) return standardAnordnung()
  const ansichten: Ansicht[] = []
  const ids = new Set<string>()
  for (const a of liste) {
    if (!a || typeof a !== 'object') continue
    const art = a.art === 'pdf' ? 'pdf' : a.art === 'blatt' ? 'blatt' : null
    if (!art) continue
    const id = art === 'pdf' ? 'pdf' : typeof a.id === 'string' && /^[a-z0-9]{1,12}$/.test(a.id) ? a.id : null
    if (!id || ids.has(id)) continue
    ids.add(id)
    const v: Ansicht = { art, id, breite: breiteOk(a.breite, art === 'pdf' ? 3 : 2) }
    if (art === 'blatt') v.lineatur = a.lineatur && ARTEN.has(a.lineatur) ? a.lineatur : 'kariert'
    if (a.zu === true) v.zu = true
    ansichten.push(v)
  }
  if (!ids.has('pdf')) ansichten.unshift({ art: 'pdf', id: 'pdf', breite: 3, zu: ansichten.some((a) => !a.zu) || undefined })
  if (!ansichten.some((a) => !a.zu)) delete ansichten[0].zu
  return { ansichten }
}

export function anordnungJson(a: Anordnung): string {
  return JSON.stringify({ ansichten: a.ansichten.map((v) => ({ ...v, breite: Math.round(v.breite * 100) / 100 })) }, null, 1) + '\n'
}

export const offeneAnsichten = (a: Anordnung) => a.ansichten.filter((v) => !v.zu)

const ersetze = (a: Anordnung, id: string, f: (v: Ansicht) => Ansicht | null): Anordnung => ({
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
  return { ansichten: [...a.ansichten, { art: 'blatt', id, lineatur, breite }] }
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
  return { ansichten }
}

export function setzeBreiten(a: Anordnung, breiten: Record<string, number>): Anordnung {
  return { ansichten: a.ansichten.map((v) => (v.id in breiten ? { ...v, breite: breiteOk(breiten[v.id], v.breite) } : v)) }
}

export const setzeLineatur = (a: Anordnung, id: string, lineatur: Lineatur): Anordnung => ersetze(a, id, (v) => ({ ...v, lineatur }))

/**
 * Ansicht schließen. Ein Blatt ohne Tinte auf irgendeiner Seite verschwindet ganz; eins mit Tinte wird nur
 * ausgeblendet, damit nichts Geschriebenes verloren geht. Die letzte offene Ansicht bleibt offen.
 */
export function schliesseAnsicht(a: Anordnung, id: string, hatTinte: boolean): Anordnung {
  if (offeneAnsichten(a).length <= 1) return a
  return ersetze(a, id, (v) => (v.art === 'blatt' && !hatTinte ? null : { ...v, zu: true }))
}

/** Ausgeblendete Ansicht wieder zeigen, hinten angefügt */
export function oeffneAnsicht(a: Anordnung, id: string): Anordnung {
  const v = a.ansichten.find((x) => x.id === id)
  if (!v) return a
  const { zu: _zu, ...offen } = v
  return { ansichten: [...a.ansichten.filter((x) => x.id !== id), offen] }
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
