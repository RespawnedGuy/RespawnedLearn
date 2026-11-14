// Einstellungen › Pomodoro: Lernzeit, Pause, Ton und, am Handy, „Nicht stören“. Gilt je Gerät (pomodoroStand.ts).
import { useEffect, useState } from 'react'
import { LERNZEIT_GRENZEN, PAUSE_GRENZEN, POMODORO_STANDARD } from '@rl/kern'
import { stilleAnfragen, stilleErlaubt, stilleMoeglich } from '@rl/oberflaeche'
import { setzePomodoroEinstellungen, usePomodoro } from './pomodoroStand'

/** Minutenfeld: Tippen darf kurz leer oder zu groß sein, gespeichert wird der begrenzte Wert, beim Verlassen steht er da */
function Minuten({ titel, wert, grenzen, setze }: { titel: string; wert: number; grenzen: { min: number; max: number }; setze: (n: number) => void }) {
  const [text, setText] = useState(String(wert))
  useEffect(() => setText(String(wert)), [wert])
  return (
    <label className="feld pomodoro-feld">
      {titel}
      <span className="pomodoro-minuten">
        <input
          className="eingabe"
          type="number"
          inputMode="numeric"
          min={grenzen.min}
          max={grenzen.max}
          step={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value.trim() && Number.isFinite(n)) setze(n)
          }}
          onBlur={() => setText(String(wert))}
        />
        <span aria-hidden="true">min</span>
      </span>
    </label>
  )
}

/** Hat der Nutzer den Zugriff in den Systemeinstellungen erteilt? Neu prüfen, wenn die App wieder sichtbar wird */
function useStilleErlaubt(): boolean {
  const [erlaubt, setErlaubt] = useState(stilleErlaubt)
  useEffect(() => {
    const pruefen = () => document.visibilityState === 'visible' && setErlaubt(stilleErlaubt())
    document.addEventListener('visibilitychange', pruefen)
    return () => document.removeEventListener('visibilitychange', pruefen)
  }, [])
  return erlaubt
}

export function EinstellungenPomodoro() {
  const { einstellungen: e } = usePomodoro()
  const moeglich = stilleMoeglich()
  const erlaubt = useStilleErlaubt()
  const standard = e.lernen === POMODORO_STANDARD.lernen && e.pause === POMODORO_STANDARD.pause
  return (
    <section className="einstellungen-teil">
      <h2>Pomodoro</h2>
      <p className="klein-leise">Die Uhr oben rechts beim Sammeln und Lernen. Ist die Lernzeit um, wird sie still orange; ein Tippen fragt nach der Pause.</p>
      <div className="pomodoro-felder">
        <Minuten titel="Lernzeit" wert={e.lernen} grenzen={LERNZEIT_GRENZEN} setze={(lernen) => setzePomodoroEinstellungen({ lernen })} />
        <Minuten titel="Pause" wert={e.pause} grenzen={PAUSE_GRENZEN} setze={(pause) => setzePomodoroEinstellungen({ pause })} />
      </div>
      {!standard && (
        <button type="button" className="knopf still klein pomodoro-standard" onClick={() => setzePomodoroEinstellungen({ lernen: POMODORO_STANDARD.lernen, pause: POMODORO_STANDARD.pause })}>
          Standard ({POMODORO_STANDARD.lernen} und {POMODORO_STANDARD.pause} Minuten)
        </button>
      )}
      <label className="schalter-zeile">
        <input type="checkbox" checked={e.ton} onChange={(x) => setzePomodoroEinstellungen({ ton: x.target.checked })} />
        Leiser Ton, wenn die Pause vorbei ist
      </label>
      {moeglich && (
        <>
          <label className="schalter-zeile">
            <input type="checkbox" checked={e.stille} onChange={(x) => setzePomodoroEinstellungen({ stille: x.target.checked })} />
            Während der Lernzeit „Nicht stören“
          </label>
          {e.stille && !erlaubt && (
            <div className="pomodoro-stille">
              <p className="klein-leise">
                Dafür braucht die App einmal den „Zugriff auf Nicht stören“. Sie schaltet damit nur ihre eigene Regel „Lernzeit“ an und zum Ende der Lernzeit
                wieder aus, auch wenn sie im Hintergrund ist. Deine übrigen Einstellungen bleiben, wie sie sind.
              </p>
              <button type="button" className="knopf haupt klein" onClick={stilleAnfragen}>
                Zugriff erlauben
              </button>
            </div>
          )}
        </>
      )}
      <p className="klein-leise">Gilt nur für dieses Gerät. Der Ton kommt nur, wenn die App offen ist.{!moeglich && ' „Nicht stören“ kann die App nur am Handy einschalten.'}</p>
    </section>
  )
}
