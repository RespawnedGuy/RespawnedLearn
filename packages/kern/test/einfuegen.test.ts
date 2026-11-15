// Kopieren und Einfügen (Vertrag Lernen 1.12): Lage auf der Buchseite und was auf die Seite kommt
import { describe, expect, it } from 'vitest'
import { A4, VERTRAG, vergleicheVersionen, EINFUEGEN_MIN, buchSeiteJson, legeEin, lageBeimEinfuegen, liesBuchSeite, natuerlicheBreite, ohneMarke, type Kopie } from '../src/index'

const SKRIPT: Kopie = { anhang: '01JSKRIPT', seite: 12, bereich: { x: 0.1, y: 0.2, b: 0.5, h: 0.1 }, marke: 'a7k2c9', verhaeltnis: 0.3 }
const BUCH: Kopie = { anhang: '01JBUCH', seite: 2, bereich: { x: 0.05, y: 0.9, b: 0.4, h: 0.2 }, marke: 'b7x2q1', verhaeltnis: 0.5 }

describe('Lage beim Einfügen', () => {
  it('der Vertrag steht auf 1.12', () => {
    expect(VERTRAG).toBe('1.12')
    expect(vergleicheVersionen('1.12', '1.11')).toBeGreaterThan(0)
  })
  it('ohne Rechteck: am Punkt, so breit wie an der Quelle', () => {
    expect(lageBeimEinfuegen(SKRIPT, { x: 100, y: 300 }, A4)).toEqual({ x: 100, y: 300, b: 500, h: 150 })
    expect(natuerlicheBreite(BUCH)).toBe(400)
  })
  it('mit Rechteck: so breit wie das Rechteck', () => {
    expect(lageBeimEinfuegen(BUCH, { x: 50, y: 50, b: 300 }, A4)).toEqual({ x: 50, y: 50, b: 300, h: 150 })
  })
  it('winzige Quelle wird mindestens greifbar breit', () => {
    expect(lageBeimEinfuegen({ ...SKRIPT, bereich: { x: 0, y: 0, b: 0.02, h: 0.01 } }, { x: 0, y: 0 }, A4).b).toBe(EINFUEGEN_MIN)
  })
  it('am rechten und unteren Rand rückt der Ausschnitt nach innen', () => {
    const l = lageBeimEinfuegen(SKRIPT, { x: 900, y: 1400 }, A4)
    expect(l.x).toBe(500)
    expect(l.y + l.h).toBeCloseTo(1414.2, 1)
    expect(l.b).toBe(500)
  })
  it('zu hoch für die Seite: kleiner, bis er ganz draufpasst', () => {
    const l = lageBeimEinfuegen({ ...SKRIPT, verhaeltnis: 3 }, { x: 0, y: 0, b: 1000 }, A4)
    expect(l.h).toBeCloseTo(1414.2, 1)
    expect(l.b).toBeCloseTo(1414.2 / 3, 1)
  })
  it('kaputtes Verhältnis zählt wie 3:4', () => {
    expect(lageBeimEinfuegen({ ...SKRIPT, verhaeltnis: Number.NaN }, { x: 0, y: 0 }, A4).h).toBe(375)
  })
})

describe('Auf die Seite legen', () => {
  const leer = liesBuchSeite('')
  it('Ausschnitt und ✦-Verweis gehören über `bild` zusammen, andere Inhalte bleiben', () => {
    const alt = liesBuchSeite(JSON.stringify({ bilder: [{ id: 'f1', anhang: 'FOTO', x: 0, y: 0, b: 200, h: 100 }], verweise: [{ id: 'v0', y: 0, anhang: '01JSKRIPT', seite: 1 }], neu: 1 }))
    const r = legeEin(alt, SKRIPT, { x: 100, y: 300 }, A4, { bild: 'b9', verweis: 'v9' }, '2026-11-15T20:00:00.000Z')
    expect(r.seite.bilder.map((b) => b.id)).toEqual(['f1', 'b9'])
    expect(r.bild).toEqual({ id: 'b9', anhang: '01JSKRIPT', seite: 12, bereich: SKRIPT.bereich, x: 100, y: 300, b: 500, h: 150 })
    expect(r.verweis).toEqual({ id: 'v9', y: 300, anhang: '01JSKRIPT', seite: 12, marke: 'a7k2c9', bild: 'b9', am: '2026-11-15T20:00:00.000Z' })
    expect(r.seite.rest).toEqual({ neu: 1 })
  })
  it('aus einem Buch: Verweis zeigt aufs Buch, übersteht Schreiben und Lesen', () => {
    const r = legeEin(leer, BUCH, { x: 0, y: 0 }, A4, { bild: 'b1', verweis: 'v1' }, '2026-11-15T20:00:00.000Z')
    const zurueck = liesBuchSeite(buchSeiteJson(r.seite))
    expect(zurueck.verweise[0]).toMatchObject({ anhang: '01JBUCH', seite: 2, marke: 'b7x2q1', bild: 'b1' })
    expect(zurueck.bilder[0]).toMatchObject({ anhang: '01JBUCH', seite: 2, bereich: { x: 0.05, y: 0.9, b: 0.4, h: 0.2 } })
  })
  it('Rückgängig über die ✦-Marke nimmt beides wieder weg, byte-gleich', () => {
    const vorher = buchSeiteJson(leer)
    const r = legeEin(leer, SKRIPT, { x: 10, y: 10 }, A4, { bild: 'b2', verweis: 'v2' }, '2026-11-15T20:00:00.000Z')
    expect(buchSeiteJson(ohneMarke(r.seite, 'v2')!.seite)).toBe(vorher)
  })
})
