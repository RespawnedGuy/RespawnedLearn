// Gewählte Markierung verschieben und skalieren (Lernen 1.10, 5.4): Rahmen mit vier Eckgriffen, gleich im Skript und im
// Notizbuch. Verschoben wird durch Klicken und Halten (0,4 s), dann Ziehen (Nils 2026-11-15); die Ecken ziehen sofort.
// Nur Finger und Maus; der Stift verschiebt nie (Nils 2026-11-14). Gespeichert wird beim Loslassen.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ANHEBEN_MS, rueckeBereich, type Bereich, type Griff } from '@rl/kern'
import { useHalten } from '@rl/oberflaeche'

const ECKEN: Griff[] = ['lo', 'ro', 'lu', 'ru']
const ECKE_NAME: Record<Griff, string> = { mitte: 'Markierung verschieben', lo: 'Größe oben links', ro: 'Größe oben rechts', lu: 'Größe unten links', ru: 'Größe unten rechts' }

/** Ein Zeiger, der schon unten ist (angehoben in der Tinte) und ab jetzt die Markierung verschiebt */
export interface Uebernahme {
  pointerId: number
  clientX: number
  clientY: number
}

/** `bereich` in Anteilen der angezeigten Seite; `onFertig` bekommt den neuen Bereich, nur wenn sich etwas bewegt hat */
export function MarkeRahmen({ bereich, farbe, uebernimm, onFertig }: { bereich: Bereich; farbe: string | null; uebernimm?: Uebernahme | null; onFertig: (b: Bereich) => void }) {
  const [lage, setLage] = useState<Bereich | null>(null)
  const [angehoben, setAngehoben] = useState(false)
  const zug = useRef<{ griff: Griff; x: number; y: number; breite: number; hoehe: number; start: Bereich } | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const b = lage ?? bereich

  const starte = (griff: Griff, ziel: HTMLElement, pointerId: number, x: number, y: number) => {
    const seite = ziel.closest('.pdf-seite, .blatt-flaeche')?.getBoundingClientRect()
    if (!seite) return
    try {
      ziel.setPointerCapture(pointerId)
    } catch {
      return
    }
    zug.current = { griff, x, y, breite: seite.width, hoehe: seite.height, start: bereich }
    if (griff === 'mitte') setAngehoben(true)
  }
  // In der Tinte 0,4 s gehalten: Der Finger ist noch unten und schiebt gleich weiter
  useEffect(() => {
    if (uebernimm && el.current) starte('mitte', el.current, uebernimm.pointerId, uebernimm.clientX, uebernimm.clientY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uebernimm])

  const halten = useHalten({ dauer: ANHEBEN_MS, art: 'anheben', onFertig: (z) => starte('mitte', z.el, z.pointerId, z.clientX, z.clientY) })
  const ecke = (griff: Griff) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'pen') return
    e.stopPropagation()
    e.preventDefault()
    starte(griff, e.currentTarget, e.pointerId, e.clientX, e.clientY)
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
    setAngehoben(false)
    if (neu && (Math.abs(neu.x - bereich.x) + Math.abs(neu.y - bereich.y) + Math.abs(neu.b - bereich.b) + Math.abs(neu.h - bereich.h) > 0.001)) onFertig(neu)
  }

  return (
    <div
      ref={el}
      className={`marke-rahmen ${farbe ?? ''}${angehoben ? ' angehoben' : ''}`}
      style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.b * 100}%`, height: `${b.h * 100}%` }}
      role="group"
      aria-label="Gewählte Markierung: halten und ziehen verschiebt, Ecken ändern die Größe, Entf löscht"
      onPointerDown={(e) => {
        if (!zug.current) halten.griffe.onPointerDown(e)
      }}
      onPointerMove={(e) => {
        halten.griffe.onPointerMove(e)
        bewegen(e)
      }}
      onPointerUp={(e) => {
        halten.griffe.onPointerUp(e)
        hoch()
      }}
      onPointerCancel={(e) => {
        halten.griffe.onPointerCancel(e)
        hoch()
      }}
    >
      {ECKEN.map((g) => (
        <span key={g} className={`marke-griff ${g}`} aria-label={ECKE_NAME[g]} onPointerDown={ecke(g)} />
      ))}
      {halten.ring}
    </div>
  )
}
