import { describe, expect, it } from 'vitest'
import { calloutName } from '../src'

describe('Callout-Typen auf Deutsch (Design-Prüfung Kl6)', () => {
  it('übersetzt die Obsidian-Typen und lässt eigene lesbar', () => {
    expect(calloutName('note')).toBe('Hinweis')
    expect(calloutName('NOTE')).toBe('Hinweis')
    expect(calloutName('warning')).toBe('Achtung')
    expect(calloutName('tldr')).toBe('Zusammenfassung')
    expect(calloutName('transkript')).toBe('Transkript')
    expect(calloutName('')).toBe('')
  })
})
