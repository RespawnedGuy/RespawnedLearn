import { useEffect, useState } from 'react'
import { fragenStand, hilfeStufen, kapitelOhneFragen, lesestand, loesungsweg, merkeFrage, neuesDokument, offeneFragen, pfade, ulid, zeitstempel, type OffeneFrage, type Wert } from '@rl/kern'
import { geraet, ortLink, useDaten, type Speicher } from '@rl/oberflaeche'
import { Abrufflaeche, KiRueckmeldung, useAbruf } from './Abruf'
import { Inhalt } from './Inhalt'
import { aktiverZugang, useKiZugang } from './kianbieter/zugang'
import { kapitelfragenJetzt, kapitelfragenLaufen } from './fragenWerkzeug'
import { fehlerText } from './ki'

/** Stand der KI auf diesem Gerät: ohne eingerichtete KI sagt die App es, statt still keine Fragen zu zeigen */
function useKi(): { bereit: boolean; grund?: string } | null {
  const z = useKiZugang()
  if (!z) return null
  return aktiverZugang(z) ? { bereit: true } : { bereit: false, grund: 'Unter Einstellungen › KI einen Anbieter einrichten.' }
}

export function useOffeneFragen(): OffeneFrage[] {
  const { bestand } = useDaten()
  return offeneFragen(bestand, lesestand(bestand))
}

/** Hinweis über der Lernrunde: es gibt Fragen zu Kapiteln, die gerade gelesen werden */
export function FragenHinweis() {
  const { bestand } = useDaten()
  const offen = useOffeneFragen()
  const ki = useKi()
  if (!offen.length) {
    // Angebot nur, wenn eine KI eingerichtet ist und das aktuelle Kapitel noch keine fertigen Fragen hat
    const ohne = ki?.bereit ? kapitelOhneFragen(bestand, Date.now()) : []
    if (!ohne.length) return null
    return (
      <a className="karte fragen-hinweis" href={ortLink('lernen', 'fragen')}>
        <span>
          <b>Fragen zu deinem Kapitel</b>
          <span className="klein-leise"> · {ohne[0].kapitel}</span>
        </span>
        <span className="knopf klein">Erzeugen</span>
      </a>
    )
  }
  const buch = bestand.dokumente.get(offen[0].anhang)?.titel ?? 'deinem Buch'
  return (
    <a className="karte fragen-hinweis" href={ortLink('lernen', 'fragen')}>
      <span>
        <b>
          {offen.length} {offen.length === 1 ? 'Frage' : 'Fragen'} zu deinem Kapitel
        </b>
        <span className="klein-leise">
          {' '}
          · {offen[0].kapitel} · {buch}
        </span>
      </span>
      <span className="knopf haupt klein">Beantworten</span>
    </a>
  )
}

const ART: Record<OffeneFrage['art'], { name: string; zeigen: string }> = {
  verstaendnis: { name: 'VERSTÄNDNISFRAGE', zeigen: 'Antwort prüfen' },
  sokratisch: { name: 'SOKRATISCHE FRAGE', zeigen: 'Denkanstöße zeigen' },
  rechnen: { name: 'RECHENAUFGABE', zeigen: 'Ergebnis prüfen' }
}

function merke(speicher: Speicher, q: OffeneFrage, wie: 'erledigt' | 'karte', karte?: string) {
  return speicher.aendere(pfade.fragenStand(geraet()), (alt) => merkeFrage(alt, q.schluessel, { am: new Date().toISOString(), wie, ...(karte ? { karte } : {}) }))
}

