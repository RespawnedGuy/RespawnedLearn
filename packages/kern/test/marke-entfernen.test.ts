import { describe, expect, it } from 'vitest'
import { buchSeiteJson, ohneMarkeImBuch, liesBuchSeite } from '../src'

const A = '01JBEXAMP000000000SKRPT001'
const bereich = { x: 0.1, y: 0.2, b: 0.5, h: 0.1 }
const ausschnitt = (id: string, y: number, seite = 12) => ({ id, anhang: A, seite, bereich, x: 48, y, b: 600, h: 120 })
const seite = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    zusatz: { bleibt: true },
    bilder: [ausschnitt('aus1', 380), { id: 'foto1', anhang: '01JFOTO', x: 48, y: 600, b: 300, h: 200 }],
    verweise: [
      { id: 'v1', y: 96, anhang: A, seite: 12, am: 'x' },
      { id: 'v2', y: 380, anhang: A, seite: 12, marke: 'a7k2c9', am: 'y', ...extra }
    ]
  })

describe('✦-Marke entfernen (Vertrag Lernen 1.5, 5.3)', () => {
  it('liest und schreibt `bild` am Verweis', () => {
    const s = liesBuchSeite(seite({ bild: 'aus1' }))
    expect(s.verweise[1].bild).toBe('aus1')
    expect(JSON.parse(buchSeiteJson(s)).verweise[1].bild).toBe('aus1')
  })

  it('mit `bild`: Marke und ihr Ausschnitt gehen, auch wenn der Ausschnitt verschoben wurde; der Rest bleibt', () => {
    const roh = JSON.parse(seite({ bild: 'aus1' }))
    roh.bilder[0].y = 700
    const s = liesBuchSeite(JSON.stringify(roh))
    const r = ohneMarkeImBuch(s, 'v2')!
    expect(r.verweise.map((v) => v.id)).toEqual(['v1'])
    expect(r.bilder.map((b) => b.id)).toEqual(['foto1'])
    expect(r.rest).toEqual({ zusatz: { bleibt: true } })
    expect(r.verweise[0]).toEqual(s.verweise[0])
    expect(r.bilder[0]).toEqual(s.bilder[1])
  })

  it('ältere Marke ohne `bild`: Ausschnitt derselben Skriptseite auf derselben Höhe geht mit', () => {
    const r = ohneMarkeImBuch(liesBuchSeite(seite()), 'v2')!
    expect(r.bilder.map((b) => b.id)).toEqual(['foto1'])
    expect(r.verweise.map((v) => v.id)).toEqual(['v1'])
  })

  it('ältere Marke, Ausschnitt verschoben oder von anderer Skriptseite: nur die Marke geht', () => {
    const roh = JSON.parse(seite())
    roh.bilder.push(ausschnitt('aus2', 380, 13))
    roh.bilder[0].y = 500
    const r = ohneMarkeImBuch(liesBuchSeite(JSON.stringify(roh)), 'v2')!
    expect(r.bilder.map((b) => b.id)).toEqual(['aus1', 'foto1', 'aus2'])
    expect(r.verweise.map((v) => v.id)).toEqual(['v1'])
  })

  it('Ausschnitt schon entfernt: nur die Marke geht', () => {
    const r = ohneMarkeImBuch(liesBuchSeite(seite({ bild: 'weg' })), 'v2')!
    expect(r.bilder.map((b) => b.id)).toEqual(['aus1', 'foto1'])
    expect(r.verweise.map((v) => v.id)).toEqual(['v1'])
  })

  it('Verweis ohne Marke oder unbekannte ID: nichts', () => {
    const s = liesBuchSeite(seite())
    expect(ohneMarkeImBuch(s, 'v1')).toBeNull()
    expect(ohneMarkeImBuch(s, 'gibtsnicht')).toBeNull()
  })
})
