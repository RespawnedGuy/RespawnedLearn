// Zugang zum Datenordner auf der Platte über die Tauri-Befehle in app/src-tauri/src/lib.rs.
// Im Browser (npm run dev ohne Tauri) gibt es keinen Ordner, dann liefert `inTauri()` false.
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface OrdnerStand {
  ordner: string | null
  /** windows, android, linux, macos … */
  plattform: string
}

export interface OrdnerEintrag {
  pfad: string
  groesse: number
  /** Millisekunden seit 1970 */
  geaendert: number
}

export const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const ordnerStand = () => invoke<OrdnerStand>('stand')
export const setzeOrdner = (pfad: string) => invoke<void>('ordner_setzen', { pfad })
export const ordnerDateien = () => invoke<OrdnerEintrag[]>('dateien')

export async function leseDatei(pfad: string): Promise<Uint8Array> {
  return new Uint8Array(await invoke<ArrayBuffer>('datei_lesen', { pfad }))
}

export async function leseText(pfad: string): Promise<string> {
  return new TextDecoder().decode(await leseDatei(pfad))
}

export function schreibeDatei(pfad: string, inhalt: Uint8Array | string): Promise<void> {
  const bytes = typeof inhalt === 'string' ? new TextEncoder().encode(inhalt) : inhalt
  return invoke('datei_schreiben', bytes, { headers: { pfad: encodeURIComponent(pfad) } })
}

/** Meldet geänderte Pfade (auch von Syncthing), kurz hintereinander kommende Meldungen zusammengefasst */
export function beobachteOrdner(rueckruf: (pfade: string[]) => void, wartezeit = 300): Promise<UnlistenFn> {
  let offen = new Set<string>()
  let uhr: ReturnType<typeof setTimeout> | undefined
  return listen<string[]>('ordner-geaendert', (e) => {
    for (const p of e.payload) offen.add(p)
    clearTimeout(uhr)
    uhr = setTimeout(() => {
      const pfade = [...offen].sort()
      offen = new Set()
      rueckruf(pfade)
    }, wartezeit)
  })
}
