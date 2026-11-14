// Zugang zum Datenordner auf der Platte über die Tauri-Befehle in app/src-tauri/src/lib.rs.
// Im Browser (npm run dev ohne Tauri) gibt es keinen Ordner, dann liefert `inTauri()` false und der Speicher nimmt
// eine Ablage im Arbeitsspeicher (ablageImSpeicher.ts).
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export interface OrdnerStand {
  ordner: string | null
  /** windows, android, linux, macos … */
  plattform: string
  /** vorgeschlagener Ort: PC „Dokumente/RespawnedLearn“, Android im Gerätespeicher */
  standard?: string | null
  /** was am vorgeschlagenen Ort schon liegt; fehlt, wenn er sich nicht lesen lässt */
  standard_inhalt?: OrdnerInhalt | null
  /** liegt der Ordner an einem gesperrten Ort (z. B. Programmordner), der Grund */
  warnung?: string | null
}

/** leer = nichts außer Verwaltung anderer Programme, lerndaten = Daten von RespawnedLearn, fremd = andere Dateien */
export type OrdnerInhalt = 'leer' | 'lerndaten' | 'fremd'

/** Neuer Ordner in den Einstellungen, geprüft, aber noch nicht übernommen */
export interface Vormerkung {
  pfad: string
  inhalt: OrdnerInhalt
}

export interface OrdnerEintrag {
  pfad: string
  groesse: number
  /** Millisekunden seit 1970 */
  geaendert: number
}

export interface TextDatei extends OrdnerEintrag {
  /** Fingerabdruck des gelesenen Stands; beim Schreiben zurückgeben, damit nichts still überschrieben wird */
  stempel: string
  text: string
}

export type Geschrieben = { art: 'ok'; groesse: number; geaendert: number; stempel: string } | { art: 'geaendert' }

/** Was der Speicher vom Datenordner braucht. Zwei Umsetzungen: Tauri (echter Ordner) und im Arbeitsspeicher (Tests, Browser). */
export interface Ablage {
  dateien(): Promise<OrdnerEintrag[]>
  texteLesen(pfade: string[]): Promise<TextDatei[]>
  leseDatei(pfad: string): Promise<Uint8Array>
  /** Schreibt nur, wenn die Datei noch den Stand `erwartet` hat (null = darf noch nicht existieren) */
  schreibeWenn(pfad: string, inhalt: Uint8Array | string, erwartet: string | null): Promise<Geschrieben>
  /** Löscht eine Konfliktkopie von `original`; andere Dateien lehnt die Ablage ab (`loeschbareKopie` in kern) */
  konfliktLoeschen(pfad: string, original: string): Promise<void>
  /** Meldet Änderungen im Ordner (auch von Syncthing); liefert die Abmeldung */
  beobachte(rueckruf: () => void): Promise<() => void>
  /** Wie oft die Dateiliste zusätzlich abgefragt wird (ms, 0 = nie): Unter Android schweigt die Dateiüberwachung im gemeinsamen Speicher oft */
  abfrageMs: number
  /** false = nichts wird dauerhaft gespeichert (Vorschau im Browser) */
  dauerhaft: boolean
}

export const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const ordnerStand = () => invoke<OrdnerStand>('stand')
/** Nur Android: getippter Pfad, Rust prüft ihn (ordnerwahl.rs) */
export const setzeOrdner = (pfad: string) => invoke<void>('ordner_setzen', { pfad })
/** Am PC: Rust öffnet den Ordnerdialog und setzt die Wahl; false = abgebrochen */
export const waehleOrdner = () => invoke<boolean>('ordner_waehlen')
/** Erster Start: den vorgeschlagenen Ort anlegen und nutzen */
export const nimmStandardOrdner = () => invoke<void>('ordner_standard')
/** Ordnerwechsel, Schritt 1: Dialog (PC), Standardort oder Pfad (Android) prüfen; null = abgebrochen */
export const merkeOrdnerVor = (wahl: 'dialog' | 'standard' | 'pfad', pfad?: string) =>
  invoke<Vormerkung | null>('ordner_vormerken', { wahl, pfad: pfad ?? null })
/** Ordnerwechsel, Schritt 2: übernehmen, mit `mitnehmen` vorher alles kopieren und prüfen; liefert die Zahl der Dateien */
export const uebernimmOrdner = (mitnehmen: boolean) => invoke<number>('ordner_uebernehmen', { mitnehmen })
/** Fortschritt des Umzugs [fertig, gesamt]; liefert die Abmeldung */
export function beobachteUmzug(f: (fertig: number, gesamt: number) => void): Promise<() => void> {
  return listen<[number, number]>('umzug-fortschritt', (e) => f(e.payload[0], e.payload[1]))
}

const bytes = (inhalt: Uint8Array | string) => (typeof inhalt === 'string' ? new TextEncoder().encode(inhalt) : inhalt)

/** Der echte Ordner über Tauri */
export async function tauriAblage(): Promise<Ablage> {
  const { plattform } = await ordnerStand()
  return {
    dateien: () => invoke<OrdnerEintrag[]>('dateien'),
    texteLesen: (pfade) => (pfade.length ? invoke<TextDatei[]>('texte_lesen', { pfade }) : Promise.resolve([])),
    leseDatei: async (pfad) => new Uint8Array(await invoke<ArrayBuffer>('datei_lesen', { pfad })),
    schreibeWenn: (pfad, inhalt, erwartet) =>
      invoke<Geschrieben>('datei_schreiben_wenn', bytes(inhalt), {
        headers: { pfad: encodeURIComponent(pfad), ...(erwartet === null ? {} : { erwartet }) }
      }),
    konfliktLoeschen: (pfad, original) => invoke<void>('konflikt_loeschen', { pfad, original }),
    beobachte: (rueckruf) => listen<string[]>('ordner-geaendert', () => rueckruf()),
    abfrageMs: plattform === 'android' ? 10_000 : 60_000,
    dauerhaft: true
  }
}
