// Leuchtende Kontur des Daumenmenüs: läuft unten um die Pille herum (von der Mitte der linken Rundung bis zur Mitte
// der rechten) und wölbt sich über dem aktiven Ziel bis an den oberen Rand. Der Pfad besteht immer aus gleich vielen
// Punkten, nur ihre Höhe ändert sich; so kann CSS ihn (Eigenschaft `d`) weich zum neuen Ziel gleiten lassen.
// Ohne aktives Ziel bleibt die Wölbung flach. Auch am Rand stimmt die Form: Dort läuft die Wölbung in der Rundung aus.

/** Halbe Breite der Wölbung (px) und ihr flaches Stück oben (Anteil) */
export const WOELBUNG = 62
const PLATEAU = 0.12
/** Punkte je Pfad: genug für eine glatte Linie, fest, damit der Übergang greift */
export const PUNKTE = 145

const z = (n: number) => Math.round(n * 10) / 10

/** Höhe des unteren Rands der Pille an der Stelle t (Rundung links und rechts, dazwischen gerade) */
function grund(t: number, breite: number, unten: number, r: number): number {
  const mitteY = unten - r
  const d = t < r ? r - t : t > breite - r ? t - (breite - r) : 0
  return mitteY + Math.sqrt(Math.max(0, r * r - d * d))
}

/**
 * Anteil der Wölbung an der Stelle t (1 oben, 0 am Rand): oben kurz flach, zu den Seiten weich (smoothstep) auslaufend.
 * Nahe am Pillenrand wird die äußere Seite schmaler, damit die Wölbung in der Rundung ausläuft statt einen Knick zu machen.
 */
function anteil(t: number, mitte: number, breite: number): number {
  const w = t < mitte ? Math.min(WOELBUNG, mitte) : Math.min(WOELBUNG, breite - mitte)
  const p = w * PLATEAU
  const u = Math.min(1, Math.max(0, (Math.abs(t - mitte) - p) / Math.max(1, w - p)))
  return 1 - u * u * (3 - 2 * u)
}

/**
 * Pfad der Linie und der leicht gefüllten Fläche unter der Wölbung.
 * `breite`, `hoehe`: Größe der Pille; `mitte`: Mitte des aktiven Ziels oder null.
 * `rund = false`: gerade am unteren Rand entlang, ohne den Rundungen zu folgen (seitlich scrollende Leiste).
 */
export function daumenKontur(breite: number, hoehe: number, mitte: number | null, rund = true): { linie: string; flaeche: string } {
  const unten = hoehe - 1
  const oben = 1.5
  const r = hoehe / 2
  const xs = Array.from({ length: PUNKTE }, (_, i) => (breite * i) / (PUNKTE - 1))
  const linie = xs.map((t) => {
    const s = mitte === null ? 0 : anteil(t, mitte, breite)
    // Wölbung nah am Rand: die äußere Seite steigt direkt aus der Mitte der Rundung auf, ohne erst nach unten zu tauchen
    const amRand = rund && mitte !== null && (t < mitte ? mitte < WOELBUNG : breite - mitte < WOELBUNG)
    const g = !rund ? unten : amRand ? unten - r : grund(t, breite, unten, r)
    return [t, g - (g - oben) * s] as const
  })
  const rueck = [...xs].reverse().map((t) => [t, rund ? grund(t, breite, unten, r) : unten] as const)
  const pfad = (p: readonly (readonly [number, number])[]) => p.map(([x, y], i) => `${i ? 'L' : 'M'} ${z(x)} ${z(y)}`).join(' ')
  return { linie: pfad(linie), flaeche: `${pfad(linie)} ${pfad(rueck).replace(/^M/, 'L')} Z` }
}
