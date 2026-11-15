// Halten packt an (Nils 2026-11-15): Klicken und Halten verschiebt eine Markierung (im Werkzeug Markieren) und löscht mit
// dem Radierer. Damit kein Tippen, Scrollen oder Darüberstreichen etwas auslöst, zählt das Halten nur, wenn der Zeiger
// fast still auf dem Ziel bleibt, bis die Zeit um ist. Rein gerechnet aus Zeitpunkten und Punkten, ohne Uhr.

/** Halten bis zum Anheben (Verschieben) */
export const ANHEBEN_MS = 400
/** Halten bis zum Löschen */
export const LOESCHEN_MS = 1000
/** Erst ab hier erscheint der Kreis, damit ein kurzes Tippen nicht aufblitzt */
export const RING_AB_MS = 150
/** Weiter als so viele Bildpunkte bewegt, ist es kein Halten mehr, sondern Ziehen oder Radieren */
export const ZITTERN_PX = 8

export interface Halten {
  /** Zeitpunkt des Drucks in ms */
  start: number
  x: number
  y: number
  /** ANHEBEN_MS oder LOESCHEN_MS */
  dauer: number
}

export type HaltenStand =
  /** `rest` läuft von 1 auf 0 (der Kreis leert sich); `ring` erst ab RING_AB_MS */
  | { art: 'laeuft'; rest: number; ring: boolean }
  | { art: 'fertig' }
  /** zu weit bewegt: Der Druck gehört jetzt dem Werkzeug (Rechteck aufziehen, radieren) */
  | { art: 'bewegt' }

export function starteHalten(start: number, x: number, y: number, dauer: number): Halten {
  return { start, x, y, dauer }
}

export const zuWeit = (h: Pick<Halten, 'x' | 'y'>, x: number, y: number) => Math.hypot(x - h.x, y - h.y) > ZITTERN_PX

/** Stand zum Zeitpunkt `jetzt` mit dem Zeiger bei (x, y) */
export function haltenStand(h: Halten, jetzt: number, x: number, y: number): HaltenStand {
  if (zuWeit(h, x, y)) return { art: 'bewegt' }
  const vergangen = Math.max(0, jetzt - h.start)
  if (vergangen >= h.dauer) return { art: 'fertig' }
  return { art: 'laeuft', rest: 1 - vergangen / h.dauer, ring: vergangen >= RING_AB_MS }
}
