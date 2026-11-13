// KI-Anbieter: Form der Anfragen (gegen die Doku der Anbieter, Stand 13.11.2026), Lesen der Antworten,
// Fehlerarten. Kein Netz: `abruf` ist hier ein Schein, der die Anfrage festhält und eine Antwort liefert.
import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMAS, setzePrompt } from '@rl/kern'
import { anthropic, kenntAufwand, kenntAusweichen } from '../src/kianbieter/anthropic'
import { gemini } from '../src/kianbieter/gemini'
import { ollama, ollamaAdresse } from '../src/kianbieter/ollama'
import { istChatModell, openai, perplexity } from '../src/kianbieter/openai'
import { fehlerAus } from '../src/kianbieter/fehler'
import { abrufFuerTest, bildAus, kiFrage } from '../src/kianbieter/frage'
import { aktiverZugang, sauber, zugangFuerTest } from '../src/kianbieter/zugang'
import { KiFehler, type Anfrage } from '../src/kianbieter/typen'

interface Gesehen {
  url: string
  methode: string
  kopf: Record<string, string>
  rumpf: unknown
}

function schein(antworten: (Response | (() => Response))[]) {
  const gesehen: Gesehen[] = []
  const abruf = async (url: string | URL | Request, init: RequestInit = {}) => {
    const kopf: Record<string, string> = {}
    new Headers(init.headers).forEach((v, k) => (kopf[k] = v))
    const roh = typeof init.body === 'string' ? init.body : init.body ? await new Response(init.body).text() : ''
    gesehen.push({ url: String(url), methode: init.method ?? 'GET', kopf, rumpf: roh ? JSON.parse(roh) : null })
    const a = antworten.shift()
    if (!a) throw new Error('keine Antwort mehr im Schein')
    return typeof a === 'function' ? a() : a
  }
  return { abruf, gesehen }
}

const json = (wert: unknown, status = 200) => new Response(JSON.stringify(wert), { status, headers: { 'content-type': 'application/json' } })
const BILD = { mime: 'image/png' as const, daten: 'iVBORw0KGgo=' }
const anfrage = (mehr: Partial<Anfrage> = {}): Anfrage => ({ system: 'SYS', text: 'TEXT', bilder: [], schema: SCHEMAS.frage, name: 'frage', aufwand: 'niedrig', ...mehr })

afterEach(() => {
  abrufFuerTest(null)
  zugangFuerTest(null)
})

describe('Anthropic (SDK)', () => {
  const nachricht = (text: string, stop = 'end_turn') => json({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text }], stop_reason: stop, usage: { input_tokens: 1, output_tokens: 1 } })

  it('schickt strukturierte Ausgabe, Bild vor dem Text, Aufwand und Ausweichen bei Ablehnung', async () => {
    const s = schein([nachricht('{"frage":"Warum?"}')])
    const r = await anthropic.frage({ schluessel: 'sk-ant-test', modell: 'claude-opus-5-5' }, anfrage({ bilder: [BILD] }), s.abruf)
    expect(r).toEqual({ frage: 'Warum?' })
    const g = s.gesehen[0]
    expect(g.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/)
    // SDK 1.x schickt den Schlüssel als Bearer (Doku „Get your Claude API key“), ältere als x-api-key
    expect(g.kopf.authorization ?? `Bearer ${g.kopf['x-api-key']}`).toBe('Bearer sk-ant-test')
    expect(g.kopf['anthropic-beta']).toBe('server-side-fallback-2026-07-01')
    const b = g.rumpf as Record<string, any>
    expect(b.model).toBe('claude-opus-5-5')
    expect(b.system).toBe('SYS')
    expect(b.fallbacks).toBe('default')
    expect(b.output_config).toEqual({ format: { type: 'json_schema', schema: SCHEMAS.frage }, effort: 'low' })
    expect(b.messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: BILD.daten } },
      { type: 'text', text: 'TEXT' }
    ])
  })

  it('ältere Modelle ohne Aufwand und ohne Ausweichen', async () => {
    const s = schein([nachricht('{"frage":"Wie?"}')])
    await anthropic.frage({ schluessel: 'sk-ant-test', modell: 'claude-haiku-4-5' }, anfrage(), s.abruf)
    const b = s.gesehen[0].rumpf as Record<string, any>
    expect(b.output_config).toEqual({ format: { type: 'json_schema', schema: SCHEMAS.frage } })
    expect(b.fallbacks).toBeUndefined()
    expect(s.gesehen[0].kopf['anthropic-beta']).toBeUndefined()
    expect(kenntAufwand('claude-sonnet-5-5')).toBe(true)
    expect(kenntAusweichen('claude-sonnet-5')).toBe(false)
  })

  it('Ablehnung und abgeschnittene Antwort werden zu Fehlern', async () => {
    await expect(anthropic.frage({ schluessel: 'k', modell: 'claude-opus-5-5' }, anfrage(), schein([nachricht('', 'refusal')]).abruf)).rejects.toMatchObject({ art: 'abgelehnt' })
    await expect(anthropic.frage({ schluessel: 'k', modell: 'claude-opus-5-5' }, anfrage(), schein([nachricht('{"fra', 'max_tokens')]).abruf)).rejects.toMatchObject({ art: 'antwort' })
  })

  it('falscher Schlüssel', async () => {
    const s = schein([json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401)])
    await expect(anthropic.frage({ schluessel: 'falsch', modell: 'claude-opus-5-5' }, anfrage(), s.abruf)).rejects.toMatchObject({ art: 'zugang' })
  })

  it('listet Modelle', async () => {
    const s = schein([json({ data: [{ type: 'model', id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }], has_more: false, first_id: 'a', last_id: 'a' })])
    expect(await anthropic.modelle({ schluessel: 'sk-ant-test' }, s.abruf)).toEqual([{ id: 'claude-opus-5-5', name: 'Claude Opus 5.5', bilder: true }])
    expect(s.gesehen[0].url).toMatch(/\/v1\/models/)
  })
})

