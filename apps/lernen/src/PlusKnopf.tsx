import { useEffect, useRef, useState } from 'react'
import { Symbol } from '@rvx/oberflaeche'
import type { PlusZiel } from './plus'

const behalteFokus = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault()

/** „+“ in der Mitte der Daumenleiste (nur in der Mitschrift): Lernkarte aus der Stelle, Kamera, Foto */
export function PlusKnopf({ ziel }: { ziel: PlusZiel }) {
  const [offen, setOffen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!offen) return
    const weg = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOffen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    addEventListener('pointerdown', weg)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', weg)
      removeEventListener('keydown', esc)
    }
  }, [offen])
  const wahl = (f: () => void) => () => {
    setOffen(false)
    f()
  }
  return (
    <div className="plus-huelle" ref={ref}>
      {offen && (
        <div className="einfuege-menue" role="menu" aria-label="Hinzufügen">
          <div className="einfuege-kacheln">
            {(
              [
                ['lernkarte', 'Lernkarte', ziel.lernkarte],
                ['kamera', 'Kamera', ziel.kamera],
                ['foto', 'Foto', ziel.foto]
              ] as const
            ).map(([id, text, f]) => (
              <button key={id} type="button" role="menuitem" className="einfuege-kachel" onPointerDown={behalteFokus} onMouseDown={behalteFokus} onClick={wahl(f)}>
                <Symbol name={id} groesse={24} />
                <span>{text}</span>
              </button>
            ))}
          </div>
          <div className="klein-leise" style={{ padding: '4px 8px 6px' }}>
            Lernkarte nimmt den markierten Text, sonst den Absatz am Cursor.
          </div>
        </div>
      )}
      <button
        type="button"
        className={`daumen-plus${offen ? ' offen' : ''}`}
        aria-label={offen ? 'Schließen' : 'Hinzufügen'}
        aria-expanded={offen}
        aria-haspopup="menu"
        onPointerDown={behalteFokus}
        onMouseDown={behalteFokus}
        onClick={() => setOffen((o) => !o)}
      >
        <Symbol name="plus" groesse={26} />
      </button>
    </div>
  )
}

/** Bildschirmtastatur offen? Dann rückt die Leiste zusammen, nur „+“ bleibt an seinem Platz (wie in Arbeit). */
export function useTastaturOffen() {
  const [offen, setOffen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const pruefe = () => setOffen(window.innerHeight - vv.height > 150)
    vv.addEventListener('resize', pruefe)
    pruefe()
    return () => vv.removeEventListener('resize', pruefe)
  }, [])
  return offen
}