/** Frage als Lernkarte übernehmen: ab dann plant FSRS die Wiederholung */
async function alsKarte(speicher: Speicher, q: OffeneFrage, buch: string): Promise<string> {
  const id = ulid()
  const jetzt = zeitstempel()
  const titel = q.frage.length > 90 ? `${q.frage.slice(0, 89).trimEnd()}…` : q.frage
  const kopf: [string, Wert][] = [
    ['id', id],
    ['typ', 'frage'],
    ['erstellt', jetzt],
    ['geaendert', jetzt],
    ['titel', titel],
    ['quelle', `[[${q.anhang}]]`]
  ]
  const antwort = (q.art === 'rechnen' ? loesungsweg(q) : q.antwort).trim().replace(/\n\s*\n/g, '\n')
  const rumpf = `?? ${q.frage.replace(/\n/g, ' ')}\n:: ${antwort}\n\nAus [[${q.anhang}#seite=${q.seite}|${buch.replace(/[\]|]/g, '')}, S. ${q.seite}]]\n`
  await speicher.schreibe(pfade.karte(id), neuesDokument(kopf, rumpf))
  return id
}

/**
 * Fragen zum Kapitel (`#/lernen/fragen`): erst aus dem Gedächtnis antworten (Schreibfläche, wird nicht gespeichert),
 * dann aufdecken. Danach als Lernkarte übernehmen, damit sie wiederkommt, oder als erledigt abhaken.
 */
export function KapitelFragen() {
  const { speicher, bestand } = useDaten()
  const ki = useKi()
  // die Reihe einmal festhalten, damit sie sich beim Abhaken nicht verschiebt
  const [reihe, setReihe] = useState(() => offeneFragen(bestand, lesestand(bestand)))
  const [i, setI] = useState(0)
  const [offen, setOffen] = useState(false)
  /** Rechenaufgaben: wie viele Hilfestufen aufgedeckt sind */
  const [stufe, setStufe] = useState(0)
  const q = reihe[i]
  const erledigt = fragenStand(bestand)

  const weiter = () => {
    setI(i + 1)
    setOffen(false)
    setStufe(0)
  }

  if (!q) {
    return (
      <div className="lernen-seite">
        <div className="seite-kopf">
          <h1 style={{ fontSize: '1.375rem' }}>Fragen zum Kapitel</h1>
          <span style={{ flex: 1 }} />
          <a className="knopf klein" href={ortLink('lernen')}>
            Zur Lernrunde
          </a>
        </div>
        <p className="leer">
          {reihe.length
            ? `Geschafft: ${reihe.length} ${reihe.length === 1 ? 'Frage' : 'Fragen'}.`
            : 'Gerade sind keine Fragen offen. Sie entstehen zu dem Kapitel, in dem du liest, und erscheinen, sobald du den Stoff gelesen hast.'}
        </p>
        {ki && !ki.bereit ? (
          <p className="klein-leise">
            KI: {ki.grund} <a href={ortLink('einstellungen')}>Zu den Einstellungen</a>
          </p>
        ) : (
          <FragenErzeugen
            nachher={() => {
              setReihe(offeneFragen(bestand, lesestand(bestand)))
              setI(0)
            }}
          />
        )}
      </div>
    )
  }

  const buch = bestand.dokumente.get(q.anhang)?.titel ?? 'Buch'
  const schonErledigt = !!erledigt[q.schluessel]
  // eine Rechenaufgabe ist durch, wenn das Ergebnis geprüft oder der ganze Weg aufgedeckt ist
  const durch = offen || (q.art === 'rechnen' && stufe > 0 && stufe >= hilfeStufen(q).length)

  return (
    <div className="lernen-seite">
      <div className="fortschritt" aria-label={`Frage ${i + 1} von ${reihe.length}`}>
        {reihe.map((_, n) => (
          <span key={n} className={n < i ? 'fertig' : n === i ? 'jetzt' : ''} />
        ))}
      </div>
      <article className="karte lern-karte">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="art">{ART[q.art].name}</span>
          <span className="klein-leise">
            {i + 1} / {reihe.length}
          </span>
        </div>
        <div className="frage">
          <Inhalt text={q.frage} />
        </div>
        <FrageInhalt key={i} q={q} offen={offen} stufe={stufe} setStufe={setStufe} />
        <div className="klein-leise">
          {q.kapitel} ·{' '}
          <a href={ortLink('sammeln', q.anhang, q.seite)}>
            {buch}, S. {q.seite}
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="knopf still" style={{ height: 48, marginRight: 'auto' }} onClick={weiter}>
            Später
          </button>
          {!durch ? (
            <button type="button" className="knopf haupt" style={{ height: 48 }} onClick={() => setOffen(true)}>
              {ART[q.art].zeigen}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="knopf"
                style={{ height: 48 }}
                disabled={schonErledigt}
                onClick={async () => {
                  const karte = await alsKarte(speicher, q, buch)
                  await merke(speicher, q, 'karte', karte)
                  weiter()
                }}
              >
                Als Lernkarte
              </button>
              <button
                type="button"
                className="knopf haupt"
                style={{ height: 48 }}
                onClick={async () => {
                  if (!schonErledigt) await merke(speicher, q, 'erledigt')
                  weiter()
                }}
              >
                Erledigt
              </button>
            </>
          )}
        </div>
      </article>
      <p className="klein-leise">Die Fragen erzeugt eine KI aus dem Text des Kapitels. Stimmt etwas nicht, prüfe die Stelle im Buch.</p>
    </div>
  )
}

