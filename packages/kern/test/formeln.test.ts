// Formeln im Satz ($…$): Zerlegen für die Anzeige und Kürzen von Kartentiteln ohne Formelbruch
import { describe, expect, it } from 'vitest'
import { formelTeile, kuerzeOhneFormelbruch } from '../src'

describe('formelTeile', () => {
  it('erkennt eine Formel im Satz', () => {
    expect(formelTeile('Wie lauten die Lösungen von $x^2 + px + q = 0$ nach der p-q-Formel?')).toEqual([
      { art: 'text', text: 'Wie lauten die Lösungen von ' },
      { art: 'formel', text: 'x^2 + px + q = 0' },
      { art: 'text', text: ' nach der p-q-Formel?' }
    ])
  })
  it('erkennt mehrere Formeln, auch ganz vorn und hinten', () => {
    expect(formelTeile('$a$ und $b$')).toEqual([
      { art: 'formel', text: 'a' },
      { art: 'text', text: ' und ' },
      { art: 'formel', text: 'b' }
    ])
  })
  it('lässt Text ohne Formel unverändert', () => {
    expect(formelTeile('Was ist ein Vektorraum?')).toEqual([{ art: 'text', text: 'Was ist ein Vektorraum?' }])
    expect(formelTeile('')).toEqual([])
  })
  it('ein einzelnes $ bleibt Text', () => {
    expect(formelTeile('Kostet 5 $ pro Stück')).toEqual([{ art: 'text', text: 'Kostet 5 $ pro Stück' }])
  })
  it('keine Formel über einen Zeilenumbruch', () => {
    expect(formelTeile('$a\nb$')).toEqual([{ art: 'text', text: '$a\nb$' }])
  })
})

describe('kuerzeOhneFormelbruch', () => {
  const vorn = 'x'.repeat(80)
  it('kurzer Titel bleibt, auch genau an der Grenze', () => {
    expect(kuerzeOhneFormelbruch('kurz $a$', 90)).toBe('kurz $a$')
    const genau = 'y'.repeat(90)
    expect(kuerzeOhneFormelbruch(genau, 90)).toBe(genau)
  })
  it('kürzt ohne Formel wie bisher', () => {
    expect(kuerzeOhneFormelbruch('a'.repeat(100), 90)).toBe(`${'a'.repeat(89)}…`)
  })
  it('kürzt vor einer Formel, in die der Schnitt fiele', () => {
    expect(kuerzeOhneFormelbruch(`${vorn} ist $x^2 + px + q = 0$ hier`, 90)).toBe(`${vorn} ist…`)
  })
  it('Schnitt nach einer Formel lässt sie ganz', () => {
    const k = kuerzeOhneFormelbruch(`Mit $a$ ${'z'.repeat(100)}`, 90)
    expect(k.startsWith('Mit $a$ ')).toBe(true)
    expect(k.length).toBe(90)
  })
  it('Formel ganz vorn bleibt ganz, auch wenn der Titel dann länger wird', () => {
    const f = `$${'q'.repeat(100)}$`
    expect(kuerzeOhneFormelbruch(`${f} und mehr`, 90)).toBe(`${f}…`)
  })
  it('keine gekürzte Ausgabe endet mit einem offenen $', () => {
    for (let n = 0; n < 60; n++) {
      const t = `${'w'.repeat(n + 10)} $\\frac{a}{b}$ und $c^2$ ${'v'.repeat(60)}`
      const k = kuerzeOhneFormelbruch(t, 90)
      expect((k.match(/\$/g) ?? []).length % 2).toBe(0)
    }
  })
})
