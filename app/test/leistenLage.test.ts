// @vitest-environment happy-dom
// Lage der Werkzeugleiste je Gerät (Nils 2026-11-17): oben als Standard, links oder rechts wählbar
import { afterEach, describe, expect, it, vi } from 'vitest'
import { leistenLage, setzeLeistenLage, wendeLeistenLageAn } from '../src/leistenLage'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.leiste
})

describe('Lage der Werkzeugleiste', () => {
  it('ohne Wahl und bei unbekanntem Wert steht sie oben', () => {
    expect(leistenLage()).toBe('oben')
    localStorage.setItem('rl-werkzeugleiste', 'unten')
    expect(leistenLage()).toBe('oben')
  })
  it('die Wahl gilt am Dokument sofort und nach einem Neustart weiter', () => {
    setzeLeistenLage('links')
    expect(document.documentElement.dataset.leiste).toBe('links')
    delete document.documentElement.dataset.leiste
    expect(leistenLage()).toBe('links')
    wendeLeistenLageAn()
    expect(document.documentElement.dataset.leiste).toBe('links')
    setzeLeistenLage('rechts')
    expect(leistenLage()).toBe('rechts')
  })
  it('ohne Speicher (privater Modus) gilt oben und Setzen wirkt trotzdem am Dokument', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    expect(leistenLage()).toBe('oben')
    setzeLeistenLage('rechts')
    expect(document.documentElement.dataset.leiste).toBe('rechts')
  })
})
