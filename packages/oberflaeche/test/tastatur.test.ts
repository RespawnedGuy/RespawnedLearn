import { describe, expect, it } from 'vitest'
import { rueckung } from '../src/tastatur'

// Sichtbarer Bereich 0–400 px (Tastatur deckt den Rest), Rand 12 px
const sicht = { oben: 0, unten: 400 }

describe('rueckung: Menü über der Bildschirmtastatur halten', () => {
  it('liegt das Menü schon sichtbar, rückt nichts', () => {
    expect(rueckung({ oben: 100, unten: 300 }, sicht)).toBe(0)
  })
  it('liegt das Menü hinter der Tastatur, rückt es genau bis über sie', () => {
    expect(rueckung({ oben: 500, unten: 700 }, sicht)).toBe(312)
  })
  it('wächst das Menü nach unten (KI-Vorschlag kommt nach), rückt es nur um das Stück', () => {
    expect(rueckung({ oben: 150, unten: 450 }, sicht)).toBe(62)
  })
  it('ist das Menü höher als der sichtbare Bereich, bleibt der obere Rand mit dem Eingabefeld sichtbar', () => {
    expect(rueckung({ oben: 300, unten: 900 }, sicht)).toBe(288)
  })
  it('liegt das Menü oberhalb des sichtbaren Bereichs, rückt es zurück nach unten', () => {
    expect(rueckung({ oben: -50, unten: 150 }, { oben: 0, unten: 400 })).toBe(-62)
  })
  it('ohne Tastatur und mit Platz rückt nichts', () => {
    expect(rueckung({ oben: 200, unten: 500 }, { oben: 0, unten: 900 })).toBe(0)
  })
})
