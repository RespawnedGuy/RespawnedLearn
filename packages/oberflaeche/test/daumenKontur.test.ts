import { describe, expect, it } from 'vitest'
import { daumenKontur, PUNKTE } from '../src/daumenKontur'

const punkte = (d: string) => [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])

describe('Kontur des Daumenmenüs', () => {
  it('hat immer gleich viele Punkte, damit der Übergang gleiten kann', () => {
    for (const mitte of [null, 20, 180, 340]) {
      const { linie, flaeche } = daumenKontur(366, 64, mitte)
      expect(punkte(linie)).toHaveLength(PUNKTE)
      expect(punkte(flaeche)).toHaveLength(2 * PUNKTE)
    }
  })

  it('beginnt und endet in der Mitte der Rundungen und liegt sonst am unteren Rand', () => {
    const p = punkte(daumenKontur(366, 64, null).linie)
    expect(p[0]).toEqual([0, 31])
    expect(p[p.length - 1]).toEqual([366, 31])
    expect(p[(PUNKTE - 1) / 2][1]).toBe(63)
  })

  it('wölbt sich über dem aktiven Ziel bis an den oberen Rand und bleibt in der Pille', () => {
    const p = punkte(daumenKontur(366, 64, 183).linie)
    expect(Math.min(...p.map(([, y]) => y))).toBe(1.5)
    expect(p.find(([x]) => x === 183)?.[1]).toBe(1.5)
    for (const [, y] of p) expect(y).toBeGreaterThanOrEqual(1.5)
    for (const [, y] of p) expect(y).toBeLessThanOrEqual(63)
  })

  it('auch ganz außen: Wölbung über dem ersten Ziel läuft nicht aus der Pille', () => {
    const p = punkte(daumenKontur(366, 64, 46).linie)
    expect(p.find(([x]) => x > 44 && x < 48)?.[1]).toBe(1.5)
    expect(p[0][0]).toBe(0)
  })
})

describe('Kontur am Rand', () => {
  it('steigt über dem ersten Ziel vom Rand an stetig auf, ohne Knick nach unten', () => {
    const p = punkte(daumenKontur(366, 64, 46).linie).filter(([x]) => x <= 46)
    for (let i = 1; i < p.length; i++) expect(p[i][1]).toBeLessThanOrEqual(p[i - 1][1])
  })
})

describe('gerade Kontur (seitlich scrollende Werkzeugleiste)', () => {
  it('liegt ganz am unteren Rand und wölbt sich nur über dem aktiven Werkzeug', () => {
    const p = punkte(daumenKontur(600, 56, 300, false).linie)
    expect(p[0]).toEqual([0, 55])
    expect(p[p.length - 1]).toEqual([600, 55])
    expect(p.find(([x]) => x === 300)?.[1]).toBe(1.5)
    expect(p.filter(([x]) => Math.abs(x - 300) > 70).every(([, y]) => y === 55)).toBe(true)
  })
})
