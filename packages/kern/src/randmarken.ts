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

/**
 * Regel beim Absetzen eines Strichs: Zeigt die nächste Marke oberhalb des Strichanfangs auf dieselbe Skriptseite,
 * bleibt alles, wie es ist. Sonst entsteht eine Marke auf Höhe des Strichanfangs; liegt dort schon eine (unter einer
 * Zeile Abstand), rückt die neue nach unten. Ohne Ziel (kein Skript offen) entsteht keine Marke.
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
  const bleiben = ohneVerwaiste(verweise, striche)
  const geaendert = bleiben.length !== verweise.length
  if (!ziel) return geaendert ? bleiben : null
  // Eine Marke, die beim letzten Mal nach unten gerückt ist, gilt für dieselbe Zeile noch als „oberhalb“
  const oberhalb = bleiben.filter((v) => v.y <= anfang + ZEILE).at(-1)
  if (oberhalb && oberhalb.anhang === ziel.anhang && oberhalb.seite === ziel.seite) return geaendert ? bleiben : null
  let y = Math.max(0, anfang)
  for (const v of bleiben) if (Math.abs(v.y - y) < ZEILE) y = v.y + ZEILE
  return [...bleiben, { id: neu.id, y, anhang: ziel.anhang, seite: ziel.seite, am: neu.am }].sort((a, b) => a.y - b.y)
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
    for (const v of liesBuchSeite(t).verweise) {
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
