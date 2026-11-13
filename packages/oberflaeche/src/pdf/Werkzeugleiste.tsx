import { FARBEN, type Farbe } from '@rl/kern'
import type { CSSProperties } from 'react'
import type { Werkzeug } from './Tinte'
import { Kontur } from '../Kontur'

const STIFTE: { farbe: Farbe; name: string }[] = [
  { farbe: 'alltag', name: 'Alltag' },
  { farbe: 'wichtig', name: 'Wichtig' },
  { farbe: 'ergaenzung', name: 'Ergänzung' }
]

/**
 * Schwebende Leiste für PDF und Blatt, in derselben Glasoptik wie das Daumenmenü: Das aktive Werkzeug trägt die
 * leuchtende Wölbung, die aktive Farbe einen leuchtenden Ring in ihrer Farbe. Die Farben haben Namen, damit sie
 * überall dasselbe bedeuten.
 */
export function Werkzeugleiste({
  werkzeug,
  farbe,
  onWerkzeug,
  onFarbe,
  markierenText = 'Markieren',
  extra
}: {
  werkzeug: Werkzeug
  farbe: Farbe
  onWerkzeug: (w: Werkzeug) => void
  onFarbe: (f: Farbe) => void
  markierenText?: string
  extra?: React.ReactNode
}) {
  return (
    <div className="werkzeug" role="toolbar" aria-label="Werkzeuge">
      <Kontur aktiv="button.aktiv" schluessel={werkzeug} rund={false} />
      <button type="button" className={werkzeug === 'lesen' ? 'aktiv' : ''} aria-pressed={werkzeug === 'lesen'} onClick={() => onWerkzeug('lesen')}>
        Lesen
      </button>
      <button type="button" className={werkzeug === 'stift' ? 'aktiv' : ''} aria-pressed={werkzeug === 'stift'} onClick={() => onWerkzeug('stift')}>
        Stift
      </button>
      <button type="button" className={werkzeug === 'markieren' ? 'aktiv' : ''} aria-pressed={werkzeug === 'markieren'} onClick={() => onWerkzeug('markieren')}>
        {markierenText}
      </button>
      <span className="trenner" />
      {STIFTE.map((s) => (
        <button
          type="button"
          key={s.farbe}
          className={farbe === s.farbe || (s.farbe === 'alltag' && farbe === 'alltag_schwarz') ? 'farbe-aktiv' : ''}
          aria-pressed={farbe === s.farbe || (s.farbe === 'alltag' && farbe === 'alltag_schwarz')}
          onClick={() => {
            // Alltag hat zwei Töne: zweiter Tipp wechselt zwischen Blau und Schwarz
            onFarbe(s.farbe === 'alltag' && farbe === 'alltag' ? 'alltag_schwarz' : s.farbe)
            if (werkzeug === 'lesen' || werkzeug === 'radierer') onWerkzeug('stift')
          }}
        >
          <span className="punkt" style={{ '--punkt': s.farbe === 'alltag' && farbe === 'alltag_schwarz' ? FARBEN.alltag_schwarz : FARBEN[s.farbe] } as CSSProperties} />
          {s.name}
        </button>
      ))}
      <span className="trenner" />
      <button type="button" className={werkzeug === 'radierer' ? 'aktiv' : ''} aria-pressed={werkzeug === 'radierer'} onClick={() => onWerkzeug('radierer')} title="Mit dem Stift: einfach umdrehen">
        Radierer
      </button>
      {extra}
    </div>
  )
}
