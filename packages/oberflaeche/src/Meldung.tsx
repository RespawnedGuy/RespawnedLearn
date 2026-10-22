import { useEffect, useState } from 'react'

// Rückmeldung nach einer Handlung („Foto im Journal · 13:04“), unten mittig, mit Rückgängig.
// Verschwindet nach ein paar Sekunden von selbst; Bildschirmleser lesen sie über role="status" vor.
const EREIGNIS = 'rvx:meldung'

interface Meldung {
  text: string
  rueckgaengig?: () => void
  nr: number
}

let zaehler = 0

export function melde(text: string, rueckgaengig?: () => void) {
  dispatchEvent(new CustomEvent<Meldung>(EREIGNIS, { detail: { text, rueckgaengig, nr: ++zaehler } }))
}

export function uhrzeit(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function Meldungen() {
  const [m, setM] = useState<Meldung | null>(null)
  useEffect(() => {
    const h = (e: Event) => setM((e as CustomEvent<Meldung>).detail)
    // Nach einem Seitenwechsel gibt es nichts mehr rückgängig zu machen
    const weg = () => setM((m) => (m?.rueckgaengig ? null : m))
    addEventListener(EREIGNIS, h)
    addEventListener('hashchange', weg)
    return () => {
      removeEventListener(EREIGNIS, h)
      removeEventListener('hashchange', weg)
    }
  }, [])
  useEffect(() => {
    if (!m) return
    const uhr = setTimeout(() => setM(null), m.rueckgaengig ? 6000 : 3500)
    return () => clearTimeout(uhr)
  }, [m])
  return (
    <div className="rueckmeldung-ort" role="status" aria-live="polite">
      {m && (
        <div className="rueckmeldung" key={m.nr}>
          <span>{m.text}</span>
          {m.rueckgaengig && (
            <button
              type="button"
              className="rueckmeldung-knopf"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                m.rueckgaengig?.()
                setM(null)
              }}
            >
              Rückgängig
            </button>
          )}
        </div>
      )}
    </div>
  )
}
