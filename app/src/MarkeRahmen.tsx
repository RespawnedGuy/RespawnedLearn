// Gewählte Markierung verschieben und skalieren (Lernen 1.10, 5.4): Rahmen mit vier Eckgriffen, gleich im Skript und im
// Notizbuch. Nur Finger und Maus; der Stift verschiebt nie (Nils 2026-11-14). Gespeichert wird beim Loslassen.
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { rueckeBereich, type Bereich, type Griff } from '@rl/kern'

const ECKEN: Griff[] = ['lo', 'ro', 'lu', 'ru']
const ECKE_NAME: Record<Griff, string> = { mitte: 'Markierung verschieben', lo: 'Größe oben links', ro: 'Größe oben rechts', lu: 'Größe unten links', ru: 'Größe unten rechts' }

/** `bereich` in Anteilen der angezeigten Seite; `onFertig` bekommt den neuen Bereich, nur wenn sich etwas bewegt hat */
export function MarkeRahmen({ bereich, farbe, onFertig }: { bereich: Bereich; farbe: string | null; onFertig: (b: Bereich) => void }) {
  const [lage, setLage] = useState<Bereich | null>(null)
  const zug = useRef<{ griff: Griff; x: number; y: number; breite: number; hoehe: number; start: Bereich } | null>(null)
  const b = lage ?? bereich

  const runter = (griff: Griff) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'pen') return
    e.stopPropagation()
    e.preventDefault()
    const seite = e.currentTarget.closest('.pdf-seite, .blatt-flaeche')?.getBoundingClientRect()
    if (!seite) return
    e.currentTarget.setPointerCapture(e.pointerId)
    zug.current = { griff, x: e.clientX, y: e.clientY, breite: seite.width, hoehe: seite.height, start: bereich }
  }
  const bewegen = (e: ReactPointerEvent<HTMLElement>) => {
    const z = zug.current
    if (!z) return
    setLage(rueckeBereich(z.start, z.griff, (e.clientX - z.x) / z.breite, (e.clientY - z.y) / z.hoehe))
  }
  const hoch = () => {
    const neu = lage
    zug.current = null
    setLage(null)
    if (neu && (Math.abs(neu.x - bereich.x) + Math.abs(neu.y - bereich.y) + Math.abs(neu.b - bereich.b) + Math.abs(neu.h - bereich.h) > 0.001)) onFertig(neu)
  }
  const ziehen = (griff: Griff) => ({ onPointerDown: runter(griff), onPointerMove: bewegen, onPointerUp: hoch, onPointerCancel: hoch })

  return (
    <div
      className={`marke-rahmen ${farbe ?? ''}`}
      style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.b * 100}%`, height: `${b.h * 100}%` }}
      role="group"
      aria-label="Gewählte Markierung: ziehen verschiebt, Ecken ändern die Größe"
      {...ziehen('mitte')}
    >
      {ECKEN.map((g) => (
        <span key={g} className={`marke-griff ${g}`} aria-label={ECKE_NAME[g]} {...ziehen(g)} />
      ))}
    </div>
  )
}
