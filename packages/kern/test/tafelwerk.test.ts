// Tafelwerk (Vertrag Lernen 1.13): Tabs erkennen, was schon drin ist, Nein von mehreren Geräten, was angeboten wird
import { describe, expect, it } from 'vitest'
import {
  VERTRAG,
  alleBausteine,
  automatisch,
  buchDokument,
  buchSeiteJson,
  imTafelwerk,
  istTafel,
  kopieVonAusschnitt,
  legeEin,
  liesBuchSeite,
  liesNein,
  markenZeile,
  neinZeile,
  neuFuerTafelwerk,
  ortAmEnde,
  pfade,
  tabVorschlag,
  tafeln,
  tauscheBuch,
  type Anordnung,
  type Kopie
} from '../src'
import { felder, zerlege } from '../src/frontmatter'

const SKRIPT = '01JSKRIPT0000000000000000A'
const BUCH = '01JBVCH00000000000000000AB'
const TAB1 = '01JTAFEL000000000000000001'
const TAB2 = '01JTAFEL000000000000000002'

const zeile = (seite: number, text: string, id: string, datum = '2026-11-14') => markenZeile({ id, seite, text, bereich: { x: 0.1, y: 0.2, b: 0.5, h: 0.1 }, datum, farbe: null })
const doc = (id: string, felder: Record<string, string>, titel = id) => ({ id, typ: 'notizbuch', titel, felder })

const KOPIE: Kopie = { anhang: SKRIPT, seite: 12, bereich: { x: 0.1, y: 0.2, b: 0.5, h: 0.1 }, marke: 'a7k2c9', verhaeltnis: 0.3 }

describe('Tabs des Tafelwerks', () => {
  it('der Vertrag steht auf 1.13', () => {
    expect(VERTRAG).toBe('1.13')
  })

  it('ein Tab ist ein Notizbuch mit art: tafelwerk; ohne das Feld ein gewöhnliches Buch', () => {
    const text = buchDokument({ id: TAB1, titel: 'Analysis', lineatur: 'leer', art: 'tafelwerk', erstellt: '2026-11-21T10:00:00Z' })
    const f = felder(zerlege(text).kopf)
    expect(f.art).toBe('tafelwerk')
    expect(istTafel({ typ: 'notizbuch', felder: f })).toBe(true)
    expect(istTafel({ typ: 'notizbuch', felder: { titel: 'X' } })).toBe(false)
    expect(istTafel({ typ: 'modul', felder: { art: 'tafelwerk' } })).toBe(false)
    expect(buchDokument({ id: BUCH, titel: 'B', lineatur: 'kariert', erstellt: '2026-11-21' })).not.toContain('art:')
  })

  it('Reihenfolge nach Anlegen, weggelegte Tabs und Bücher fehlen', () => {
    const t = tafeln([
      doc(TAB2, { art: 'tafelwerk', erstellt: '2026-11-21T11:00:00Z' }),
      doc(BUCH, { erstellt: '2026-11-20' }),
      doc('01JTAFEL000000000000000003', { art: 'tafelwerk', erstellt: '2026-11-19', status: 'archiviert' }),
      doc(TAB1, { art: 'tafelwerk', erstellt: '2026-11-21T10:00:00Z' })
    ])
    expect(t.map((x) => x.id)).toEqual([TAB1, TAB2])
  })

  it('im selben Platz ein anderer Tab: Breite und Stelle bleiben', () => {
    const a: Anordnung = { schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 2 }, { art: 'buch', id: TAB1, breite: 1.5 }, { art: 'buch', id: BUCH, breite: 1 }] }
    expect(tauscheBuch(a, TAB1, TAB2).ansichten).toEqual([{ art: 'pdf', id: 'pdf', breite: 2 }, { art: 'buch', id: TAB2, breite: 1.5 }, { art: 'buch', id: BUCH, breite: 1 }])
    // steht der andere schon da, verschwindet der alte
    expect(tauscheBuch(a, TAB1, BUCH).ansichten.map((v) => v.id)).toEqual(['pdf', BUCH])
    expect(tauscheBuch(a, 'gibtsnicht', TAB2)).toBe(a)
  })
})

describe('Was liegt schon im Tafelwerk', () => {
  const seite = (anhang: string, marke: string) => buchSeiteJson(legeEin(liesBuchSeite(''), { ...KOPIE, anhang, marke }, { x: 50, y: 50 }, Math.SQRT2, { bild: `b${marke}`, verweis: `v${marke}` }, '2026-11-21').seite)
  const texte = new Map([
    [pfade.buchSeite(TAB1, 1), seite(SKRIPT, 'a7k2c9')],
    [pfade.buchSeite(TAB2, 3), seite(SKRIPT, 'a7k2c9')],
    [pfade.buchSeite(BUCH, 1), seite(SKRIPT, 'zz1111')]
  ])

  it('✦-Verweise der Tabs zählen, die gewöhnlicher Bücher nicht', () => {
    const drin = imTafelwerk(texte, new Set([TAB1, TAB2]))
    expect([...drin]).toEqual([[`${SKRIPT}#a7k2c9`, [TAB1, TAB2]]])
  })

  it('Seitenverweise ohne Marke zählen nicht', () => {
    const t = new Map([[pfade.buchSeite(TAB1, 1), JSON.stringify({ bilder: [], verweise: [{ id: 'v1', y: 10, anhang: SKRIPT, seite: 3 }] })]])
    expect(imTafelwerk(t, new Set([TAB1])).size).toBe(0)
  })
})