describe('OpenAI und Perplexity (Chat Completions)', () => {
  const antwort = (content: string | null, mehr: Record<string, unknown> = {}) => json({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content, ...mehr } }] })

  it('schickt json_schema mit strict, System zuerst und Bilder als data-URL', async () => {
    const s = schein([antwort('{"frage":"Warum?"}')])
    expect(await openai.frage({ schluessel: 'sk-test', modell: 'gpt-6-astra' }, anfrage({ bilder: [BILD] }), s.abruf)).toEqual({ frage: 'Warum?' })
    const g = s.gesehen[0]
    expect(g.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(g.kopf.authorization).toBe('Bearer sk-test')
    const b = g.rumpf as Record<string, any>
    expect(b.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'frage', schema: SCHEMAS.frage, strict: true } })
    expect(b.messages[0]).toEqual({ role: 'system', content: 'SYS' })
    expect(b.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: `data:image/png;base64,${BILD.daten}` } })
  })

  it('Perplexity über die OpenAI-kompatible Schnittstelle', async () => {
    const s = schein([antwort('{"frage":"Wie?"}')])
    await perplexity.frage({ schluessel: 'pplx-x', modell: 'perplexity/kimi-k3' }, anfrage(), s.abruf)
    expect(s.gesehen[0].url).toBe('https://api.perplexity.ai/orchestrator/v1/chat/completions')
  })

  it('Ablehnung, Kontingent aufgebraucht, Ratenlimit', async () => {
    await expect(openai.frage({ schluessel: 'k', modell: 'm' }, anfrage(), schein([antwort(null, { refusal: 'Nein.' })]).abruf)).rejects.toMatchObject({ art: 'abgelehnt' })
    const leer = json({ error: { message: 'You exceeded your current quota', type: 'insufficient_quota', code: 'insufficient_quota' } }, 429)
    await expect(openai.frage({ schluessel: 'k', modell: 'm' }, anfrage(), schein([leer]).abruf)).rejects.toMatchObject({ art: 'guthaben' })
    const viel = json({ error: { message: 'Rate limit reached', type: 'rate_limit_error' } }, 429)
    await expect(perplexity.frage({ schluessel: 'k', modell: 'm' }, anfrage(), schein([viel]).abruf)).rejects.toMatchObject({ art: 'limit' })
  })

  it('Modellliste: OpenAI nur Chat-Modelle, Perplexity mit Preis', async () => {
    const s = schein([json({ data: [{ id: 'gpt-6-astra', created: 2 }, { id: 'text-embedding-3-large', created: 3 }, { id: 'gpt-4o-realtime-preview', created: 1 }] })])
    expect((await openai.modelle({ schluessel: 'k' }, s.abruf)).map((m) => m.id)).toEqual(['gpt-6-astra'])
    expect(istChatModell('o4-mini')).toBe(true)
    const p = schein([json({ object: 'list', data: [{ id: 'perplexity/kimi-k3', object: 'model', created: 1, owned_by: 'perplexity', pricing: { input: 1, output: 3, unit: 'usd_per_1m_tokens' } }] })])
    expect(await perplexity.modelle({ schluessel: 'k' }, p.abruf)).toEqual([{ id: 'perplexity/kimi-k3', name: 'perplexity/kimi-k3', hinweis: '1 $ / 3 $ je Mio. Tokens' }])
    expect(p.gesehen[0].url).toBe('https://api.perplexity.ai/orchestrator/v1/models')
  })
})

