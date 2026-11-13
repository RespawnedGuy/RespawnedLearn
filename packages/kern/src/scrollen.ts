// Skript scrollt durchgehend (Konzept Notizbücher, Schritt 1): Welche Seite gilt als „die offene“? Die mit dem größten
// sichtbaren Anteil. Rein, damit Übungsplatz, Lesestand und später die Randmarken dieselbe Regel nutzen.

export interface SeitenLage {
  nr: number
  /** Ober- und Unterkante in denselben Koordinaten wie die Sicht (z. B. Pixel relativ zum Fenster) */
  oben: number
  unten: number
}

/**
 * Seite mit dem größten sichtbaren Stück zwischen `sichtOben` und `sichtUnten`. Bei Gleichstand gewinnt die
 * obere, weil man von oben nach unten liest. null, wenn keine Seite sichtbar ist.
 */
export function sichtbareSeite(seiten: SeitenLage[], sichtOben: number, sichtUnten: number): number | null {
  let beste: number | null = null
  let besterAnteil = 0
  for (const s of seiten) {
    const anteil = Math.min(s.unten, sichtUnten) - Math.max(s.oben, sichtOben)
    if (anteil > besterAnteil || (anteil === besterAnteil && anteil > 0 && beste !== null && s.nr < beste)) {
      beste = s.nr
      besterAnteil = anteil
    }
  }
  return beste
}

/** Nächste Seite beim Blättern mit Tasten: innerhalb 1 … seiten, ohne bekannte Seitenzahl nur nach unten begrenzt */
export function naechsteSeite(aktuell: number, richtung: -1 | 1, seiten: number): number {
  const ziel = aktuell + richtung
  return Math.max(1, seiten > 0 ? Math.min(seiten, ziel) : ziel)
}
