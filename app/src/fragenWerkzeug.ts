// PDF-Text über pdf.js und die eingerichtete KI für das Erzeugen von Kapitelfragen und Vorfragen. Ein Lauf zur Zeit:
// mehrfaches Drücken (auch aus zwei Ansichten) startet keine zweite Runde Anfragen.
import { seitenText, seitenzahl, type Speicher } from '@rl/oberflaeche'
import { erzeugeKapitelfragen, erzeugeVorfragen, type Ergebnis, type Fortschritt, type Werkzeug } from './fragenErzeugen'
import { kiFrage, modellKennung } from './kianbieter/frage'

export function werkzeugFuer(speicher: Speicher): Werkzeug {
  return {
    seitenText: (pfad, von, bis) => seitenText(speicher, pfad, von, bis),
    seitenzahl: (pfad) => seitenzahl(speicher, pfad),
    frage: <T>(aufgabe: Parameters<Werkzeug['frage']>[0], a: Parameters<Werkzeug['frage']>[1]) => kiFrage<T>(speicher, aufgabe, a),
    modell: modellKennung
  }
}

let kapitelLauf: Promise<Ergebnis> | null = null
const zuhoerer = new Set<Fortschritt>()

/** Kapitelfragen erzeugen; läuft schon ein Lauf, hängt sich der Aufruf an ihn an */
export function kapitelfragenJetzt(speicher: Speicher, melde: Fortschritt): Promise<Ergebnis> {
  zuhoerer.add(melde)
  kapitelLauf ??= erzeugeKapitelfragen(speicher, werkzeugFuer(speicher), (m) => zuhoerer.forEach((z) => z(m))).finally(() => {
    kapitelLauf = null
    zuhoerer.clear()
  })
  return kapitelLauf
}

export const kapitelfragenLaufen = () => !!kapitelLauf

let vorfragenLauf: ReturnType<typeof erzeugeVorfragen> | null = null
export function vorfragenJetzt(speicher: Speicher, neu: boolean): ReturnType<typeof erzeugeVorfragen> {
  vorfragenLauf ??= erzeugeVorfragen(speicher, werkzeugFuer(speicher), { neu }).finally(() => (vorfragenLauf = null))
  return vorfragenLauf
}
