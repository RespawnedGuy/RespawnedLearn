import { useEffect, useState, type ReactNode } from 'react'
import { dateizugriff, dateizugriffAnfragen, inTauri, ordnerStand, setzeOrdner, waehleOrdner, type OrdnerStand } from '@rl/oberflaeche'
import { startSchritt } from './ersterStart'

/** Vorschlag unter Android: ein Ordner im gemeinsamen Speicher, den Syncthing ebenfalls erreicht */
const ANDROID_VORSCHLAG = '/storage/emulated/0/RespawnedLearn'

/**
 * Erster Start: Ohne Datenordner geht nichts. Am PC wählt man ihn im Dateidialog, unter Android tippt man den Pfad
 * (der Dateidialog liefert dort keinen echten Pfad). Läuft die Oberfläche ohne Tauri im Browser, zeigt sie direkt die App.
 * Unter Android erklärt sie vorher, wofür „Zugriff auf alle Dateien“ nötig ist, und fragt erst auf Knopfdruck.
 */
export function OrdnerWahl({ children }: { children: ReactNode }) {
  const [stand, setStand] = useState<OrdnerStand | null>(null)
  const [pfad, setPfad] = useState(ANDROID_VORSCHLAG)
  const [fehler, setFehler] = useState('')
  const [zugriff, setZugriff] = useState(dateizugriff)
  const tauri = inTauri()
  const schritt = startSchritt(zugriff, stand?.ordner ?? null)

  useEffect(() => {
    if (tauri) void ordnerStand().then(setStand).catch((e) => setFehler(String(e)))
  }, [tauri])

  // Zurück aus der Android-Einstellung (oder nach dem Systemdialog bis Android 10): Zugriff neu prüfen
  useEffect(() => {
    if (schritt !== 'erlaubnis') return
    const pruefe = () => setZugriff(dateizugriff())
    document.addEventListener('visibilitychange', pruefe)
    const takt = setInterval(pruefe, 1000)
    return () => (document.removeEventListener('visibilitychange', pruefe), clearInterval(takt))
  }, [schritt])

  if (!tauri) return <>{children}</>
  if (!stand) return fehler ? <p className="leer">{fehler}</p> : null
  if (schritt === 'app') return <>{children}</>
  if (schritt === 'erlaubnis') return <Erlaubnis />

  // Android: getippter Pfad (setzeOrdner); PC: Rust öffnet den Dialog und setzt die Wahl (waehleOrdner)
  const uebernimm = async (setze: () => Promise<unknown>) => {
    setFehler('')
    try {
      if ((await setze()) !== false) setStand(await ordnerStand())
    } catch (e) {
      setFehler(String(e))
    }
  }
  const android = stand.plattform === 'android'

  return (
    <main className="ordner-wahl karte">
      <h1>Wo sollen deine Lerndaten liegen?</h1>
      <p>
        Wähle einen Ordner für Lernkarten, Mitschriften und Skripte. Ist er leer, beginnst du neu; liegen dort schon Daten
        von einem anderen Gerät, erscheinen sie hier.
      </p>
      <p className="klein-leise">
        Mehrere Geräte? Lass den Ordner von Syncthing abgleichen. Das ist freiwillig, ohne bleibt alles auf diesem Gerät.
      </p>
      {android ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void uebernimm(() => setzeOrdner(pfad.trim()))
          }}
        >
          <label>
            Ordner (Pfad im Gerätespeicher)
            <input className="eingabe" value={pfad} onChange={(e) => setPfad(e.target.value)} spellCheck={false} autoCapitalize="off" />
          </label>
          <button type="submit" className="knopf haupt">Übernehmen</button>
        </form>
      ) : (
        <button
          type="button"
          className="knopf haupt"
          onClick={() => void uebernimm(waehleOrdner)}
        >
          Ordner wählen
        </button>
      )}
      {fehler && (
        <p className="ordner-fehler" role="alert">
          {fehler}
          {android && ' Prüfe den Pfad: Er muss im Gerätespeicher liegen, zum Beispiel wie im Vorschlag.'}
        </p>
      )}
    </main>
  )
}

/** Android, erster Schritt: erst sagen, wofür die Erlaubnis da ist, dann auf Knopfdruck die Einstellung öffnen */
function Erlaubnis() {
  return (
    <main className="ordner-wahl karte">
      <h1>Zugriff auf deinen Lernordner</h1>
      <p>
        RespawnedLearn speichert Lernkarten, Mitschriften und Skripte als gewöhnliche Dateien in einem Ordner deiner Wahl.
        So kannst du sie sichern, selbst öffnen und auf Wunsch mit Syncthing auf andere Geräte bringen.
      </p>
      <p>
        Damit die App und Syncthing denselben Ordner sehen, braucht sie unter Android die Erlaubnis{' '}
        <strong>„Zugriff auf alle Dateien“</strong> (bis Android 10 „Speicher“). Die App arbeitet nur in dem Ordner, den du
        gleich wählst.
      </p>
      <p className="klein-leise">
        Nach dem Tippen fragt Android nach der Erlaubnis, meist auf einer Seite der Einstellungen. Schalte sie dort ein und
        kehre mit „Zurück“ hierher zurück. Später findest du sie unter Einstellungen › Apps › RespawnedLearn.
      </p>
      <button type="button" className="knopf haupt" onClick={dateizugriffAnfragen}>
        Zugriff erlauben
      </button>
    </main>
  )
}
