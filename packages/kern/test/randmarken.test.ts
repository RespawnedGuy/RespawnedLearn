import { describe, expect, it } from 'vitest'
import { buchSeiteJson, ohneVerwaiste, rueckwege, strichLage, verweiseBeimSchreiben, ZEILE, type Verweis } from '../src'

const A = '01JBEXAMP000000000SKRPT001'
const B = '01JBEXAMP000000000SKRPT002'
const BUCH = '01JNB8000000000000000B0001'
const neu = { id: 'neu1', am: '2026-11-13T10:00:00Z' }
const v = (id: string, y: number, seite: number, extra: Partial<Verweis> = {}): Verweis => ({ id, y, anhang: A, seite, am: 'x', ...extra })
const lage = (oben: number, unten = oben + 20) => ({ oben, unten })

describe('Randmarken beim Schreiben (Vertrag Lernen 1.3, 5.3)', () => {
  it('erste Zeile auf einer leeren Buchseite: Marke auf Höhe des Strichanfangs', () => {
    const r = verweiseBeimSchreiben([], [lage(100)], 100, { anhang: A, seite: 12 }, neu)
    expect(r).toEqual([{ id: 'neu1', y: 100, anhang: A, seite: 12, am: neu.am }])
  })

  it('dieselbe Skriptseite: keine neue Marke', () => {
    const alt = [v('a', 100, 12)]
    expect(verweiseBeimSchreiben(alt, [lage(100), lage(300)], 300, { anhang: A, seite: 12 }, neu)).toBeNull()
  })

  it('Seitenwechsel im Skript: neue Marke unter der alten', () => {
    const r = verweiseBeimSchreiben([v('a', 100, 12)], [lage(100), lage(300)], 300, { anhang: A, seite: 13 }, neu)
    expect(r?.map((x) => [x.id, x.y, x.seite])).toEqual([['a', 100, 12], ['neu1', 300, 13]])
  })

  it('anderes Skript mit derselben Seitenzahl zählt als Wechsel', () => {
    const r = verweiseBeimSchreiben([v('a', 100, 12)], [lage(100), lage(300)], 300, { anhang: B, seite: 12 }, neu)
    expect(r?.at(-1)).toMatchObject({ anhang: B, seite: 12 })
  })

  it('Strich oberhalb der ersten Marke: eigene Marke darüber', () => {
    const r = verweiseBeimSchreiben([v('a', 400, 12)], [lage(400), lage(100)], 100, { anhang: A, seite: 12 }, neu)
    expect(r?.map((x) => x.y)).toEqual([100, 400])
  })

  it('zu dicht an einer vorhandenen Marke: die neue rückt eine Zeile nach unten', () => {
    const r = verweiseBeimSchreiben([v('a', 100, 12)], [lage(100), lage(110)], 110 - ZEILE - 1, { anhang: A, seite: 13 }, neu)
    // Strich beginnt knapp oberhalb, aber unter einer Zeile Abstand
    expect(r?.find((x) => x.id === 'neu1')?.y).toBe(100 + ZEILE)
  })

  it('nach dem Rücken gilt die gerückte Marke für dieselbe Zeile weiter', () => {
    const alt = [v('a', 100, 12), v('b', 100 + ZEILE, 13)]
    expect(verweiseBeimSchreiben(alt, [lage(100), lage(105), lage(110)], 110, { anhang: A, seite: 13 }, neu)).toBeNull()
  })

  it('ohne offenes Skript: keine Marke', () => {
    expect(verweiseBeimSchreiben([], [lage(100)], 100, null, neu)).toBeNull()
  })

  it('verwaiste automatische Marke fällt beim nächsten Schreiben weg', () => {
    // unter „b“ wurde alles wegradiert; geschrieben wird oben auf derselben Skriptseite wie „a“
    const alt = [v('a', 100, 12), v('b', 500, 14)]
    const r = verweiseBeimSchreiben(alt, [lage(100), lage(140)], 140, { anhang: A, seite: 12 }, neu)
    expect(r?.map((x) => x.id)).toEqual(['a'])
  })

  it('verwaiste Marken fallen auch ohne offenes Skript weg', () => {
    expect(verweiseBeimSchreiben([v('a', 100, 12), v('b', 500, 14)], [lage(100)], 100, null, neu)?.map((x) => x.id)).toEqual(['a'])
  })

  it('Marke aus einer Markierung bleibt, auch ohne Strich darunter', () => {
    const alt = [v('a', 100, 12), v('m', 500, 14, { marke: 'a7k2c9' })]
    expect(ohneVerwaiste(alt, [lage(100)]).map((x) => x.id)).toEqual(['a', 'm'])
  })

  it('angehobene Marke oben auf der Seite (y 0) bleibt, solange darunter geschrieben steht', () => {
    expect(ohneVerwaiste([v('s3', 0, 3)], [lage(700)]).map((x) => x.id)).toEqual(['s3'])
  })

  it('Lage eines Strichs: oberster und unterster Punkt', () => {
    expect(strichLage({ punkte: [[0, 50, 0.5], [1, 20, 0.5], [2, 80, 0.5]] })).toEqual({ oben: 20, unten: 80 })
  })
})

describe('Rückweg vom Skript ins Buch', () => {
  it('sammelt je Skriptseite die Buchstellen, nur für dieses Skript', () => {
    const dateien: Record<string, string> = {
      [`lernen/buecher/${BUCH}/S001.json`]: buchSeiteJson({ bilder: [], verweise: [v('a', 100, 12), v('b', 400, 13), { id: 'c', y: 600, anhang: B, seite: 12 }], rest: {} }),
      [`lernen/buecher/${BUCH}/S002.json`]: buchSeiteJson({ bilder: [], verweise: [v('d', 0, 12, { marke: 'k1' })], rest: {} }),
      [`lernen/buecher/${BUCH}/S002.svg`]: '<svg/>',
      'lernen/anderes.json': JSON.stringify({ anhang: A })
    }
    const r = rueckwege(Object.keys(dateien), (p) => dateien[p], A)
    expect(r.get(12)).toEqual([
      { buch: BUCH, nr: 1, y: 100, marke: false },
      { buch: BUCH, nr: 2, y: 0, marke: true }
    ])
    expect(r.get(13)).toHaveLength(1)
    expect(r.has(14)).toBe(false)
  })
})
