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

/** Lesestelle im scrollenden Skript: Seite an der Oberkante der Sicht und wie weit sie schon nach oben hinaus ist (0 … 1) */
export interface Anker {
  nr: number
  anteil: number
}

/**
 * Anker an der Oberkante der Sicht: die Seite, die `sichtOben` schneidet, sonst die erste darunter (Abstand zwischen
 * den Seiten). Ändert sich die Breite, bleiben Seite und Anteil gleich, die Pixel nicht; darum merkt sich das Skript
 * den Anker und nicht die Scrollposition.
 */
export function ankerBei(seiten: SeitenLage[], sichtOben: number): Anker | null {
  let unter: SeitenLage | null = null
  for (const s of seiten) {
    const hoehe = s.unten - s.oben
    if (hoehe <= 0) continue
    if (s.oben <= sichtOben && sichtOben < s.unten) return { nr: s.nr, anteil: (sichtOben - s.oben) / hoehe }
    if (s.oben > sichtOben && (!unter || s.oben < unter.oben)) unter = s
  }
  return unter ? { nr: unter.nr, anteil: 0 } : null
}

/** Um wie viele Pixel gescrollt werden muss, damit der Anker wieder an `sichtOben` steht (positiv = nach unten) */
export function ankerVersatz(seite: SeitenLage, anker: Anker, sichtOben: number): number {
  return seite.oben + anker.anteil * (seite.unten - seite.oben) - sichtOben
}
