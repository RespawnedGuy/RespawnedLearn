// Randmarken im Notizbuch (Vertrag Lernen 1.3, 5.3): Beim Schreiben merkt sich die Buchseite, welche Skriptseite
// gerade offen war. Eine Marke entsteht nur, wenn sich der Zusammenhang ändert, nicht nach Uhr. Dazu der Rückweg:
// welche Buchstellen auf eine Skriptseite zeigen („✎ 2“).

import { liesBuchSeite, type Verweis } from './buecher'
import type { Strich } from './tinte'

/** Eine Zeile im Buch (8 mm, wie die Linien), in Seitenkoordinaten (Breite 1000) */
export const ZEILE = 38

/** Wohin geschrieben wird: die Skriptseite, die gerade offen ist */
export interface Ziel {
  anhang: string
  seite: number
}

/** Senkrechte Ausdehnung eines Strichs */
export interface StrichLage {
  oben: number
  unten: number
}

export function strichLage(s: Pick<Strich, 'punkte'>): StrichLage {
  let oben = Infinity
  let unten = -Infinity
  for (const [, y] of s.punkte) {
    if (y < oben) oben = y
    if (y > unten) unten = y
  }
  return Number.isFinite(oben) ? { oben, unten } : { oben: 0, unten: 0 }
}

const automatisch = (v: Verweis) => !v.marke

/**
 * Automatische Marken, unter denen bis zur nächsten Marke kein Strich mehr steht, fallen weg (sie sind abgeleitet,
 * keine Nutzereingabe). Marken aus Markierungen bleiben immer.
 */
export function ohneVerwaiste(verweise: Verweis[], striche: StrichLage[]): Verweis[] {
  const sortiert = [...verweise].sort((a, b) => a.y - b.y)
  return sortiert.filter((v, i) => {
    if (!automatisch(v)) return true
    const bis = sortiert[i + 1]?.y ?? Infinity
    return striche.some((s) => s.unten >= v.y - ZEILE && s.oben < bis)
  })
}

const gleicheSeite = (a: { anhang: string; seite: number }, b: { anhang: string; seite: number }) => a.anhang === b.anhang && a.seite === b.seite

/**
 * Höchstens eine automatische Marke je Skriptseite auf einer Buchseite (Nils 2026-11-15): Von doppelten bleibt die
 * oberste. Marken aus Markierungen bleiben alle.
 */
export function ohneDoppelte(verweise: Verweis[]): Verweis[] {
  const sortiert = [...verweise].sort((a, b) => a.y - b.y)
  return sortiert.filter((v, i) => !automatisch(v) || !sortiert.slice(0, i).some((w) => automatisch(w) && gleicheSeite(v, w)))
}

/**
 * Regel beim Absetzen eines Strichs: Hat die Buchseite schon eine automatische Marke für die offene Skriptseite,
 * bleibt alles, wie es ist (eine je Skriptseite, egal wo darauf geschrieben wird). Sonst entsteht eine Marke auf Höhe
 * des Strichanfangs; liegt dort schon eine (unter einer Zeile Abstand), rückt die neue nach unten. Ohne Ziel (kein
 * Skript offen) entsteht keine Marke. Doppelte und verwaiste automatische Marken fallen dabei weg.
 *
 * @param striche alle Striche der Buchseite, der neue eingeschlossen
 * @param anfang Höhe, an der der neue Strich begann
 * @returns die neuen Verweise der Seite, oder null, wenn sich nichts ändert
 */
export function verweiseBeimSchreiben(
  verweise: Verweis[],
  striche: StrichLage[],
  anfang: number,
  ziel: Ziel | null,
  neu: { id: string; am: string }
): Verweis[] | null {
  const bleiben = ohneVerwaiste(ohneDoppelte(verweise), striche)
  const geaendert = bleiben.length !== verweise.length
  if (!ziel) return geaendert ? bleiben : null
  if (bleiben.some((v) => automatisch(v) && gleicheSeite(v, ziel))) return geaendert ? bleiben : null
  let y = Math.max(0, anfang)
  for (const v of bleiben) if (Math.abs(v.y - y) < ZEILE) y = v.y + ZEILE
  return [...bleiben, { id: neu.id, y, anhang: ziel.anhang, seite: ziel.seite, am: neu.am }].sort((a, b) => a.y - b.y)
}

/** Eine Skriptseite in der Blase oben auf der Buchseite, mit der obersten Stelle, die auf sie zeigt */
export interface BlasenSeite {
  anhang: string
  seite: number
  y: number
}

