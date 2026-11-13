// KI-Zugang: gewählter Anbieter und je Anbieter Schlüssel, Adresse und Modell.
// - Nur auf diesem Gerät: über Rust im Konfigurationsordner (app/src-tauri/src/zugang.rs), nie in localStorage.
// - Auf allen Geräten (freiwillig, Vertrag Lernen 1.2, 5.8): verschlüsselt im Datenordner (teilen.ts, tresor.rs).
//   Das Gerät hält dann im Konfigordner eine Kopie des zuletzt gelesenen Stands, damit die KI auch weiterläuft,
//   solange nach einer Passwortänderung auf einem anderen Gerät hier noch das neue Passwort fehlt.
// Im Browser (npm run dev) gilt der Zugang nur bis zum Neuladen, Teilen gibt es dort nicht.
import { invoke } from '@tauri-apps/api/core'
import { pfade } from '@rl/kern'
import { useEffect, useSyncExternalStore } from 'react'
import { inTauri } from './netz'
import { einarbeiten, dateiKennung, lies, standardTresor, verdeckt, zusammenfuehren, type Tresor } from './teilen'
import type { AnbieterId, AnbieterZugang } from './typen'

export interface KiZugang {
  anbieter: AnbieterId | null
  zugaenge: Partial<Record<AnbieterId, AnbieterZugang>>
}

/**
 * Wie das Gerät zum gemeinsamen Zugang steht:
 * aus = keine Datei im Ordner; angeboten = Datei da, dieses Gerät nimmt nicht teil; an = geteilt;
 * neues-passwort = auf einem anderen Gerät wurde das Passwort geändert; kaputt = Datei nicht lesbar
 */
export type Teilen = 'aus' | 'angeboten' | 'an' | 'neues-passwort' | 'kaputt'

/** Was der Zugang vom Datenordner braucht (der Speicher erfüllt das) */
export interface ZugangOrdner {
  text(pfad: string): string | undefined
  schreibe(pfad: string, text: string): Promise<void>
  abonniere(f: () => void): () => void
}

const LEER: KiZugang = { anbieter: null, zugaenge: {} }
const IDS: AnbieterId[] = ['anthropic', 'openai', 'gemini', 'perplexity', 'ollama']
const PFAD = pfade.kiZugang()

/** Was in der Oberfläche gilt; null, solange noch geladen wird */
let stand: KiZugang | null = null
/** Inhalt der Datei mit allen Feldern (auch unbekannten), wenn geteilt */
let gemeinsamRoh: Record<string, unknown> | null = null
let teilen: Teilen = 'aus'
let laden: Promise<KiZugang> | null = null
let ordner: ZugangOrdner | null = null
let tresor: Tresor | null = null
let gelesen: string | undefined
let pruefung: Promise<void> = Promise.resolve()
const hoerer = new Set<() => void>()
const melde = () => hoerer.forEach((f) => f())

/** Gespeicherten Zugang in sichere Form bringen (unbekannte Anbieter und Felder fallen weg) */
export function sauber(roh: unknown): KiZugang {
  const r = (roh && typeof roh === 'object' ? roh : {}) as { anbieter?: unknown; zugaenge?: Record<string, unknown> }
  const zugaenge: KiZugang['zugaenge'] = {}
  for (const id of IDS) {
    const z = r.zugaenge?.[id] as Record<string, unknown> | undefined
    if (!z || typeof z !== 'object') continue
    const t = (k: string) => (typeof z[k] === 'string' && (z[k] as string).trim() ? (z[k] as string).trim() : undefined)
    zugaenge[id] = { ...(t('schluessel') ? { schluessel: t('schluessel') } : {}), ...(t('adresse') ? { adresse: t('adresse') } : {}), ...(t('modell') ? { modell: t('modell') } : {}) }
  }
  return { anbieter: IDS.includes(r.anbieter as AnbieterId) ? (r.anbieter as AnbieterId) : null, zugaenge }
}

const leer = (z: KiZugang) => !z.anbieter && !Object.keys(z.zugaenge).length

