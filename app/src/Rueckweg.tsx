// Rückweg vom Skript ins Notizbuch (Vertrag Lernen 1.3, 5.3): Zeigen Buchstellen auf diese Skriptseite, steht oben
// auf der Seite „✎ 2“. Tippen öffnet die Stelle; bei mehreren erst eine kurze Liste.
import { useMemo, useState } from 'react'
import { rueckwege, type Rueckweg } from '@rl/kern'
import { useDaten } from '@rl/oberflaeche'

/** Alle Buchstellen je Skriptseite, neu berechnet, wenn sich Dateien ändern */
export function useRueckwege(anhang: string): Map<number, Rueckweg[]> {
  const { speicher, version } = useDaten()
  return useMemo(() => rueckwege(speicher.pfade(), (p) => speicher.text(p), anhang), [speicher, version, anhang])
}

export function RueckwegKnopf({ wege, onOeffne }: { wege: Rueckweg[]; onOeffne: (w: Rueckweg) => void }) {
  const { bestand } = useDaten()
  const [offen, setOffen] = useState(false)
  const name = (w: Rueckweg) => `${bestand.dokumente.get(w.buch)?.titel ?? 'Notizbuch'}, S. ${w.nr}${w.marke ? ' ✦' : ''}`
  const wahl = (w: Rueckweg) => {
    setOffen(false)
    onOeffne(w)
  }
  return (
    <div className="rueckweg" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={wege.length === 1 ? `Im Notizbuch öffnen: ${name(wege[0])}` : `${wege.length} Stellen in Notizbüchern`}
        aria-expanded={wege.length > 1 ? offen : undefined}
        onClick={() => (wege.length === 1 ? wahl(wege[0]) : setOffen((o) => !o))}
      >
        ✎ {wege.length}
      </button>
      {offen && (
        <div className="schwebe rueckweg-liste" role="menu">
          {wege.map((w) => (
            <button key={`${w.buch}-${w.nr}-${w.y}`} type="button" role="menuitem" className="buch-zeile" onClick={() => wahl(w)}>
              {name(w)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
