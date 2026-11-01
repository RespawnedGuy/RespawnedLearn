import { describe, expect, it } from 'vitest'
import {
  A4,
  MM,
  anordnungJson,
  blattFormat,
  lineaturSchichten,
  liesAnordnung,
  neueBlattId,
  neuesBlatt,
  oeffneAnsicht,
  offeneAnsichten,
  pfade,
  schliesseAnsicht,
  setzeBreiten,
  setzeLineatur,
  tinteSvg,
  verschiebeAnsicht
} from '../src'

describe('Blätter neben dem Skript (Vertrag 5.3)', () => {
  it('ohne Datei: Skript und ein Blatt mit Kästchen, wie bisher', () => {
    const a = liesAnordnung(undefined)
    expect(a.ansichten.map((v) => [v.art, v.id, v.lineatur])).toEqual([
      ['pdf', 'pdf', undefined],
      ['blatt', '1', 'kariert']
    ])
  })

  it('das erste Blatt behält seine alte Datei, weitere bekommen ihre ID angehängt', () => {
    expect(pfade.blatt('A1', 3)).toBe('lernen/blaetter/A1/S003.svg')
    expect(pfade.blatt('A1', 3, '1')).toBe('lernen/blaetter/A1/S003.svg')
    expect(pfade.blatt('A1', 3, 'k7x2m9')).toBe('lernen/blaetter/A1/S003-k7x2m9.svg')
    expect(pfade.blattAnordnung('A1')).toBe('lernen/blaetter/A1/anordnung.json')
  })

  it('Rechnung in Kästchen, Graph auf Millimeterpapier: drei Ansichten, frei sortierbar', () => {
    let a = liesAnordnung(undefined)
    a = neuesBlatt(a, 'mm1', 'millimeter')
    expect(offeneAnsichten(a).map((v) => v.id)).toEqual(['pdf', '1', 'mm1'])
    a = verschiebeAnsicht(a, 'mm1', -1)
    a = verschiebeAnsicht(a, 'mm1', -1)
    expect(offeneAnsichten(a).map((v) => v.id)).toEqual(['mm1', 'pdf', '1'])
    // am Rand passiert nichts
    expect(verschiebeAnsicht(a, 'mm1', -1)).toEqual(a)
    a = setzeBreiten(a, { mm1: 4, pdf: 1.5 })
    const zurueck = liesAnordnung(anordnungJson(a))
    expect(zurueck).toEqual(a)
  })

  it('verschieben überspringt ausgeblendete Ansichten', () => {
    let a = neuesBlatt(liesAnordnung(undefined), 'b2', 'liniert')
    a = schliesseAnsicht(a, '1', true)
    a = verschiebeAnsicht(a, 'b2', -1)
    expect(offeneAnsichten(a).map((v) => v.id)).toEqual(['b2', 'pdf'])
  })

  it('schließen: leeres Blatt verschwindet, beschriebenes wird nur ausgeblendet, die letzte Ansicht bleibt', () => {
    let a = neuesBlatt(liesAnordnung(undefined), 'b2', 'punkte')
    a = schliesseAnsicht(a, 'b2', false)
    expect(a.ansichten.some((v) => v.id === 'b2')).toBe(false)
    a = schliesseAnsicht(a, '1', true)
    expect(a.ansichten.find((v) => v.id === '1')?.zu).toBe(true)
    // nur noch das Skript offen: es lässt sich nicht schließen
    expect(schliesseAnsicht(a, 'pdf', false)).toEqual(a)
    a = oeffneAnsicht(a, '1')
    expect(a.ansichten.find((v) => v.id === '1')).toEqual({ art: 'blatt', id: '1', lineatur: 'kariert', breite: 2 })
    // Skript ausblenden: nur noch das Blatt ist zu sehen (Schreibfläche in voller Breite)
    a = schliesseAnsicht(a, 'pdf', false)
    expect(offeneAnsichten(a).map((v) => v.id)).toEqual(['1'])
  })

  it('liest kaputte und fremde Angaben robust', () => {
    expect(liesAnordnung('{kaputt').ansichten).toHaveLength(2)
    const a = liesAnordnung(
      JSON.stringify({
        ansichten: [
          { art: 'blatt', id: 'x', lineatur: 'gibtsnicht', breite: 999 },
          { art: 'blatt', id: 'x', lineatur: 'noten' },
          { art: 'blatt', id: '../böse' },
          { art: 'video', id: 'v' },
          { art: 'blatt', id: 'y', zu: true }
        ]
      })
    )
    // Skript fehlte: kommt dazu, aber ausgeblendet, weil schon ein Blatt offen ist
    expect(a.ansichten.map((v) => [v.id, v.lineatur, v.breite, !!v.zu])).toEqual([
      ['pdf', undefined, 3, true],
      ['x', 'kariert', 20, false],
      ['y', 'kariert', 2, true]
    ])
    // alles zu: die erste Ansicht wird wieder geöffnet
    expect(offeneAnsichten(liesAnordnung(JSON.stringify({ ansichten: [{ art: 'pdf', id: 'pdf', zu: true, breite: 1 }] })))).toHaveLength(1)
  })

  it('Lineatur wechseln und neue IDs ohne Doppel', () => {
    let a = setzeLineatur(liesAnordnung(undefined), '1', 'noten')
    expect(a.ansichten[1].lineatur).toBe('noten')
    a = neuesBlatt(a, neueBlattId(a, '01JABCDEFGHK7X2M9'), 'kariert')
    expect(a.ansichten[2].id).toBe('k7x2m9')
    expect(neueBlattId(a, 'zzK7X2M9')).toBe('k7x2m92')
  })

  it('das Format eines Blatts kommt aus der Höhe seiner Tinte, mindestens A4', () => {
    expect(blattFormat(undefined)).toBe(A4)
    expect(blattFormat(tinteSvg([], 1000))).toBe(A4)
    expect(blattFormat(tinteSvg([], 1000 * A4 * 2))).toBeCloseTo(2 * A4, 2)
  })
})

