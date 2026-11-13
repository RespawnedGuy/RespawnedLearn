// KI-Anfragen laufen in der App über Rust (tauri-plugin-http): Perplexity und Ollama erlauben keine Anfragen aus dem
// Browser (CORS). Welche Adressen erreichbar sind, steht in app/src-tauri/capabilities/default.json. Im Browser
// (npm run dev) bleibt nur fetch, dann gehen nur Anbieter, die Browser-Anfragen erlauben.
import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { KiFehler, type Abruf } from './typen'

/** wie inTauri() aus @rl/oberflaeche, ohne die ganze Oberfläche zu laden (testbar ohne Browser) */
export const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Rechenaufgaben mit hohem Aufwand und Vorfragen über zwei Bücher brauchen bei großen Modellen auch mal drei, vier Minuten (VX: 300 s)
const SEKUNDEN = 300

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

/** Ollama (http, Port 11434) geht nicht über die freie HTTP-Freigabe, sondern über einen eigenen Befehl, der nur
 * Rechner im eigenen Netz erreicht (app/src-tauri/src/ollama.rs). Erkannt am Port, wie in ollamaAdresse(). */
export const istOllama = (url: string) => /^https?:\/\/[^/]+:11434\//.test(url)

export const ollamaAbruf: Abruf = (url, init) => {
  const signal = init?.signal ?? undefined
  const rumpf = typeof init?.body === 'string' ? init.body : null
  const anfrage = invoke<{ status: number; text: string }>('ollama_anfrage', { url, rumpf }).then(
    (a) => new Response(a.text, { status: a.status, headers: { 'content-type': 'application/json' } }),
    (e: unknown) => {
      if (String(e) === 'ollama-nicht-privat')
        throw new KiFehler('anfrage', 'Ollama ist nur im eigenen Netz erlaubt, zum Beispiel http://192.168.1.20:11434 oder localhost.')
      throw new KiFehler('netz', String(e))
    }
  )
  if (!signal) return anfrage
  // Den Befehl selbst kann man nicht abbrechen; das Warten schon
  return Promise.race([
    anfrage,
    new Promise<never>((_, nein) => {
      const ab = () => nein(new DOMException('abgebrochen', 'AbortError'))
      if (signal.aborted) ab()
      else signal.addEventListener('abort', ab, { once: true })
    })
  ])
}

export const kiAbruf: Abruf = (url, init) => (inTauri() ? (istOllama(url) ? ollamaAbruf(url, init) : tauriFetch(url, init)) : fetch(url, init))
