import { describe, expect, it } from 'vitest'
import { VERTRAG, vergleicheVersionen, absatzAmAnker, alleBausteine, benenne, liesMarken, markenZeile, offeneBausteine, setzeMarke, sucheBausteine } from '../src'

// Bausteine aus Mitschriften (Vertrag Lernen 1.10, 5.4): Zeile mit Blockkennung statt Seite und Bereich
describe('Textstellen als Bausteine (Lernen 1.10)', () => {
  const zeile = '- ^k3m9 · Maschenregel #kirchhoff %%rt 2026-11-14%% ^b7x2q1'

  it('liest und schreibt die Textzeile byte-gleich', () => {
    const [m] = liesMarken(zeile)
    expect(m).toMatchObject({ id: 'b7x2q1', anker: 'k3m9', text: 'Maschenregel #kirchhoff', datum: '2026-11-14', farbe: null, seite: 0 })
    expect(markenZeile(m)).toBe(zeile)
    expect(markenZeile({ ...m, text: '' })).toBe('- ^k3m9 %%rt 2026-11-14%% ^b7x2q1')
  })

  it('benennen ändert nur diese Zeile, Skript-Zeilen daneben bleiben', () => {
    const pdf = '- S. 1 · Merksatz %%rn 0.120 0.300 0.430 0.080 2026-10-19%% ^a7k2c9'
    const text = `${pdf}\n- ^k3m9 %%rt 2026-11-14%% ^b7x2q1\n`
    const m = liesMarken(text).find((x) => x.anker)!
    const neu = setzeMarke(text, { ...m, text: benenne(m.text, 'Knotenregel #kirchhoff') })
    expect(neu).toBe(`${pdf}\n- ^k3m9 · Knotenregel #kirchhoff %%rt 2026-11-14%% ^b7x2q1\n`)
  })

  it('offen, Suche und Archiv wie bei Markierungen im Skript', () => {
    const texte = new Map([['lernen/markierungen/NOTIZ1.md', `${zeile}\n- ^z2 %%rt 2026-11-10%% ^c1\n- ^z3 · Alt #archiv %%rt 2026-11-10%% ^d1\n`]])
    const alle = alleBausteine(texte)
    expect(offeneBausteine(alle).map((b) => b.marke.id)).toEqual(['c1'])
    expect(sucheBausteine(alle, 'kirchhoff').map((b) => b.marke.anker)).toEqual(['k3m9'])
    expect(sucheBausteine(alle, 'alt')).toEqual([])
  })

  it('der Text des Bausteins ist der Absatz bis zur Kennung', () => {
    const rumpf = '# Netzwerke\n\nEinleitung\n\nUmlauf: Summe der Spannungen\nist null ^k3m9\nDanach weiter\n\n## Satz ^h1'
    expect(absatzAmAnker(rumpf, 'k3m9')).toBe('Umlauf: Summe der Spannungen\nist null')
    expect(absatzAmAnker(rumpf, 'h1')).toBe('## Satz')
    expect(absatzAmAnker(rumpf, 'weg')).toBeNull()
  })

  it('die Vertragsversion 1.10 gilt als neuer als 1.9', () => {
    expect(VERTRAG).toBe('1.10')
    expect(vergleicheVersionen('1.10', '1.9')).toBeGreaterThan(0)
  })
})
