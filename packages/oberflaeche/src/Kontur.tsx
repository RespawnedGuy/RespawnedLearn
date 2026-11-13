import { useLayoutEffect, useRef, useState } from 'react'
import { daumenKontur } from './daumenKontur'

/**
 * Leuchtende Kontur für schwebende Glasleisten (Daumenmenü, Werkzeugleiste): misst ihr Elternelement und das aktive
 * Element darin und zeichnet die Linie mit der Wölbung darüber (daumenKontur.ts). Gemessen wird über die eigene Ref,
 * denn die Ref des Elternelements setzt React erst nach diesem Effekt. Ändert sich `schluessel` (welches Element
 * aktiv ist), misst sie neu; die Wölbung gleitet per CSS-Übergang auf `d` (bewegung.css).
 * `rund`: die Linie folgt den Rundungen links und rechts (Daumenmenü). Ohne: gerade am unteren Rand, für
 * Leisten, die seitlich scrollen, denn dort liegen die Enden des Inhalts nicht an den sichtbaren Rundungen.
 */
export function Kontur({ aktiv, schluessel, rund = true }: { aktiv: string; schluessel: string; rund?: boolean }) {
  const selbst = useRef<SVGSVGElement>(null)
  const [mass, setMass] = useState<{ b: number; h: number; x: number | null }>({ b: 0, h: 0, x: null })
  useLayoutEffect(() => {
    const el = selbst.current?.parentElement
    if (!el) return
    const messen = () => {
      const a = el.querySelector<HTMLElement>(aktiv)
      // offset… statt getBoundingClientRect: unabhängig von Skalierung (kleine Pille) und seitlichem Scrollen
      const x = a ? a.offsetLeft + a.offsetWidth / 2 : null
      const b = rund ? el.offsetWidth : el.scrollWidth
      const h = rund ? el.offsetHeight : el.clientHeight
      setMass((m) => (m.b === b && m.h === h && m.x === x ? m : { b, h, x }))
    }
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(messen)
    ro.observe(el)
    return () => ro.disconnect()
  }, [aktiv, schluessel, rund])
  const k = mass.b ? daumenKontur(mass.b, mass.h, mass.x, rund) : null
  return (
    <svg ref={selbst} className={`kontur${rund ? '' : ' gerade'}`} aria-hidden="true" width={mass.b} height={mass.h} viewBox={`0 0 ${mass.b || 1} ${mass.h || 1}`}>
      {k && <path className="kontur-flaeche" style={{ d: `path("${k.flaeche}")` }} />}
      {k && <path className="kontur-linie" style={{ d: `path("${k.linie}")` }} />}
    </svg>
  )
}
