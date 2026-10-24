import { forwardRef, type ReactNode } from 'react'
import type { KopfZiel } from './Kopf'
import { Symbol } from './Symbol'

export type LeistenZiel = KopfZiel & { symbol: string }

/**
 * Daumenleiste am Handy (beide Apps): die festen Ziele unten, wahlweise etwas in der Mitte (in Arbeit das „+“).
 * Am PC bleibt sie unsichtbar, dort stehen dieselben Ziele als Reiter im Kopf.
 */
export const Daumenleiste = forwardRef<HTMLDivElement, { ziele: LeistenZiel[]; mitte?: ReactNode; nurMitte?: boolean; children?: ReactNode }>(function Daumenleiste(
  { ziele, mitte, nurMitte, children },
  ref
) {
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
    <div className={`daumenleiste${nurMitte ? ' tastatur' : ''}`} ref={ref}>
      {children}
      <nav className="daumen-zeile" aria-label="Hauptmenü">
        {!nurMitte && ziele.slice(0, halb).map(knopf)}
        {mitte}
        {!nurMitte && ziele.slice(halb).map(knopf)}
      </nav>
    </div>
  )
})
