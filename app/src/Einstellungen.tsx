import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { inTauri, ordnerStand, setzeOrdner, type OrdnerStand } from '@rl/oberflaeche'
import { EinstellungenKi } from './EinstellungenKi'
import { EinstellungenPrompts } from './EinstellungenPrompts'

/** `#/einstellungen`: Datenordner, KI-Zugang dieses Geräts, Anweisungen an die KI */
export function Einstellungen() {
  return (
    <div className="lernen-seite einstellungen">
      <h1>Einstellungen</h1>
      <Datenordner />
      <EinstellungenKi />
      <EinstellungenPrompts />
    </div>
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

  const uebernimm = async (p: string) => {
    setFehler('')
    try {
      await setzeOrdner(p)
      // Neu laden, damit der Speicher den anderen Ordner von vorn liest
      location.reload()
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
                void uebernimm(pfad.trim())
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
                onClick={async () => {
                  const p = await open({ directory: true, multiple: false, title: 'Datenordner wählen' })
                  if (typeof p === 'string') await uebernimm(p)
                }}
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
