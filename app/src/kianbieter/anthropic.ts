// Anthropic (Claude) über das offizielle SDK. Die Anfrage läuft über `abruf` (in der App: Rust statt Browser).
// Antwortformat: strukturierte Ausgabe (`output_config.format`). Für Modelle, die serverseitiges Ausweichen bei
// Ablehnungen kennen, ist es eingeschaltet (`fallbacks: "default"`, Doku „Refusals and fallback“).
import Anthropic from '@anthropic-ai/sdk'
import { jsonAusText } from '@rl/kern'
import { fehlerAus, netzFehler } from './fehler'
import { mitFrist } from './netz'
import { KiFehler, type Abruf, type Adapter, type AnbieterZugang } from './typen'

/** Modelle mit `output_config.effort` (Claude 4.6 und neuer, Opus 4.5) */
export const kenntAufwand = (m: string) => /^claude-(opus|sonnet|fable|mythos|haiku)-5/.test(m) || /^claude-opus-4-[5-8]/.test(m) || /^claude-sonnet-4-6/.test(m)
/** Modelle mit serverseitigem Ausweichen bei Ablehnung */
export const kenntAusweichen = (m: string) => /^claude-(fable-5-[12]|opus-5(-5)?|sonnet-5-5)$/.test(m)

function klient(z: AnbieterZugang, abruf: Abruf) {
  return new Anthropic({
    apiKey: z.schluessel ?? '',
    fetch: abruf as unknown as typeof fetch,
    // Der Schlüssel gehört dem Nutzer und liegt ohnehin auf seinem Gerät; es gibt keinen Server dazwischen
    dangerouslyAllowBrowser: true,
    maxRetries: 2
  })
}

function uebersetze(e: unknown, signal?: AbortSignal): KiFehler {
  if (e instanceof KiFehler) return e
  if (e instanceof Anthropic.APIUserAbortError) return new KiFehler('abgebrochen')
  if (e instanceof Anthropic.APIConnectionError) return netzFehler(e.cause ?? e, signal)
  if (e instanceof Anthropic.APIError && typeof e.status === 'number') return fehlerAus(e.status, JSON.stringify(e.error ?? { message: e.message }))
  return netzFehler(e, signal)
}

export const anthropic: Adapter = {
  async modelle(z, abruf, signal) {
    try {
      const out = []
      for await (const m of klient(z, abruf).models.list({ limit: 100 }, { signal })) out.push({ id: m.id, name: m.display_name || m.id, bilder: true })
      return out
    } catch (e) {
      throw uebersetze(e, signal)
    }
  },

  async frage(z, a, abruf) {
    const modell = z.modell ?? ''
    const signal = mitFrist(a.signal)
    let r: Anthropic.Beta.BetaMessage
    try {
      r = await klient(z, abruf).beta.messages.create(
        {
          model: modell,
          max_tokens: 16000,
          system: a.system,
          messages: [
            {
              role: 'user',
              content: [
                ...a.bilder.map((b) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: b.mime, data: b.daten } })),
                { type: 'text' as const, text: a.text }
              ]
            }
          ],
          output_config: {
            format: { type: 'json_schema', schema: a.schema as unknown as Record<string, unknown> },
            ...(kenntAufwand(modell) ? { effort: a.aufwand === 'niedrig' ? ('low' as const) : a.aufwand === 'hoch' ? ('high' as const) : ('medium' as const) } : {})
          },
          ...(kenntAusweichen(modell) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})
        },
        { signal }
      )
    } catch (e) {
      throw uebersetze(e, a.signal)
    }
    if (r.stop_reason === 'refusal') throw new KiFehler('abgelehnt')
    if (r.stop_reason === 'max_tokens') throw new KiFehler('antwort', 'Antwort abgeschnitten')
    const text = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    try {
      return jsonAusText(text)
    } catch {
      throw new KiFehler('antwort')
    }
  }
}
