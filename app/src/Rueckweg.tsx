// Rückweg vom Skript ins Notizbuch (Vertrag Lernen 1.3, 5.3): Zeigen Buchstellen auf diese Skriptseite, steht oben
// auf der Seite „✎ 2“. Tippen öffnet eine kurze Liste: Zeile öffnet die Stelle, ✕ löst die Verknüpfung.
import { useMemo, useState } from 'react'
import { rueckwege, type Rueckweg } from '@rl/kern'
import { useDaten } from '@rl/oberflaeche'

/** Alle Buchstellen je Skriptseite, neu berechnet, wenn sich Dateien ändern */
export function useRueckwege(anhang: string): Map<number, Rueckweg[]> {
  const { speicher, version } = useDaten()
  return useMemo(() => rueckwege(speicher.pfade(), (p) => speicher.text(p), anhang), [speicher, version, anhang])
}

export function RueckwegKnopf({ wege, onOeffne, onLoesen }: { wege: Rueckweg[]; onOeffne: (w: Rueckweg) => void; onLoesen: (w: Rueckweg) => void }) {
  const { bestand } = useDaten()
  const [offen, setOffen] = useState(false)
  const name = (w: Rueckweg) => `${bestand.dokumente.get(w.buch)?.titel ?? 'Notizbuch'}, S. ${w.nr}${w.marke ? ' ✦' : ''}`
  const wahl = (w: Rueckweg) => {
    setOffen(false)
    onOeffne(w)
  }
  // Tippen öffnet immer die Liste, damit sich jede Verknüpfung lösen lässt (Nils 2026-11-17); ✦ löst man im Buch
  return (
    <div className="rueckweg" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={wege.length === 1 ? `Im Notizbuch: ${name(wege[0])}` : `${wege.length} Stellen in Notizbüchern`}
        aria-expanded={offen}
        aria-haspopup="menu"
        onClick={() => setOffen((o) => !o)}
      >
        ✎ {wege.length}
      </button>
      {offen && (
        <div className="schwebe rueckweg-liste" role="menu">
          {wege.map((w) => (
            <div key={`${w.buch}-${w.nr}-${w.y}`} className="seiten-blase-zeile">
              <button type="button" role="menuitem" className="buch-zeile" onClick={() => wahl(w)}>
                {name(w)}
              </button>
              {!w.marke && (
                <button type="button" role="menuitem" className="seiten-blase-weg" aria-label={`Verknüpfung lösen: ${name(w)}`} title="Verknüpfung lösen" onClick={() => onLoesen(w)}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
