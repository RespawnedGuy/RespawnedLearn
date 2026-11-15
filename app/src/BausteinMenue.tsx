// Menü nach dem Rechteck (Vertrag Lernen 1.8/1.9, 5.4): Name mit #Schlagworten, daneben „?“ zum Erklären, darunter alle
// Wege als Symbole, ohne „…“ (Nils 2026-11-15: wiedererkennen geht schneller als lesen). Gleich im Skript (Sammeln.tsx),
// im eigenen Notizbuch (Buch.tsx) und in der Mitschrift; welche Wege es gibt, gibt der Ort vor.
import { type CSSProperties } from 'react'
import { liesBausteinText, type Bereich, type Marke } from '@rl/kern'
import { Symbol, geheZu, mitFinger } from '@rl/oberflaeche'

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

export function SymbolKnopf({ symbol, name, hinweis, haupt, onClick }: { symbol: string; name: string; hinweis?: string; haupt?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`knopf symbol-knopf${haupt ? ' haupt' : ''}`} onClick={onClick} aria-label={name} title={hinweis ?? name}>
      <Symbol name={symbol} groesse={20} />
    </button>
  )
}

export function BausteinMenue({
  name,
  onName,
  onBaustein,
  onLernkarte,
  onAbbrechen,
  onErklaeren,
  onKopieren,
  onEinfuegen,
  zurKarte,
  bausteinTitel = 'Baustein: findet sich in allen Skripten wieder'
}: {
  name: string
  onName: (n: string) => void
  onBaustein: () => void
  onLernkarte: () => void
  onAbbrechen: () => void
  /** „?“ neben dem Namen: die KI erklärt die Stelle; ohne diese Angabe gibt es kein „?“ */
  onErklaeren?: () => void
  /** Stelle in die Ablage des Geräts (Lernen 1.12) */
  onKopieren?: () => void
  /** nur im Buch und nur mit etwas in der Ablage: die Kopie hierher legen */
  onEinfuegen?: () => void
  /** angetippte Markierung mit Karte: dorthin */
  zurKarte?: () => void
  bausteinTitel?: string
}) {
  return (
    <>
      <div className="menue-name">
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
            // Ohne preventDefault ginge das Enter nach dem Schließen an den Editor der Mitschrift, der die Markierung
            // dann durch einen Zeilenumbruch ersetzt (Text weg); Escape schlösse sonst zusätzlich den Dialog doppelt
            if (e.key === 'Enter') {
              e.preventDefault()
              onBaustein()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onAbbrechen()
            }
          }}
        />
        {onErklaeren && (
          <button type="button" className="knopf symbol-knopf frage-knopf" onClick={onErklaeren} aria-label="Erklären" title="Erklären: die KI erklärt die Stelle in einfachen Worten">
            ?
          </button>
        )}
      </div>
      <div className="reihe symbol-reihe" role="group" aria-label="Was wird aus der Stelle?">
        <SymbolKnopf symbol="baustein" name="Baustein" hinweis={bausteinTitel} haupt onClick={onBaustein} />
        <SymbolKnopf symbol="lernkarte" name="Lernkarte" hinweis="Lernkarte: die Stelle ist die Antwort" onClick={onLernkarte} />
        {onKopieren && <SymbolKnopf symbol="kopieren" name="Kopieren" hinweis="Kopieren: im Notizbuch an einer Stelle einfügen (Strg+C)" onClick={onKopieren} />}
        {onEinfuegen && <SymbolKnopf symbol="einfuegen" name="Einfügen" hinweis="Einfügen: die kopierte Stelle hierher legen (Strg+V)" onClick={onEinfuegen} />}
        {zurKarte && <SymbolKnopf symbol="zurkarte" name="Zur Karte" onClick={zurKarte} />}
        <span style={{ flex: 1 }} />
        <SymbolKnopf symbol="zu" name="Schließen" onClick={onAbbrechen} />
      </div>
    </>
  )
}
