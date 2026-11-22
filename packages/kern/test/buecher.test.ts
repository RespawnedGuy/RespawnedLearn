import { describe, expect, it } from 'vitest'
import { buchIdAusBlatt, buchSeiteJson, buchSeitenNummern, hebeBlaetterAn, liesAnordnung, liesBuchSeite, liesTinte, mussAnheben, pfade, tinteSvg, zerlege, felder, type Strich } from '../src'

const A = '01JBEXAMP000000000SKRPT001'
const strich: Strich = { farbe: 'alltag', breite: 2.5, punkte: [[10, 10, 0.5], [40, 50, 0.5]], d: 'M10 10L40 50Z' }
const mitTinte = tinteSvg([strich], 1414)
const ohneTinte = tinteSvg([], 1414)
const lang = tinteSvg([strich], 2828) // „Platz nach unten“

function skript(dateien: Record<string, string>, anordnung: string | null = null) {
  return { anhangId: A, titel: 'Skript ET1', erstellt: '2026-10-01T10:00:00+02:00', geaendert: '2026-10-02T10:00:00+02:00', modul: '01JBEXAMP00000000MODUL0001', anordnung, dateien: new Map(Object.entries(dateien).map(([k, v]) => [`lernen/blaetter/${A}/${k}`, v])) }
}

describe('Notizbuch-Seiten (Vertrag Lernen 1.3)', () => {
  it('liest Bilder und Verweise robust und behält Unbekanntes', () => {
    const s = liesBuchSeite(JSON.stringify({ neu: 1, bilder: [{ id: 'b1', anhang: 'F', x: 1, y: 2, b: 3, h: 4 }, { id: 'kaputt' }], verweise: [{ id: 'v1', y: 96, anhang: A, seite: 12, am: 'x' }, { id: 'v2', y: 380, anhang: A, seite: 12, marke: 'a7k2c9' }, { id: 'v3', y: 1, anhang: A, seite: 0 }] }))
    expect(s.bilder).toEqual([{ id: 'b1', anhang: 'F', x: 1, y: 2, b: 3, h: 4 }])
    expect(s.verweise.map((v) => v.id)).toEqual(['v1', 'v2'])
    expect(s.verweise[1].marke).toBe('a7k2c9')
    expect(JSON.parse(buchSeiteJson(s)).neu).toBe(1)
    expect(liesBuchSeite(buchSeiteJson(s))).toEqual(s)
    expect(liesBuchSeite('{kaputt')).toEqual({ bilder: [], verweise: [], rest: {} })
  })

  it('Textfelder (Lernen 1.14): rund lesen und schreiben, leere und kaputte fallen weg', () => {
    const roh = { bilder: [], verweise: [], texte: [{ id: 't1', x: 80, y: 640, b: 600, text: 'Gilt nur für $I$ = konstant', am: '2026-11-22' }, { id: 'leer', x: 0, y: 0, b: 300, text: '  ' }, { id: 'kaputt', x: 'a' }] }
    const s = liesBuchSeite(JSON.stringify(roh))
    expect(s.texte).toEqual([{ id: 't1', x: 80, y: 640, b: 600, text: 'Gilt nur für $I$ = konstant', am: '2026-11-22' }])
    expect(liesBuchSeite(buchSeiteJson(s))).toEqual(s)
    // ohne Textfelder schreibt die App kein Feld `texte`
    expect(buchSeiteJson({ ...s, texte: [] })).not.toContain('texte')
  })

  it('eine Seite ohne Textfelder bleibt beim Lesen und Schreiben byte-gleich', () => {
    const alt = buchSeiteJson(liesBuchSeite(JSON.stringify({ bilder: [{ id: 'b1', anhang: 'F', x: 1, y: 2, b: 3, h: 4 }], verweise: [{ id: 'v1', y: 96, anhang: A, seite: 12 }] })))
    expect(buchSeiteJson(liesBuchSeite(alt))).toBe(alt)
    expect(liesBuchSeite(alt).texte).toBeUndefined()
  })

  it('ein unlesbares Feld texte bleibt unverändert erhalten', () => {
    const s = liesBuchSeite(JSON.stringify({ bilder: [], verweise: [], texte: 'von einer neueren App' }))
    expect(s.texte).toBeUndefined()
    expect(JSON.parse(buchSeiteJson(s)).texte).toBe('von einer neueren App')
  })

  it('Seitennummern aus den Dateinamen', () => {
    const id = '01JNB8000000000000000B0001'
    expect(buchSeitenNummern([pfade.buchTinte(id, 2), pfade.buchSeite(id, 2), pfade.buchSeite(id, 1), pfade.buchTinte('ANDERES', 3), pfade.buch(id)], id)).toEqual([1, 2])
  })
})

