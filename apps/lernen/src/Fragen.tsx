import { useEffect, useState } from 'react'
import { fragenStand, lesestand, merkeFrage, neuesDokument, offeneFragen, pfade, ulid, zeitstempel, type Farbe, type OffeneFrage, type Wert } from '@rvx/kern'
import { TintenEbene, geraet, ortLink, useDaten, type Speicher } from '@rvx/oberflaeche'
import { Inhalt } from './Inhalt'

interface KiStand {
  bereit: boolean
  grund?: string
  laeuft?: boolean
}

let angestossen = false

/** Stand der KI auf dem Server; stößt einmal pro Sitzung eine Runde an, damit ein neues Kapitel bald Fragen hat */
function useKi(): KiStand | null {
  const [stand, setStand] = useState<KiStand | null>(null)
  useEffect(() => {
    let weg = false
    const ziel = angestossen ? fetch('/api/fragen') : fetch('/api/fragen/jetzt', { method: 'POST' })
    angestossen = true
    ziel
      .then((r) => (r.ok ? (r.json() as Promise<KiStand>) : null))
      .then((s) => !weg && setStand(s))
      .catch(() => undefined)
    return () => {
      weg = true
    }
  }, [])
  return stand
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
  // fehlt auf dem Server etwas, sagt die App es hier, statt still keine Fragen zu zeigen
  if (!offen.length) return ki && !ki.bereit ? <p className="klein-leise">Fragen zum Kapitel: {ki.grund}</p> : null
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
  sokratisch: { name: 'SOKRATISCHE FRAGE', zeigen: 'Denkanstöße zeigen' }
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
  const antwort = q.antwort.trim().replace(/\n\s*\n/g, '\n')
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
  const [reihe] = useState(() => offeneFragen(bestand, lesestand(bestand)))
  const [i, setI] = useState(0)
  const [offen, setOffen] = useState(false)
  const [radieren, setRadieren] = useState(false)
  const [leer, setLeer] = useState(0)
  const [farbe] = useState<Farbe>('alltag')
  const q = reihe[i]
  const erledigt = fragenStand(bestand)

  const weiter = () => {
    setI(i + 1)
    setOffen(false)
    setRadieren(false)
  }

  if (!q) {
    return (
      <div className="lernen-seite">
        <div className="seite-kopf">
          <h1 style={{ fontSize: 22 }}>Fragen zum Kapitel</h1>
          <span style={{ flex: 1 }} />
          <a className="knopf klein" href={ortLink('lernen')}>
            Zur Lernrunde
          </a>
        </div>
        <p className="leer">
          {reihe.length
            ? `Geschafft: ${reihe.length} ${reihe.length === 1 ? 'Frage' : 'Fragen'}.`
            : 'Gerade sind keine Fragen offen. Sie entstehen auf dem Server zu dem Kapitel, in dem du liest, und erscheinen, sobald du den Stoff gelesen hast.'}
        </p>
        {ki && !ki.bereit && <p className="klein-leise">KI auf dem Server: {ki.grund}</p>}
        {ki?.laeuft && <p className="klein-leise">Der Server erzeugt gerade Fragen.</p>}
      </div>
    )
  }

  const buch = bestand.dokumente.get(q.anhang)?.titel ?? 'Buch'
  const schonErledigt = !!erledigt[q.schluessel]

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
        {!offen && (
          <div className="schreibflaeche-huelle">
            <span className="klein-leise">{q.art === 'sokratisch' ? 'Denk laut auf dem Blatt: Was spricht dafür, was dagegen?' : 'Erst aus dem Gedächtnis antworten, in eigenen Worten.'}</span>
            <div className="schreibflaeche pdf-seite zeichnen">
              <TintenEbene key={`${i}-${leer}`} pfad="" format={0.32} werkzeug={radieren ? 'radierer' : 'stift'} farbe={farbe} fluechtig />
            </div>
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
            <Inhalt text={q.antwort} />
          </div>
        )}
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
          {!offen ? (
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
