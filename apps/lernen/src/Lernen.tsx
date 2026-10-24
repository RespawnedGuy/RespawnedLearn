import { useState } from 'react'
import type { Eintrag, Note } from '@rvx/kern'
import { ortLink, useDaten } from '@rvx/oberflaeche'
import { Abrufflaeche, KiRueckmeldung, useAbruf, type Abruf } from './Abruf'
import { Inhalt } from './Inhalt'
import { Bearbeiten } from './Bearbeiten'
import { Eintraege } from './Eintraege'
import { FragenHinweis, KapitelFragen } from './Fragen'
import { Vorfragen, VorfragenHinweis } from './Vorfragen'
import { mitschriftSpur } from './Nutzen'
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
      <VorfragenHinweis />
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
  const k = runde[i]

  if (ansicht === 'fragen') return <KapitelFragen />
  if (ansicht === 'vorfragen') return <Vorfragen />
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
    setBearbeiten(false)
  }

  return (
    <div className="lernen-seite">
      <VorfragenHinweis />
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
        <KartenAbruf key={i} frage={frage} antwort={antwort} offen={offen} />
        {offen && !bearbeiten && (
          <div className="antwort">
            <Inhalt text={antwort} />
          </div>
        )}
        {offen && !bearbeiten && neu && <MitschriftLink e={neu} />}
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
    </div>
  )
}

/** Schreibfläche einer Lernkarte; die KI-Rückmeldung nur, wenn die Antwort Text hat (nicht nur ein Ausschnitt als Bild) */
function KartenAbruf({ frage, antwort, offen }: { frage: string; antwort: string; offen: boolean }) {
  const abruf: Abruf = useAbruf()
  const mitText = antwort.replace(/!?\[\[[^\]]*\]\]/g, '').trim().length >= 15
  return (
    <>
      {!offen && <Abrufflaeche abruf={abruf} />}
      {mitText && <KiRueckmeldung abruf={abruf} art="karte" frage={frage} muster={antwort} fest={offen} />}
    </>
  )
}

/** Nach dem Aufdecken: zurück an die Stelle in der Mitschrift, aus der die Karte stammt */
function MitschriftLink({ e }: { e: Eintrag }) {
  const { bestand } = useDaten()
  const s = mitschriftSpur(bestand, e)
  if (!s) return null
  return (
    <a className="klein-leise" href={s.link}>
      In der Mitschrift: {s.titel}
      {s.abschnitt.length ? ` › ${s.abschnitt.join(' › ')}` : ''}
    </a>
  )
}
