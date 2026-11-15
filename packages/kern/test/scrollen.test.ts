import { describe, expect, it } from 'vitest'
import { ankerBei, ankerVersatz, naechsteSeite, sichtbareSeite } from '../src/scrollen'

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

describe('Anker beim Ändern der Breite', () => {
  it('nimmt die Seite an der Oberkante samt Anteil', () => {
    expect(ankerBei(seiten, 1516)).toEqual({ nr: 2, anteil: 0.5 })
    expect(ankerBei(seiten, 0)).toEqual({ nr: 1, anteil: 0 })
  })

  it('im Abstand zwischen zwei Seiten gilt die untere ab ihrem Anfang', () => {
    expect(ankerBei(seiten, 1008)).toEqual({ nr: 2, anteil: 0 })
  })

  it('ohne Seiten oder hinter der letzten gibt es keinen Anker', () => {
    expect(ankerBei([], 0)).toBeNull()
    expect(ankerBei(seiten, 5000)).toBeNull()
  })

  it('hält nach dem Schmalerwerden dieselbe Stelle: S. 12 wird nicht S. 19 (Fehler 2026-11-15)', () => {
    // breit: Seiten 1000 px hoch; das Skript stand mitten in S. 12
    const breit = Array.from({ length: 30 }, (_, i) => ({ nr: i + 1, oben: i * 1016, unten: i * 1016 + 1000 }))
    const anker = ankerBei(breit, 11 * 1016 + 250)!
    expect(anker).toEqual({ nr: 12, anteil: 0.25 })
    // schmal: gleiche Scrollposition, Seiten nur noch 600 px hoch → oben stünde S. 19
    const scroll = 11 * 1016 + 250
    const schmal = Array.from({ length: 30 }, (_, i) => ({ nr: i + 1, oben: i * 616 - scroll, unten: i * 616 + 600 - scroll }))
    expect(ankerBei(schmal, 0)!.nr).toBe(19)
    const versatz = ankerVersatz(schmal[anker.nr - 1], anker, 0)
    const danach = schmal.map((s) => ({ ...s, oben: s.oben - versatz, unten: s.unten - versatz }))
    expect(ankerBei(danach, 0)).toEqual({ nr: 12, anteil: 0.25 })
    expect(sichtbareSeite(danach, 0, 800)).toBe(12)
  })
})
