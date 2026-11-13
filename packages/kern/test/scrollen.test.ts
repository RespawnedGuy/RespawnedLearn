import { describe, expect, it } from 'vitest'
import { naechsteSeite, sichtbareSeite } from '../src/scrollen'

const seiten = [
  { nr: 1, oben: 0, unten: 1000 },
  { nr: 2, oben: 1016, unten: 2016 },
  { nr: 3, oben: 2032, unten: 3032 }
]

describe('sichtbareSeite', () => {
  it('nimmt die Seite mit dem größten sichtbaren Anteil', () => {
    expect(sichtbareSeite(seiten, 0, 800)).toBe(1)
    expect(sichtbareSeite(seiten, 700, 1500)).toBe(2) // 300 px von S. 1, 484 px von S. 2
    expect(sichtbareSeite(seiten, 1900, 2700)).toBe(3)
  })

  it('bei Gleichstand gewinnt die obere Seite', () => {
    expect(sichtbareSeite(seiten, 600, 1416)).toBe(1) // je 400 px
  })

  it('kleine Sicht in einer langen Seite', () => {
    expect(sichtbareSeite(seiten, 1200, 1300)).toBe(2)
  })

  it('nichts sichtbar ergibt null', () => {
    expect(sichtbareSeite(seiten, 5000, 6000)).toBeNull()
    expect(sichtbareSeite([], 0, 800)).toBeNull()
    expect(sichtbareSeite(seiten, 1001, 1015)).toBeNull() // genau im Zwischenraum
  })

  it('Reihenfolge der Liste spielt keine Rolle', () => {
    expect(sichtbareSeite([...seiten].reverse(), 600, 1416)).toBe(1)
  })
})

describe('naechsteSeite', () => {
  it('bleibt in den Grenzen', () => {
    expect(naechsteSeite(1, -1, 80)).toBe(1)
    expect(naechsteSeite(80, 1, 80)).toBe(80)
    expect(naechsteSeite(12, 1, 80)).toBe(13)
    expect(naechsteSeite(12, 1, 0)).toBe(13)
  })
})
