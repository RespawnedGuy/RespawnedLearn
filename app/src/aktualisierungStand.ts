// Neue Versionen der App (docs/aktualisieren.md). Die App fragt beim Start einmal die Datei `latest.json` im neuesten
// GitHub-Release ab (abschaltbar, je Gerät), ohne Kennung und ohne Daten. Am PC installiert sie auf Knopfdruck (Rust,
// Signaturprüfung im Tauri-Updater), unter Android öffnet sie den Download der APK.
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { erlaubterDownload, liesNeuigkeit, zeigeNeuigkeit, type Neuigkeit, type Plattform } from '@rl/kern'
import { inTauri, oeffneDownload, ordnerStand } from '@rl/oberflaeche'

declare const __VERSION__: string
export const eigeneVersion = (): string => (typeof __VERSION__ === 'string' ? __VERSION__ : '0.0.0')

export type Lage =
  | { art: 'ruhe' }
  | { art: 'sucht' }
  | { art: 'aktuell'; geprueft: Date }
  | { art: 'neu'; neuigkeit: Neuigkeit; installierbar: boolean }
  | { art: 'installiert' }
  | { art: 'fehler'; text: string }

const PRUEFEN = 'rl-updates-pruefen'
const WEG = 'rl-updates-weg'

function lies(schluessel: string): string | null {
  try {
    return localStorage.getItem(schluessel)
  } catch {
    return null
  }
}

function merke(schluessel: string, wert: string | null) {
  try {
    if (wert === null) localStorage.removeItem(schluessel)
    else localStorage.setItem(schluessel, wert)
  } catch {
    /* ohne Speicher gilt es bis zum Neustart */
  }
}

/** Beim Start nachsehen? Standard ja (Nils 13.11.), je Gerät abschaltbar */
export const pruefenBeimStart = (): boolean => lies(PRUEFEN) !== 'nein'

let lage: Lage = { art: 'ruhe' }
let plattform: Plattform = 'windows'
let installierbar = false
const hoerer = new Set<(l: Lage) => void>()

function setze(l: Lage) {
  lage = l
  for (const f of hoerer) f(l)
}

export function useAktualisierung(): Lage {
  const [l, setL] = useState(lage)
  useEffect(() => {
    hoerer.add(setL)
    setL(lage)
    return () => void hoerer.delete(setL)
  }, [])
  return l
}

export function setzePruefenBeimStart(an: boolean) {
  merke(PRUEFEN, an ? null : 'nein')
  for (const f of hoerer) f(lage)
}

/** Fehlertexte aus Rust in Sätze; ohne Netz sagt die automatische Prüfung gar nichts */
function satz(fehler: unknown): string {
  const f = String(fehler)
  if (f.includes('kein-netz')) return 'Keine Verbindung zu GitHub. Später noch einmal versuchen.'
  if (f.includes('antwort-404')) return 'Auf GitHub liegt noch keine Versionsliste.'
  if (f.includes('keine-neue')) return 'Es gibt keine neuere Version.'
  if (/signature|signatur/i.test(f)) return 'Die neue Version trägt keine gültige Signatur und wurde nicht installiert.'
  return `Nachsehen ging nicht (${f.slice(0, 120)}).`
}

/** Sucht nach einer neuen Version. `still`: beim Start, ohne Meldung bei Fehlern und ohne weggeklickte Version */
export async function suche(still: boolean): Promise<void> {
  if (!inTauri() || lage.art === 'sucht') return
  setze({ art: 'sucht' })
  try {
    const stand = await ordnerStand()
    plattform = stand.plattform === 'android' ? 'android' : 'windows'
    installierbar = plattform === 'windows' && (await invoke<boolean>('aktualisierung_eingerichtet'))
    const n = liesNeuigkeit(await invoke<string>('aktualisierung_abrufen'), plattform)
    if (!n) return setze(still ? { art: 'ruhe' } : { art: 'fehler', text: 'Die Versionsliste auf GitHub ist nicht lesbar.' })
    if (zeigeNeuigkeit(n, eigeneVersion(), still ? lies(WEG) : null)) setze({ art: 'neu', neuigkeit: n, installierbar })
    else setze({ art: 'aktuell', geprueft: new Date() })
  } catch (e) {
    setze(still ? { art: 'ruhe' } : { art: 'fehler', text: satz(e) })
  }
}

/** Einmal je Start, wenn erlaubt */
let gestartet = false
export function sucheBeimStart() {
  if (gestartet || !pruefenBeimStart()) return
  gestartet = true
  void suche(true)
}

/** „Später“: diese Version nicht mehr beim Start zeigen (in den Einstellungen bleibt sie sichtbar) */
export function spaeter(n: Neuigkeit) {
  merke(WEG, n.version)
  setze({ art: 'ruhe' })
}

/** PC: installieren (die App beendet sich dafür und startet neu). Android: Download der APK öffnen. */
export async function hole(n: Neuigkeit): Promise<void> {
  if (plattform === 'android') {
    if (n.adresse && erlaubterDownload(n.adresse)) oeffneDownload(n.adresse)
    else setze({ art: 'fehler', text: 'Diese Version hat keine APK zum Herunterladen.' })
    return
  }
  setze({ art: 'installiert' })
  try {
    await invoke('aktualisierung_installieren')
  } catch (e) {
    setze({ art: 'fehler', text: satz(e) })
  }
}
