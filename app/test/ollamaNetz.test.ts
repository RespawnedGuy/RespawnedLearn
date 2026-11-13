import { describe, expect, it, vi } from 'vitest'

const aufrufe: { befehl: string; args: unknown }[] = []
let antwort: () => Promise<unknown> = async () => ({ status: 200, text: '{"models":[]}' })
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (befehl: string, args: unknown) => {
    aufrufe.push({ befehl, args })
    return antwort()
  }
}))

const { istOllama, ollamaAbruf } = await import('../src/kianbieter/netz')

describe('Ollama über den eigenen Befehl statt über die freie HTTP-Freigabe', () => {
  it('erkennt Ollama am Port 11434, die Anbieter im Netz nicht', () => {
    expect(istOllama('http://localhost:11434/api/chat')).toBe(true)
    expect(istOllama('http://192.168.1.20:11434/api/tags')).toBe(true)
    expect(istOllama('https://api.openai.com/v1/chat/completions')).toBe(false)
    expect(istOllama('https://api.anthropic.com/v1/messages')).toBe(false)
  })

  it('schickt URL und JSON-Rumpf an ollama_anfrage und macht daraus eine Response', async () => {
    aufrufe.length = 0
    const r = await ollamaAbruf('http://localhost:11434/api/chat', { method: 'POST', body: '{"model":"x"}' })
    expect(aufrufe).toEqual([{ befehl: 'ollama_anfrage', args: { url: 'http://localhost:11434/api/chat', rumpf: '{"model":"x"}' } }])
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ models: [] })
  })

  it('sagt verständlich, wenn die Adresse nicht im eigenen Netz liegt', async () => {
    antwort = () => Promise.reject('ollama-nicht-privat')
    await expect(ollamaAbruf('http://angreifer.invalid:11434/api/chat')).rejects.toThrow(/nur im eigenen Netz/)
  })

  it('hört auf Abbrechen, auch wenn der Befehl noch läuft', async () => {
    antwort = () => new Promise(() => {})
    const c = new AbortController()
    const p = ollamaAbruf('http://localhost:11434/api/chat', { signal: c.signal })
    c.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
