import { useEffect, useRef, type CSSProperties } from 'react'
import { FARBEN, type Farbe } from '@rl/kern'
import type { Werkzeug } from './Tinte'
import { Funktionsleiste, type Funktion } from '../Funktionsleiste'

const STIFTE: { farbe: Farbe; name: string }[] = [
  { farbe: 'alltag', name: 'Alltag' },
  { farbe: 'wichtig', name: 'Wichtig' },
  { farbe: 'ergaenzung', name: 'Ergänzung' }
]

/** Was jedes Werkzeug tut (Nils 2026-11-15); steht im Hinweis des Knopfs */
const HINWEIS: Record<Werkzeug, string> = {
  lesen: 'Finger scrollt, der Stift schreibt',
  stift: 'Schreiben',
  markieren: 'Rechteck ziehen; eine Markierung antippen zum Bearbeiten, halten und ziehen zum Verschieben',
  radierer: 'Striche sofort; Markierungen, Randmarken und Bilder durch Halten löschen. Mit dem Stift: einfach umdrehen'
}

/** Kürzel am PC: ein Buchstabe wählt das Werkzeug, solange man nicht in ein Textfeld schreibt */
const KUERZEL: Record<string, Werkzeug> = { l: 'lesen', s: 'stift', m: 'markieren', r: 'radierer' }

/**
 * Werkzeuge für Skript und Buch, in der Funktionsleiste „Linie“: am Handy unten, am PC als Spalte gegenüber der
 * Schreibhand. Bei Stift und Markieren stehen die Farben darüber. Die Farben haben Namen, damit sie überall
 * dasselbe bedeuten. „Bild“ legt Fotos oder Bilder ins Buch (am Handy bietet die Auswahl auch die Kamera an).
 */
export function Werkzeugleiste({
  werkzeug,
  farbe,
  onWerkzeug,
  onFarbe,
  markierenText = 'Markieren',
  onBilder
}: {
  werkzeug: Werkzeug
  farbe: Farbe
  onWerkzeug: (w: Werkzeug) => void
  onFarbe: (f: Farbe) => void
  markierenText?: string
  onBilder?: (dateien: File[]) => void
}) {
  const bild = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      const w = KUERZEL[e.key.toLowerCase()]
      if (w) onWerkzeug(w)
    }
    addEventListener('keydown', taste)
    return () => removeEventListener('keydown', taste)
  }, [onWerkzeug])

  const werkzeugFn = (w: Werkzeug, titel: string, k: string): Funktion => ({
    id: w,
    titel,
    symbol: w,
    aktiv: werkzeug === w,
    tun: () => onWerkzeug(w),
    hinweis: `${titel} (Taste ${k.toUpperCase()}). ${HINWEIS[w]}`
  })
  const funktionen: Funktion[] = [werkzeugFn('lesen', 'Lesen', 'l'), werkzeugFn('stift', 'Stift', 's'), werkzeugFn('markieren', markierenText, 'm'), werkzeugFn('radierer', 'Radierer', 'r')]
  if (onBilder) funktionen.push({ id: 'bild', titel: 'Bild', symbol: 'foto', tun: () => bild.current?.click(), hinweis: 'Foto, Screenshot oder Bild ins Buch legen (am PC auch mit Strg+V)' })

  const alltagSchwarz = farbe === 'alltag_schwarz'
  const farben =
    werkzeug === 'stift' || werkzeug === 'markieren' ? (
      <div className="fl-farben" role="group" aria-label="Farbe">
        {STIFTE.map((s) => {
          const an = farbe === s.farbe || (s.farbe === 'alltag' && alltagSchwarz)
          return (
            <button
              type="button"
              key={s.farbe}
              className={`fl-farbe${an ? ' aktiv' : ''}`}
              aria-pressed={an}
              onClick={() => onFarbe(s.farbe === 'alltag' && farbe === 'alltag' ? 'alltag_schwarz' : s.farbe)}
              title={s.farbe === 'alltag' ? 'Alltag: zweiter Tipp wechselt zwischen Blau und Schwarz' : s.name}
            >
              <span className="punkt" style={{ '--punkt': s.farbe === 'alltag' && alltagSchwarz ? FARBEN.alltag_schwarz : FARBEN[s.farbe] } as CSSProperties} />
              <span className="fl-farbe-name">{s.name}</span>
            </button>
          )
        })}
      </div>
    ) : null

  return (
    <>
      <Funktionsleiste name="Werkzeuge" funktionen={funktionen} oben={farben} spalte />
      {onBilder && (
        <input
          ref={bild}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onBilder(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      )}
    </>
  )
}