let lokalLesen: () => Promise<unknown> = () => (inTauri() ? invoke<unknown>('ki_zugang_lesen').catch(() => null) : Promise.resolve(null))
let lokalSetzen: (z: KiZugang) => Promise<void> = async (z) => {
  if (inTauri()) await invoke('ki_zugang_setzen', { wert: leer(z) ? null : z })
}

export function ladeZugang(): Promise<KiZugang> {
  if (stand) return Promise.resolve(stand)
  laden ??= lokalLesen().then(async (roh) => {
    stand ??= sauber(roh)
    melde()
    await pruefung
    return stand
  })
  return laden
}

/**
 * Verbindet den Zugang mit dem Datenordner. Jede Änderung der verschlüsselten Datei (auch durch Syncthing) wird
 * gelesen; ohne Neustart gilt dann der Stand des anderen Geräts.
 */
export function verbindeOrdner(o: ZugangOrdner, t: Tresor | null = standardTresor()): () => void {
  ordner = o
  tresor = t
  gelesen = undefined
  const pruefe = () => {
    const text = o.text(PFAD)
    if (text === gelesen) return
    gelesen = text
    pruefung = pruefung.then(() => uebernimm(text)).catch(() => undefined)
  }
  const ab = o.abonniere(pruefe)
  pruefe()
  return () => {
    ab()
    if (ordner === o) ordner = null
  }
}

async function uebernimm(text: string | undefined) {
  await ladeZugang()
  const vorher = teilen
  if (text === undefined || !tresor) {
    teilen = text === undefined ? 'aus' : 'angeboten'
    gemeinsamRoh = null
  } else {
    const eigene = await tresor.kennung()
    const kennung = dateiKennung(text)
    if (!kennung) teilen = 'kaputt'
    else if (!eigene) teilen = 'angeboten'
    else if (eigene !== kennung) teilen = 'neues-passwort'
    else {
      try {
        gemeinsamRoh = lies(await tresor.oeffnen(text))
        teilen = 'an'
        const neu = sauber(gemeinsamRoh)
        if (JSON.stringify(neu) !== JSON.stringify(stand)) {
          stand = neu
          await lokalSetzen(neu)
        }
      } catch {
        teilen = 'kaputt'
      }
    }
  }
  if (teilen !== 'an') gemeinsamRoh = null
  if (vorher !== teilen || teilen === 'an') melde()
}

/** Speichert den Zugang auf dem Gerät und, wenn geteilt, verschlüsselt im Datenordner */
export async function speichereZugang(z: KiZugang): Promise<void> {
  const neu = sauber(z)
  if (teilen === 'an' && ordner && tresor) {
    const roh = einarbeiten(gemeinsamRoh ?? {}, neu)
    const datei = await tresor.schreiben(ordner.text(PFAD) ?? '', JSON.stringify(roh))
    gemeinsamRoh = roh
    gelesen = datei
    await ordner.schreibe(PFAD, datei)
  }
  await lokalSetzen(neu)
  stand = neu
  melde()
}

function brauche(): { o: ZugangOrdner; t: Tresor } {
  if (!ordner || !tresor) throw new Error('Teilen gibt es nur in der installierten App mit Datenordner.')
  return { o: ordner, t: tresor }
}

async function schreibeNeu(passwort: string, roh: Record<string, unknown>) {
  const { o, t } = brauche()
  const datei = await t.anlegen(passwort, JSON.stringify(roh))
  gemeinsamRoh = roh
  gelesen = datei
  teilen = 'an'
  await o.schreibe(PFAD, datei)
  const neu = sauber(roh)
  await lokalSetzen(neu)
  stand = neu
  melde()
}

/** Erstes Gerät: der Zugang dieses Geräts wird mit dem Passwort verschlüsselt in den Ordner gelegt */
export async function teilenEinschalten(passwort: string): Promise<void> {
  if (teilen !== 'aus') throw new Error('Im Ordner liegt schon ein gemeinsamer Zugang.')
  await schreibeNeu(passwort, einarbeiten({}, await ladeZugang()))
}

/**
 * Mit dem Passwort beitreten. Beim ersten Mal kommen Anbieter dazu, die nur dieses Gerät kannte; nach einer
 * Passwortänderung gilt die Datei allein (sonst kämen auf einem anderen Gerät entfernte Schlüssel zurück).
 */
