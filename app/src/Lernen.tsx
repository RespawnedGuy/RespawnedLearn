import { useState } from 'react'
import type { Eintrag, Note } from '@rl/kern'
import { ortLink, useDaten } from '@rl/oberflaeche'
import { Abrufflaeche, KiRueckmeldung, useAbruf, type Abruf } from './Abruf'
import { Inhalt } from './Inhalt'
import { Bearbeiten } from './Bearbeiten'
import { Eintraege } from './Eintraege'
import { FragenHinweis, KapitelFragen } from './Fragen'
import { Vorfragen, VorfragenHinweis } from './Vorfragen'
import { mitschriftSpur } from './Nutzen'
import { bewerte, lernkarten, naechsteAbstaende, type Lernkarte } from './wissen'
import { allgemeineRunde, einordnen, modulRunde, type Auswahl } from './modulkarten'
import { useLernzeit } from './lernzeitMessen'

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
        <h1 style={{ fontSize: '1.375rem' }}>Alle Lernkarten · {karten.length}</h1>
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
export function Lernen({ ort }: { ort: string[] }) {
  const ansicht = ort[1]
  const { speicher, bestand } = useDaten()
  // `#/lernen/modul/<id>[/<mitschrift>/<zeile>]`: nur dieses Modul (oder ein Teil seiner Mitschrift), geordnet
  const auswahl: Auswahl | null = ansicht === 'modul' && ort[2] ? { modul: ort[2], teil: ort[3] && ort[4] ? [ort[3], Number(ort[4]) || 0] : undefined } : null
  const modul = auswahl ? bestand.dokumente.get(auswahl.modul) : undefined
  // Die Runde wird einmal zusammengestellt, damit sie sich beim Bewerten nicht unter der Hand ändert
  const [runde] = useState<Lernkarte[]>(() => (auswahl ? modulRunde(bestand, auswahl) : allgemeineRunde(bestand)))
  const [i, setI] = useState(0)
  const [sicher, setSicher] = useState<string | null>(null)
  const [offen, setOffen] = useState(false)
  const [bearbeiten, setBearbeiten] = useState(false)
  const k = runde[i]
  const lernModul = auswahl?.modul ?? (k ? einordnen(bestand, k.e).modul : null)
  useLernzeit(!ansicht || ansicht === 'modul' ? (lernModul ? { ziel: lernModul, art: 'lernen' } : null) : null)

  if (ansicht === 'fragen') return <KapitelFragen />
  if (ansicht === 'vorfragen') return <Vorfragen />
  if (ansicht === 'alle') return <AlleKarten />
  if (auswahl && !k) return <ModulFertig modulId={auswahl.modul} titel={modul?.titel ?? 'Modul'} geschafft={runde.length} />
  if (!runde.length) return <AlleKarten hinweis="Heute ist nichts fällig. Hier sind alle deine Karten." />
  if (!k) return <AlleKarten hinweis={`Runde geschafft: ${runde.length} Karten. Morgen geht es weiter.`} />
  const wo = einordnen(bestand, k.e)
  const woModul = !auswahl && wo.modul ? bestand.dokumente.get(wo.modul)?.titel : undefined
  const woText = [woModul, ...wo.abschnitt].filter(Boolean).join(' › ')

  // Frage und Antwort frisch aus dem Bestand, damit eine Änderung sofort zu sehen ist
  const neu = bestand.dokumente.get(k.e.id)
  const abruf = neu ? lernkarten(bestand).find((x) => x.e.id === k.e.id) : undefined
  const frage = abruf?.frage ?? k.frage
  const antwort = abruf?.antwort ?? k.antwort

  const abstaende = naechsteAbstaende(bestand, k.e.id)

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
      <h1 className="nur-vorleser">Lernen</h1>
      <div className="fortschritt" role="progressbar" aria-label="Lernrunde" aria-valuemin={1} aria-valuemax={runde.length} aria-valuenow={i + 1} aria-valuetext={`Karte ${i + 1} von ${runde.length}`}>
        {runde.map((_, n) => (
          <span key={n} className={n < i ? 'fertig' : n === i ? 'jetzt' : ''} />
        ))}
      </div>
      <article className="karte lern-karte">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="art">{modul ? modul.titel.toUpperCase() : 'LERNKARTE'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="klein-leise">
              {i + 1} / {runde.length}
            </span>
            <a className="knopf still klein" href={ortLink('lernen', 'alle')}>
              Alle Karten
            </a>
          </span>
        </div>
        {woText && !bearbeiten && <div className="klein-leise lern-wo">{woText}</div>}
        {bearbeiten && neu ? <Bearbeiten e={neu} onFertig={() => setBearbeiten(false)} /> : <div className="frage" role="heading" aria-level={2}>{frage}</div>}
        {!offen && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="klein-leise">Wie sicher bist du vorher?</span>
            {SICHER.map(([id, text]) => (
              <button key={id} type="button" className={`knopf klein${sicher === id ? ' haupt' : ''}`} style={{ borderRadius: 18 }} onClick={() => setSicher(id)} aria-pressed={sicher === id}>
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
        {!offen ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="knopf haupt" style={{ height: 48 }} onClick={() => setOffen(true)}>
              Lösung prüfen
            </button>
          </div>
        ) : (
          <>
            {/* Vier gleiche Knöpfe, darunter wann die Karte wiederkommt (FSRS) */}
            <div className="bewertung" role="group" aria-label="Wie gut wusstest du es?">
              {NOTEN.map(([n, text]) => (
                <button key={n} type="button" className="knopf" onClick={() => void weiter(n)}>
                  {text}{' '}
                  <span className="abstand">{abstaende[n]}</span>
                </button>
              ))}
            </div>
            {!bearbeiten && neu && (
              <button type="button" className="knopf still klein" style={{ alignSelf: 'flex-start' }} onClick={() => setBearbeiten(true)}>
                Karte bearbeiten
              </button>
            )}
          </>
        )}
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

/** Ende einer Modulrunde (oder nichts fällig): zurück zum Modul oder weiter mit der allgemeinen Runde */
function ModulFertig({ modulId, titel, geschafft }: { modulId: string; titel: string; geschafft: number }) {
  return (
    <div className="lernen-seite">
      <div className="karte lern-karte" style={{ gap: 14 }}>
        <span className="art">{titel.toUpperCase()}</span>
        <div className="frage" style={{ fontSize: '1.375rem' }}>
          {geschafft ? `Runde geschafft: ${geschafft} ${geschafft === 1 ? 'Karte' : 'Karten'}.` : 'Hier ist heute nichts fällig.'}
        </div>
        <div className="reihe">
          <a className="knopf" href={ortLink('sammeln', 'modul', modulId)}>
            Zum Modul
          </a>
          <a className="knopf haupt" href={ortLink('lernen')}>
            Allgemeine Runde
          </a>
        </div>
      </div>
    </div>
  )
}
