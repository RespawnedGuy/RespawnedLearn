// OpenAI (ChatGPT) und Perplexity sprechen dieselbe Form: Chat Completions mit `response_format: json_schema`.
// Perplexity über seine OpenAI-kompatible Schnittstelle (`/orchestrator/v1`, Doku „Chat Completions“).
import { jsonAusText } from '@rl/kern'
import { holeJson } from './fehler'
import { mitFrist } from './netz'
import { KiFehler, type Adapter, type ModellInfo } from './typen'

interface Antwort {
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[]
}

interface ModellListe {
  data?: { id: string; created?: number; pricing?: { input?: number; output?: number } }[]
}

/** Nur Modelle, mit denen man chatten kann (die Liste von OpenAI enthält auch Bild-, Ton- und Embedding-Modelle) */
export const istChatModell = (id: string) => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|tts|transcribe|image|embedding|instruct|moderation|search|codex|dall-e|whisper)/.test(id)

export function chatAdapter(basis: string, o: { filter?: (id: string) => boolean } = {}): Adapter {
  const kopf = (schluessel?: string) => ({ authorization: `Bearer ${schluessel ?? ''}`, 'content-type': 'application/json' })
  return {
    async modelle(z, abruf, signal) {
      const j = await holeJson<ModellListe>(abruf, `${basis}/models`, { headers: kopf(z.schluessel), signal })
      return (j.data ?? [])
        .filter((m) => !o.filter || o.filter(m.id))
        .sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.id.localeCompare(b.id))
        .map(
          (m): ModellInfo => ({
            id: m.id,
            name: m.id,
            ...(m.pricing?.input != null && m.pricing?.output != null ? { hinweis: `${m.pricing.input} $ / ${m.pricing.output} $ je Mio. Tokens` } : {})
          })
        )
    },

    async frage(z, a, abruf) {
      const inhalt = [{ type: 'text', text: a.text }, ...a.bilder.map((b) => ({ type: 'image_url', image_url: { url: `data:${b.mime};base64,${b.daten}` } }))]
      const j = await holeJson<Antwort>(abruf, `${basis}/chat/completions`, {
        method: 'POST',
        headers: kopf(z.schluessel),
        signal: mitFrist(a.signal),
        body: JSON.stringify({
          model: z.modell,
          messages: [
            { role: 'system', content: a.system },
            { role: 'user', content: inhalt }
          ],
          response_format: { type: 'json_schema', json_schema: { name: a.name, schema: a.schema, strict: true } }
        })
      })
      const w = j.choices?.[0]
      if (w?.message?.refusal) throw new KiFehler('abgelehnt', w.message.refusal.slice(0, 200))
      if (w?.finish_reason === 'length') throw new KiFehler('antwort', 'Antwort abgeschnitten')
      if (w?.finish_reason === 'content_filter') throw new KiFehler('abgelehnt')
      try {
        return jsonAusText(w?.message?.content ?? '')
      } catch {
        throw new KiFehler('antwort')
      }
    }
  }
}

export const openai = chatAdapter('https://api.openai.com/v1', { filter: istChatModell })
export const perplexity = chatAdapter('https://api.perplexity.ai/orchestrator/v1')
