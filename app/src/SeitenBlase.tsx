// Seitenverweise einer Notizbuchseite (Vertrag Lernen 1.3, 5.3) als eine Blase oben rechts, wie „✎ n“ im Skript
// (Nils 2026-11-15). Eine Seite: Tippen springt ins Skript; mehrere: erst eine kurze Liste. ✦-Marken bleiben am Rand.
import { useEffect, useRef, useState } from 'react'
import { seitenBlase, seitenDerBuchseite, type Verweis } from '@rl/kern'
import { geheZu, useDaten } from '@rl/oberflaeche'

export function SeitenBlase({ verweise, blinktBei }: { verweise: Verweis[]; blinktBei: number | null }) {
  const { bestand } = useDaten()
  const [offen, setOffen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
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
  const skript = (anhang: string) => bestand.dokumente.get(anhang)?.titel ?? 'Skript'
  const name = (s: (typeof seiten)[number]) => `${skript(s.anhang)}, Seite ${s.seite}`
  const springe = (s: (typeof seiten)[number]) => {
    setOffen(false)
    geheZu('sammeln', s.anhang, s.seite)
  }
  const blinkt = blinktBei !== null && seiten.some((s) => s.y === blinktBei)
  return (
    <div className="seiten-blase" ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={blinkt ? 'blinkt' : undefined}
        title={seiten.length === 1 ? `Im Skript öffnen: ${name(seiten[0])}` : `Geschrieben zu ${seiten.length} Skriptseiten`}
        aria-expanded={seiten.length > 1 ? offen : undefined}
        onClick={() => (seiten.length === 1 ? springe(seiten[0]) : setOffen((o) => !o))}
      >
        {seitenBlase(seiten)}
      </button>
      {offen && (
        <div className="schwebe seiten-blase-liste" role="menu">
          {seiten.map((s) => (
            <button key={`${s.anhang}-${s.seite}`} type="button" role="menuitem" className="buch-zeile" onClick={() => springe(s)}>
              {name(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