describe('Anheben der Zeichenblätter (Lernen 1.2 → 1.3)', () => {
  it('neues Skript ohne alte Dateien: nichts zu tun, nichts zu schreiben', () => {
    expect(hebeBlaetterAn(skript({}))).toBeNull()
    expect(hebeBlaetterAn(skript({}, JSON.stringify({ schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 3 }] })))).toBeNull()
  })

  it('nur Seiten mit Inhalt werden Buchseiten, in Reihenfolge, Tinte byte-genau, je Seite ein Verweis', () => {
    const a = hebeBlaetterAn(skript({ 'S001.svg': ohneTinte, 'S003.svg': mitTinte, 'S012.svg': lang, 'S007-bilder.json': JSON.stringify({ bilder: [{ id: 'f1', blatt: '1', anhang: 'FOTO', x: 48, y: 48, b: 700, h: 500 }] }) }))!
    expect(a.buecher).toHaveLength(1)
    const id = a.buecher[0].id
    const datei = new Map(a.schreiben.map((x) => [x.pfad, x.text]))
    expect(buchSeitenNummern(datei.keys(), id)).toEqual([1, 2, 3])
    expect(datei.get(pfade.buchTinte(id, 1))).toBe(mitTinte) // S. 3
    expect(liesTinte(datei.get(pfade.buchTinte(id, 2))!)).toEqual([]) // S. 7: nur ein Bild, leere A4-Seite
    expect(datei.get(pfade.buchTinte(id, 3))).toBe(lang) // S. 12, verlängert bleibt verlängert
    const s2 = liesBuchSeite(datei.get(pfade.buchSeite(id, 2)))
    expect(s2.bilder).toEqual([{ id: 'f1', anhang: 'FOTO', x: 48, y: 48, b: 700, h: 500 }])
    expect([1, 2, 3].map((n) => liesBuchSeite(datei.get(pfade.buchSeite(id, n))).verweise)).toEqual([
      [{ id: 's3', y: 0, anhang: A, seite: 3 }],
      [{ id: 's7', y: 0, anhang: A, seite: 7 }],
      [{ id: 's12', y: 0, anhang: A, seite: 12 }]
    ])
    const kopf = felder(zerlege(datei.get(pfade.buch(id))!).kopf)
    expect(kopf).toMatchObject({ id, typ: 'notizbuch', titel: 'Skript ET1', lineatur: 'kariert', modul: '[[01JBEXAMP00000000MODUL0001]]', erstellt: '2026-10-01T10:00:00+02:00' })
    // ohne Datei galt Skript + Blatt 1: daraus wird Skript + Buch
    expect(liesAnordnung(a.anordnung)).toEqual({ schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 3 }, { art: 'buch', id, breite: 2 }] })
  })

  it('mehrere Blätter: je ein Buch mit Lineatur; leere Blätter fallen weg; ausgeblendet bleibt ausgeblendet', () => {
    const anordnung = JSON.stringify({ ansichten: [{ art: 'pdf', id: 'pdf', breite: 2 }, { art: 'blatt', id: '1', lineatur: 'kariert', breite: 1.5 }, { art: 'blatt', id: 'mm7', lineatur: 'millimeter', breite: 1, zu: true }, { art: 'blatt', id: 'leer2', lineatur: 'liniert', breite: 1 }] })
    const a = hebeBlaetterAn(skript({ 'S002.svg': mitTinte, 'S002-mm7.svg': mitTinte, 'S005-leer2.svg': ohneTinte }, anordnung))!
    expect(a.buecher.map((b) => b.blatt)).toEqual(['1', 'mm7'])
    const [eins, mm] = a.buecher.map((b) => b.id)
    expect(felder(zerlege(a.schreiben.find((x) => x.pfad === pfade.buch(mm))!.text).kopf)).toMatchObject({ titel: 'Skript ET1 – Millimeter', lineatur: 'millimeter' })
    expect(liesAnordnung(a.anordnung).ansichten).toEqual([
      { art: 'pdf', id: 'pdf', breite: 2 },
      { art: 'buch', id: eins, breite: 1.5 },
      { art: 'buch', id: mm, breite: 1, zu: true }
    ])
  })

  it('Heft: Skript war ausgeblendet; ohne beschriebenes Blatt wird es wieder gezeigt', () => {
    const heft = JSON.stringify({ ansichten: [{ art: 'pdf', id: 'pdf', breite: 3, zu: true }, { art: 'blatt', id: '1', lineatur: 'liniert', breite: 2 }] })
    const mit = hebeBlaetterAn(skript({ 'S001.svg': mitTinte }, heft))!
    expect(liesAnordnung(mit.anordnung).ansichten.map((v) => [v.art, !!v.zu])).toEqual([['pdf', true], ['buch', false]])
    const ohne = hebeBlaetterAn(skript({}, heft))!
    expect(ohne.schreiben).toEqual([])
    expect(liesAnordnung(ohne.anordnung).ansichten).toEqual([{ art: 'pdf', id: 'pdf', breite: 3 }])
  })

  it('deterministisch: zweimal (zwei Geräte) angehoben ergibt dieselben Bytes; IDs sind gültige ULIDs', () => {
    const d = { 'S002.svg': mitTinte, 'S004-x9.svg': mitTinte }
    expect(hebeBlaetterAn(skript(d))).toEqual(hebeBlaetterAn(skript(d)))
    const id = buchIdAusBlatt(A, '1')
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(id.slice(0, 10)).toBe(A.slice(0, 10))
    expect(buchIdAusBlatt(A, 'x9')).not.toBe(id)
    expect(buchIdAusBlatt('01JBEXAMP000000000SKRPT002', '1')).not.toBe(id)
  })

  it('alte Dateien werden nie überschrieben: alles Geschriebene liegt unter lernen/buecher/ oder ist die Anordnung', () => {
    const a = hebeBlaetterAn(skript({ 'S002.svg': mitTinte }))!
    expect(a.schreiben.every((x) => x.pfad.startsWith('lernen/buecher/'))).toBe(true)
  })

  it('Blatt nur als Datei (nicht in der Anordnung): kommt als ausgeblendetes Buch dazu', () => {
    const anordnung = JSON.stringify({ ansichten: [{ art: 'pdf', id: 'pdf', breite: 3 }, { art: 'blatt', id: '1', lineatur: 'kariert', breite: 2 }] })
    const a = hebeBlaetterAn(skript({ 'S002-q4.svg': mitTinte }, anordnung))!
    expect(liesAnordnung(a.anordnung).ansichten.map((v) => [v.art, !!v.zu])).toEqual([['pdf', false], ['buch', true]])
  })

  it('mussAnheben: alte Anordnung oder alte Dateien', () => {
    expect(mussAnheben(null, new Map())).toBe(false)
    expect(mussAnheben('{"ansichten":[]}', new Map())).toBe(true)
    expect(mussAnheben(null, new Map([[`lernen/blaetter/${A}/S001.svg`, ohneTinte]]))).toBe(true)
  })
})