describe('Gemini (generateContent)', () => {
  it('Schlüssel im Kopf, Systemanweisung, Bilder als inlineData, JSON-Schema', async () => {
    const s = schein([json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"frage":' }, { text: '"Warum?"}' }] } }] })])
    expect(await gemini.frage({ schluessel: 'AIza-test', modell: 'gemini-3.8-flash' }, anfrage({ bilder: [BILD] }), s.abruf)).toEqual({ frage: 'Warum?' })
    const g = s.gesehen[0]
    expect(g.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent')
    expect(g.kopf['x-goog-api-key']).toBe('AIza-test')
    expect(g.url).not.toContain('AIza')
    const b = g.rumpf as Record<string, any>
    expect(b.systemInstruction).toEqual({ parts: [{ text: 'SYS' }] })
    expect(b.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: BILD.daten } })
    expect(b.generationConfig).toEqual({ responseMimeType: 'application/json', responseJsonSchema: SCHEMAS.frage })
  })

  it('gesperrte Anfrage und falscher Schlüssel', async () => {
    await expect(gemini.frage({ schluessel: 'k', modell: 'm' }, anfrage(), schein([json({ promptFeedback: { blockReason: 'SAFETY' } })]).abruf)).rejects.toMatchObject({ art: 'abgelehnt' })
    const falsch = json({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }, 400)
    await expect(gemini.frage({ schluessel: 'k', modell: 'm' }, anfrage(), schein([falsch]).abruf)).rejects.toMatchObject({ art: 'zugang' })
  })

  it('listet nur Modelle, die generateContent können', async () => {
    const s = schein([json({ models: [{ name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }] })])
    expect(await gemini.modelle({ schluessel: 'k' }, s.abruf)).toEqual([{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', bilder: true }])
  })
})

describe('Ollama (eigener Rechner)', () => {
  it('Adresse ergänzen', () => {
    expect(ollamaAdresse({})).toBe('http://localhost:11434')
    expect(ollamaAdresse({ adresse: '192.168.1.20' })).toBe('http://192.168.1.20:11434')
    expect(ollamaAdresse({ adresse: 'http://pc.fritz.box:11434/' })).toBe('http://pc.fritz.box:11434')
  })

  it('schickt format als Schema, Bilder in images, ohne Streaming', async () => {
    const s = schein([json({ model: 'gemma3', message: { role: 'assistant', content: '{"frage":"Warum?"}' }, done: true, done_reason: 'stop' })])
    expect(await ollama.frage({ adresse: '192.168.1.20', modell: 'gemma3' }, anfrage({ bilder: [BILD] }), s.abruf)).toEqual({ frage: 'Warum?' })
    const g = s.gesehen[0]
    expect(g.url).toBe('http://192.168.1.20:11434/api/chat')
    const b = g.rumpf as Record<string, any>
    expect(b).toMatchObject({ model: 'gemma3', format: SCHEMAS.frage, stream: false })
    expect(b.messages[1]).toEqual({ role: 'user', content: 'TEXT', images: [BILD.daten] })
  })

  it('weiß nach der Modellliste, welches Modell keine Bilder liest', async () => {
    const s = schein([json({ models: [{ name: 'llama3.2', details: { parameter_size: '3B' } }] }), json({ capabilities: ['completion'] })])
    expect(await ollama.modelle({ adresse: 'localhost' }, s.abruf)).toEqual([{ id: 'llama3.2', name: 'llama3.2', bilder: false, hinweis: '3B' }])
    await expect(ollama.frage({ adresse: 'localhost', modell: 'llama3.2' }, anfrage({ bilder: [BILD] }), schein([]).abruf)).rejects.toMatchObject({ art: 'bilder' })
  })

  it('kein Rechner erreichbar', async () => {
    const weg = async () => {
      throw new TypeError('error sending request')
    }
    await expect(ollama.frage({ modell: 'gemma3' }, anfrage(), weg)).rejects.toMatchObject({ art: 'netz' })
  })
})

describe('Fehlerarten', () => {
  it('ordnet Status und Meldung zu', () => {
    expect(fehlerAus(400, JSON.stringify({ error: { message: 'Your credit balance is too low to access the Anthropic API.' } })).art).toBe('guthaben')
    expect(fehlerAus(404, '{"error":{"message":"model: claude-x not found"}}').art).toBe('modell')
    expect(fehlerAus(529, '{"error":{"type":"overloaded_error"}}').art).toBe('dienst')
    expect(fehlerAus(400, '{"error":"model does not support images"}').art).toBe('bilder')
    expect(fehlerAus(400, '{"error":{"message":"max_tokens too large"}}')).toMatchObject({ art: 'anfrage', detail: 'max_tokens too large' })
  })
})

describe('Frage an die gewählte KI', () => {
  const ordner = (texte: Record<string, string>) => ({ text: (p: string) => texte[p] })

  it('ohne eingerichtete KI: ein Satz mit dem Weg in die Einstellungen', async () => {
    zugangFuerTest({ anbieter: null, zugaenge: {} })
    const e = await kiFrage(ordner({}), 'erklaeren', { text: 'x', schema: SCHEMAS.erklaerung, name: 'erklaerung' }).catch((e) => e)
    expect(e).toBeInstanceOf(KiFehler)
    expect(e.art).toBe('einrichten')
    expect(e.message).toMatch(/Einstellungen › KI/)
  })

  it('nimmt die eigene Anweisung aus dem Datenordner und prüft die Antwort', async () => {
    zugangFuerTest({ anbieter: 'ollama', zugaenge: { ollama: { modell: 'gemma3' } } })
    const s = schein([json({ message: { content: '{"antwort":"Weil …","begriff":"Ohm","extra":1}' }, done: true })])
    abrufFuerTest(s.abruf)
    const prompts = setzePrompt(undefined, 'erklaeren', 'Erkläre es wie für ein Kind.')
    const r = await kiFrage(ordner({ 'lernen/einstellungen/ki-prompts.json': prompts }), 'erklaeren', { text: 'x', schema: SCHEMAS.erklaerung, name: 'erklaerung' })
    expect(r).toEqual({ antwort: 'Weil …', begriff: 'Ohm' })
    expect((s.gesehen[0].rumpf as any).messages[0]).toEqual({ role: 'system', content: 'Erkläre es wie für ein Kind.' })
  })

  it('eine Antwort im falschen Format wird nicht durchgereicht', async () => {
    zugangFuerTest({ anbieter: 'ollama', zugaenge: { ollama: { modell: 'gemma3' } } })
    abrufFuerTest(schein([json({ message: { content: '{"antwort":"nur halb"}' }, done: true })]).abruf)
    await expect(kiFrage(ordner({}), 'erklaeren', { text: 'x', schema: SCHEMAS.erklaerung, name: 'erklaerung' })).rejects.toMatchObject({ art: 'antwort' })
  })
})

describe('Zugang des Geräts', () => {
  it('ist erst aktiv mit Anbieter, Modell und (außer Ollama) Schlüssel', () => {
    expect(aktiverZugang({ anbieter: 'openai', zugaenge: { openai: { modell: 'gpt-6-astra' } } })).toBeNull()
    expect(aktiverZugang({ anbieter: 'openai', zugaenge: { openai: { schluessel: 'sk-x' } } })).toBeNull()
    expect(aktiverZugang({ anbieter: 'openai', zugaenge: { openai: { schluessel: 'sk-x', modell: 'gpt-6-astra' } } })).toEqual({ anbieter: 'openai', schluessel: 'sk-x', modell: 'gpt-6-astra' })
    expect(aktiverZugang({ anbieter: 'ollama', zugaenge: { ollama: { modell: 'gemma3' } } })).toEqual({ anbieter: 'ollama', modell: 'gemma3' })
  })

  it('übernimmt nur Bekanntes aus der gespeicherten Datei', () => {
    expect(sauber({ anbieter: 'unbekannt', zugaenge: { openai: { schluessel: ' sk-x ', fremd: 1 }, boese: {} } })).toEqual({ anbieter: null, zugaenge: { openai: { schluessel: 'sk-x' } } })
    expect(sauber(null)).toEqual({ anbieter: null, zugaenge: {} })
  })

  it('Bilder nur als PNG oder JPEG', () => {
    expect(bildAus('data:image/png;base64,QUJD')).toEqual({ mime: 'image/png', daten: 'QUJD' })
    expect(bildAus('data:image/gif;base64,QUJD')).toBeNull()
    expect(bildAus(null)).toBeNull()
  })
})
