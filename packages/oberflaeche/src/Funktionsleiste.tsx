import { useRef, type ReactNode } from 'react'
import { Symbol } from './Symbol'
import { stiftRuhe } from './stiftRuhe'

/** Eine Funktion des aktiven Bereichs: Werkzeug (mit `aktiv`) oder Handlung (ohne) */
export interface Funktion {
  id: string
  titel: string
  symbol: string
  /** nur bei Werkzeugen: gerade gewählt (zeigt die Linie, aria-pressed) */
  aktiv?: boolean
  tun: () => void
  hinweis?: string
}

const behalteFokus = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault()

/**
 * Funktionsleiste im Stil „Linie“ (Nils 13.11.): Oben stehen die Bereiche als Tabs mit Unterstrich, unten schaltet
 * diese Leiste die Funktionen des aktiven Bereichs; die aktive trägt dieselbe Linie, gespiegelt am oberen Rand.
 * Am Handy fest unten über die ganze Breite (über der Tastatur, wenn sie offen ist). Am PC nur als `spalte`:
 * senkrecht am Rand gegenüber der Schreibhand und durchlässig, solange der Stift schreibt (stiftRuhe.ts);
 * ohne `spalte` gibt es sie am PC nicht.
 * `fokusBehalten`: Antippen nimmt dem Editor den Fokus nicht (Mitschrift, Tastatur bleibt offen).
 */
export function Funktionsleiste({
  funktionen,
  oben,
  spalte,
  fokusBehalten,
  name
}: {
  funktionen: Funktion[]
  /** Zeile über den Funktionen, z. B. die Farben beim Stift */
  oben?: ReactNode
  spalte?: boolean
  fokusBehalten?: boolean
  name: string
}) {
  const zeiger = useRef('')
  return (
    <div className={`funktionsleiste${spalte ? ' spalte' : ''}`} role="toolbar" aria-label={name}>
      {oben && <div className="fl-oben">{oben}</div>}
      <div className="fl-zeile">
        {funktionen.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`fl-fn${f.aktiv ? ' aktiv' : ''}`}
            aria-pressed={f.aktiv === undefined ? undefined : f.aktiv}
            title={f.hinweis}
            onPointerDown={(e) => {
              zeiger.current = e.pointerType
              if (fokusBehalten) e.preventDefault()
            }}
            onMouseDown={fokusBehalten ? behalteFokus : undefined}
            onClick={(e) => {
              // Handballen beim Schreiben: Finger lösen nichts aus, solange der Stift aufliegt
              if (zeiger.current === 'touch' && !stiftRuhe.fingerErlaubt(e.timeStamp)) return
              f.tun()
            }}
          >
            <Symbol name={f.symbol} groesse={22} />
            <span className="fl-text">{f.titel}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
