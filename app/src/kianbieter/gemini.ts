// Google Gemini über die REST-Schnittstelle `generateContent` (Schlüssel im Kopf `x-goog-api-key`),
// Antwortformat über `responseMimeType` und `responseJsonSchema` (Doku „Structured outputs“).
import { jsonAusText } from '@rl/kern'
import { holeJson } from './fehler'
import { mitFrist } from './netz'
import { KiFehler, type Adapter } from './typen'

const BASIS = 'https://generativelanguage.googleapis.com/v1beta'

interface Antwort {
  promptFeedback?: { blockReason?: string }
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]
}

interface ModellListe {
  models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[]
}

export const gemini: Adapter = {
  async modelle(z, abruf, signal) {
    const j = await holeJson<ModellListe>(abruf, `${BASIS}/models?pageSize=1000`, { headers: { 'x-goog-api-key': z.schluessel ?? '' }, signal })
    return (j.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && !/(embedding|aqa|imagen|veo|tts|image)/.test(m.name))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name, bilder: true }))
  },

  async frage(z, a, abruf) {
    const j = await holeJson<Antwort>(abruf, `${BASIS}/models/${encodeURIComponent(z.modell ?? '')}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': z.schluessel ?? '', 'content-type': 'application/json' },
      signal: mitFrist(a.signal),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: a.system }] },
        contents: [{ role: 'user', parts: [{ text: a.text }, ...a.bilder.map((b) => ({ inlineData: { mimeType: b.mime, data: b.daten } }))] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: a.schema }
      })
    })
    if (j.promptFeedback?.blockReason) throw new KiFehler('abgelehnt', j.promptFeedback.blockReason)
    const k = j.candidates?.[0]
    if (k?.finishReason === 'SAFETY' || k?.finishReason === 'PROHIBITED_CONTENT') throw new KiFehler('abgelehnt')
    if (k?.finishReason === 'MAX_TOKENS') throw new KiFehler('antwort', 'Antwort abgeschnitten')
    const text = (k?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('')
    try {
      return jsonAusText(text)
    } catch {
      throw new KiFehler('antwort')
    }
  }
}
