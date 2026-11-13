import { forwardRef, useEffect, useState, type ReactNode } from 'react'
import { Kontur } from './Kontur'
import type { KopfZiel } from './Kopf'
import { Symbol } from './Symbol'

export type LeistenZiel = KopfZiel & { symbol: string }

/** Ab so viel Scrollweg in eine Richtung klappt die Pille zusammen oder auf (px) */
const SCHWELLE = 24

/**
 * Klein beim Lesen: Scrollt der Inhalt nach unten, wird die Pille klein, nach oben wieder groß (wie Safari am Handy).
 * Hört auf jedes scrollende Element (scroll blubbert nicht, darum in der Capture-Phase), denn je nach Breite scrollt
 * die Seite oder nur das Skript.
 */
function useKleinBeimLesen(an: boolean) {
  const [klein, setKlein] = useState(false)
  useEffect(() => {
    if (!an) {
      setKlein(false)
      return
    }
    const zuletzt = new WeakMap<EventTarget, number>()
    let weg = 0
    const scroll = (e: Event) => {
      const el = e.target === document ? document.scrollingElement : (e.target as Element | null)
      if (!el) return
      const y = el.scrollTop
      const vorher = zuletzt.get(el) ?? y
      zuletzt.set(el, y)
      const d = y - vorher
      // Richtungswechsel setzt den Weg zurück, damit kleines Zittern nichts auslöst
      weg = Math.sign(d) === Math.sign(weg) ? weg + d : d
      if (y < SCHWELLE) setKlein(false)
      else if (weg > SCHWELLE) setKlein(true)
      else if (weg < -SCHWELLE) setKlein(false)
    }
    addEventListener('scroll', scroll, { capture: true, passive: true })
    return () => removeEventListener('scroll', scroll, { capture: true })
  }, [an])
  return [klein, setKlein] as const
}

/**
 * Daumenmenü am Handy: eine schwebende Glaspille mit den festen Zielen, wahlweise etwas in der Mitte (das „+“).
 * Eine leuchtende Kontur läuft unten an der Pille entlang und wölbt sich über dem aktiven Ziel (Kontur.tsx);
 * beim Wechsel gleitet die Wölbung zum neuen Ziel (CSS-Übergang auf `d`, bewegung.css).
 * Mit `einklappen` wird die Pille beim Lesen klein; der erste Tipp darauf macht sie wieder groß, damit niemand aus Versehen den Bereich wechselt. Am PC bleibt sie unsichtbar, dort stehen die Ziele als Reiter im Kopf.
 */
export const Daumenleiste = forwardRef<
  HTMLDivElement,
  { ziele: LeistenZiel[]; mitte?: ReactNode; nurMitte?: boolean; einklappen?: boolean; children?: ReactNode }
>(function Daumenleiste({ ziele, mitte, nurMitte, einklappen, children }, ref) {
  const [klein, setKlein] = useKleinBeimLesen(!!einklappen && !nurMitte)
  const halb = mitte ? Math.ceil(ziele.length / 2) : ziele.length
  const knopf = (z: LeistenZiel) => (
    <a key={z.ziel} href={z.ziel} className={`daumen-ziel${z.aktiv ? ' aktiv' : ''}`} aria-current={z.aktiv ? 'page' : undefined}>
      <span className="daumen-symbol">
        <Symbol name={z.symbol} groesse={22} />
        {!!z.zahl && <span className="daumen-zahl">{z.zahl > 99 ? '99+' : z.zahl}</span>}
      </span>
      <span className="daumen-text">{z.titel}</span>
    </a>
  )
  return (
    <div
      className={`daumenleiste${nurMitte ? ' tastatur' : ''}${klein ? ' klein' : ''}`}
      ref={ref}
      onClickCapture={(e) => {
        // Tastatur und Bildschirmleser (detail 0) gehen direkt ans Ziel, nur der Finger macht die Pille erst groß
        if (!klein || e.detail === 0) return
        e.preventDefault()
        e.stopPropagation()
        setKlein(false)
      }}
    >
      {children}
      <nav className="daumen-zeile" aria-label="Hauptmenü">
        {!nurMitte && <Kontur aktiv=".daumen-ziel.aktiv" schluessel={ziele.map((z) => (z.aktiv ? 1 : 0)).join('') + (mitte ? '+' : '')} />}
        {!nurMitte && ziele.slice(0, halb).map(knopf)}
        {mitte}
        {!nurMitte && ziele.slice(halb).map(knopf)}
      </nav>
    </div>
  )
})
