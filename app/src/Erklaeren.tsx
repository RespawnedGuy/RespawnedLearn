import { useEffect, useRef, useState } from 'react'
import { tag, type Bereich, type Eintrag } from '@rl/kern'
import { Dialog, melde, useDaten } from '@rl/oberflaeche'
import { erklaere, stelleLesen, type StelleZumErklaeren } from './ki'
import { kiBlock, type ChatZeile } from './kiBlock'
import { Inhalt } from './Inhalt'
import { karteAusStelle } from './wissen'

/**
 * „Erklären“ zu einer markierten Stelle im Skript: Die KI erklärt sie in einfachen Worten, Rückfragen gehen im selben
 * Fenster. Gespeichert wird nichts, außer Nils behält die Erklärung als Wissenskarte (Vertrag 5.5 und 5.8).
 */
export function ErklaerFenster({ quelle, seite, bereich, farbe, onZu }: { quelle: Eintrag; seite: number; bereich: Bereich; farbe: string | null; onZu: (behalten: boolean) => void }) {
  const { speicher } = useDaten()
  const [stelle, setStelle] = useState<StelleZumErklaeren | null>(null)
  const [verlauf, setVerlauf] = useState<ChatZeile[]>([])
  const [begriff, setBegriff] = useState('')
  const [denkt, setDenkt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [rueckfrage, setRueckfrage] = useState('')
  const [speichert, setSpeichert] = useState(false)
  const ab = useRef<AbortController | null>(null)
  const ende = useRef<HTMLDivElement>(null)

  const frage = async (s: StelleZumErklaeren, bisher: ChatZeile[]) => {
    ab.current?.abort()
    const a = (ab.current = new AbortController())
    setDenkt(true)
    setFehler('')
    const r = await erklaere(s, bisher, a.signal)
    if (a.signal.aborted) return
    setDenkt(false)
    if ('fehler' in r) return setFehler(r.fehler)
    setVerlauf([...bisher, { von: 'ki', text: r.antwort }])
    if (r.begriff && !bisher.length) setBegriff(r.begriff)
  }

  // Beim Öffnen: Text der Stelle und der Seite lesen, dann gleich erklären lassen
  useEffect(() => {
    let weg = false
    void stelleLesen(speicher, quelle, seite, bereich).then((s) => {
      if (weg) return
      setStelle(s)
      void frage(s, [])
    })
    return () => {
      weg = true
      ab.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speicher, quelle, seite, bereich])

  // neueste Antwort sichtbar halten (geschweifte Klammern: neuere Browser geben hier ein Promise zurück, kein Aufräumen)
  useEffect(() => {
    ende.current?.scrollIntoView({ block: 'nearest' })
  }, [verlauf, denkt, fehler])

  const senden = () => {
    const t = rueckfrage.trim()
    if (!t || !stelle || denkt) return
    const neu: ChatZeile[] = [...verlauf, { von: 'ich', text: t }]
    setVerlauf(neu)
    setRueckfrage('')
    void frage(stelle, neu)
  }

  const behalten = async () => {
    if (speichert || !verlauf.some((v) => v.von === 'ki')) return
    setSpeichert(true)
    // eine unbeantwortete Rückfrage am Ende gehört nicht auf die Karte
    const fertig = verlauf.at(-1)?.von === 'ich' ? verlauf.slice(0, -1) : verlauf
    await karteAusStelle(speicher, { quelle, seite, bereich, art: 'wissen', titel: begriff || 'Stelle', farbe, ki: kiBlock(fertig, tag()) })
    melde('Wissenskarte angelegt, mit der Erklärung eingeklappt darunter')
    onZu(true)
  }

  const nochmal = () => stelle && void frage(stelle, verlauf)
  const hatAntwort = verlauf.some((v) => v.von === 'ki')
  const vorschau = stelle?.stelle.replace(/\s+/g, ' ').trim() ?? ''

  return (
    <Dialog titel="Erklären" onZu={() => onZu(false)}>
      <div className="klein-leise">
        {quelle.titel}, S. {seite}
        {vorschau && ` · „${vorschau.length > 140 ? `${vorschau.slice(0, 140)} …` : vorschau}“`}
      </div>
      <div className="erklaer-verlauf" aria-live="polite">
        {verlauf.map((v, i) =>
          v.von === 'ki' ? (
            <div key={i} className="erklaer-ki">
              <Inhalt text={v.text} />
            </div>
          ) : (
            <div key={i} className="erklaer-ich">
              {v.text}
            </div>
          )
        )}
        {denkt && <div className="klein-leise">{stelle ? 'KI erklärt …' : 'Stelle wird gelesen …'}</div>}
        {fehler && (
          <div className="erklaer-fehler">
            {fehler}{' '}
            <button type="button" className="knopf klein still" onClick={nochmal}>
              Noch einmal
            </button>
          </div>
        )}
        <div ref={ende} />
      </div>
      {hatAntwort && (
        <div className="erklaer-eingabe">
          <input
            className="eingabe"
            placeholder="Rückfrage, z. B. „Und warum?“"
            aria-label="Rückfrage an die KI"
            value={rueckfrage}
            onChange={(e) => setRueckfrage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && senden()}
          />
          <button type="button" className="knopf" disabled={!rueckfrage.trim() || denkt} onClick={senden}>
            Fragen
          </button>
        </div>
      )}
      <div className="klein-leise">Nichts wird gespeichert, außer du behältst es. Am besten bleibt es hängen, wenn du es danach in eigenen Worten aufschreibst.</div>
      <div className="dialog-knoepfe">
        <button type="button" className="knopf still" onClick={() => onZu(false)}>
          Schließen
        </button>
        <button type="button" className="knopf haupt" disabled={!hatAntwort || speichert} onClick={() => void behalten()}>
          Als Wissenskarte behalten
        </button>
      </div>
    </Dialog>
  )
}
