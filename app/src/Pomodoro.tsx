// Pomodoro-Chip oben rechts neben dem Zahnrad (Nils 2026-11-14): unauffällig, ohne Ton und ohne Blinken beim Ablauf.
// Ist die Lernzeit um, fragt ein Tippen nach der Pause, ein zweites startet sie; Tippen daneben oder Esc schließt.
// Nach der Pause ein leiser Ton (nur bei offener App), dann startet ein Tippen die nächste Lernzeit.
import { useEffect, useRef, useState } from 'react'
import { chipName, chipText, phasenAnsage, pomodoroPhase, restMinuten, type PomodoroStand } from '@rl/kern'
import { lernzeitStarten, pauseStarten, pomodoroBeenden, usePomodoro } from './pomodoroStand'

function Uhr() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5 M10 2h4" />
    </svg>
  )
}

/** Wie viel der Phase noch übrig ist, 0 bis 1 */
function anteil(s: PomodoroStand, jetzt: number): number {
  if (s.art === 'bereit') return 0
  return Math.min(1, Math.max(0, (s.ende - jetzt) / (s.minuten * 60_000)))
}

/** Restzeit als Zahl in einem dünnen Ring, der mit der Zeit kürzer wird (ändert sich nur jede Minute) */
function Ring({ anteil, zahl }: { anteil: number; zahl: number }) {
  const umfang = 2 * Math.PI * 13
  return (
    <span className="pomodoro-ring">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <circle cx="15" cy="15" r="13" className="pomodoro-ring-grund" />
        <circle cx="15" cy="15" r="13" className="pomodoro-ring-rest" strokeDasharray={umfang} strokeDashoffset={umfang * (1 - anteil)} transform="rotate(-90 15 15)" />
      </svg>
      <span className="pomodoro-zahl">{zahl}</span>
    </span>
  )
}

/** `zeigen`: in Sammeln und Lernen; läuft der Timer, steht er in jedem Bereich */
export function PomodoroChip({ zeigen }: { zeigen: boolean }) {
  const { stand, einstellungen, jetzt } = usePomodoro()
  const phase = pomodoroPhase(stand, jetzt)
  const [offen, setOffen] = useState(false)
  const [ansage, setAnsage] = useState('')
  const huelle = useRef<HTMLDivElement>(null)
  const letztePhase = useRef(phase)

  // Ansage für Screenreader nur beim Wechsel der Phase, nicht jede Minute; die Frage schließt dabei
  useEffect(() => {
    if (letztePhase.current === phase) return
    letztePhase.current = phase
    setAnsage(phasenAnsage(stand, Date.now()))
    setOffen(false)
  }, [phase, stand])

  // Tippen daneben oder Esc schließt die Frage
  useEffect(() => {
    if (!offen) return
    const daneben = (e: PointerEvent) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('pointerdown', daneben)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', daneben)
      document.removeEventListener('keydown', esc)
    }
  }, [offen])

  if (phase === 'bereit' && !zeigen) return <span className="nur-vorleser" aria-live="polite">{ansage}</span>

  const tippen = () => {
    if (phase === 'bereit' || phase === 'pauseVorbei') return lernzeitStarten()
    // „Für 5 Minuten Pause nochmal tippen“: das zweite Tippen auf den Chip startet die Pause
    if (phase === 'abgelaufen' && offen) return pauseStarten()
    setOffen((o) => !o)
  }

  const fertig = (f: () => void) => () => {
    f()
    setOffen(false)
  }

  return (
    <div className="pomodoro" ref={huelle}>
      <button
        type="button"
        className={`pomodoro-chip ${phase}`}
        onClick={tippen}
        aria-label={chipName(stand, jetzt)}
        aria-expanded={phase === 'bereit' || phase === 'pauseVorbei' ? undefined : offen}
        title={phase === 'bereit' ? `Lernzeit starten (${einstellungen.lernen} Minuten)` : undefined}
      >
        {phase === 'bereit' ? (
          <Uhr />
        ) : (
          <>
            <span className="pomodoro-text">{chipText(stand, jetzt)}</span>
            {/* Handy: neben den Tabs ist nur Platz für die Zahl im Ring, nach dem Ablauf die Uhr auf Orange */}
            <span className="pomodoro-kurz" aria-hidden="true">
              {phase === 'lernt' || phase === 'pause' ? <Ring anteil={anteil(stand, jetzt)} zahl={restMinuten(stand, jetzt)} /> : <Uhr />}
            </span>
          </>
        )}
      </button>
      {offen && (
        <div className="pomodoro-frage" role="group" aria-label="Pomodoro">
          {phase === 'abgelaufen' && (
            <>
              <button type="button" className="knopf haupt" onClick={fertig(pauseStarten)}>
                Für {einstellungen.pause} Minuten Pause nochmal tippen
              </button>
              <button type="button" className="knopf still" onClick={fertig(pomodoroBeenden)}>
                Weiterlernen
              </button>
            </>
          )}
          {phase === 'lernt' && (
            <button type="button" className="knopf" onClick={fertig(pomodoroBeenden)}>
              Lernzeit beenden
            </button>
          )}
          {phase === 'pause' && (
            <>
              <button type="button" className="knopf haupt" onClick={fertig(lernzeitStarten)}>
                Pause beenden, weiterlernen
              </button>
              <button type="button" className="knopf still" onClick={fertig(pomodoroBeenden)}>
                Timer aus
              </button>
            </>
          )}
        </div>
      )}
      <span className="nur-vorleser" aria-live="polite">
        {ansage}
      </span>
    </div>
  )
}
