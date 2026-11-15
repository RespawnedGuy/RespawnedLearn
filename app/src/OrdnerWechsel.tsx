// Teil „Datenordner“ der Einstellungen: anderen Ordner wählen und auf Wunsch die Daten mitnehmen. Rust kopiert, prüft
// jede Datei gegen das Original und wechselt erst danach (app/src-tauri/src/umzug.rs); der alte Ordner bleibt, wie er ist.
import { useEffect, useState } from 'react'
import {
  auswahlFehler,
  beobachteUmzug,
  imNetz,
  inTauri,
  kannOrdnerAuswaehlen,
  merkeOrdnerVor,
  ordnerAuswaehlen,
  ordnerStand,
  ortLink,
  uebernimmOrdner,
  useDaten,
  type OrdnerStand,
  type Vormerkung
} from '@rl/oberflaeche'

type Lage =
  | { art: 'ruhe' }
  | { art: 'waehlen' }
  | { art: 'vorgemerkt'; v: Vormerkung }
  | { art: 'umzug'; fertig: number; gesamt: number }
  | { art: 'fertig'; anzahl: number; alt: string; neu: string }

/** Stand des Datenordners einmal laden (nur in Tauri) */
function useOrdnerStand(): [OrdnerStand | null, string] {
  const [stand, setStand] = useState<OrdnerStand | null>(null)
  const [fehler, setFehler] = useState('')
  useEffect(() => {
    if (inTauri()) void ordnerStand().then(setStand).catch((e) => setFehler(String(e)))
  }, [])
  return [stand, fehler]
}

/** Hinweis über dem Inhalt, wenn der Datenordner an einem gesperrten Ort liegt (ältere Fassungen erlaubten das) */
export function OrdnerWarnung() {
  const [stand] = useOrdnerStand()
  if (!stand?.warnung) return null
  return (
    <div className="karte app-hinweis warnung" role="alert">
      <p>
        <strong>Deine Lerndaten liegen an einem ungünstigen Ort.</strong> {stand.warnung}
      </p>
      <div className="app-hinweis-knoepfe">
        <a className="knopf haupt klein" href={ortLink('einstellungen')}>
          Jetzt umziehen
        </a>
      </div>
    </div>
  )
}

