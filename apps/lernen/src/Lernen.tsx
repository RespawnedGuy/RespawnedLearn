import { useState } from 'react'
import type { Farbe, Note } from '@rvx/kern'
import { TintenEbene, ortLink, useDaten } from '@rvx/oberflaeche'
import { Inhalt } from './Inhalt'
import { Bearbeiten } from './Bearbeiten'
import { Eintraege } from './Eintraege'
import { FragenHinweis, KapitelFragen } from './Fragen'
import { bewerte, faellige, lernkarten, type Lernkarte } from './wissen'

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

/** Alle Lernkarten mit ihrem Stand; ein Klick öffnet die Karte zum Ansehen und Bearbeiten */
function AlleKarten({ hinweis }: { hinweis?: string }) {
  const { bestand } = useDaten()
  const karten = lernkarten(bestand).map((k) => k.e)
  return (
    <div className="lernen-seite">
      <FragenHinweis />
      {hinweis && (
        <div className="leer" style={{ padding: '16px 0 0' }}>
          {hinweis}
        </div>
      )}
      <div className="seite-kopf">
        <h1 style={{ fontSize: 22 }}>Alle Lernkarten · {karten.length}</h1>
        <span style={{ flex: 1 }} />
        {!hinweis && (
          <a className="knopf haupt klein" href={ortLink('lernen')}>
            Lernrunde
          </a>
        )}
      </div>
      <Eintraege nurLernkarten eintraege={karten} />
    </div>
  )
}

/**
 * Lernen: eine Aufgabe zur Zeit. Erst selbst abrufen (und vorher einschätzen, wie sicher man ist),
 * dann aufdecken und ehrlich bewerten. Die Planung übernimmt FSRS aus dem Protokoll aller Geräte.
 * Unter `#/lernen/alle` stehen alle Karten zum Ansehen und Bearbeiten.
 */
export function Lernen({ ansicht }: { ansicht?: string }) {
  const { speicher, bestand } = useDaten()
  // Die Runde wird einmal zusammengestellt, damit sie sich beim Bewerten nicht unter der Hand ändert
  const [runde] = useState<Lernkarte[]>(() => faellige(bestand))
  const [i, setI] = useState(0)
  const [sicher, setSicher] = useState<string | null>(null)
  const [offen, setOffen] = useState(false)
  const [bearbeiten, setBearbeiten] = useState(false)
  const [farbe] = useState<Farbe>('alltag')
  const [radieren, setRadieren] = useState(false)
  const [leer, setLeer] = useState(0)
  const k = runde[i]

  if (ansicht === 'fragen') return <KapitelFragen />
  if (ansicht === 'alle') return <AlleKarten />
  if (!runde.length) return <AlleKarten hinweis="Heute ist nichts fällig. Hier sind alle deine Karten." />
  if (!k) return <AlleKarten hinweis={`Runde geschafft: ${runde.length} Karten. Morgen geht es weiter.`} />

  // Frage und Antwort frisch aus dem Bestand, damit eine Änderung sofort zu sehen ist
  const neu = bestand.dokumente.get(k.e.id)
  const abruf = neu ? lernkarten(bestand).find((x) => x.e.id === k.e.id) : undefined
  const frage = abruf?.frage ?? k.frage
  const antwort = abruf?.antwort ?? k.antwort

  const weiter = async (note: Note) => {
    await bewerte(speicher, k.e.id, note, sicher ?? undefined)
    setI(i + 1)
    setSicher(null)
    setOffen(false)
    setRadieren(false)
    setBearbeiten(false)
  }

  return (
    <div className="lernen-seite">
      <FragenHinweis />
      <div className="fortschritt" aria-label={`Karte ${i + 1} von ${runde.length}`}>
        {runde.map((_, n) => (
          <span key={n} className={n < i ? 'fertig' : n === i ? 'jetzt' : ''} />
        ))}
      </div>
      <article className="karte lern-karte">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="art">LERNKARTE</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="klein-leise">
              {i + 1} / {runde.length}
            </span>
            <a className="knopf still klein" href={ortLink('lernen', 'alle')}>
              Alle Karten
            </a>
          </span>
        </div>
        {bearbeiten && neu ? <Bearbeiten e={neu} onFertig={() => setBearbeiten(false)} /> : <div className="frage">{frage}</div>}
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
        {offen && !bearbeiten && (
          <div className="antwort">
            <Inhalt text={antwort} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {offen && !bearbeiten && neu && (
            <button type="button" className="knopf still" style={{ height: 48, marginRight: 'auto' }} onClick={() => setBearbeiten(true)}>
              Karte bearbeiten
            </button>
          )}
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
