import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: () => Promise.reject(new Error('kein Tauri')) }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: () => Promise.reject(new Error('kein Tauri')) }))

const { serverAbruf } = await import('../src/kianbieter/netz')

// Zugang übers Netz (docs/netz.md): KI-Anfragen gehen an den Server der Desktop-App, der nur an bekannte Ziele weiterleitet
const echtesFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = echtesFetch
})

function server(antwort: () => Response | Promise<Response>) {
  const aufrufe: { url: string; init: RequestInit }[] = []
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    aufrufe.push({ url: String(url), init: init ?? {} })
    return antwort()
  }) as typeof fetch
  return aufrufe
}

describe('KI über den Server im Netz', () => {
  it('schickt Ziel, Methode, Köpfe und Rumpf an /api/ki, mit eigenem Kopf gegen fremde Seiten', async () => {
    const aufrufe = server(() => Response.json({ status: 200, text: '{"ok":true}' }))
    const r = await serverAbruf('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: new Headers({ 'x-api-key': 'geheim', 'content-type': 'application/json' }),
      body: '{"model":"m"}'
    })
    expect(aufrufe).toHaveLength(1)
    expect(aufrufe[0].url).toBe('/api/ki')
    expect(new Headers(aufrufe[0].init.headers).get('Rl-Anfrage')).toBe('1')
    expect(JSON.parse(String(aufrufe[0].init.body))).toEqual({
      url: 'https://api.anthropic.com/v1/messages',
      methode: 'POST',
      kopf: { 'x-api-key': 'geheim', 'content-type': 'application/json' },
      rumpf: '{"model":"m"}'
    })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
  })

  it('reicht den Status des Anbieters durch (etwa 401 bei falschem Schlüssel)', async () => {
    server(() => Response.json({ status: 401, text: '{"error":"invalid x-api-key"}' }))
    const r = await serverAbruf('https://api.anthropic.com/v1/models', { method: 'GET' })
    expect(r.status).toBe(401)
  })

  it('sagt verständlich, wenn der Server das Ziel nicht erreicht', async () => {
    server(() => new Response('ki-ziel', { status: 403 }))
    await expect(serverAbruf('https://evil.example/x')).rejects.toThrow(/bekannten Anbieter/)
    server(() => new Response('ollama-nicht-privat', { status: 502 }))
    await expect(serverAbruf('http://8.8.8.8:11434/api/chat')).rejects.toThrow(/nur im eigenen Netz/)
  })

  it('hört auf Abbrechen', async () => {
    server(() => new Promise<Response>(() => {}))
    const c = new AbortController()
    const p = serverAbruf('https://api.openai.com/v1/models', { signal: c.signal })
    c.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