describe('Lineaturen', () => {
  const zahl = (d: string, c: string) => d.split(c).length - 1

  it('Kästchen 5 mm: 42 senkrechte Linien auf A4-Breite, waagerecht bis unten', () => {
    const [s] = lineaturSchichten('kariert', A4)
    expect(zahl(s.d, 'V')).toBe(42) // 5 … 210 mm
    expect(zahl(s.d, 'H')).toBe(59) // 5 … 295 mm (297 mm Höhe)
  })

  it('Millimeterpapier: 1/5/10 mm ohne doppelte Linien', () => {
    const [fein, mittel, kraeftig] = lineaturSchichten('millimeter', A4)
    expect(zahl(kraeftig.d, 'V')).toBe(22) // 0 … 210 mm
    expect(zahl(mittel.d, 'V')).toBe(21) // 5, 15 … 205 mm
    expect(zahl(fein.d, 'V')).toBe(211 - 43)
  })

  it('Noten: 12 Systeme mit je fünf Linien pro A4, beim Verlängern doppelt so viele', () => {
    expect(zahl(lineaturSchichten('noten', A4)[0].d, 'H')).toBe(60)
    expect(zahl(lineaturSchichten('noten', 2 * A4)[0].d, 'H')).toBe(120)
  })

  it('Punkte im 5-mm-Raster, Linien 8 mm, leer ohne alles', () => {
    expect(zahl(lineaturSchichten('punkte', A4)[0].d, 'h0')).toBe(41 * 59)
    const linien = lineaturSchichten('liniert', A4)[0].d
    expect(linien.startsWith(`M0 ${Math.round(16 * MM * 10) / 10}H1000`)).toBe(true)
    expect(lineaturSchichten('leer', A4)).toEqual([])
  })
})
