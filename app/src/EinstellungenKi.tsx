import { useEffect, useRef, useState } from 'react'
import { ANBIETER, anbieterInfo, type AnbieterInfo } from './kianbieter/anbieter'
import { kiModelle, kiProbe } from './kianbieter/frage'
import { OLLAMA_STANDARD } from './kianbieter/ollama'
import { KiFehler, type AnbieterId, type AnbieterZugang, type ModellInfo } from './kianbieter/typen'
import { EinstellungenTeilen } from './EinstellungenTeilen'
import { aktiverZugang, speichereZugang, useKiZugang, type KiZugang } from './kianbieter/zugang'

const fehlerText = (e: unknown) => (e instanceof KiFehler ? e.message : String((e as Error)?.message ?? e))

/**
 * Einstellungen › KI: Anbieter wählen, eigenen Schlüssel (bei Ollama die Adresse) eintragen, Modell aus der Liste des
 * Anbieters wählen, Verbindung testen. Gespeichert wird auf diesem Gerät; wer will, teilt den Zugang mit einem Passwort
 * verschlüsselt über den Datenordner mit seinen anderen Geräten (EinstellungenTeilen).
 */
export function EinstellungenKi() {
  const zugang = useKiZugang()
  const [offen, setOffen] = useState<AnbieterId | null>(null)
  if (!zugang) return null
  const aktiv = aktiverZugang(zugang)
  const gezeigt = offen ?? zugang.anbieter

  return (
    <section className="einstellungen-teil">
      <h2>KI</h2>
      <p className="klein-leise">
        Die KI erklärt markierte Stellen, gibt Rückmeldung auf deine Antworten und schlägt Fragen vor. Du nutzt dafür deinen eigenen Zugang bei
        einem Anbieter und zahlst dort nach Verbrauch (Ollama: kostenlos auf dem eigenen Rechner). Ohne KI geht alles andere genauso.
      </p>
      <div className={`ki-stand${aktiv ? ' an' : ''}`}>
        {aktiv ? (
          <>
            Aktiv: <b>{anbieterInfo(aktiv.anbieter).name}</b> · {aktiv.modell}
          </>
        ) : (
          'Noch keine KI eingerichtet.'
        )}
      </div>
      <div className="anbieter-liste">
        {ANBIETER.map((a) => (
          <div key={a.id} className={`anbieter karte${gezeigt === a.id ? ' offen' : ''}`}>
            <button type="button" className="anbieter-kopf" aria-expanded={gezeigt === a.id} onClick={() => setOffen(gezeigt === a.id ? null : a.id)}>
              <span>
                <b>{a.name}</b>
                {aktiv?.anbieter === a.id && <span className="chip akzent">aktiv</span>}
                <span className="klein-leise anbieter-kurz">{a.kurz}</span>
              </span>
              <span aria-hidden="true">{gezeigt === a.id ? '–' : '+'}</span>
            </button>
            {gezeigt === a.id && <AnbieterFormular info={a} zugang={zugang} />}
          </div>
        ))}
      </div>
      <EinstellungenTeilen />
    </section>
  )
}

