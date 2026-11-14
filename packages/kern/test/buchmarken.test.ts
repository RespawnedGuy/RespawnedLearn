import { describe, expect, it } from 'vitest'
import { alleBausteine, ausSeitenbreiten, benenne, inSeitenbreiten, liesMarken, markenZeile, setzeMarke, sucheBausteine } from '../src'

// Markierungen im eigenen Notizbuch (Vertrag Lernen 1.9, 5.4): gleiche Zeile wie im Skript, Maße in Seitenbreiten
const A4 = 1414 / 1000

describe('Markierungen im Notizbuch (Vertrag Lernen 1.9)', () => {
  it('rechnet den Bereich in Seitenbreiten und zurück', () => {
    const vonTinte = { x: 0.1, y: 0.5, b: 0.4, h: 0.1 }
    const gespeichert = inSeitenbreiten(vonTinte, A4)
    expect(gespeichert.y).toBeCloseTo(0.707)
    expect(gespeichert.h).toBeCloseTo(0.1414)
    const zurueck = ausSeitenbreiten(gespeichert, A4)
    expect(zurueck.y).toBeCloseTo(0.5)
    expect(zurueck.h).toBeCloseTo(0.1)
  })

  it('bleibt an derselben Stelle, wenn die Seite nach unten wächst', () => {
    const gespeichert = inSeitenbreiten({ x: 0.1, y: 0.5, b: 0.4, h: 0.1 }, A4)
    const zeile = markenZeile({ id: 'a1b2c3', seite: 2, text: '', bereich: gespeichert, datum: '2026-11-14', farbe: null })
    const [m] = liesMarken(zeile)
    // Seite ist inzwischen doppelt so hoch: oben in Seitenkoordinaten ist es dieselbe Stelle (707 von 1000 Breite)
    const lang = ausSeitenbreiten(m.bereich, 2 * A4)
    expect(lang.y * 2 * A4 * 1000).toBeCloseTo(707, 0)
  })

  it('schreibt y und Höhe über 1 und schneidet sie beim Umbenennen nicht ab', () => {
    const bereich = { x: 0.2, y: 1.8, b: 0.5, h: 0.3 }
    let text = setzeMarke('', { id: 'b7x2q1', seite: 3, text: '', bereich, datum: '2026-11-14', farbe: null })
    expect(text).toContain('%%rn 0.200 1.800 0.500 0.300 2026-11-14%%')
    const m = liesMarken(text)[0]
    text = setzeMarke(text, { ...m, text: benenne(m.text, 'Kettenregel #ableitung') })
    expect(liesMarken(text)[0]).toMatchObject({ text: 'Kettenregel #ableitung', bereich })
  })

  it('PDF-Zeilen bleiben byte-gleich, x und Breite bleiben auf 0 bis 1 begrenzt', () => {
    const alt = '- S. 1 · Merksatz Spannungsteiler %%rn 0.120 0.300 0.430 0.080 2026-10-19 wichtig%% ^a7k2c9'
    const [m] = liesMarken(alt)
    expect(markenZeile(m)).toBe(alt)
    expect(markenZeile({ ...m, bereich: { x: 1.5, y: 0.3, b: -1, h: 0.08 } })).toContain('%%rn 1.000 0.300 0.000 0.080')
  })

  it('Bausteine aus Büchern stehen neben denen aus Skripten und werden gefunden', () => {
    const texte = new Map([
      ['lernen/markierungen/SKRIPT1.md', setzeMarke('', { id: 's1', seite: 4, text: 'Potenzregel #integral', bereich: { x: 0, y: 0, b: 1, h: 0.1 }, datum: '2026-11-13', farbe: null })],
      ['lernen/markierungen/BUCH1.md', setzeMarke('', { id: 'b1', seite: 2, text: 'Eigene Herleitung #integral', bereich: { x: 0, y: 1.2, b: 1, h: 0.2 }, datum: '2026-11-14', farbe: null })]
    ])
    const alle = alleBausteine(texte)
    expect(alle.map((b) => b.anhang).sort()).toEqual(['BUCH1', 'SKRIPT1'])
    expect(sucheBausteine(alle, 'integral').map((b) => b.marke.id)).toEqual(['b1', 's1'])
  })
})
