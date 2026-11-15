// Einstellungen › Zugang übers Netz (nur am PC, docs/netz.md): Die App gibt ihre Oberfläche für Geräte im eigenen
// Tailnet frei, etwa ein iPhone in Safari. Je Tailscale-Login ein eigener Datenordner. Der Server lauscht nur auf
// 127.0.0.1 (app/src-tauri/src/netz/); erreichbar wird er erst mit `tailscale serve` auf diesem Rechner.
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from '@rl/oberflaeche'

interface NetzNutzer {
  login: string
  ordner: string
}

interface NetzEinstellung {
  an: boolean
  port: number
  nutzer: NetzNutzer[]
}

interface NetzStand {
  einstellung: NetzEinstellung
  moeglich: boolean
  laeuft: boolean
  fehler: string | null
}

export function EinstellungenNetz() {
  const [stand, setStand] = useState<NetzStand | null>(null)
  const [entwurf, setEntwurf] = useState<NetzEinstellung | null>(null)
  const [fehler, setFehler] = useState('')
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    if (!inTauri()) return
    void invoke<NetzStand>('netz_stand')
      .then((s) => (setStand(s), setEntwurf(s.einstellung)))
      .catch(() => undefined)
  }, [])

  if (!stand?.moeglich || !entwurf) return null

  const aendere = (f: (e: NetzEinstellung) => NetzEinstellung) => setEntwurf((e) => (e ? f(e) : e))
  const aendereNutzer = (i: number, teil: Partial<NetzNutzer>) => aendere((e) => ({ ...e, nutzer: e.nutzer.map((n, j) => (j === i ? { ...n, ...teil } : n)) }))
  const geaendert = JSON.stringify(entwurf) !== JSON.stringify(stand.einstellung)

  const speichern = async () => {
    setFehler('')
    setSpeichert(true)
    try {
      const s = await invoke<NetzStand>('netz_setzen', { einstellung: { ...entwurf, nutzer: entwurf.nutzer.filter((n) => n.login.trim() || n.ordner.trim()) } })
      setStand(s)
      setEntwurf(s.einstellung)
    } catch (e) {
      setFehler(String(e))
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <section className="einstellungen-teil netz-teil">
      <h2>Zugang übers Netz</h2>
      <p className="klein-leise">
        Geräte in deinem Tailscale-Netz öffnen RespawnedLearn dann im Browser, etwa ein iPhone in Safari. Jedes Tailscale-Konto arbeitet in seinem eigenen Datenordner auf diesem Rechner. Die App
        muss dafür offen sein.
      </p>
      <label className="schalter-zeile">
        <input type="checkbox" checked={entwurf.an} onChange={(e) => aendere((x) => ({ ...x, an: e.target.checked }))} /> Freigeben
      </label>

      <div className="netz-nutzer" role="group" aria-label="Wer darf zugreifen">
        {entwurf.nutzer.map((n, i) => (
          <div key={i} className="netz-zeile">
            <label className="feld">
              Tailscale-Konto
              <input
                className="eingabe"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="name@anbieter"
                value={n.login}
                onChange={(e) => aendereNutzer(i, { login: e.target.value })}
              />
            </label>
            <label className="feld">
              Datenordner
              <input className="eingabe" type="text" autoComplete="off" placeholder="vollständiger Pfad" value={n.ordner} onChange={(e) => aendereNutzer(i, { ordner: e.target.value })} />
            </label>
            <button type="button" className="knopf klein" onClick={() => aendere((x) => ({ ...x, nutzer: x.nutzer.filter((_, j) => j !== i) }))}>
              Entfernen
            </button>
          </div>
        ))}
        <button type="button" className="knopf klein" onClick={() => aendere((x) => ({ ...x, nutzer: [...x.nutzer, { login: '', ordner: '' }] }))}>
          + Konto
        </button>
      </div>

      <label className="feld netz-port">
        Port
        <input
          className="eingabe"
          type="number"
          inputMode="numeric"
          min={1024}
          max={65535}
          value={entwurf.port}
          onChange={(e) => aendere((x) => ({ ...x, port: Math.round(Number(e.target.value)) || 0 }))}
        />
      </label>

      <div>
        <button type="button" className="knopf haupt klein" disabled={!geaendert || speichert} onClick={() => void speichern()}>
          {speichert ? 'Speichert …' : 'Übernehmen'}
        </button>
      </div>
      {(fehler || stand.fehler) && (
        <p className="meldung-schlecht" role="alert">
          {fehler || stand.fehler}
        </p>
      )}
      {stand.laeuft && (
        <p className="klein-leise">
          Läuft auf diesem Rechner unter 127.0.0.1:{stand.einstellung.port}, von außen nicht erreichbar. Einmal in der Eingabeaufforderung: <code>tailscale serve --bg localhost:{stand.einstellung.port}</code>
          . Danach öffnen die eingetragenen Konten die Adresse, die Tailscale nennt. Anleitung: docs/netz.md im Repository.
        </p>
      )}
    </section>
  )
}
