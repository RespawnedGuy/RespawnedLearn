// HTTP-Fehler der Anbieter in Fehlerarten übersetzen, die man einem Menschen erklären kann.
// Grundlage: die Fehlerseiten der Anbieter (Anthropic, OpenAI, Gemini, Perplexity) und Ollamas Antworten.
import { KiFehler } from './typen'

/** Die Meldung des Anbieters aus dem Fehlerrumpf, gekürzt */
export function meldungAus(rumpf: string): string {
  try {
    const j = JSON.parse(rumpf) as { error?: { message?: string } | string; message?: string }
    const m = typeof j.error === 'string' ? j.error : (j.error?.message ?? j.message)
    if (m) return String(m).slice(0, 300)
  } catch {
    /* kein JSON */
  }
  return rumpf.replace(/\s+/g, ' ').trim().slice(0, 300)
}

export function fehlerAus(status: number, rumpf: string): KiFehler {
  const m = meldungAus(rumpf)
  const t = `${rumpf} ${m}`.toLowerCase()
  if (status === 402 || /insufficient_quota|credit balance|billing|quota exceeded|exceeded your current quota/.test(t)) return new KiFehler('guthaben', m)
  if (status === 401 || status === 403 || /api_key_invalid|api key not valid|invalid x-api-key|invalid api key|incorrect api key/.test(t)) return new KiFehler('zugang', m)
  if (status === 429) return new KiFehler('limit', m)
  if (status === 404 || /model[^.]{0,40}(not found|does not exist)|unknown model|not_found_error/.test(t)) return new KiFehler('modell', m)
  if (status >= 500) return new KiFehler('dienst', m)
  if (/image|vision|multimodal/.test(t) && /support|not allowed|cannot/.test(t)) return new KiFehler('bilder', m)
  return new KiFehler('anfrage', m || `HTTP ${status}`)
}

/** Fehler beim Abruf selbst (kein HTTP-Status): abgebrochen oder kein Netz */
export function netzFehler(e: unknown, signal?: AbortSignal): KiFehler {
  if (e instanceof KiFehler) return e
  if (signal?.aborted || (e as { name?: string })?.name === 'AbortError') return new KiFehler('abgebrochen')
  return new KiFehler('netz', String((e as Error)?.message ?? e).slice(0, 200))
}

/** JSON abrufen; HTTP-Fehler werden zu KiFehler */
export async function holeJson<T>(abruf: (url: string, init?: RequestInit) => Promise<Response>, url: string, init: RequestInit = {}): Promise<T> {
  let r: Response
  try {
    r = await abruf(url, init)
  } catch (e) {
    throw netzFehler(e, init.signal ?? undefined)
  }
  const rumpf = await r.text().catch(() => '')
  if (!r.ok) throw fehlerAus(r.status, rumpf)
  try {
    return JSON.parse(rumpf) as T
  } catch {
    throw new KiFehler('antwort', 'keine JSON-Antwort')
  }
}
