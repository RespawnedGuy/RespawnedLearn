// Halten packt an (Nils 2026-11-15): ein Kreis um den Finger zeigt die Zeit, er leert sich, bis angehoben (orange,
// 0,4 s) oder gelöscht (rot, 1,0 s) wird. Die Rechnung steht in `kern/halten.ts`; hier nur Anzeige und Zeiger.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { RING_AB_MS, haltenStand, starteHalten, zuWeit, type Halten } from '@rl/kern'

export type HalteArt = 'anheben' | 'loeschen'

/** Ort in Pixeln innerhalb des nächsten positionierten Vorfahren */
export interface RingOrt {
  x: number
  y: number
  dauer: number
  art: HalteArt
}

// so groß, dass der Kreis auch unter einem Finger noch zu sehen ist
const R = 36
const UMFANG = 2 * Math.PI * R

/** Der ablaufende Kreis. Bei reduzierter Bewegung läuft er trotzdem: Er zeigt Zeit, er schmückt nicht. */
export function HalteRing({ x, y, dauer, art }: RingOrt) {
  return (
    <svg
      className={`halte-ring ${art}`}
      width={88}
      height={88}
      viewBox="0 0 88 88"
      aria-hidden="true"
      style={{ left: x - 44, top: y - 44, '--dauer': `${dauer}ms`, '--ab': `${RING_AB_MS}ms`, '--umfang': UMFANG } as CSSProperties}
    >
      <circle className="halte-ring-grund" cx={44} cy={44} r={R} />
      <circle className="halte-ring-zeit" cx={44} cy={44} r={R} strokeDasharray={UMFANG} transform="rotate(-90 44 44)" />
    </svg>
  )
}

/**
 * Halten auf einem Element (Rahmen, Bild, Randmarke): Nach `dauer` ms ohne Bewegung ruft es `onFertig` mit dem
 * Zeiger, der noch unten ist. Bewegt er sich weiter als 8 px oder geht er hoch, passiert nichts. Der Stift hält nie;
 * nur mit `stiftRadierer` zählt die Radiererseite des Stifts (gedrückte Radierer-Taste).
 */
export function useHalten({ dauer, art, aktiv = true, stiftRadierer = false, onFertig }: { dauer: number; art: HalteArt; aktiv?: boolean; stiftRadierer?: boolean; onFertig: (z: { pointerId: number; clientX: number; clientY: number; el: HTMLElement }) => void }) {
  const [ring, setRing] = useState<RingOrt | null>(null)
  const lauf = useRef<{ h: Halten; uhr: ReturnType<typeof setTimeout>; el: HTMLElement; id: number; x: number; y: number } | null>(null)
  const fertig = useRef(onFertig)
  fertig.current = onFertig
  const ende = () => {
    if (lauf.current) clearTimeout(lauf.current.uhr)
    lauf.current = null
    setRing(null)
  }
  useEffect(() => ende, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!aktiv) return
    if (e.pointerType === 'pen' && !(stiftRadierer && (e.buttons & 32) !== 0)) return
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* dann ohne */
    }
    const r = el.getBoundingClientRect()
    const h = starteHalten(performance.now(), e.clientX, e.clientY, dauer)
    const uhr = setTimeout(() => {
      const l = lauf.current
      if (!l || haltenStand(l.h, performance.now() + 1, l.x, l.y).art !== 'fertig') return
      ende()
      fertig.current({ pointerId: l.id, clientX: l.x, clientY: l.y, el: l.el })
    }, dauer)
    lauf.current = { h, uhr, el, id: e.pointerId, x: e.clientX, y: e.clientY }
    setRing({ x: e.clientX - r.left, y: e.clientY - r.top, dauer, art })
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const l = lauf.current
    if (!l || e.pointerId !== l.id) return
    l.x = e.clientX
    l.y = e.clientY
    if (zuWeit(l.h, e.clientX, e.clientY)) ende()
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (lauf.current?.id === e.pointerId) ende()
  }
  return { griffe: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }, ring: ring && <HalteRing {...ring} />, laeuft: !!ring }
}
