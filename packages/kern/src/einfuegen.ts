// Kopieren und Einfügen (Vertrag Lernen 1.12, 5.3): Eine markierte Stelle aus Skript oder Notizbuch wird als Ausschnitt
// mit ✦-Marke an eine angetippte Stelle einer Buchseite gelegt. Die Ablage selbst lebt nur im Arbeitsspeicher des
// Geräts; gespeichert wird erst das Eingefügte, als Bild und Verweis wie beim Markieren (Lernen 1.5).
import type { Bereich } from './marken'
import type { BuchBild, BuchSeite, Verweis } from './buecher'
import { SEITE_BREITE } from './tinte'

/** Was in der Ablage liegt: eine gespeicherte Markierung und wie ihr Ausschnitt aussieht */
export interface Kopie {
  /** Skript (Anhang) oder Notizbuch, in dessen Markierungsdatei die Zeile steht */
  anhang: string
  /** Skript- bzw. Buchseite */
  seite: number
  /** wie in der Markierungszeile: im Skript Anteile der Seite, im Buch Seitenbreiten (5.4) */
  bereich: Bereich
  marke: string
  /** Höhe durch Breite des Ausschnitts, wie er zu sehen ist */
  verhaeltnis: number
}

/** Kleinste Breite eines eingefügten Ausschnitts (Seitenkoordinaten), damit er sich noch greifen lässt */
export const EINFUEGEN_MIN = 120

/** Breite, mit der eine Kopie ohne aufgezogenes Rechteck eingefügt wird: so breit wie an ihrer Quelle */
export function natuerlicheBreite(k: Kopie): number {
  return Math.min(SEITE_BREITE, Math.max(EINFUEGEN_MIN, k.bereich.b * SEITE_BREITE))
}

/**
 * Lage auf der Buchseite: oben links am angetippten Punkt (`ort` in Seitenkoordinaten, Breite 1000). Mit `ort.b`
 * (aufgezogenes Rechteck) so breit wie das Rechteck. Passt der Ausschnitt nicht, rückt er nach links bzw. oben und
 * wird, wenn nötig, kleiner, bis er ganz auf der Seite liegt.
 */
export function lageBeimEinfuegen(k: Kopie, ort: { x: number; y: number; b?: number }, format: number): { x: number; y: number; b: number; h: number } {
  const v = Number.isFinite(k.verhaeltnis) && k.verhaeltnis > 0 ? k.verhaeltnis : 0.75
  const hoehe = SEITE_BREITE * format
  let b = ort.b !== undefined && ort.b >= EINFUEGEN_MIN / 2 ? Math.min(SEITE_BREITE, Math.max(EINFUEGEN_MIN / 2, ort.b)) : natuerlicheBreite(k)
  if (b * v > hoehe) b = hoehe / v
  const h = b * v
  const x = Math.min(SEITE_BREITE - b, Math.max(0, ort.x))
  const y = Math.min(hoehe - h, Math.max(0, ort.y))
  return { x, y, b, h }
}

/** Die Kopie auf die Seite legen: Ausschnitt plus ✦-Verweis, der über `bild` zu ihm gehört */
export function legeEin(
  s: BuchSeite,
  k: Kopie,
  ort: { x: number; y: number; b?: number },
  format: number,
  ids: { bild: string; verweis: string },
  am: string
): { seite: BuchSeite; bild: BuchBild; verweis: Verweis } {
  const lage = lageBeimEinfuegen(k, ort, format)
  const bild: BuchBild = { id: ids.bild, anhang: k.anhang, seite: k.seite, bereich: { ...k.bereich }, ...lage }
  const verweis: Verweis = { id: ids.verweis, y: lage.y, anhang: k.anhang, seite: k.seite, marke: k.marke, bild: ids.bild, am }
  return { seite: { ...s, bilder: [...s.bilder, bild], verweise: [...s.verweise, verweis] }, bild, verweis }
}