/** Rechnung samt Zwischenergebnis; steht das Ergebnis schon am Ende der Rechnung, nicht doppelt */
const knapp = (t: string) => t.replace(/[\s$]/g, '')
const mitErgebnis = (rechnung: string, ergebnis: string) => (!ergebnis || knapp(rechnung).endsWith(knapp(ergebnis)) ? rechnung : `${rechnung} → ${ergebnis}`)

const HILFE_KNOPF = { tipp: 'Tipp', ziel: 'Nächstes Teilziel', rechnung: 'Rechnung zeigen' } as const

/**
 * Schreibfläche, Rückmeldung und Lösung einer Frage. Rechenaufgaben: Die Fläche bleibt stehen, Hilfe gibt es in
 * Stufen (Tipps, dann je Schritt erst das Teilziel, dann die Rechnung), das Ergebnis lässt sich für sich prüfen.
 * Der gezeigte Weg ist einer von mehreren; den eigenen prüft die KI-Rückmeldung.
 */
function FrageInhalt({ q, offen, stufe, setStufe }: { q: OffeneFrage; offen: boolean; stufe: number; setStufe: (n: number) => void }) {
  const abruf = useAbruf()
  const rechnen = q.art === 'rechnen'
  const stufen = rechnen ? hilfeStufen(q) : []
  const gezeigt = stufen.slice(0, stufe)
  const naechste = stufen[stufe]
  const schritte = gezeigt.filter((h) => h.art !== 'tipp')
  return (
    <>
      {(!offen || rechnen) && (
        <Abrufflaeche
          abruf={abruf}
          format={rechnen ? 0.6 : 0.32}
          hinweis={rechnen ? 'Rechne auf dem Blatt. Hilfe gibt es in Stufen, nur so viel wie du brauchst.' : q.art === 'sokratisch' ? 'Denk laut auf dem Blatt: Was spricht dafür, was dagegen?' : 'Erst aus dem Gedächtnis antworten, in eigenen Worten.'}
        />
      )}
      <KiRueckmeldung
        abruf={abruf}
        art={q.art}
        frage={q.frage}
        muster={rechnen ? loesungsweg(q) : q.antwort}
        knopf={rechnen ? 'Meinen Weg prüfen' : 'Rückmeldung'}
        fest={offen && !rechnen}
        extra={
          naechste && (
            <button type="button" className="knopf klein" onClick={() => setStufe(stufe + 1)}>
              {HILFE_KNOPF[naechste.art]}
              {naechste.art === 'tipp' && stufen.filter((h) => h.art === 'tipp').length > 1 ? ` ${naechste.nr}` : ''}
            </button>
          )
        }
      />
      {gezeigt.length > 0 && (
        <div className="hilfe">
          {gezeigt.map((h) =>
            h.art === 'tipp' ? (
              <div key={`t${h.nr}`} className="hilfe-tipp">
                <span className="rueckmeldung-titel">Tipp</span>
                <Inhalt text={h.text} />
              </div>
            ) : null
          )}
          {schritte.some((h) => h.art === 'ziel') && <span className="rueckmeldung-titel">Ein möglicher Weg</span>}
          {schritte
            .filter((h) => h.art === 'ziel')
            .map((h) => (
              <div key={`s${h.nr}`} className="hilfe-schritt">
                <Inhalt text={`${h.nr}. ${h.schritt.ziel}`} />
                {schritte.some((x) => x.art === 'rechnung' && x.nr === h.nr) && <Inhalt text={mitErgebnis(h.schritt.rechnung, h.schritt.ergebnis)} />}
              </div>
            ))}
        </div>
      )}
      {offen && (
        <div className="antwort">
          {rechnen ? <Inhalt text={`Ergebnis: ${q.antwort}`} /> : <Inhalt text={q.antwort} />}
        </div>
      )}
      {rechnen && q.wege && (offen || (stufe > 0 && stufe >= stufen.length)) && <p className="klein-leise">Andere Wege: {q.wege}</p>}
    </>
  )
}

