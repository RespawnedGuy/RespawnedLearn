import { useEffect, useRef, useState } from 'react'
import { lesestand, liesVorfragen, pfade, type Vorfragen as VorfragenDatei } from '@rl/kern'
import { ortLink, useDaten } from '@rl/oberflaeche'
import { Abrufflaeche, useAbruf } from './Abruf'
import { Inhalt } from './Inhalt'

// Vorfragen vor dem Lernen (Vertrag 5.8): Raten, bevor man liest, verbessert das Behalten des Stoffs, auch wenn
// die Vermutung falsch ist (Pretesting, Pan & Carpenter 2023). Auf Knopfdruck, als tägliche Routine vor dem Lernen.

const TAGE = 14
const heute = () => new Date().toLocaleDateString('sv-SE')
const merkName = (datum: string) => `rvx-vorfragen-${datum}`

function gemacht(datum: string): boolean {
  try {
    return localStorage.getItem(merkName(datum)) === '1'
  } catch {
    return false
  }
}

function merkeGemacht(datum: string) {
  try {
    localStorage.setItem(merkName(datum), '1')
  } catch {
    /* dann eben nicht gemerkt */
  }
}

/** Seitdem weitergelesen? Dann passen die Vorfragen nicht mehr zu den nächsten Seiten. */
function veraltet(v: VorfragenDatei, stand: ReturnType<typeof lesestand>): boolean {
  return v.buecher.some((b) => stand[b.anhang] && stand[b.anhang].seite !== b.ab)
}

/** Hinweis über der Lernrunde, solange heute noch keine Vorfragen gemacht sind */
export function VorfragenHinweis() {
  const { bestand } = useDaten()
  const datum = heute()
  const stand = lesestand(bestand)
  const liest = Object.values(stand).some((s) => Date.now() - Date.parse(s.am) < TAGE * 86_400_000)
  if (!liest || gemacht(datum)) return null
  return (
    <a className="karte fragen-hinweis" href={ortLink('lernen', 'vorfragen')}>
      <span>
        <b>Vor dem Lernen</b>
        <span className="klein-leise"> · ein paar Vorfragen zu den nächsten Seiten</span>
      </span>
      <span className="knopf klein">Einstimmen</span>
    </a>
  )
}

async function holeVorfragen(neu: boolean): Promise<{ v: VorfragenDatei | null; hinweis?: string }> {
  // Die App erzeugt Vorfragen selbst ab Version 0.4.0 (Schritt 3b); bis dahin gelten nur schon vorhandene Dateien
  void neu
  return { v: null, hinweis: 'Neue Vorfragen erzeugt die App mit dem nächsten Update selbst.' }
}

/** `#/lernen/vorfragen`: eine Frage zur Zeit, erst raten, dann wahlweise auflösen */
export function Vorfragen() {
  const { bestand } = useDaten()
  const datum = heute()
  const gespeichert = liesVorfragen(bestand.texte.get(pfade.vorfragen(datum)))
  const [v, setV] = useState<VorfragenDatei | null>(() => (gespeichert && !veraltet(gespeichert, lesestand(bestand)) ? gespeichert : null))
  const [laedt, setLaedt] = useState(false)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [i, setI] = useState(0)
  const [offen, setOffen] = useState(false)
  const abruf = useAbruf()
  const gestartet = useRef(false)

  const lade = async (neu: boolean) => {
    setLaedt(true)
    setHinweis(null)
    const r = await holeVorfragen(neu)
    setLaedt(false)
    if (r.v) {
      setV(r.v)
      setI(0)
      setOffen(false)
    } else setHinweis(r.hinweis ?? null)
  }

  useEffect(() => {
    if (v && i >= v.fragen.length) merkeGemacht(datum)
  }, [v, i, datum])

  useEffect(() => {
    if (gestartet.current || v) return
    gestartet.current = true
    void lade(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kopf = (
    <div className="seite-kopf">
      <h1 style={{ fontSize: '1.375rem' }}>Vorfragen</h1>
      <span style={{ flex: 1 }} />
      <a className="knopf klein" href={ortLink('lernen')}>
        Zur Lernrunde
      </a>
    </div>
  )

  if (!v)
    return (
      <div className="lernen-seite">
        {kopf}
        <p className="leer">{laedt ? 'Die KI liest die nächsten Seiten deiner Bücher. Das dauert etwa eine Minute.' : hinweis ?? ''}</p>
        {!laedt && hinweis && (
          <button type="button" className="knopf" onClick={() => void lade(false)}>
            Nochmal versuchen
          </button>
        )}
      </div>
    )

  const q = v.fragen[i]
  if (!q) {
    return (
      <div className="lernen-seite">
        {kopf}
        <p className="leer">Eingestimmt. Beim Lesen findest du die Antworten.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {v.buecher.map((b) => (
            <a key={b.anhang} className="knopf haupt" href={ortLink('sammeln', b.anhang, b.ab)}>
              {b.titel} lesen, ab S. {b.ab}
            </a>
          ))}
          <a className="knopf" href={ortLink('lernen')}>
            Zur Lernrunde
          </a>
        </div>
      </div>
    )
  }

  const buch = v.buecher.find((b) => b.anhang === q.anhang)
  const weiter = () => {
    setI(i + 1)
    setOffen(false)
    abruf.setText('')
  }

  return (
    <div className="lernen-seite">
      <div className="fortschritt" aria-label={`Vorfrage ${i + 1} von ${v.fragen.length}`}>
        {v.fragen.map((_, n) => (
          <span key={n} className={n < i ? 'fertig' : n === i ? 'jetzt' : ''} />
        ))}
      </div>
      <article className="karte lern-karte">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="art">VORFRAGE</span>
          <span className="klein-leise">
            {i + 1} / {v.fragen.length}
          </span>
        </div>
        <div className="frage">
          <Inhalt text={q.frage} />
        </div>
        {!offen && <Abrufflaeche key={i} abruf={abruf} hinweis="Rate, bevor du liest. Auch eine falsche Vermutung hilft dir beim Lesen." />}
        {offen && (
          <div className="antwort">
            <Inhalt text={q.antwort} />
          </div>
        )}
        <div className="klein-leise">
          {buch?.kapitel ? `${buch.kapitel} · ` : ''}
          <a href={ortLink('sammeln', q.anhang, q.seite)}>
            {buch?.titel ?? 'Buch'}, S. {q.seite}
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {!offen && (
            <button type="button" className="knopf still" style={{ height: 48, marginRight: 'auto' }} onClick={() => setOffen(true)}>
              Auflösen
            </button>
          )}
          <button type="button" className="knopf haupt" style={{ height: 48 }} onClick={weiter}>
            Weiter
          </button>
        </div>
      </article>
      <p className="klein-leise">
        Die Vorfragen erzeugt eine KI aus den nächsten Seiten.{' '}
        <button type="button" className="knopf still klein" disabled={laedt} onClick={() => void lade(true)}>
          {laedt ? 'Neue Vorfragen kommen …' : 'Neue Vorfragen'}
        </button>
      </p>
    </div>
  )
}