function AnbieterFormular({ info, zugang }: { info: AnbieterInfo; zugang: KiZugang }) {
  const gespeichert = zugang.zugaenge[info.id] ?? {}
  const [schluessel, setSchluessel] = useState(gespeichert.schluessel ?? '')
  const [adresse, setAdresse] = useState(gespeichert.adresse ?? '')
  const [modelle, setModelle] = useState<ModellInfo[] | null>(null)
  const [modell, setModell] = useState(gespeichert.modell ?? '')
  const [laeuft, setLaeuft] = useState<'' | 'verbinden' | 'testen'>('')
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null)
  const ab = useRef<AbortController | null>(null)
  useEffect(() => () => ab.current?.abort(), [])

  const eingabe: AnbieterZugang = info.schluessel ? { schluessel: schluessel.trim() } : { adresse: adresse.trim() || OLLAMA_STANDARD }
  const merke = (neu: AnbieterZugang, aktivieren: boolean) =>
    speichereZugang({ anbieter: aktivieren ? info.id : zugang.anbieter, zugaenge: { ...zugang.zugaenge, [info.id]: neu } })

  const verbinden = async () => {
    ab.current?.abort()
    const a = (ab.current = new AbortController())
    setLaeuft('verbinden')
    setMeldung(null)
    try {
      const liste = await kiModelle(info.id, eingabe, a.signal)
      setModelle(liste)
      // Der Anbieter hat Schlüssel bzw. Adresse angenommen: merken, auch wenn noch kein Modell gewählt ist
      await merke({ ...gespeichert, ...eingabe }, false)
      setMeldung({ gut: true, text: liste.length ? `Verbunden. ${liste.length} Modelle zur Auswahl.` : 'Verbunden, aber der Anbieter nennt keine Modelle.' })
    } catch (e) {
      if (!a.signal.aborted) setMeldung({ gut: false, text: fehlerText(e) })
    } finally {
      if (!a.signal.aborted) setLaeuft('')
    }
  }

  const waehle = async (id: string) => {
    setModell(id)
    if (!id.trim()) return
    await merke({ ...gespeichert, ...eingabe, modell: id.trim() }, true)
    const m = modelle?.find((x) => x.id === id)
    setMeldung(m?.bilder === false ? { gut: false, text: 'Dieses Modell liest keine Bilder: Rückmeldung auf Handschrift und Erklären von Scans gehen damit nicht.' } : null)
  }

  const testen = async () => {
    ab.current?.abort()
    const a = (ab.current = new AbortController())
    setLaeuft('testen')
    setMeldung(null)
    try {
      await kiProbe(info.id, { ...eingabe, modell: modell.trim() }, a.signal)
      setMeldung({ gut: true, text: 'Funktioniert: Das Modell hat im verlangten Format geantwortet.' })
    } catch (e) {
      if (!a.signal.aborted) setMeldung({ gut: false, text: fehlerText(e) })
    } finally {
      if (!a.signal.aborted) setLaeuft('')
    }
  }

  const entfernen = async () => {
    const rest = { ...zugang.zugaenge }
    delete rest[info.id]
    await speichereZugang({ anbieter: zugang.anbieter === info.id ? null : zugang.anbieter, zugaenge: rest })
    setSchluessel('')
    setAdresse('')
    setModell('')
    setModelle(null)
    setMeldung(null)
  }

  const listenId = `modelle-${info.id}`
  return (
    <div className="anbieter-inhalt">
      <details className="anleitung">
        <summary>{info.schluessel ? 'So bekommst du einen Schlüssel' : 'So richtest du Ollama ein'}</summary>
        <ol>
          {info.schritte.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <ul className="anleitung-links">
          {info.links.map((l) => (
            <li key={l.url}>
              {l.text}:{' '}
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.url.replace(/^https:\/\//, '')}
              </a>{' '}
              <button type="button" className="knopf klein still" onClick={() => void navigator.clipboard?.writeText(l.url)}>
                Kopieren
              </button>
            </li>
          ))}
        </ul>
      </details>
      <p className="klein-leise">{info.daten}</p>

      {info.schluessel ? (
        <label className="feld">
          API-Schlüssel
          <input
            className="eingabe"
            type="password"
            value={schluessel}
            onChange={(e) => setSchluessel(e.target.value)}
            placeholder={info.schluesselBeginn ? `${info.schluesselBeginn}…` : 'Schlüssel einfügen'}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
          />
        </label>
      ) : (
        <label className="feld">
          Adresse des Rechners mit Ollama
          <input className="eingabe" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder={OLLAMA_STANDARD} spellCheck={false} autoCapitalize="off" inputMode="url" />
        </label>
      )}
      <div className="anbieter-knoepfe">
        <button type="button" className="knopf haupt klein" disabled={!!laeuft || (info.schluessel && !schluessel.trim())} onClick={() => void verbinden()}>
          {laeuft === 'verbinden' ? 'Verbindet …' : 'Verbinden'}
        </button>
        {(gespeichert.schluessel || gespeichert.adresse || gespeichert.modell) && (
          <button type="button" className="knopf klein still gefahr" disabled={!!laeuft} onClick={() => void entfernen()}>
            {info.schluessel ? 'Schlüssel entfernen' : 'Entfernen'}
          </button>
        )}
      </div>

      {(modelle || modell) && (
        <label className="feld">
          Modell
          <input className="eingabe" list={listenId} value={modell} onChange={(e) => setModell(e.target.value)} onBlur={(e) => void waehle(e.target.value)} placeholder="Modell wählen" spellCheck={false} autoCapitalize="off" />
          <datalist id={listenId}>
            {modelle?.map((m) => (
              <option key={m.id} value={m.id}>
                {[m.name !== m.id ? m.name : '', m.hinweis, m.bilder === false ? 'ohne Bilder' : ''].filter(Boolean).join(' · ')}
              </option>
            ))}
          </datalist>
        </label>
      )}
      {modelle && modelle.length > 0 && modelle.length <= 40 && (
        <div className="modell-wahl">
          {modelle.map((m) => (
            <button key={m.id} type="button" className={`chip chip-wahl${modell === m.id ? ' akzent' : ''}`} title={m.hinweis} onClick={() => void waehle(m.id)}>
              {m.name}
            </button>
          ))}
        </div>
      )}
      {modell.trim() && (
        <div className="anbieter-knoepfe">
          <button type="button" className="knopf klein" disabled={!!laeuft} onClick={() => void testen()}>
            {laeuft === 'testen' ? 'Testet …' : 'Testen'}
          </button>
          <span className="klein-leise">Eine kurze Anfrage; kostet beim Anbieter einen Bruchteil eines Cents.</span>
        </div>
      )}
      {meldung && (
        <p className={meldung.gut ? 'meldung-gut' : 'meldung-schlecht'} role="status">
          {meldung.text}
        </p>
      )}
    </div>
  )
}