export async function teilenBeitreten(passwort: string): Promise<void> {
  const { o, t } = brauche()
  const erstesMal = teilen === 'angeboten'
  const text = o.text(PFAD) ?? ''
  const roh = lies(await t.beitreten(text, passwort))
  const zusammen = erstesMal ? zusammenfuehren(roh, await ladeZugang()) : roh
  gemeinsamRoh = roh
  teilen = 'an'
  gelesen = text
  if (JSON.stringify(zusammen) !== JSON.stringify(roh)) await speichereZugang(sauber(zusammen))
  else {
    const neu = sauber(roh)
    await lokalSetzen(neu)
    stand = neu
    melde()
  }
}

/** Neues Passwort mit neuem Datenschlüssel; andere Geräte fragen danach einmal nach dem neuen Passwort */
export async function passwortAendern(neuesPasswort: string): Promise<void> {
  if (teilen !== 'an') throw new Error('Dieses Gerät nimmt nicht am gemeinsamen Zugang teil.')
  await schreibeNeu(neuesPasswort, gemeinsamRoh ?? einarbeiten({}, await ladeZugang()))
}

/** Passwort vergessen: die Datei wird mit dem Zugang dieses Geräts und neuem Passwort ersetzt */
export async function neuAnfangen(passwort: string): Promise<void> {
  await schreibeNeu(passwort, einarbeiten({}, await ladeZugang()))
}

/** Dieses Gerät nimmt nicht mehr teil; es behält den Zugang für sich, die Datei im Ordner bleibt */
export async function teilenBeenden(): Promise<void> {
  const { t } = brauche()
  await t.vergessen()
  teilen = ordner?.text(PFAD) === undefined ? 'aus' : 'angeboten'
  gemeinsamRoh = null
  melde()
}

/** Für die Konfliktansicht: eine Fassung entschlüsselt und verdeckt; null, wenn dieses Gerät sie nicht lesen kann */
export async function zeigeVerdeckt(datei: string | undefined): Promise<string[] | null> {
  if (!tresor || datei === undefined) return null
  try {
    return verdeckt(sauber(lies(await tresor.oeffnen(datei))))
  } catch {
    return null
  }
}

/** Der Zugang, mit dem gefragt wird: Anbieter gewählt, Modell gewählt und Schlüssel da (Ollama: ohne Schlüssel) */
export function aktiverZugang(z: KiZugang | null): (AnbieterZugang & { anbieter: AnbieterId }) | null {
  if (!z?.anbieter) return null
  const a = z.zugaenge[z.anbieter]
  if (!a?.modell) return null
  if (z.anbieter !== 'ollama' && !a.schluessel) return null
  return { anbieter: z.anbieter, ...a }
}

const abonniere = (f: () => void) => {
  hoerer.add(f)
  return () => hoerer.delete(f)
}

export function useKiZugang(): KiZugang | null {
  const z = useSyncExternalStore(abonniere, () => stand)
  useEffect(() => {
    void ladeZugang()
  }, [])
  return z
}

/** Wie das Gerät zum gemeinsamen Zugang steht; null im Browser ohne App (dort gibt es kein Teilen) */
export function useTeilen(): Teilen | null {
  return useSyncExternalStore(abonniere, () => (tresor ? teilen : null))
}

/** Wartet, bis die zuletzt bemerkte Änderung der Datei verarbeitet ist (Tests) */
export const zugangVerarbeitet = () => pruefung

/** Nur für Tests: Zugang setzen, ohne Tauri */
export function zugangFuerTest(z: KiZugang | null, lokal?: { lesen: () => Promise<unknown>; setzen: (z: KiZugang) => Promise<void> }) {
  stand = z ? sauber(z) : LEER
  laden = Promise.resolve(stand)
  teilen = 'aus'
  gemeinsamRoh = null
  ordner = null
  tresor = null
  gelesen = undefined
  pruefung = Promise.resolve()
  if (lokal) {
    lokalLesen = lokal.lesen
    lokalSetzen = lokal.setzen
  }
}

/** Nur für Tests */
export const teilenStand = () => teilen
