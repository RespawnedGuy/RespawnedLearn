// KI-Anfragen laufen in der App über Rust (tauri-plugin-http): Perplexity und Ollama erlauben keine Anfragen aus dem
// Browser (CORS). Welche Adressen erreichbar sind, steht in app/src-tauri/capabilities/default.json. Im Browser
// (npm run dev) bleibt nur fetch, dann gehen nur Anbieter, die Browser-Anfragen erlauben.
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import type { Abruf } from './typen'

/** wie inTauri() aus @rl/oberflaeche, ohne die ganze Oberfläche zu laden (testbar ohne Browser) */
export const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const SEKUNDEN = 180

/** Bricht nach SEKUNDEN ab und hört zusätzlich auf das Signal des Aufrufers */
export function mitFrist(signal?: AbortSignal, sekunden = SEKUNDEN): AbortSignal {
  const frist = AbortSignal.timeout(sekunden * 1000)
  if (!signal) return frist
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, frist])
  const c = new AbortController()
  const ab = () => c.abort()
  signal.addEventListener('abort', ab, { once: true })
  frist.addEventListener('abort', ab, { once: true })
  return c.signal
}

export const kiAbruf: Abruf = (url, init) => (inTauri() ? tauriFetch(url, init) : fetch(url, init))
