// Welche Funktionen die Funktionsleiste (Stil „Linie“) außerhalb von Skript und Buch zeigt. Skript und Buch bringen
// ihre Werkzeuge selbst mit (Werkzeugleiste). Rein, damit die Belegung ohne Oberfläche testbar ist.
import type { PlusZiel } from './plus'

export interface LeistenFunktion {
  id: string
  titel: string
  symbol: string
  /** Wohin die Funktion führt (Adresse) oder was sie tut */
  ziel: string | (() => void)
  aktiv?: boolean
  hinweis?: string
}

/** Lernen: die Runde (auch die Runde eines Moduls) und alle Karten. Nur im Bereich Lernen. */
export function lernFunktionen(ort: string[]): LeistenFunktion[] {
  if (ort[0] !== 'lernen') return []
  const alle = ort[1] === 'alle'
  return [
    { id: 'runde', titel: 'Runde', symbol: 'runde', ziel: '#/lernen', aktiv: !alle },
    { id: 'alle', titel: 'Alle Karten', symbol: 'karten', ziel: '#/lernen/alle', aktiv: alle }
  ]
}

/** Mitschrift: was bisher hinter dem „+“ lag. Handlungen, darum ohne `aktiv`. */
export function mitschriftFunktionen(plus: PlusZiel | null): LeistenFunktion[] {
  if (!plus) return []
  return [
    { id: 'lernkarte', titel: 'Lernkarte', symbol: 'lernkarte', ziel: () => plus.lernkarte(), hinweis: 'Nimmt den markierten Text, sonst den Absatz am Cursor' },
    { id: 'kamera', titel: 'Kamera', symbol: 'kamera', ziel: () => plus.kamera() },
    { id: 'foto', titel: 'Foto', symbol: 'foto', ziel: () => plus.foto() }
  ]
}
