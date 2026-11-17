// Seitenverweise einer Notizbuchseite (Vertrag Lernen 1.3, 5.3) als eine Blase oben rechts, wie „✎ n“ im Skript
// (Nils 2026-11-15). Tippen öffnet die Liste: Zeile springt ins Skript, ✕ löst den Verweis (Nils 2026-11-17).
// Radierer + Halten auf der Blase löst alle Seitenverweise der Buchseite. ✦-Marken bleiben am Rand.
import { useEffect, useRef, useState } from 'react'
import { LOESCHEN_MS, seitenBlase, seitenDerBuchseite, type BlasenSeite, type Verweis } from '@rl/kern'
import { geheZu, useDaten, useHalten } from '@rl/oberflaeche'

export function SeitenBlase({
  verweise,
  blinktBei,
  radierer,
  onLoesen
}: {
  verweise: Verweis[]
  blinktBei: number | null
  radierer: boolean
  /** eine Skriptseite lösen, mit null alle */
  onLoesen: (ziel: BlasenSeite | null) => void
}) {
  const { bestand } = useDaten()
  const [offen, setOffen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const halten = useHalten({ dauer: LOESCHEN_MS, art: 'loeschen', aktiv: radierer, stiftRadierer: true, onFertig: () => onLoesen(null) })
  useEffect(() => {
    if (!offen) return
    const weg = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOffen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    addEventListener('pointerdown', weg, true)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', weg, true)
      removeEventListener('keydown', esc)
    }
  }, [offen])
  const seiten = seitenDerBuchseite(verweise)
  if (!seiten.length) return null
  const name = (s: BlasenSeite) => `${bestand.dokumente.get(s.anhang)?.titel ?? 'Skript'}, Seite ${s.seite}`
  const springe = (s: BlasenSeite) => {
    setOffen(false)
    geheZu('sammeln', s.anhang, s.seite)
  }
  const blinkt = blinktBei !== null && seiten.some((s) => s.y === blinktBei)
  return (
    <div className="seiten-blase" ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`${blinkt ? 'blinkt' : ''}${halten.laeuft ? ' loescht-gleich' : ''}`}
        title={radierer ? 'Halten löst alle Seitenverweise dieser Buchseite' : `Geschrieben zu ${seiten.length === 1 ? name(seiten[0]) : `${seiten.length} Skriptseiten`}`}
        aria-expanded={offen}
        aria-haspopup="menu"
        onClick={() => !radierer && setOffen((o) => !o)}
        {...halten.griffe}
      >
        {seitenBlase(seiten)}
        {halten.ring}
      </button>
      {offen && (
        <div className="schwebe seiten-blase-liste" role="menu">
          {seiten.map((s) => (
            <div key={`${s.anhang}-${s.seite}`} className="seiten-blase-zeile">
              <button type="button" role="menuitem" className="buch-zeile" onClick={() => springe(s)}>
                {name(s)}
              </button>
              <button type="button" role="menuitem" className="seiten-blase-weg" aria-label={`Verweis lösen: ${name(s)}`} title="Verweis lösen" onClick={() => onLoesen(s)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
