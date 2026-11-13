// Gemeinsamer KI-Zugang aller eigenen Geräte (Vertrag Lernen 1.2, 5.8): verschlüsselte Datei im Datenordner.
// Verschlüsseln und den Datenschlüssel hält Rust (app/src-tauri/src/tresor.rs); hier stehen die Schnittstelle dazu
// und die reinen Regeln: Zusammenführen beim Beitreten, Unbekanntes erhalten, verdeckte Anzeige.
import { invoke } from '@tauri-apps/api/core'
import { inTauri } from './netz'
import type { AnbieterId } from './typen'
import { sauber, type KiZugang } from './zugang'

/** Was Rust anbietet; in Tests ein Schein */
export interface Tresor {
  /** Kennung des Datenschlüssels, den dieses Gerät kennt; null = tritt nicht bei */
  kennung(): Promise<string | null>
  /** Neue Datei mit neuem Datenschlüssel; liefert den Dateitext */
  anlegen(passwort: string, klartext: string): Promise<string>
  /** Mit Passwort beitreten; liefert den Inhalt */
  beitreten(datei: string, passwort: string): Promise<string>
  oeffnen(datei: string): Promise<string>
  /** Neuer Inhalt, gleiches Passwort; liefert den Dateitext */
  schreiben(datei: string, klartext: string): Promise<string>
  vergessen(): Promise<void>
}

export const tauriTresor: Tresor = {
  kennung: () => invoke<string | null>('tresor_kennung'),
  anlegen: (passwort, klartext) => invoke<string>('tresor_anlegen', { passwort, klartext }),
  beitreten: (datei, passwort) => invoke<string>('tresor_beitreten', { datei, passwort }),
  oeffnen: (datei) => invoke<string>('tresor_oeffnen', { datei }),
  schreiben: (datei, klartext) => invoke<string>('tresor_schreiben', { datei, klartext }),
  vergessen: () => invoke<void>('tresor_vergessen')
}

export const standardTresor = (): Tresor | null => (inTauri() ? tauriTresor : null)

/** Mindestlänge in der Oberfläche (Rust verlangt mindestens 8) */
export const PASSWORT_MINDESTENS = 10

/** Fehlerwörter aus Rust als Sätze */
export function tresorFehlerText(e: unknown): string {
  const w = String((e as Error)?.message ?? e)
  if (w === 'passwort') return 'Das Passwort stimmt nicht.'
  if (w === 'kennung' || w === 'kein-schluessel') return 'Das Passwort wurde auf einem anderen Gerät geändert. Bitte das neue Passwort eingeben.'
  if (w === 'kaputt') return 'Die Datei mit dem gemeinsamen Zugang ist beschädigt oder von einer neueren App-Version.'
  if (w === 'zu-kurz') return `Das Passwort braucht mindestens ${PASSWORT_MINDESTENS} Zeichen.`
  if (w === 'zufall') return 'Das Gerät liefert gerade keine Zufallszahlen. Bitte noch einmal versuchen.'
  return w
}

/** Kennung aus dem Dateitext lesen, ohne zu entschlüsseln; null, wenn die Datei nicht passt */
export function dateiKennung(datei: string | undefined): string | null {
  try {
    const k = (JSON.parse(datei ?? '') as { kennung?: unknown }).kennung
    return typeof k === 'string' && /^[0-9a-f]{32}$/.test(k) ? k : null
  } catch {
    return null
  }
}

function objekt(roh: unknown): Record<string, unknown> {
  return roh && typeof roh === 'object' && !Array.isArray(roh) ? (roh as Record<string, unknown>) : {}
}

export function lies(klartext: string): Record<string, unknown> {
  try {
    return objekt(JSON.parse(klartext))
  } catch {
    return {}
  }
}

/**
 * Beim ersten Beitreten eines Geräts: Die Datei gilt; Anbieter, die nur dieses Gerät kannte, kommen dazu, ein hier
 * gewählter Anbieter gilt nur, wenn die Datei keinen nennt. So geht kein Schlüssel verloren.
 */
export function zusammenfuehren(gemeinsam: Record<string, unknown>, lokal: KiZugang): Record<string, unknown> {
  const g = sauber(gemeinsam)
  const zugaenge = { ...objekt(gemeinsam.zugaenge) }
  for (const [id, z] of Object.entries(lokal.zugaenge)) if (!g.zugaenge[id as AnbieterId] && z) zugaenge[id] = z
  return { ...gemeinsam, anbieter: g.anbieter ?? lokal.anbieter, zugaenge }
}

/**
 * Neuen Stand in den alten Inhalt einarbeiten: bekannte Anbieter nach `neu` (entfernte fallen weg), unbekannte Felder
 * und Anbieter einer neueren App-Version bleiben stehen.
 */
export function einarbeiten(alt: Record<string, unknown>, neu: KiZugang): Record<string, unknown> {
  const zugaenge = { ...objekt(alt.zugaenge) }
  for (const id of ['anthropic', 'openai', 'gemini', 'perplexity', 'ollama'] as AnbieterId[]) {
    const z = neu.zugaenge[id]
    if (z) zugaenge[id] = { ...objekt(zugaenge[id]), ...z }
    else delete zugaenge[id]
    // Felder, die im neuen Stand fehlen, auch hier entfernen (z. B. Modell gelöscht)
    if (z) for (const f of ['schluessel', 'adresse', 'modell'] as const) if (!z[f]) delete (zugaenge[id] as Record<string, unknown>)[f]
  }
  return { ...alt, anbieter: neu.anbieter, zugaenge }
}

const NAMEN: Record<AnbieterId, string> = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini', perplexity: 'Perplexity', ollama: 'Ollama' }

/** Schlüssel nur mit den letzten vier Zeichen */
export function verdeckeSchluessel(s: string): string {
  return s.length <= 8 ? '…' : `…${s.slice(-4)}`
}

/** Eine Zeile je Anbieter für die Konfliktansicht, ohne vollständigen Schlüssel */
export function verdeckt(z: KiZugang): string[] {
  const zeilen = Object.entries(z.zugaenge).map(([id, a]) =>
    [NAMEN[id as AnbieterId] + (z.anbieter === id ? ' (aktiv)' : ''), a?.schluessel ? `Schlüssel ${verdeckeSchluessel(a.schluessel)}` : '', a?.adresse ?? '', a?.modell ? `Modell ${a.modell}` : '']
      .filter(Boolean)
      .join(' · ')
  )
  return zeilen.length ? zeilen : ['Kein Anbieter eingerichtet']
}
