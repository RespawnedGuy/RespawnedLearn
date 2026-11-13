import { useEffect, useState, type ReactNode } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { inTauri, ordnerStand, setzeOrdner, type OrdnerStand } from '@rl/oberflaeche'

/** Vorschlag unter Android: ein Ordner im gemeinsamen Speicher, den Syncthing ebenfalls erreicht */
const ANDROID_VORSCHLAG = '/storage/emulated/0/RespawnedLearn'

/**
 * Erster Start: Ohne Datenordner geht nichts. Am PC wählt man ihn im Dateidialog, unter Android tippt man den Pfad
 * (der Dateidialog liefert dort keinen echten Pfad). Läuft die Oberfläche ohne Tauri im Browser, zeigt sie direkt die App.
 */
export function OrdnerWahl({ children }: { children: ReactNode }) {
  const [stand, setStand] = useState<OrdnerStand | null>(null)
  const [pfad, setPfad] = useState(ANDROID_VORSCHLAG)
  const [fehler, setFehler] = useState('')
  const tauri = inTauri()

  useEffect(() => {
    if (tauri) void ordnerStand().then(setStand).catch((e) => setFehler(String(e)))
  }, [tauri])

  if (!tauri || stand?.ordner) return <>{children}</>
  if (!stand) return fehler ? <p className="leer">{fehler}</p> : null

  const uebernimm = async (p: string) => {
    setFehler('')
    try {
      await setzeOrdner(p)
      setStand(await ordnerStand())
    } catch (e) {
      setFehler(String(e))
    }
  }
  const android = stand.plattform === 'android'

  return (
    <main className="ordner-wahl karte">
      <h1>Wo sollen deine Lerndaten liegen?</h1>
      <p>
        Wähle einen Ordner, den Syncthing mit deinen anderen Geräten abgleicht. Ist er leer, beginnst du neu; liegen dort
        schon Daten von einem anderen Gerät, erscheinen sie hier.
      </p>
      {android ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void uebernimm(pfad.trim())
          }}
        >
          <label>
            Ordner
            <input value={pfad} onChange={(e) => setPfad(e.target.value)} spellCheck={false} autoCapitalize="off" />
          </label>
          <button type="submit" className="knopf haupt">Übernehmen</button>
        </form>
      ) : (
        <button
          type="button"
          className="knopf haupt"
          onClick={async () => {
            const p = await open({ directory: true, multiple: false, title: 'Datenordner wählen' })
            if (typeof p === 'string') await uebernimm(p)
          }}
        >
          Ordner wählen
        </button>
      )}
      {fehler && (
        <p className="ordner-fehler" role="alert">
          {fehler}
          {android && ' Erlaube der App in den Android-Einstellungen „Zugriff auf alle Dateien“ und versuche es noch einmal.'}
        </p>
      )}
    </main>
  )
}
