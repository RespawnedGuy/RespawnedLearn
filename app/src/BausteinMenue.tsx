// Menü nach dem Rechteck (Vertrag Lernen 1.8/1.9, 5.4): Name mit #Schlagworten, „Baustein“, „Lernkarte“, „…“.
// Gleich im Skript (Sammeln.tsx) und im eigenen Notizbuch (Buch.tsx); was „…“ zeigt, gibt der Ort vor.
import { useState, type CSSProperties, type ReactNode } from 'react'
import { liesBausteinText, type Bereich, type Eintrag, type Marke } from '@rl/kern'
import { geheZu, mitFinger, useDaten } from '@rl/oberflaeche'
import { WISSEN } from './wissen'

/**
 * Lage des Menüs auf der Seite: unter dem Finger, wo das Rechteck losgelassen wurde; bei einer angetippten Markierung
 * unter ihr. 300 px breit, nie über den Rand der Seite.
 */
export function schwebeLage(b: Bereich, punkt?: { x: number; y: number }): CSSProperties {
  if (punkt) return { left: `max(8px, min(${punkt.x - 150}px, calc(100% - 308px)))`, top: punkt.y + 12 }
  return { left: `max(8px, min(calc(${(b.x + b.b / 2) * 100}% - 150px), calc(100% - 308px)))`, top: `calc(${(b.y + b.h) * 100}% + 8px)` }
}

/** Zur ersten Karte einer Markierung, falls sie eine hat */
export function karteVon(m: Marke | undefined): (() => void) | undefined {
  const ziel = m && liesBausteinText(m.text).verweise[0]?.ziel
  return ziel ? () => geheZu('nutzen', ziel) : undefined
}

export function BausteinMenue({
  name,
  onName,
  onBaustein,
  onLernkarte,
  onAbbrechen,
  mehr,
  zurKarte,
  bausteinTitel = 'Als Baustein merken: findet sich in allen Skripten wieder'
}: {
  name: string
  onName: (n: string) => void
  onBaustein: () => void
  onLernkarte: () => void
  onAbbrechen: () => void
  /** Knöpfe hinter „…“ */
  mehr?: ReactNode
  /** angetippte Markierung mit Karte: dorthin */
  zurKarte?: () => void
  bausteinTitel?: string
}) {
  const [offen, setOffen] = useState(false)
  return (
    <>
      <label className="unsichtbar" htmlFor="baustein-name">
        Name des Bausteins
      </label>
      <input
        id="baustein-name"
        className="eingabe"
        // am Handy nicht: die Tastatur würde die Stelle verdecken, der Name ist freiwillig
        autoFocus={!mitFinger()}
        enterKeyHint="done"
        placeholder="Name, z. B. Potenzregel #integral"
        value={name}
        onChange={(e) => onName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onBaustein()
          if (e.key === 'Escape') onAbbrechen()
        }}
      />
      <div className="reihe">
        <button type="button" className="knopf haupt klein" onClick={onBaustein} title={bausteinTitel}>
          Baustein
        </button>
        <button type="button" className="knopf klein" onClick={onLernkarte} title="Baustein mit Lernkarte: die Stelle ist die Antwort">
          Lernkarte
        </button>
        {mehr && (
          <button type="button" className="knopf klein" aria-expanded={offen} onClick={() => setOffen((m) => !m)} title="Weitere Wege">
            …
          </button>
        )}
        <button type="button" className="knopf still klein" onClick={onAbbrechen} aria-label="Nicht markieren">
          ×
        </button>
      </div>
      {offen && mehr && <div className="reihe">{mehr}</div>}
      {zurKarte && (
        <button type="button" className="knopf still klein" style={{ justifyContent: 'flex-start' }} onClick={zurKarte}>
          Zur Karte →
        </button>
      )}
    </>
  )
}

/** Markierung mit einer vorhandenen Karte verbinden */
export function Verlinken({ onWahl, onZurueck }: { onWahl: (e: Eintrag) => void; onZurueck: () => void }) {
  const { bestand } = useDaten()
  const [q, setQ] = useState('')
  const treffer = bestand
    .nachTyp(...WISSEN)
    .filter((e) => e.typ !== 'frage' && e.titel.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6)
  return (
    <>
      <input className="eingabe" autoFocus placeholder="Mit welcher Karte verbinden?" value={q} onChange={(e) => setQ(e.target.value)} />
      {treffer.map((e) => (
        <button key={e.id} type="button" className="knopf klein" style={{ justifyContent: 'flex-start' }} onClick={() => onWahl(e)}>
          {e.titel}
        </button>
      ))}
      <button type="button" className="knopf still klein" onClick={onZurueck}>
        Zurück
      </button>
    </>
  )
}
