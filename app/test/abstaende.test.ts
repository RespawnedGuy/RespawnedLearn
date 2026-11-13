// @vitest-environment happy-dom
// Bewertungsknöpfe zeigen, wann die Karte wiederkommt (Design-Prüfung Kl4)
import { describe, expect, it } from 'vitest'
import { Bestand } from '@rl/kern'
import { abstandText, naechsteAbstaende } from '../src/wissen'

describe('Abstand bis zur nächsten Wiederholung', () => {
  it('schreibt Zeiträume in Worten', () => {
    expect(abstandText(0)).toBe('in 1 Min.')
    expect(abstandText(10 * 60_000)).toBe('in 10 Min.')
    expect(abstandText(5 * 3600_000)).toBe('in 5 Std.')
    expect(abstandText(86400_000)).toBe('in 1 Tag')
    expect(abstandText(3 * 86400_000)).toBe('in 3 Tagen')
    expect(abstandText(62 * 86400_000)).toBe('in 2 Monaten')
    expect(abstandText(400 * 86400_000)).toBe('in 1 Jahr')
  })

  it('neue Karte: Nochmal kommt am schnellsten, Leicht am spätesten', () => {
    const jetzt = new Date('2026-11-13T10:00:00Z')
    const a = naechsteAbstaende(new Bestand(new Map()), 'neu', jetzt)
    expect(a.nochmal).toMatch(/Min\./)
    expect(a.leicht).toMatch(/Tag/)
  })

  it('geübte Karte: Gut liegt nach mehreren Wiederholungen bei Tagen', () => {
    const zeilen = ['2026-11-01T10:00:00Z', '2026-11-02T10:00:00Z', '2026-11-05T10:00:00Z'].map((am) => JSON.stringify({ karte: 'k', am, note: 'gut' })).join('\n')
    const b = new Bestand(new Map([['reviews/2026-11.pc.jsonl', zeilen + '\n']]))
    const a = naechsteAbstaende(b, 'k', new Date('2026-11-13T10:00:00Z'))
    expect(a.gut).toMatch(/Tagen|Monat/)
  })
})
