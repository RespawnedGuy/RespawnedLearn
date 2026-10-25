import { describe, expect, it } from 'vitest'
import { benenneLinksUm, findeLinks, fuerZelle, neueTabelle, striche, tabellen, zeilenKorrektur, zellen } from '../src'

describe('Tabellen', () => {
  it('erkennt Tabellen mit Kopf und Trennzeile, nicht im Codeblock', () => {
    const t = ['Text', '| A | B |', '|---|:-:|', '| 1 | 2 |', '| 3 | 4 |', '', '```', '| x |', '|---|', '```']
    expect(tabellen(t)).toEqual([{ kopf: 1, ende: 4, spalten: 2 }])
    expect(tabellen(['| nur | eine Zeile |'])).toEqual([])
  })

  it('teilt Zellen nicht an \\| und nicht in Links', () => {
    const z = '| [[01A\\|Kabel ziehen]] | [[01B|roh]] | c |'
    expect(striche(z).length).toBe(4)
    expect(zellen(z).map((c) => z.slice(c.von, c.bis).trim())).toEqual(['[[01A\\|Kabel ziehen]]', '[[01B|roh]]', 'c'])
    expect(zellen('| a | b').map((c) => c.bis - c.von)).toEqual([3, 2])
  })

  it('liest Links mit \\| in der Zelle', () => {
    const [l] = findeLinks('| [[01A\\|Kabel ziehen]] |')
    expect(l.ziel).toBe('01A')
    expect(l.anzeige).toBe('Kabel ziehen')
    const [b] = findeLinks('[[01P#bericht=montage%20halle\\|Montage]]')
    expect(b.anker).toBe('bericht=montage%20halle')
  })

  it('hält Zeilen sauber und schreibt Text für eine Zelle um', () => {
    expect(zeilenKorrektur('| [[01A|x]] || b |')).toEqual([{ pos: 7, text: '\\' }, { pos: 13, text: ' ' }])
    expect(fuerZelle('[[01A|x]]\nweiter')).toBe('[[01A\\|x]] weiter')
  })

  it('behält beim Umbenennen den Trenner in der Zelle', () => {
    expect(benenneLinksUm('| [[01A\\|alt]] |', '01A', 'alt', 'neu')).toBe('| [[01A\\|neu]] |')
    expect(benenneLinksUm('[[01A|alt]]', '01A', 'alt', 'neu')).toBe('[[01A|neu]]')
  })

  it('legt eine leere Tabelle an', () => {
    expect(tabellen(neueTabelle(3, 2).split('\n'))).toEqual([{ kopf: 0, ende: 3, spalten: 3 }])
  })
})

describe('Tabellenzeile sauber halten', () => {
  it('setzt Leerzeichen innen an die Striche', () => {
    const fix = (t: string) => {
      for (const k of zeilenKorrektur(t).reverse()) t = t.slice(0, k.pos) + k.text + t.slice(k.pos)
      return t
    }
    expect(fix('|a|b|')).toBe('| a | b |')
    expect(fix('| a ||')).toBe('| a | |')
    expect(fix('| [[01A|x]]|')).toBe('| [[01A\\|x]] |')
    expect(fix('| a | b |')).toBe('| a | b |')
  })
})
