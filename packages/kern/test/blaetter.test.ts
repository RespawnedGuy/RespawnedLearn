import { describe, expect, it } from 'vitest'
import {
  A4,
  MM,
  alteStandardAnordnung,
  anordnungJson,
  blattFormat,
  bilderJson,
  leeresPdf,
  liesBilder,
  platzFuerBild,
  rueckeBild,
  type BlattBild,
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
  verschiebeAnsicht,
  zeigeBuch
} from '../src'

describe('Blätter neben dem Skript (Vertrag 5.3)', () => {
  it('ohne Datei: ab Lernen 1.3 das Skript allein; die alte Vorgabe (Skript und Blatt 1) bleibt fürs Anheben', () => {
    expect(liesAnordnung(undefined)).toEqual({ schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 3 }] })
    const a = alteStandardAnordnung()
    expect(a.ansichten.map((v) => [v.art, v.id, v.lineatur])).toEqual([
      ['pdf', 'pdf', undefined],
      ['blatt', '1', 'kariert']
    ])
  })

  it('Anordnung mit Notizbüchern (schema 2): alte Blätter gelten darin nicht mehr, Bücher brauchen eine ULID', () => {
    const text = JSON.stringify({ schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 2 }, { art: 'buch', id: '01JNB8000000000000000B0001', breite: 1 }, { art: 'buch', id: 'kaputt', breite: 1 }, { art: 'blatt', id: '1', breite: 1 }] })
    const a = liesAnordnung(text)
    expect(a).toEqual({ schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 2 }, { art: 'buch', id: '01JNB8000000000000000B0001', breite: 1 }] })
    expect(liesAnordnung(anordnungJson(a))).toEqual(a)
    // Buch schließen: fällt aus der Anordnung, das Buch selbst bleibt als Datei
    expect(schliesseAnsicht(a, '01JNB8000000000000000B0001', true)).toEqual({ schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 2 }] })
    // wieder zeigen und ein zweites dazu
    let b = zeigeBuch(liesAnordnung(undefined), '01JNB8000000000000000B0001')
    b = zeigeBuch(b, '01JNB8000000000000000B0002')
    expect(b.ansichten.map((v) => v.id)).toEqual(['pdf', '01JNB8000000000000000B0001', '01JNB8000000000000000B0002'])
    expect(zeigeBuch(b, '01JNB8000000000000000B0002')).toEqual(b)
  })

  it('das erste Blatt behält seine alte Datei, weitere bekommen ihre ID angehängt', () => {
    expect(pfade.blatt('A1', 3)).toBe('lernen/blaetter/A1/S003.svg')
    expect(pfade.blatt('A1', 3, '1')).toBe('lernen/blaetter/A1/S003.svg')
    expect(pfade.blatt('A1', 3, 'k7x2m9')).toBe('lernen/blaetter/A1/S003-k7x2m9.svg')
    expect(pfade.blattAnordnung('A1')).toBe('lernen/blaetter/A1/anordnung.json')
  })

  it('Rechnung in Kästchen, Graph auf Millimeterpapier: drei Ansichten, frei sortierbar', () => {
    let a = alteStandardAnordnung()
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
    let a = neuesBlatt(alteStandardAnordnung(), 'b2', 'liniert')
    a = schliesseAnsicht(a, '1', true)
    a = verschiebeAnsicht(a, 'b2', -1)
    expect(offeneAnsichten(a).map((v) => v.id)).toEqual(['b2', 'pdf'])
  })

  it('schließen: leeres Blatt verschwindet, beschriebenes wird nur ausgeblendet, die letzte Ansicht bleibt', () => {
    let a = neuesBlatt(alteStandardAnordnung(), 'b2', 'punkte')
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
    let a = setzeLineatur(alteStandardAnordnung(), '1', 'noten')
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

describe('Leeres PDF (Heft)', () => {
  it('ist reines ASCII mit stimmender Querverweistabelle', () => {
    const pdf = leeresPdf(3, 'kariert', 'Mathe Klasse 10 – Übungen')
    expect(/^[\x00-\x7f]*$/.test(pdf)).toBe(true)
    const start = Number(/startxref\n(\d+)/.exec(pdf)![1])
    expect(pdf.slice(start, start + 4)).toBe('xref')
    const eintraege = pdf.slice(start).split('\n').slice(3).filter((z) => / 00000 n $/.test(z))
    eintraege.forEach((z, i) => expect(pdf.slice(Number(z.slice(0, 10))).startsWith(`${i + 1} 0 obj`)).toBe(true))
    const laenge = Number(/\/Length (\d+) >>\nstream\n/.exec(pdf)![1])
    const ab = pdf.indexOf('stream\n') + 7
    expect(pdf.slice(ab + laenge, ab + laenge + 9)).toBe('endstream')
  })

  it('pdf.js liest Seitenzahl, A4-Format und Titel', async () => {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const daten = new TextEncoder().encode(leeresPdf(40, 'millimeter', 'Physik – Heft'))
    const doc = await getDocument({ data: daten, isEvalSupported: false }).promise
    expect(doc.numPages).toBe(40)
    const v = (await doc.getPage(40)).getViewport({ scale: 1 })
    expect(v.height / v.width).toBeCloseTo(A4, 2)
    expect(((await doc.getMetadata()).info as { Title?: string }).Title).toBe('Physik – Heft')
    // 40 Seiten Millimeterpapier teilen sich einen Inhalt: klein genug zum schnellen Sync
    expect(daten.length).toBeLessThan(60_000)
  })
})

describe('Bilder auf Blättern', () => {
  const foto: BlattBild = { id: 'f1', blatt: '1', anhang: '01JFOTO', x: 48, y: 48, b: 700, h: 525 }

  it('Pfad, Lesen und Schreiben, Kaputtes fällt weg', () => {
    expect(pfade.blattBilder('A1', 2)).toBe('lernen/blaetter/A1/S002-bilder.json')
    const aus: BlattBild = { id: 'a1', blatt: 'k7x2m9', anhang: '01JSKRIPT', seite: 3, bereich: { x: 0.1, y: 0.2, b: 0.5, h: 0.25 }, x: 10, y: 600, b: 500, h: 177.3 }
    const text = bilderJson([foto, aus])
    expect(liesBilder(text)).toEqual([foto, aus])
    expect(liesBilder('{"bilder":[{"id":"x","blatt":"1","anhang":"a","x":0,"y":0,"b":0,"h":5},{"id":"y","blatt":"1","anhang":"a","x":0,"y":0,"b":5,"h":5,"seite":2,"bereich":{"x":2,"y":0,"b":1,"h":1}}]}')).toEqual([])
    expect(liesBilder('kaputt')).toEqual([])
  })

  it('neues Bild kommt unter das unterste dieses Blatts, das Blatt wächst bei Bedarf', () => {
    const erstes = platzFuerBild([], '1', 0.75, A4)
    expect(erstes).toMatchObject({ x: 48, y: 48, b: 700, h: 525, format: A4 })
    const zweites = platzFuerBild([foto], '1', 0.75, A4)
    expect(zweites.y).toBe(48 + 525 + 24)
    expect(zweites.format).toBe(A4)
    const drittes = platzFuerBild([foto, { ...foto, id: 'f2', y: 597 }], '1', 0.75, A4)
    expect(drittes.format).toBeCloseTo(2 * A4, 5)
    // Bilder auf anderen Blättern zählen nicht
    expect(platzFuerBild([foto], 'b2', 0.75, A4).y).toBe(48)
  })

  it('hohe Bilder werden schmaler statt länger als eine Seite', () => {
    const p = platzFuerBild([], '1', 3, A4)
    expect(p.h).toBeCloseTo(1000 * A4 - 96, 5)
    expect(p.b).toBeCloseTo(p.h / 3, 5)
  })

  it('verschieben und vergrößern bleibt auf dem Blatt, Seitenverhältnis bleibt', () => {
    const r = rueckeBild(foto, 900, -50, 2000, A4)
    expect(r.b).toBe(1000)
    expect(r.h).toBe(750)
    expect([r.x, r.y]).toEqual([0, 0])
    const u = rueckeBild(foto, 100, 5000, 400, A4)
    expect(u.y + u.h).toBeCloseTo(1000 * A4, 5)
  })
})
