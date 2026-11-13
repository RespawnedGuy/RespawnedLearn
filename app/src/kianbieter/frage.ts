// Eine Frage an die gewählte KI: Anweisung aus den Einstellungen (Datenordner), Antwortformat fest, Antwort geprüft.
import { pfade, pruefeAntwort, SCHEMAS, wirksamerPrompt, type PromptSchluessel, type Schema } from '@rl/kern'
import { anbieterInfo } from './anbieter'
import { kiAbruf } from './netz'
import { KiFehler, type Abruf, type Anfrage, type AnbieterId, type AnbieterZugang, type Bild, type ModellInfo } from './typen'
import { aktiverZugang, ladeZugang } from './zugang'

/** Was die Anweisungen braucht: der Text der Prompt-Datei im Datenordner */
export interface PromptQuelle {
  text(pfad: string): string | undefined
}

export interface Aufgabe {
  text: string
  bilder?: Bild[]
  schema: Schema
  name: string
  aufwand?: 'niedrig' | 'mittel' | 'hoch'
  signal?: AbortSignal
}

let abruf: Abruf = kiAbruf
/** Nur für Tests */
export function abrufFuerTest(f: Abruf | null) {
  abruf = f ?? kiAbruf
}

export async function kiFrage<T>(quelle: PromptQuelle, aufgabe: PromptSchluessel, a: Aufgabe): Promise<T> {
  const z = aktiverZugang(await ladeZugang())
  if (!z) throw new KiFehler('einrichten')
  const anfrage: Anfrage = {
    system: wirksamerPrompt(quelle.text(pfade.kiPrompts()), aufgabe),
    text: a.text,
    bilder: a.bilder ?? [],
    schema: a.schema,
    name: a.name,
    aufwand: a.aufwand ?? 'mittel',
    signal: a.signal
  }
  const roh = await anbieterInfo(z.anbieter).adapter.frage(z, anfrage, abruf)
  try {
    return pruefeAntwort<T>(roh, a.schema)
  } catch (e) {
    throw new KiFehler('antwort', (e as Error).message)
  }
}

/** Ist eine KI eingerichtet? (ohne Netz) */
export async function kiBereit(): Promise<boolean> {
  return !!aktiverZugang(await ladeZugang())
}

/** Modelle eines Anbieters; prüft dabei Schlüssel bzw. Adresse */
export function kiModelle(anbieter: AnbieterId, z: AnbieterZugang, signal?: AbortSignal): Promise<ModellInfo[]> {
  return anbieterInfo(anbieter).adapter.modelle(z, abruf, signal)
}

/** Kleine Probe mit Antwortformat, bevor man sich auf ein Modell verlässt */
export async function kiProbe(anbieter: AnbieterId, z: AnbieterZugang, signal?: AbortSignal): Promise<void> {
  const roh = await anbieterInfo(anbieter).adapter.frage(
    z,
    { system: 'Antworte mit {"ok": true}.', text: 'Test', bilder: [], schema: SCHEMAS.pruefung, name: 'pruefung', aufwand: 'niedrig', signal },
    abruf
  )
  const r = pruefeAntwort<{ ok: boolean }>(roh, SCHEMAS.pruefung)
  if (!r.ok) throw new KiFehler('antwort', 'Probe nicht bestanden')
}

/** data:image/…;base64,… → Bild (nur PNG und JPEG, höchstens 4 MB) */
export function bildAus(dataUrl: string | null | undefined): Bild | null {
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '')
  if (!m || m[2].length > (4 * 1024 * 1024 * 4) / 3) return null
  return { mime: m[1] as Bild['mime'], daten: m[2] }
}

/** Für Fragen-Dateien (Vertrag 5.7, 5.8): Anbieter und Modell */
export async function modellKennung(): Promise<string> {
  const z = aktiverZugang(await ladeZugang())
  return z ? `${z.anbieter}/${z.modell}` : ''
}
