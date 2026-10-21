import { useState } from 'react'
import type { Farbe, Note } from '@rvx/kern'
import { TintenEbene, ortLink, useDaten } from '@rvx/oberflaeche'
import { Inhalt } from './Inhalt'
import { bewerte, faellige, type Lernkarte } from './wissen'

const SICHER = [
  ['unsicher', 'unsicher'],
  ['eher_sicher', 'eher sicher'],
  ['sicher', 'sicher']
] as const

const NOTEN: [Note, string][] = [
  ['nochmal', 'Nochmal'],
  ['schwer', 'Schwer'],
  ['gut', 'Gut'],
  ['leicht', 'Leicht']
]

/**
 * Lernen: eine Aufgabe zur Zeit. Erst selbst abrufen (und vorher einschätzen, wie sicher man ist),
 * dann aufdecken und ehrlich bewerten. Die Planung übernimmt FSRS aus dem Protokoll aller Geräte.
 */
export function Lernen() {
  const { speicher, bestand } = useDaten()
  // Die Runde wird einmal zusammengestellt, damit sie sich beim Bewerten nicht unter der Hand ändert
  const [runde] = useState<Lernkarte[]>(() => faellige(bestand))
  const [i, setI] = useState(0)
  const [sicher, setSicher] = useState<string | null>(null)
  const [offen, setOffen] = useState(false)
  const [farbe] = useState<Farbe>('alltag')
  const [radieren, setRadieren] = useState(false)
  const [leer, setLeer] = useState(0)
  const k = runde[i]

  if (!runde.length)
    return (
      <div className="seite" style={{ maxWidth: 820 }}>
        <div className="leer">
          Heute ist nichts fällig. <a href={ortLink('sammeln')}>Weiter sammeln</a> oder in <a href={ortLink('nutzen')}>Nutzen</a> nachschlagen.
        </div>
      </div>
    )
  if (!k)
    return (
      <div className="seite" style={{ maxWidth: 820 }}>
        <div className="leer">Runde geschafft: {runde.length} Karten. Morgen geht es weiter.</div>
      </div>
    )

  const weiter = async (note: Note) => {
    await bewerte(speicher, k.e.id, note, sicher ?? undefined)
    setI(i + 1)
    setSicher(null)
    setOffen(false)
    setRadieren(false)
  }

  return (
    <div className="lernen-seite">
      <div className="fortschritt" aria-label={`Karte ${i + 1} von ${runde.length}`}>
        {runde.map((_, n) => (
          <span key={n} className={n < i ? 'fertig' : n === i ? 'jetzt' : ''} />
        ))}
      </div>
      <article className="karte lern-karte">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span className="art">LERNKARTE</span>
          <span className="klein-leise">
            {i + 1} / {runde.length}
          </span>
        </div>
        <div className="frage">{k.frage}</div>
        {!offen && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="klein-leise">Wie sicher bist du vorher?</span>
            {SICHER.map(([id, text]) => (
              <button key={id} type="button" className={`knopf klein${sicher === id ? ' haupt' : ''}`} style={{ borderRadius: 18 }} onClick={() => setSicher(id)}>
                {text}
              </button>
            ))}
          </div>
        )}
        {/* Schreibfläche zum Abrufen: wird nicht gespeichert, es zählt das Abrufen selbst */}
        {!offen && (
          <div className="schreibflaeche-huelle">
            <div className="schreibflaeche pdf-seite zeichnen">
              <TintenEbene key={`${i}-${leer}`} pfad="" format={0.32} werkzeug={radieren ? 'radierer' : 'stift'} farbe={farbe} fluechtig />
            </div>
            {/* Radieren auch ohne Stiftrückseite */}
            <div className="schreib-werkzeug" role="toolbar" aria-label="Schreibfläche">
              <button type="button" className={`knopf klein${!radieren ? ' haupt' : ''}`} onClick={() => setRadieren(false)}>
                Stift
              </button>
              <button type="button" className={`knopf klein${radieren ? ' haupt' : ''}`} onClick={() => setRadieren(true)}>
                Radierer
              </button>
              <button type="button" className="knopf klein still" onClick={() => setLeer(leer + 1)}>
                Leeren
              </button>
            </div>
          </div>
        )}
        {offen && (
          <div className="antwort">
            <Inhalt text={k.antwort} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {!offen ? (
            <button type="button" className="knopf haupt" style={{ height: 48 }} onClick={() => setOffen(true)}>
              Lösung prüfen
            </button>
          ) : (
            NOTEN.map(([n, text]) => (
              <button key={n} type="button" className={`knopf${n === 'gut' ? ' haupt' : ''}`} style={{ height: 48 }} onClick={() => void weiter(n)}>
                {text}
              </button>
            ))
          )}
        </div>
      </article>
      <p className="klein-leise">Weitere Aufgabenarten (Rechnen, Lückentext, Multiple Choice, Erklären) erzeugt später die Pipeline aus deinen Karten.</p>
    </div>
  )
}