describe('Nein je Gerät', () => {
  it('Vereinigung aller Geräte, beschädigte Zeilen übergangen', () => {
    const texte = new Map([
      [pfade.tafelNein('pc-ab12'), neinZeile(SKRIPT, 'a7k2c9', '2026-11-21T10:00:00Z')],
      [pfade.tafelNein('android-cd34'), neinZeile(BUCH, 'b7x2q1', '2026-11-21T10:01:00Z') + '{"am":"2026-11-21","anh'],
      ['lernen/zeit/2026-11.pc-ab12.jsonl', neinZeile(SKRIPT, 'falsch', '2026-11-21')]
    ])
    expect([...liesNein(texte)].sort()).toEqual([`${BUCH}#b7x2q1`, `${SKRIPT}#a7k2c9`])
  })

  it('gleichzeitige Antworten zweier Geräte in derselben Datei werden ohne Menschen vereinigt', () => {
    const a = neinZeile(SKRIPT, 'a1', '2026-11-21T10:00:00Z')
    const b = a + neinZeile(SKRIPT, 'b2', '2026-11-21T10:05:00Z')
    const c = a + neinZeile(SKRIPT, 'c3', '2026-11-21T10:03:00Z')
    expect(automatisch(pfade.tafelNein('pc-ab12'), b, c)).toEqual({ art: 'zusammen', text: a + neinZeile(SKRIPT, 'c3', '2026-11-21T10:03:00Z') + neinZeile(SKRIPT, 'b2', '2026-11-21T10:05:00Z') })
  })
})

describe('Neu fürs Tafelwerk', () => {
  const texte = new Map([
    [
      pfade.marken('lernen', SKRIPT),
      [
        zeile(1, 'Potenzregel #integral', 'a1', '2026-11-14'),
        zeile(2, 'Kettenregel', 'b2', '2026-11-20'),
        zeile(3, '', 'c3'),
        zeile(4, 'Alt #archiv', 'd4'),
        zeile(5, 'Schon drin', 'e5'),
        zeile(6, 'Abgelehnt', 'f6')
      ].join('\n')
    ],
    [pfade.marken('lernen', TAB1), zeile(1, 'Im Tafelwerk markiert', 'g7')],
    [pfade.marken('lernen', BUCH), zeile(2, 'Eigene Herleitung', 'h8', '2026-11-21')],
    ['lernen/markierungen/01JNOTIZ000000000000000000.md', '- ^k3m9 · Maschenregel %%rt 2026-11-21%% ^i9']
  ])
  const alle = alleBausteine(texte)

  it('benannte Bausteine aus Skript und Buch, neueste zuerst; offen, weggelegt, drin, abgelehnt, im Tab markiert und Mitschrift fehlen', () => {
    const drin = new Map([[`${SKRIPT}#e5`, [TAB1]]])
    const nein = new Set([`${SKRIPT}#f6`])
    const neu = neuFuerTafelwerk(alle, drin, nein, new Set([TAB1]))
    expect(neu.map((b) => b.marke.id)).toEqual(['h8', 'b2', 'a1'])
  })

  it('Vorschlag: Tab mit passendem Schlagwort zuerst, dann Tab mit Bausteinen derselben Quelle', () => {
    const tabs = [
      { id: TAB1, titel: 'Mechanik' },
      { id: TAB2, titel: 'Integral' },
      { id: 'T3', titel: 'Elektrotechnik' }
    ]
    const drin = new Map([[`${SKRIPT}#x1`, ['T3']], [`${SKRIPT}#x2`, ['T3']], [`${BUCH}#y1`, [TAB1]]])
    expect(tabVorschlag({ anhang: SKRIPT, name: 'Potenzregel', schlagworte: ['integral'] }, tabs, drin)).toEqual([TAB2, 'T3', TAB1])
    expect(tabVorschlag({ anhang: SKRIPT, name: 'Ohmsches Gesetz', schlagworte: [] }, tabs, drin)).toEqual(['T3', TAB1, TAB2])
    // Name des Tabs als ganzes Wort im Namen des Bausteins
    expect(tabVorschlag({ anhang: 'X', name: 'Mechanik Grundformel', schlagworte: [] }, tabs, new Map())[0]).toBe(TAB1)
    expect(tabVorschlag({ anhang: 'X', name: 'Ohne', schlagworte: [] }, tabs, new Map())).toEqual([TAB1, TAB2, 'T3'])
  })
})

describe('Kopieren und Einfügen im Tafelwerk', () => {
  it('die Kopie eines eingefügten Ausschnitts zeigt aufs Original', () => {
    const { seite } = legeEin(liesBuchSeite(''), KOPIE, { x: 100, y: 300 }, Math.SQRT2, { bild: 'bild1', verweis: 'v1' }, '2026-11-21')
    const k = kopieVonAusschnitt(seite, 'bild1')
    expect(k).toEqual({ ...KOPIE, verhaeltnis: expect.closeTo(0.3, 5) })
  })

  it('ein Bild ohne ✦-Marke (Foto) lässt sich so nicht kopieren', () => {
    const s = liesBuchSeite(JSON.stringify({ bilder: [{ id: 'f1', anhang: '01JFOTO', x: 0, y: 0, b: 500, h: 300 }], verweise: [] }))
    expect(kopieVonAusschnitt(s, 'f1')).toBeNull()
    expect(kopieVonAusschnitt(s, 'gibtsnicht')).toBeNull()
  })

  it('ohne angetippte Stelle unter das Unterste der Seite, sonst null für die nächste Seite', () => {
    const o = ortAmEnde([{ y: 100, h: 200 }], [{ oben: 0, unten: 500 }], KOPIE, Math.SQRT2)
    expect(o).not.toBeNull()
    expect(o!.y).toBeGreaterThan(500)
    expect(o!.b).toBe(500)
    expect(ortAmEnde([{ y: 1300, h: 100 }], [], KOPIE, Math.SQRT2)).toBeNull()
  })
})
