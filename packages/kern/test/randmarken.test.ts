import { describe, expect, it } from 'vitest'
import { buchSeiteJson, ohneVerwaiste, platzFuerMarkierung, rueckwege, seitenBlase, seitenDerBuchseite, strichLage, verweiseBeimSchreiben, ZEILE, type Verweis } from '../src'

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

  // Bis v0.30.0 entstand hier eine zweite Marke S. 12 darüber; seit v0.30.1 höchstens eine je Skriptseite (Nils 2026-11-15)
  it('Strich oberhalb der Marke derselben Skriptseite: keine zweite Marke', () => {
    expect(verweiseBeimSchreiben([v('a', 400, 12)], [lage(400), lage(100)], 100, { anhang: A, seite: 12 }, neu)).toBeNull()
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

  it('höchstens eine Marke je Skriptseite: Hin- und Herblättern zwischen 28 und 29', () => {
    let vs: Verweis[] = []
    const striche: { oben: number; unten: number }[] = []
    let n = 0
    for (const [y, seite] of [[100, 28], [200, 29], [300, 28], [400, 29], [500, 28]] as const) {
      striche.push(lage(y))
      vs = verweiseBeimSchreiben(vs, striche, y, { anhang: A, seite }, { id: `n${n++}`, am: 'x' }) ?? vs
    }
    expect(vs.map((x) => [x.y, x.seite])).toEqual([[100, 28], [200, 29]])
  })

  it('eine ✦-Marke dazwischen erzeugt keine zweite Marke derselben Skriptseite', () => {
    const alt = [v('a', 100, 28), v('m', 200, 27, { marke: 'k1' })]
    expect(verweiseBeimSchreiben(alt, [lage(100), lage(300)], 300, { anhang: A, seite: 28 }, neu)).toBeNull()
  })

  it('eine ✦-Marke allein zählt nicht als Seitenverweis', () => {
    const r = verweiseBeimSchreiben([v('m', 100, 28, { marke: 'k1' })], [lage(300)], 300, { anhang: A, seite: 28 }, neu)
    expect(r?.map((x) => x.id)).toEqual(['m', 'neu1'])
  })

  it('vorhandene doppelte Marken fallen beim nächsten Strich weg, die oberste bleibt, ✦ bleiben alle', () => {
    const alt = [v('a', 100, 27), v('b', 200, 28), v('c', 260, 28), v('m', 300, 28, { marke: 'k1' }), v('d', 400, 28), v('e', 500, 29)]
    const striche = [100, 200, 260, 300, 400, 500].map((y) => lage(y))
    const r = verweiseBeimSchreiben(alt, striche, 500, { anhang: A, seite: 29 }, neu)
    expect(r?.map((x) => x.id)).toEqual(['a', 'b', 'm', 'e'])
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

  it('doppelte automatische Marken einer Buchseite zählen einmal, ✦ jede für sich', () => {
    const dateien: Record<string, string> = {
      [`lernen/buecher/${BUCH}/S001.json`]: buchSeiteJson({ bilder: [], verweise: [v('a', 300, 12), v('b', 100, 12), v('m', 200, 12, { marke: 'k1' })], rest: {} })
    }
    expect(rueckwege(Object.keys(dateien), (p) => dateien[p], A).get(12)).toEqual([
      { buch: BUCH, nr: 1, y: 100, marke: false },
      { buch: BUCH, nr: 1, y: 200, marke: true }
    ])
  })
})

describe('Blase mit den Seitenverweisen einer Buchseite', () => {
  it('je Skriptseite einmal, die oberste Stelle, ohne ✦, in Seitenfolge', () => {
    const vs = [v('a', 500, 29), v('b', 100, 28), v('c', 300, 28), v('m', 50, 27, { marke: 'k1' }), { id: 'x', y: 700, anhang: B, seite: 3 }]
    expect(seitenDerBuchseite(vs).map((x) => [x.anhang, x.seite, x.y])).toEqual([
      [A, 28, 100],
      [A, 29, 500],
      [B, 3, 700]
    ])
  })
  it('Aufschrift: eine Seite, ein Bereich, mehrere Skripte', () => {
    expect(seitenBlase([])).toBe('')
    expect(seitenBlase(seitenDerBuchseite([v('a', 0, 28)]))).toBe('S. 28')
    expect(seitenBlase(seitenDerBuchseite([v('a', 0, 27), v('b', 9, 29), v('c', 5, 28)]))).toBe('S. 27–29')
    expect(seitenBlase(seitenDerBuchseite([v('a', 0, 3), v('b', 9, 40)]))).toBe('S. 3, 40')
    expect(seitenBlase(seitenDerBuchseite([v('a', 0, 3), v('b', 9, 8), v('c', 12, 40)]))).toBe('3 Seiten')
    expect(seitenBlase(seitenDerBuchseite([v('a', 0, 3), { id: 'x', y: 1, anhang: B, seite: 3 }]))).toBe('2 Seiten')
  })
})

describe('Platz für eine Markierung im Buch', () => {
  it('leere Seite: oben, Breite wie im Skript', () => {
    expect(platzFuerMarkierung([], [], 0.5, 0.2, 1.414)).toEqual({ x: 48, y: 48, b: 500, h: 100 })
  })
  it('unter dem untersten Strich und dem untersten Bild', () => {
    expect(platzFuerMarkierung([{ y: 100, h: 200 }], [lage(350, 380)], 0.5, 0.2, 1.414)?.y).toBe(380 + 24)
    expect(platzFuerMarkierung([{ y: 100, h: 400 }], [lage(350, 380)], 0.5, 0.2, 1.414)?.y).toBe(500 + 24)
  })
  it('passt es nicht mehr auf die Seite: null (dann auf die nächste)', () => {
    expect(platzFuerMarkierung([], [lage(1200, 1300)], 0.5, 0.4, 1.414)).toBeNull()
  })
  it('sehr schmale und sehr breite Stellen bleiben lesbar und auf der Seite', () => {
    expect(platzFuerMarkierung([], [], 0.05, 0.2, 1.414)?.b).toBe(240)
    expect(platzFuerMarkierung([], [], 1, 0.2, 1.414)?.b).toBe(904)
  })
})
