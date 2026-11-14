import { describe, expect, it } from 'vitest'
import { lernFunktionen, mitschriftFunktionen } from '../src/funktionen'

describe('Funktionsleiste: Belegung je Ansicht', () => {
  it('Lernen hat Runde und Alle Karten, die Runde ist auch bei einer Modulrunde aktiv', () => {
    expect(lernFunktionen(['lernen']).map((f) => [f.id, f.aktiv])).toEqual([['runde', true], ['alle', false]])
    expect(lernFunktionen(['lernen', 'modul', 'M1']).find((f) => f.aktiv)?.id).toBe('runde')
    expect(lernFunktionen(['lernen', 'alle']).find((f) => f.aktiv)?.id).toBe('alle')
  })

  it('andere Bereiche bekommen hier keine Funktionen (Skript und Buch bringen ihre Werkzeuge selbst mit)', () => {
    for (const ort of [['sammeln'], ['sammeln', 'SKRIPT', '1'], ['nutzen'], ['einstellungen'], []]) expect(lernFunktionen(ort)).toEqual([])
  })

  it('Mitschrift: Baustein, Lernkarte, Kamera, Foto, nur solange die Mitschrift sie anbietet', () => {
    expect(mitschriftFunktionen(null)).toEqual([])
    const aufgerufen: string[] = []
    const f = mitschriftFunktionen({ baustein: () => aufgerufen.push('b'), lernkarte: () => aufgerufen.push('k'), kamera: () => aufgerufen.push('c'), foto: () => aufgerufen.push('f') })
    expect(f.map((x) => x.id)).toEqual(['baustein', 'lernkarte', 'kamera', 'foto'])
    expect(f.every((x) => x.aktiv === undefined)).toBe(true)
    for (const x of f) if (typeof x.ziel === 'function') x.ziel()
    expect(aufgerufen).toEqual(['b', 'k', 'c', 'f'])
  })
})
