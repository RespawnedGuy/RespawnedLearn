// KI-Zugang des Geräts: gewählter Anbieter und je Anbieter Schlüssel, Adresse und Modell. In der App liegt er über
// Rust im Konfigurationsordner (app/src-tauri/src/zugang.rs), nie im Datenordner und nie in localStorage.
// Im Browser (npm run dev) gilt er nur bis zum Neuladen.
import { invoke } from '@tauri-apps/api/core'
import { useEffect, useSyncExternalStore } from 'react'
import { inTauri } from './netz'
import type { AnbieterId, AnbieterZugang } from './typen'

export interface KiZugang {
  anbieter: AnbieterId | null
  zugaenge: Partial<Record<AnbieterId, AnbieterZugang>>
}

const LEER: KiZugang = { anbieter: null, zugaenge: {} }
const IDS: AnbieterId[] = ['anthropic', 'openai', 'gemini', 'perplexity', 'ollama']

let stand: KiZugang | null = null
let laden: Promise<KiZugang> | null = null
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

export function ladeZugang(): Promise<KiZugang> {
  if (stand) return Promise.resolve(stand)
  laden ??= (inTauri() ? invoke<unknown>('ki_zugang_lesen').catch(() => null) : Promise.resolve(null)).then((roh) => {
    stand = sauber(roh)
    melde()
    return stand
  })
  return laden
}

export async function speichereZugang(z: KiZugang): Promise<void> {
  const neu = sauber(z)
  const leer = !neu.anbieter && !Object.keys(neu.zugaenge).length
  if (inTauri()) await invoke('ki_zugang_setzen', { wert: leer ? null : neu })
  stand = neu
  melde()
}

/** Der Zugang, mit dem gefragt wird: Anbieter gewählt, Modell gewählt und Schlüssel da (Ollama: ohne Schlüssel) */
export function aktiverZugang(z: KiZugang | null): (AnbieterZugang & { anbieter: AnbieterId }) | null {
  if (!z?.anbieter) return null
  const a = z.zugaenge[z.anbieter]
  if (!a?.modell) return null
  if (z.anbieter !== 'ollama' && !a.schluessel) return null
  return { anbieter: z.anbieter, ...a }
}

export function useKiZugang(): KiZugang | null {
  const z = useSyncExternalStore(
    (f) => {
      hoerer.add(f)
      return () => hoerer.delete(f)
    },
    () => stand
  )
  useEffect(() => {
    void ladeZugang()
  }, [])
  return z
}

/** Nur für Tests: Zugang setzen, ohne Tauri */
export function zugangFuerTest(z: KiZugang | null) {
  stand = z ? sauber(z) : LEER
  laden = Promise.resolve(stand)
}
