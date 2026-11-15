// Markierter Text der Mitschrift → Baustein (Vertrag Lernen 1.10, 5.4). Dasselbe Menü wie nach dem Rechteck im Skript
// und im Buch (BausteinMenue): Name mit #Schlagworten, Baustein und Lernkarte als Symbole.
import { useState } from 'react'
import { Dialog } from '@rl/oberflaeche'
import { BausteinMenue } from './BausteinMenue'
import type { KartenStelle } from './mitschriftEditor'

export function MitschriftBaustein({
  stelle,
  onBaustein,
  onLernkarte,
  onZu
}: {
  stelle: KartenStelle
  onBaustein: (name: string) => void
  onLernkarte: (name: string) => void
  onZu: () => void
}) {
  const [name, setName] = useState('')
  return (
    <Dialog titel="Baustein" onZu={onZu}>
      {stelle.abschnitt.length > 0 && <div className="klein-leise">{stelle.abschnitt.join(' › ')}</div>}
      <blockquote className="mitschrift-zitat">{stelle.antwort.length > 280 ? `${stelle.antwort.slice(0, 280)} …` : stelle.antwort}</blockquote>
      <div className="schwebe-inhalt">
        <BausteinMenue
          name={name}
          onName={setName}
          onBaustein={() => onBaustein(name)}
          onLernkarte={() => onLernkarte(name)}
          onAbbrechen={onZu}
          bausteinTitel="Baustein: findet sich mit den Bausteinen aus Skripten und Büchern wieder"
        />
      </div>
    </Dialog>
  )
}
