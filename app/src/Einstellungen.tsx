import { useEffect, useState } from 'react'
import { inTauri, ordnerStand, ortLink, setzeOrdner, useDaten, Version, waehleOrdner, type OrdnerStand } from '@rl/oberflaeche'
import { EinstellungenKi } from './EinstellungenKi'
import { EinstellungenPrompts } from './EinstellungenPrompts'
import { setzeSchreibhand, useSchreibhand } from './schreibhand'
import { EinstellungenAktualisierung } from './Aktualisierung'

/** `#/einstellungen`: Datenordner, KI-Zugang dieses Geräts, Anweisungen an die KI */
export function Einstellungen() {
  return (
    <div className="lernen-seite einstellungen">
      <h1>Einstellungen</h1>
      <KonfliktHinweis />
      <Datenordner />
      <Schreiben />
      <EinstellungenKi />
      <EinstellungenPrompts />
      <EinstellungenAktualisierung />
      <section className="einstellungen-teil">
        <h2>Über die App</h2>
        <p className="klein-leise">
          RespawnedLearn <Version />. Freie Software unter der AGPL-3.0, läuft ohne Server; deine Daten liegen nur in deinem Ordner.
        </p>
      </section>
    </div>
  )
}

/** Am Handy steht neben den Tabs nur ein roter Punkt am Zahnrad; hier steht, was er meint, mit dem Weg dorthin */
function KonfliktHinweis() {
  const { speicher } = useDaten()
  const k = speicher.konflikte().length + speicher.syncProbleme().length
  const h = speicher.hinweis
  if (!k && !h) return null
  return (
    <section className="einstellungen-teil">
      <a className="knopf haupt" href={ortLink('konflikte')}>
        {h ? 'Sync prüfen' : `${k} Konflikt${k > 1 ? 'e' : ''} ansehen`}
      </a>
    </section>
  )
}

/** Geräte-Einstellung: mit welcher Hand geschrieben wird; die Randmarken im Notizbuch stehen gegenüber */
function Schreiben() {
  const hand = useSchreibhand()
  return (
    <section className="einstellungen-teil">
      <h2>Schreiben</h2>
      <div className="segmente klein" role="radiogroup" aria-label="Schreibhand">
        {(['rechts', 'links'] as const).map((h) => (
          <button key={h} type="button" role="radio" aria-checked={hand === h} className={hand === h ? 'aktiv' : ''} onClick={() => setzeSchreibhand(h)}>
            {h === 'rechts' ? 'Rechte Hand' : 'Linke Hand'}
          </button>
        ))}
      </div>
      <p className="klein-leise">Die Verweise aufs Skript stehen im Notizbuch auf der anderen Seite, damit die Hand sie beim Schreiben nicht verdeckt. Gilt nur für dieses Gerät.</p>
    </section>
  )
}

function Datenordner() {
  const [stand, setStand] = useState<OrdnerStand | null>(null)
  const [pfad, setPfad] = useState('')
  const [aendern, setAendern] = useState(false)
  const [fehler, setFehler] = useState('')
  const tauri = inTauri()
  useEffect(() => {
    if (tauri) void ordnerStand().then((s) => (setStand(s), setPfad(s.ordner ?? ''))).catch((e) => setFehler(String(e)))
  }, [tauri])

  // Android: getippter Pfad (setzeOrdner); PC: Rust öffnet den Dialog und setzt die Wahl (waehleOrdner)
  const uebernimm = async (setze: () => Promise<unknown>) => {
    setFehler('')
    try {
      // Neu laden, damit der Speicher den anderen Ordner von vorn liest
      if ((await setze()) !== false) location.reload()
    } catch (e) {
      setFehler(String(e))
    }
  }

  return (
    <section className="einstellungen-teil">
      <h2>Datenordner</h2>
      {!tauri ? (
        <p className="klein-leise">Vorschau im Browser: Es gibt keinen Ordner, nichts wird gespeichert.</p>
      ) : (
        <>
          <p className="ordner-pfad">{stand?.ordner ?? '…'}</p>
          <p className="klein-leise">Syncthing gleicht diesen Ordner mit deinen anderen Geräten ab. KI-Schlüssel liegen nicht darin.</p>
          {!aendern ? (
            <div>
              <button type="button" className="knopf klein" onClick={() => setAendern(true)}>
                Anderen Ordner wählen
              </button>
            </div>
          ) : stand?.plattform === 'android' ? (
            <form
              className="anbieter-knoepfe"
              onSubmit={(e) => {
                e.preventDefault()
                void uebernimm(() => setzeOrdner(pfad.trim()))
              }}
            >
              <input className="eingabe" value={pfad} onChange={(e) => setPfad(e.target.value)} spellCheck={false} autoCapitalize="off" />
              <button type="submit" className="knopf haupt klein">
                Übernehmen
              </button>
            </form>
          ) : (
            <div className="anbieter-knoepfe">
              <button
                type="button"
                className="knopf haupt klein"
                onClick={() => void uebernimm(waehleOrdner)}
              >
                Ordner wählen
              </button>
              <button type="button" className="knopf klein still" onClick={() => setAendern(false)}>
                Abbrechen
              </button>
            </div>
          )}
          {fehler && (
            <p className="meldung-schlecht" role="alert">
              {fehler}
            </p>
          )}
        </>
      )}
    </section>
  )
}