export function Datenordner() {
  const [stand, ladeFehler] = useOrdnerStand()
  const { speicher } = useDaten()
  const [lage, setLage] = useState<Lage>({ art: 'ruhe' })
  const [pfad, setPfad] = useState('')
  const [fehler, setFehler] = useState(ladeFehler)
  const android = stand?.plattform === 'android'
  useEffect(() => setPfad(stand?.ordner ?? ''), [stand])
  useEffect(() => setFehler(ladeFehler), [ladeFehler])

  const versuche = async (f: () => Promise<void>) => {
    setFehler('')
    try {
      await f()
    } catch (e) {
      setFehler(String(e))
    }
  }
  const vormerken = (wahl: 'dialog' | 'standard' | 'pfad', p?: string) =>
    versuche(async () => {
      const v = await merkeOrdnerVor(wahl, p)
      if (v) setLage({ art: 'vorgemerkt', v })
    })
  const auswahl = () =>
    versuche(async () => {
      const a = await ordnerAuswaehlen()
      if ('pfad' in a) await vormerken('pfad', a.pfad)
      else if ('fehler' in a) setFehler(auswahlFehler(a.fehler))
    })
  const uebernehmen = (v: Vormerkung, mitnehmen: boolean) =>
    versuche(async () => {
      // Ausstehendes zuerst in den bisherigen Ordner, damit es mitkommt
      await speicher.speichereAlles()
      if (!mitnehmen) return void (await uebernimmOrdner(false), location.reload())
      setLage({ art: 'umzug', fertig: 0, gesamt: 0 })
      const ab = await beobachteUmzug((fertig, gesamt) => setLage({ art: 'umzug', fertig, gesamt }))
      try {
        const anzahl = await uebernimmOrdner(true)
        setLage({ art: 'fertig', anzahl, alt: stand?.ordner ?? '', neu: v.pfad })
      } catch (e) {
        // Rust hat die Vormerkung verbraucht; der bisherige Ordner bleibt aktiv
        setLage({ art: 'ruhe' })
        throw e
      } finally {
        ab()
      }
    })

  if (imNetz()) {
    return (
      <section className="einstellungen-teil">
        <h2>Datenordner</h2>
        <p className="klein-leise">Über das Netz verbunden: Deine Daten liegen auf dem Rechner, der RespawnedLearn für dich freigibt. Ohne Verbindung dorthin speichert die App nichts.</p>
      </section>
    )
  }

  if (!inTauri()) {
    return (
      <section className="einstellungen-teil">
        <h2>Datenordner</h2>
        <p className="klein-leise">Vorschau im Browser: Es gibt keinen Ordner, nichts wird gespeichert.</p>
      </section>
    )
  }

  return (
    <section className="einstellungen-teil">
      <h2>Datenordner</h2>
      <p className="ordner-pfad">{stand?.ordner ?? '…'}</p>
      <p className="klein-leise">Syncthing gleicht diesen Ordner mit deinen anderen Geräten ab. KI-Schlüssel liegen nicht darin.</p>
      {stand?.warnung && lage.art === 'ruhe' && (
        <div className="meldung-schlecht ordner-warnung" role="alert">
          <p>{stand.warnung}</p>
          {stand.standard && (
            <button type="button" className="knopf haupt klein" onClick={() => void vormerken('standard')}>
              Umziehen nach {stand.standard}
            </button>
          )}
        </div>
      )}

      {lage.art === 'ruhe' && (
        <div>
          <button type="button" className="knopf klein" onClick={() => (android ? setLage({ art: 'waehlen' }) : void vormerken('dialog'))}>
            Anderen Ordner wählen
          </button>
        </div>
      )}

      {lage.art === 'waehlen' && (
        <form
          className="anbieter-knoepfe"
          onSubmit={(e) => {
            e.preventDefault()
            void vormerken('pfad', pfad.trim())
          }}
        >
          {kannOrdnerAuswaehlen() && (
            <button type="button" className="knopf haupt klein" onClick={() => void auswahl()}>
              Ordner auswählen
            </button>
          )}
          <input className="eingabe" aria-label="Pfad im Gerätespeicher" value={pfad} onChange={(e) => setPfad(e.target.value)} spellCheck={false} autoCapitalize="off" />
          <button type="submit" className="knopf klein">
            Prüfen
          </button>
          <button type="button" className="knopf klein still" onClick={() => setLage({ art: 'ruhe' })}>
            Abbrechen
          </button>
        </form>
      )}

      {lage.art === 'vorgemerkt' && <Entscheidung v={lage.v} uebernehmen={uebernehmen} abbrechen={() => setLage({ art: 'ruhe' })} />}

      {lage.art === 'umzug' && (
        <p role="status" aria-live="polite">
          {lage.gesamt ? `Kopiere und prüfe ${lage.fertig} von ${lage.gesamt} Dateien …` : 'Bereite den Umzug vor …'}
        </p>
      )}

      {lage.art === 'fertig' && (
        <div className="karte ordner-karte" role="status">
          <p>
            <strong>Umzug fertig.</strong> {lage.anzahl} {lage.anzahl === 1 ? 'Datei' : 'Dateien'} kopiert und geprüft. Die App nutzt jetzt{' '}
            {lage.neu}.
          </p>
          <p className="klein-leise">
            Der alte Ordner {lage.alt} bleibt unverändert. Lösche ihn selbst, wenn alles da ist. Gleicht Syncthing den alten Ordner ab,
            stelle dort den Pfad auf den neuen um.
          </p>
          <button type="button" className="knopf haupt klein" onClick={() => location.reload()}>
            Weiter
          </button>
        </div>
      )}

      {fehler && (
        <p className="meldung-schlecht" role="alert">
          {fehler}
        </p>
      )}
    </section>
  )
}

/** Was mit dem gewählten Ordner geschehen soll, je nachdem, was dort schon liegt */
function Entscheidung({ v, uebernehmen, abbrechen }: { v: Vormerkung; uebernehmen: (v: Vormerkung, mitnehmen: boolean) => void; abbrechen: () => void }) {
  const text =
    v.inhalt === 'leer'
      ? 'Der Ordner ist leer. Sollen deine Daten mitkommen? Sie werden kopiert, der bisherige Ordner bleibt unverändert.'
      : v.inhalt === 'lerndaten'
        ? 'Dort liegen schon Lerndaten, etwa von einem anderen Gerät. Die App nutzt sie so, wie sie sind, und kopiert nichts dazu.'
        : 'Dort liegen andere Dateien. Daten mitnehmen geht nur in einen leeren Ordner; lege dafür am besten einen neuen Unterordner an.'
  return (
    <div className="karte ordner-karte">
      <p className="ordner-pfad">{v.pfad}</p>
      <p>{text}</p>
      <div className="anbieter-knoepfe">
        {v.inhalt === 'leer' && (
          <button type="button" className="knopf haupt klein" onClick={() => uebernehmen(v, true)}>
            Daten mitnehmen
          </button>
        )}
        <button type="button" className={v.inhalt === 'lerndaten' ? 'knopf haupt klein' : 'knopf klein'} onClick={() => uebernehmen(v, false)}>
          {v.inhalt === 'leer' ? 'Leer beginnen' : v.inhalt === 'lerndaten' ? 'Diesen Ordner nutzen' : 'Trotzdem nutzen, ohne Daten'}
        </button>
        <button type="button" className="knopf klein still" onClick={abbrechen}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