/**
 * Knopf „Fragen erzeugen“: liest das aktuelle Kapitel Stück für Stück und fragt die KI. Was fertig ist, steht sofort
 * im Datenordner; ein Abbruch verliert nichts.
 */
function FragenErzeugen({ nachher }: { nachher: () => void }) {
  const { speicher, bestand } = useDaten()
  const [laeuft, setLaeuft] = useState(kapitelfragenLaufen)
  const [stand, setStand] = useState('')
  const [ergebnis, setErgebnis] = useState<{ gut: boolean; text: string } | null>(null)
  const ohne = kapitelOhneFragen(bestand, Date.now())
  const los = async () => {
    setLaeuft(true)
    setErgebnis(null)
    try {
      const r = await kapitelfragenJetzt(speicher, setStand)
      setErgebnis(
        r.hinweis
          ? { gut: false, text: r.hinweis }
          : { gut: true, text: r.neu ? `${r.neu} neue ${r.neu === 1 ? 'Frage' : 'Fragen'}. Jede erscheint, sobald du bis zu ihrer Seite gelesen hast.` : 'Keine neuen Fragen: Das Kapitel ist schon bearbeitet oder hat kaum Text.' }
      )
    } catch (e) {
      setErgebnis({ gut: false, text: fehlerText(e) })
    } finally {
      setLaeuft(false)
      setStand('')
    }
  }
  // läuft der Lauf schon (aus einer anderen Ansicht), hier anhängen, damit Stand und Ende sichtbar sind
  useEffect(() => {
    if (laeuft) void los()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // neue Fragen in die Reihe holen, sobald sie da sind
  useEffect(() => {
    if (ergebnis?.gut) nachher()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ergebnis])
  if (!ohne.length && !laeuft && !ergebnis) return null
  return (
    <div className="fragen-erzeugen">
      {laeuft ? (
        <p className="klein-leise" role="status">
          {stand || 'Liest das Kapitel …'} · etwa eine halbe Minute je Abschnitt
        </p>
      ) : (
        ohne.length > 0 && (
          <button type="button" className="knopf haupt" onClick={() => void los()}>
            Fragen zu „{ohne[0].kapitel}“ erzeugen
          </button>
        )
      )}
      {ergebnis && (
        <p className={ergebnis.gut ? 'meldung-gut' : 'meldung-schlecht'} role="status">
          {ergebnis.text} {/Einstellungen/.test(ergebnis.text) && <a href={ortLink('einstellungen')}>Zu den Einstellungen</a>}
        </p>
      )}
      {!laeuft && !ergebnis && <p className="klein-leise">Die KI liest dafür den Text des Kapitels (bis zu 40 Seiten); der Anbieter rechnet das nach Verbrauch ab.</p>}
    </div>
  )
}
