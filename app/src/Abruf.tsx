import { useEffect, useRef, useState } from 'react'
import type { Farbe } from '@rl/kern'
import { TintenEbene } from '@rl/oberflaeche'
import { Inhalt } from './Inhalt'
import { rueckmeldung, schriftBild, type Rueckmeldung } from './ki'

/** Was auf der Schreibfläche steht: Handschrift (über `huelle`) und Getipptes */
export interface Abruf {
  huelle: React.RefObject<HTMLDivElement | null>
  text: string
  setText: (t: string) => void
}

export function useAbruf(): Abruf {
  const huelle = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  return { huelle, text, setText }
}

/**
 * Schreibfläche zum Abrufen: Stift (wird nicht gespeichert, es zählt das Abrufen selbst) oder getippt.
 * Radieren geht auch ohne Stiftrückseite. `format` ist Höhe/Breite, für Rechenwege höher.
 */
export function Abrufflaeche({ abruf, hinweis, format = 0.32 }: { abruf: Abruf; hinweis?: string; format?: number }) {
  const [radieren, setRadieren] = useState(false)
  const [tippen, setTippen] = useState(false)
  const [leer, setLeer] = useState(0)
  const [farbe] = useState<Farbe>('alltag')
  return (
    <div className="schreibflaeche-huelle">
      {hinweis && <span className="klein-leise">{hinweis}</span>}
      {/* die Handschrift bleibt beim Tippen erhalten, sie wird nur versteckt */}
      <div ref={abruf.huelle} className="schreibflaeche pdf-seite zeichnen" style={{ aspectRatio: `1 / ${format}`, display: tippen ? 'none' : undefined }}>
        <TintenEbene key={leer} pfad="" format={format} werkzeug={radieren ? 'radierer' : 'stift'} farbe={farbe} fluechtig />
      </div>
      {tippen && <textarea className="abruf-text" rows={Math.max(3, Math.round(format * 12))} value={abruf.text} onChange={(e) => abruf.setText(e.target.value)} placeholder="Deine Antwort" autoFocus />}
      <div className="schreib-werkzeug" role="toolbar" aria-label="Schreibfläche">
        {!tippen && (
          <>
            <button type="button" className={`knopf klein${!radieren ? ' haupt' : ''}`} onClick={() => setRadieren(false)}>
              Stift
            </button>
            <button type="button" className={`knopf klein${radieren ? ' haupt' : ''}`} onClick={() => setRadieren(true)}>
              Radierer
            </button>
            <button type="button" className="knopf klein still" onClick={() => setLeer(leer + 1)}>
              Leeren
            </button>
          </>
        )}
        <button type="button" className="knopf klein still" onClick={() => setTippen(!tippen)}>
          {tippen ? 'Schreiben' : 'Tippen'}
        </button>
      </div>
    </div>
  )
}

const URTEIL: Record<Rueckmeldung['urteil'], string> = { richtig: 'Stimmt', teilweise: 'Teilweise', falsch: 'Noch nicht', leer: 'Nichts zu lesen' }

/**
 * KI-Rückmeldung auf die eigene Antwort: was stimmt, was fehlt, der erste Fehler und ein nächster Schritt,
 * ohne die Lösung zu verraten. Danach kann man es noch einmal versuchen und erneut prüfen lassen.
 */
export function KiRueckmeldung({
  abruf,
  art,
  frage,
  muster,
  knopf = 'Rückmeldung',
  fest,
  extra
}: {
  abruf: Abruf
  art: string
  frage: string
  muster: string
  knopf?: string
  /** nach dem Aufdecken: nur noch die letzte Rückmeldung zeigen, ohne Knopf */
  fest?: boolean
  /** weitere Knöpfe in derselben Reihe */
  extra?: React.ReactNode
}) {
  const [zustand, setZustand] = useState<'ruht' | 'laeuft' | 'fehler'>('ruht')
  const [r, setR] = useState<Rueckmeldung | null>(null)
  const ab = useRef<AbortController | null>(null)
  useEffect(() => () => ab.current?.abort(), [])

  const pruefe = async () => {
    ab.current?.abort()
    ab.current = new AbortController()
    setZustand('laeuft')
    const bild = await schriftBild(abruf.huelle.current).catch(() => null)
    const antwort = await rueckmeldung({ art, frage, muster, antwort: abruf.text, bild }, ab.current.signal)
    if (ab.current.signal.aborted) return
    setR(antwort)
    setZustand(antwort ? 'ruht' : 'fehler')
  }

  return (
    <div className="rueckmeldung-huelle">
      {(!fest || extra) && (
        <div className="rueckmeldung-knoepfe">
          {!fest && (
            <button type="button" className="knopf klein" disabled={zustand === 'laeuft'} onClick={() => void pruefe()}>
              {zustand === 'laeuft' ? 'Die KI liest deine Antwort …' : r ? 'Nochmal prüfen' : knopf}
            </button>
          )}
          {extra}
          {zustand === 'fehler' && !fest && <span className="klein-leise">Die KI ist gerade nicht erreichbar.</span>}
        </div>
      )}
      {r && zustand !== 'laeuft' && (
        <div className={`rueckmeldung ${r.urteil}`}>
          <b>{URTEIL[r.urteil]}</b>
          {r.gelesen && <span className="klein-leise">Gelesen: {r.gelesen}</span>}
          <Liste titel="Stimmt" punkte={r.richtig} />
          <Liste titel="Fehlt" punkte={r.fehlt} />
          <Liste titel="Fehler" punkte={r.fehler} />
          {r.tipp && (
            <div>
              <span className="rueckmeldung-titel">Nächster Schritt</span>
              <Inhalt text={r.tipp} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Liste({ titel, punkte }: { titel: string; punkte: string[] }) {
  if (!punkte.length) return null
  return (
    <div>
      <span className="rueckmeldung-titel">{titel}</span>
      <Inhalt text={punkte.map((p) => `- ${p}`).join('\n')} />
    </div>
  )
}
