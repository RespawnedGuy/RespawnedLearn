// Markierter Text der Mitschrift → Baustein (Vertrag Lernen 1.10, 5.4). Dasselbe Menü wie nach dem Rechteck im Skript
// und im Buch (BausteinMenue): Name mit #Schlagworten, „Baustein“, „Lernkarte“, „…“ → Verlinken.
import { useState } from 'react'
import type { Eintrag } from '@rl/kern'
import { Dialog } from '@rl/oberflaeche'
import { BausteinMenue, Verlinken } from './BausteinMenue'
import type { KartenStelle } from './mitschriftEditor'

export function MitschriftBaustein({
  stelle,
  onBaustein,
  onLernkarte,
  onVerlinken,
  onZu
}: {
  stelle: KartenStelle
  onBaustein: (name: string) => void
  onLernkarte: (name: string) => void
  onVerlinken: (name: string, karte: Eintrag) => void
  onZu: () => void
}) {
  const [name, setName] = useState('')
  const [link, setLink] = useState(false)
  return (
    <Dialog titel="Baustein" onZu={onZu}>
      {stelle.abschnitt.length > 0 && <div className="klein-leise">{stelle.abschnitt.join(' › ')}</div>}
      <blockquote className="mitschrift-zitat">{stelle.antwort.length > 280 ? `${stelle.antwort.slice(0, 280)} …` : stelle.antwort}</blockquote>
      <div className="schwebe-inhalt">
        {link ? (
          <Verlinken onWahl={(k) => onVerlinken(name, k)} onZurueck={() => setLink(false)} />
        ) : (
          <BausteinMenue
            name={name}
            onName={setName}
            onBaustein={() => onBaustein(name)}
            onLernkarte={() => onLernkarte(name)}
            onAbbrechen={onZu}
            bausteinTitel="Als Baustein merken: findet sich mit den Bausteinen aus Skripten und Büchern wieder"
            mehr={
              <button type="button" className="knopf klein" onClick={() => setLink(true)}>
                Verlinken
              </button>
            }
          />
        )}
      </div>
    </Dialog>
  )
}
