// Lernplan auf der Modulseite (Vertrag Lernen 1.7): nur das aktuelle Paket und die nächsten drei, eigene Einheiten
// dazu; der ganze Plan eingeklappt. Gerechnet wird in `kern/lernplan.ts`, gespeichert werden nur die Felder im Modul
// (schwer, uebungen) und die eigenen Einheiten unter „## Lernplan“.
import { useState } from 'react'
import { aktuellePakete, erledigt, liesEinheiten, neueEinheit, schalteEinheit, wochenVerteilen, type Einheit, type Modul, type Paket } from '@rl/kern'
import { ortLink, useDaten } from '@rl/oberflaeche'
import { setzeModulFeld } from './wissen'
import { seitenText, type ModulPlan } from './lernplanDaten'

export function Lernplan({ m, p }: { m: Modul; p: ModulPlan }) {
  const { speicher, bestand } = useDaten()
  const text = bestand.texte.get(m.pfad) ?? ''
  const einheiten = liesEinheiten(text)
  const einPdf = m.quellen.length === 1
  const zuletzt = Object.entries(p.stand)
    .filter(([a]) => m.quellen.includes(a))
    .sort((x, y) => y[1].am.localeCompare(x[1].am))[0]
  const jetzt = aktuellePakete(p.plan, p.stand, zuletzt ? { anhang: zuletzt[0], seite: zuletzt[1].seite } : null)
  const zeigeEinheiten = (pk: Paket) => (einPdf ? einheiten.filter((e) => e.seite !== null && e.seite >= pk.von && e.seite <= pk.bis) : [])
  const gezeigt = new Set(jetzt.flatMap(zeigeEinheiten).map((e) => e.zeile))
  const uebrige = einheiten.filter((e) => !gezeigt.has(e.zeile))
  const schalte = (e: Einheit) => void speicher.aendere(m.pfad, (alt) => schalteEinheit(alt, e.zeile))

  if (!p.plan.length && !einheiten.length) return null
  return (
    <section className="lernplan" aria-labelledby="lernplan-titel">
      <h2 id="lernplan-titel" className="lern-gruppe-titel" style={{ marginTop: 24 }}>
        Lernplan
      </h2>
      {p.plan.length > 0 && !jetzt.length && <div className="klein-leise">Alles gelesen. Jetzt wiederholen und üben.</div>}
      <ol className="pakete">
        {jetzt.map((pk, i) => (
          <li key={`${pk.anhang}-${pk.von}`} className={i === 0 ? 'paket jetzt' : 'paket'}>
            <a className="paket-zeile" href={ortLink('sammeln', pk.anhang, String(pk.von))}>
              <span className="paket-seiten">{seitenText(pk.von, pk.bis)}</span>
              <span className="paket-abschnitt">{pk.abschnitt}</span>
              <span className="klein-leise">{pk.minuten} min</span>
            </a>
            {zeigeEinheiten(pk).length > 0 && <Einheiten liste={zeigeEinheiten(pk)} onSchalte={schalte} />}
          </li>
        ))}
      </ol>
      {uebrige.length > 0 && <Einheiten liste={uebrige} onSchalte={schalte} />}
      <NeueEinheit onNeu={(t, s) => void speicher.aendere(m.pfad, (alt) => neueEinheit(alt, t, s))} />
      {p.plan.length > 0 && <GanzerPlan m={m} p={p} />}
    </section>
  )
}

function Einheiten({ liste, onSchalte }: { liste: Einheit[]; onSchalte: (e: Einheit) => void }) {
  return (
    <ul className="einheiten">
      {liste.map((e) => (
        <li key={e.zeile}>
          <label>
            <input type="checkbox" checked={e.erledigt} onChange={() => onSchalte(e)} />
            <span className={e.erledigt ? 'erledigt' : undefined}>
              {e.seite !== null && <span className="klein-leise">S. {e.seite} · </span>}
              {e.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}

function NeueEinheit({ onNeu }: { onNeu: (text: string, seite: number | null) => void }) {
  const [text, setText] = useState('')
  const [seite, setSeite] = useState('')
  const fertig = () => {
    if (!text.trim()) return
    onNeu(text, Number(seite) > 0 ? Math.floor(Number(seite)) : null)
    setText('')
    setSeite('')
  }
  return (
    <form
      className="einheit-neu"
      onSubmit={(e) => {
        e.preventDefault()
        fertig()
      }}
    >
      <input className="eingabe" value={text} onChange={(e) => setText(e.target.value)} placeholder="Eigene Einheit: ein Fakt oder eine Aufgabe" aria-label="Eigene Einheit" />
      <input className="eingabe einheit-seite" value={seite} onChange={(e) => setSeite(e.target.value)} inputMode="numeric" placeholder="Seite" aria-label="Seite (optional)" />
      <button type="submit" className="knopf klein" disabled={!text.trim()}>
        Hinzufügen
      </button>
    </form>
  )
}

function GanzerPlan({ m, p }: { m: Modul; p: ModulPlan }) {
  const { speicher } = useDaten()
  const offen = p.plan.flatMap((a) => a.pakete).filter((pk) => !erledigt(pk, p.stand))
  const woche = new Map<Paket, number>()
  if (m.stundenProWoche) wochenVerteilen(offen, m.stundenProWoche).forEach((w, i) => woche.set(offen[i], w))
  const schalteSchwer = (titel: string) => {
    const neu = m.schwer.includes(titel) ? m.schwer.filter((t) => t !== titel) : [...m.schwer, titel]
    void setzeModulFeld(speicher, m, 'schwer', neu.length ? neu : undefined)
  }
  return (
    <details className="ganzer-plan">
      <summary>Ganzer Plan</summary>
      <label className="plan-schalter">
        <input type="checkbox" checked={m.uebungen} onChange={() => void setzeModulFeld(speicher, m, 'uebungen', m.uebungen ? false : undefined)} />
        Nach einem Abschnitt eine Übung vorschlagen, wenn es Fragen oder Karten dazu gibt
      </label>
      {p.plan.map((a) => (
        <div key={`${a.anhang}-${a.von}`} className="plan-abschnitt">
          <div className="plan-abschnitt-kopf">
            <b>{a.titel}</b>
            <span className="klein-leise">{seitenText(a.von, a.bis)}</span>
            <span style={{ flex: 1 }} />
            <label className="klein-leise">
              <input type="checkbox" checked={a.schwer} onChange={() => schalteSchwer(a.titel)} /> schwer
            </label>
          </div>
          <div className="plan-pakete">
            {a.pakete.map((pk) => (
              <span key={pk.von} className={erledigt(pk, p.stand) ? 'chip erledigt' : 'chip'}>
                {seitenText(pk.von, pk.bis)}
                {woche.has(pk) && <> · W{woche.get(pk)! + 1}</>}
              </span>
            ))}
          </div>
        </div>
      ))}
      {m.stundenProWoche && <div className="klein-leise">W1 = diese Woche, bei {String(m.stundenProWoche).replace('.', ',')} h pro Woche.</div>}
    </details>
  )
}