/** Die Skriptseiten, auf die eine Buchseite beim Schreiben zeigt: je Seite einmal, ohne ✦-Marken, nach Skript und Seite */
export function seitenDerBuchseite(verweise: Verweis[]): BlasenSeite[] {
  return ohneDoppelte(verweise)
    .filter(automatisch)
    .map(({ anhang, seite, y }) => ({ anhang, seite, y }))
    .sort((a, b) => a.anhang.localeCompare(b.anhang) || a.seite - b.seite)
}

/** Aufschrift der Blase: „S. 28“, „S. 27–29“, „S. 3, 40“, sonst „n Seiten“ */
export function seitenBlase(seiten: BlasenSeite[]): string {
  if (!seiten.length) return ''
  const n = seiten.length
  if (new Set(seiten.map((s) => s.anhang)).size > 1) return `${n} Seiten`
  const erste = seiten[0].seite
  const letzte = seiten[n - 1].seite
  if (n === 1) return `S. ${erste}`
  if (letzte - erste === n - 1) return `S. ${erste}–${letzte}`
  if (n === 2) return `S. ${erste}, ${letzte}`
  return `${n} Seiten`
}

/** Eine Stelle im Buch, die auf eine Skriptseite zeigt */
export interface Rueckweg {
  buch: string
  nr: number
  y: number
  marke: boolean
}

const SEITE_JSON = /^lernen\/buecher\/([0-9A-HJKMNP-TV-Z]{26})\/S(\d{3,})\.json$/

/**
 * Rückweg vom Skript ins Buch: je Skriptseite die Buchstellen, die auf sie zeigen. Wird aus den Seitendateien im
 * Arbeitsspeicher berechnet, es gibt keinen eigenen Index im Ordner.
 */
export function rueckwege(dateien: Iterable<string>, text: (pfad: string) => string | null | undefined, anhang: string): Map<number, Rueckweg[]> {
  const out = new Map<number, Rueckweg[]>()
  const suche = `"anhang":"${anhang}"`
  for (const p of dateien) {
    const m = SEITE_JSON.exec(p)
    if (!m) continue
    const t = text(p)
    if (!t || !t.includes(suche)) continue
    // doppelte automatische Marken (bis v0.30.0) zählen je Buchseite einmal
    for (const v of ohneDoppelte(liesBuchSeite(t).verweise)) {
      if (v.anhang !== anhang) continue
      const liste = out.get(v.seite) ?? []
      liste.push({ buch: m[1], nr: Number(m[2]), y: v.y, marke: !!v.marke })
      out.set(v.seite, liste)
    }
  }
  for (const l of out.values()) l.sort((a, b) => a.buch.localeCompare(b.buch) || a.nr - b.nr || a.y - b.y)
  return out
}

/** Abstand zum Seitenrand und unter der letzten Zeile, wie bei den Bildern auf den Blättern */
const RAND = 48

/**
 * Platz für den Ausschnitt einer Markierung (Vertrag Lernen 1.3, 5.3): unter der letzten Zeile der Buchseite, also
 * unter dem untersten Strich und dem untersten Bild. Die Breite folgt der Breite im Skript (beide Seiten sind 1000
 * breit), damit Schrift im Ausschnitt so groß bleibt wie im Skript.
 *
 * @param verhaeltnis Höhe/Breite des Ausschnitts
 * @param format Höhe/Breite der Buchseite
 * @returns Lage des Bilds, oder null, wenn es auf dieser Seite keinen Platz mehr hat (dann oben auf die nächste)
 */
export function platzFuerMarkierung(
  bilder: { y: number; h: number }[],
  striche: StrichLage[],
  breiteImSkript: number,
  verhaeltnis: number,
  format: number
): { x: number; y: number; b: number; h: number } | null {
  const v = Number.isFinite(verhaeltnis) && verhaeltnis > 0 ? verhaeltnis : 0.5
  const hoehe = 1000 * format
  let b = Math.min(1000 - 2 * RAND, Math.max(240, (Number.isFinite(breiteImSkript) ? breiteImSkript : 0.7) * 1000))
  let h = b * v
  if (h > hoehe - 2 * RAND) {
    h = hoehe - 2 * RAND
    b = h / v
  }
  const unten = Math.max(0, ...bilder.map((x) => x.y + x.h), ...striche.map((s) => s.unten))
  const y = unten ? unten + RAND / 2 : RAND
  if (y + h > hoehe - RAND / 2) return null
  return { x: RAND, y, b, h }
}
