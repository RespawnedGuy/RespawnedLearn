import { describe, expect, it } from 'vitest'
import { ausSeitenbreiten, inSeitenbreiten, KLEINSTER_BEREICH, liesMarken, markeAn, rueckeBereich } from '../src'

const b = { x: 0.2, y: 0.3, b: 0.4, h: 0.1 }
const nah = (x: { x: number; y: number; b: number; h: number }, y: typeof x) => {
  for (const k of ['x', 'y', 'b', 'h'] as const) expect(x[k]).toBeCloseTo(y[k], 6)
}

describe('Markierung verschieben und skalieren', () => {
  it('verschiebt, Größe bleibt', () => nah(rueckeBereich(b, 'mitte', 0.1, -0.05), { x: 0.3, y: 0.25, b: 0.4, h: 0.1 }))

  it('bleibt beim Verschieben ganz auf der Seite', () => {
    nah(rueckeBereich(b, 'mitte', 5, 5), { x: 0.6, y: 0.9, b: 0.4, h: 0.1 })
    nah(rueckeBereich(b, 'mitte', -5, -5), { x: 0, y: 0, b: 0.4, h: 0.1 })
  })

  it('Ecke unten rechts: Größe ändert sich, oben links bleibt stehen', () => nah(rueckeBereich(b, 'ru', 0.1, 0.05), { x: 0.2, y: 0.3, b: 0.5, h: 0.15 }))

  it('Ecke oben links: unten rechts bleibt stehen', () => nah(rueckeBereich(b, 'lo', -0.1, -0.1), { x: 0.1, y: 0.2, b: 0.5, h: 0.2 }))

  it('nie kleiner als die kleinste Markierung, auch beim Überziehen der Gegenecke', () => {
    const k = rueckeBereich(b, 'ru', -1, -1)
    nah(k, { x: 0.2, y: 0.3, b: KLEINSTER_BEREICH.b, h: KLEINSTER_BEREICH.h })
    const l = rueckeBereich(b, 'lo', 1, 1)
    expect(l.x + l.b).toBeCloseTo(0.6)
    expect(l.b).toBeCloseTo(KLEINSTER_BEREICH.b)
  })

  it('Ecken ziehen nicht über den Seitenrand', () => {
    nah(rueckeBereich(b, 'ro', 2, -2), { x: 0.2, y: 0, b: 0.8, h: 0.4 })
    nah(rueckeBereich(b, 'lu', -2, 2), { x: 0, y: 0.3, b: 0.6, h: 0.7 })
  })

  it('im Buch: angezeigt in Anteilen, gespeichert in Seitenbreiten über 1', () => {
    const format = 1.414
    const gespeichert = { x: 0.1, y: 1.2, b: 0.5, h: 0.1 }
    const neu = inSeitenbreiten(rueckeBereich(ausSeitenbreiten(gespeichert, format), 'mitte', 0, 0.05), format)
    expect(neu.y).toBeCloseTo(1.2 + 0.05 * format)
    expect(neu.h).toBeCloseTo(0.1)
  })

  it('markeAn trifft die oberste Markierung, mit kleiner Zugabe; im Buch über Seitenbreiten', () => {
    const marken = liesMarken(
      '- S. 1 %%rn 0.100 0.100 0.500 0.300 2026-11-14%% ^unten\n- S. 1 %%rn 0.200 0.200 0.200 0.050 2026-11-14%% ^oben\n- ^k3 %%rt 2026-11-14%% ^text\n'
    )
    expect(markeAn(marken, { x: 0.3, y: 0.22 })?.marke.id).toBe('oben')
    expect(markeAn(marken, { x: 0.15, y: 0.35 })?.marke.id).toBe('unten')
    expect(markeAn(marken, { x: 0.605, y: 0.2 })?.marke.id).toBe('unten')
    expect(markeAn(marken, { x: 0.9, y: 0.9 })).toBeNull()
    const buch = liesMarken('- S. 2 %%rn 0.100 1.200 0.500 0.100 2026-11-14%% ^b\n')
    expect(markeAn(buch, { x: 0.3, y: 1.25 / 1.414 }, 1.414)?.marke.id).toBe('b')
    expect(markeAn(buch, { x: 0.3, y: 0.5 }, 1.414)).toBeNull()
  })
})
