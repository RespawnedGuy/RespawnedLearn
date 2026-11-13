import { describe, expect, it } from 'vitest'
import { richtung } from '../src/uebergang'

describe('richtung des Übergangs', () => {
  it('andere Seite im selben Skript bewegt nichts', () => {
    expect(richtung('#/sammeln/SKRIPT/3', '#/sammeln/SKRIPT/4')).toBe('keine')
    expect(richtung('#/sammeln/SKRIPT', '#/sammeln/SKRIPT/4')).toBe('keine')
    expect(richtung('#/lernen', '#/lernen')).toBe('keine')
  })

  it('anderer Bereich blendet über', () => {
    expect(richtung('#/sammeln', '#/lernen')).toBe('wechsel')
    expect(richtung('#/sammeln/SKRIPT/2', '#/nutzen')).toBe('wechsel')
    expect(richtung('', '#/einstellungen')).toBe('wechsel')
  })

  it('tiefer in denselben Bereich kommt von rechts', () => {
    expect(richtung('#/sammeln', '#/sammeln/modul/M1')).toBe('tiefer')
    expect(richtung('#/sammeln/modul/M1', '#/sammeln/SKRIPT/1')).toBe('wechsel')
    expect(richtung('#/nutzen', '#/nutzen/ID')).toBe('tiefer')
  })

  it('eine Ebene höher geht zurück', () => {
    expect(richtung('#/sammeln/modul/M1', '#/sammeln')).toBe('zurueck')
    expect(richtung('#/nutzen/ID', '#/nutzen')).toBe('zurueck')
  })

  it('Zurück im Verlauf geht immer zurück, auch in einen anderen Bereich', () => {
    expect(richtung('#/lernen', '#/sammeln/SKRIPT/2', true)).toBe('zurueck')
  })

  it('Zurück im Verlauf zur selben Ansicht bewegt nichts', () => {
    expect(richtung('#/sammeln/SKRIPT/5', '#/sammeln/SKRIPT/2', true)).toBe('keine')
  })
})
