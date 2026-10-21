import { describe, expect, it } from 'vitest'
import { gedruckteEintraege, inhaltText, inhaltVeraltet, kapitelBei, liesInhalt, ordneSeitenZu, setzeKapitel, versatzAus, INHALT_VERSION } from '../src/inhalt'

describe('inhalt', () => {
  const kapitel = [
    { titel: '1 Grundlagen', seite: 5, ebene: 1 },
    { titel: '1.1 Spannung', seite: 5, ebene: 2 },
    { titel: '1.2 Spannungsteiler', seite: 9, ebene: 2 },
    { titel: '2 Transistoren', seite: 20, ebene: 1 }
  ]

  it('findet das Kapitel zu einer Seite (tiefster Eintrag)', () => {
    expect(kapitelBei(kapitel, 3)).toBeNull()
    expect(kapitelBei(kapitel, 5)?.titel).toBe('1.1 Spannung')
    expect(kapitelBei(kapitel, 12)?.titel).toBe('1.2 Spannungsteiler')
    expect(kapitelBei(kapitel, 99)?.titel).toBe('2 Transistoren')
  })

  it('schreibt und liest die Datei, eigene Änderungen werden nie überschrieben', () => {
    const i = { herkunft: 'pdf' as const, version: INHALT_VERSION, kapitel }
    expect(liesInhalt(inhaltText(i))).toEqual({ ...i, eigen: undefined })
    expect(inhaltVeraltet(null)).toBe(true)
    expect(inhaltVeraltet({ ...i, version: 0 })).toBe(true)
    expect(inhaltVeraltet({ ...i, version: 0, eigen: true })).toBe(false)
    const neu = setzeKapitel(i, (k) => [...k, { titel: 'Anhang', seite: 15, ebene: 1 }])
    expect(neu.eigen).toBe(true)
    expect(neu.kapitel.map((k) => k.seite)).toEqual([5, 5, 9, 15, 20])
    expect(liesInhalt('kaputt')).toBeNull()
  })

  it('liest ein gedrucktes Inhaltsverzeichnis', () => {
    const e = gedruckteEintraege([
      'Inhaltsverzeichnis',
      '1 Grundlagen ............ 1',
      '1.1 Spannung und Strom . . . . . 3',
      '1.2 Spannungsteiler     12',
      '2 Transistoren 45',
      'Anhang A … 101',
      'Seite iii'
    ])
    expect(e).toEqual([
      { titel: '1 Grundlagen', gedruckt: 1, ebene: 1 },
      { titel: '1.1 Spannung und Strom', gedruckt: 3, ebene: 2 },
      { titel: '1.2 Spannungsteiler', gedruckt: 12, ebene: 2 },
      { titel: '2 Transistoren', gedruckt: 45, ebene: 1 },
      { titel: 'Anhang A', gedruckt: 101, ebene: 1 }
    ])
    // Fließtext mit einzelnen Zahlen ist keine Inhaltsseite
    expect(gedruckteEintraege(['Im Jahr 2026 waren es 12', 'ganz normaler Text', 'noch eine Zeile'])).toEqual([])
  })

  it('rechnet gedruckte Seiten in PDF-Seiten um', () => {
    const e = [
      { titel: 'Eins', gedruckt: 1, ebene: 1 },
      { titel: 'Zwei', gedruckt: 40, ebene: 1 }
    ]
    expect(ordneSeitenZu(e, 50, { versatz: 8 }).map((k) => k.seite)).toEqual([9, 48])
    // zu weit hinten: weglassen
    expect(ordneSeitenZu(e, 45, { versatz: 8 }).map((k) => k.seite)).toEqual([9])
    expect(ordneSeitenZu(e, 50, { labels: ['i', 'ii', '1', '2'], versatz: 0 }).map((k) => k.seite)).toEqual([3, 40])
    expect(versatzAus([8, 8, 7])).toBe(8)
    expect(versatzAus([3, 9])).toBeNull()
    expect(versatzAus([])).toBeNull()
  })
})
