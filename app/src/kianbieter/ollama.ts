// Ollama: ein KI-Modell auf dem eigenen Rechner oder im Heimnetz (`/api/chat` mit `format` als JSON-Schema,
// Bilder als base64 in `images`, Doku docs.ollama.com/api/chat). Ob ein Modell Bilder liest, sagt `/api/show`.
import { jsonAusText } from '@rl/kern'
import { holeJson } from './fehler'
import { mitFrist } from './netz'
import { KiFehler, type Adapter, type AnbieterZugang } from './typen'

export const OLLAMA_STANDARD = 'http://localhost:11434'

/** Adresse vereinheitlichen: ohne Schrägstrich am Ende, ohne Schema wird http angenommen, ohne Port 11434 */
export function ollamaAdresse(z: AnbieterZugang): string {
  let a = (z.adresse ?? '').trim() || OLLAMA_STANDARD
  if (!/^https?:\/\//.test(a)) a = `http://${a}`
  a = a.replace(/\/+$/, '')
  if (!/:\d+$/.test(new URL(a).host)) a = a.replace(/^(https?:\/\/[^/]+)/, '$1:11434')
  return a
}

interface Liste {
  models?: { name: string; details?: { parameter_size?: string } }[]
}

const kannSehen = new Map<string, boolean>()

export const ollama: Adapter = {
  async modelle(z, abruf, signal) {
    const basis = ollamaAdresse(z)
    const j = await holeJson<Liste>(abruf, `${basis}/api/tags`, { signal })
    return Promise.all(
      (j.models ?? []).map(async (m) => {
        const info = await holeJson<{ capabilities?: string[] }>(abruf, `${basis}/api/show`, { method: 'POST', body: JSON.stringify({ model: m.name }), signal }).catch(() => null)
        const bilder = info?.capabilities ? info.capabilities.includes('vision') : undefined
        if (bilder !== undefined) kannSehen.set(`${basis}|${m.name}`, bilder)
        return { id: m.name, name: m.name, bilder, ...(m.details?.parameter_size ? { hinweis: m.details.parameter_size } : {}) }
      })
    )
  },

  async frage(z, a, abruf) {
    const basis = ollamaAdresse(z)
    if (a.bilder.length && kannSehen.get(`${basis}|${z.modell}`) === false) throw new KiFehler('bilder')
    const j = await holeJson<{ message?: { content?: string }; done_reason?: string }>(abruf, `${basis}/api/chat`, {
      method: 'POST',
      // lokale Modelle brauchen beim ersten Laden länger
      signal: mitFrist(a.signal, 600),
      body: JSON.stringify({
        model: z.modell,
        messages: [
          { role: 'system', content: a.system },
          { role: 'user', content: a.text, ...(a.bilder.length ? { images: a.bilder.map((b) => b.daten) } : {}) }
        ],
        format: a.schema,
        stream: false
      })
    })
    if (j.done_reason === 'length') throw new KiFehler('antwort', 'Antwort abgeschnitten')
    try {
      return jsonAusText(j.message?.content ?? '')
    } catch {
      throw new KiFehler('antwort')
    }
  }
}
