import { describe, expect, it } from 'vitest'
import { Bestand } from '../src/bestand'
import {
  LEERLAUF_MS,
  MIN_TEMPO_SEITEN,
  SCHREIBEN_MS,
  alleLernzeiten,
  eingabe,
  liesLernzeit,
  lernzeitZeile,
  schnitt,
  stundenText,
  tempo,
  uhr,
  zeitIn,
  type LernAbschnitt,
  type LernKontext,
  type Messung
} from '../src/lernzeit'
import type { Modul } from '../src/module'

const T0 = Date.parse('2026-11-14T08:00:00Z')
const MIN = 60_000
const skript: LernKontext = { ziel: 'M1', art: 'sammeln', quelle: 'P1', seite: 12 }

/** Spielt Eingaben zu Minuten ab T0 ab und sammelt die fertigen Abschnitte */
function abspielen(schritte: [number, LernKontext | null][]): { m: Messung | null; fertig: LernAbschnitt[] } {
  let m: Messung | null = null
  const fertig: LernAbschnitt[] = []
  for (const [min, k] of schritte) {
    const s = eingabe(m, k, T0 + min * MIN)
    m = s.messung
    fertig.push(...s.fertig)
  }
  return { m, fertig }
}

describe('Lernzeit messen', () => {
  it('zählt bis zur letzten Eingabe, Leerlauf beendet den Abschnitt', () => {
    const { m, fertig } = abspielen([
      [0, skript],
      [3, { ...skript, seite: 13 }],
      [6, { ...skript, seite: 15 }],
      [6 + LEERLAUF_MS / MIN + 1, skript]
    ])
    expect(fertig).toEqual([{ ziel: 'M1', art: 'sammeln', am: '2026-11-14T08:00:00.000Z', bis: '2026-11-14T08:06:00.000Z', quelle: 'P1', seiten: [12, 15] }])
    expect(m?.von).toBe(T0 + 12 * MIN)
  })

  it('anderer Kontext oder verdeckte App beendet den Abschnitt sofort', () => {
    const { m, fertig } = abspielen([
      [0, skript],
      [2, skript],
      [3, { ziel: 'M1', art: 'mitschrift' }],
      [5, { ziel: 'M1', art: 'mitschrift' }],
      [6, null]
    ])
    expect(fertig.map((a) => [a.art, a.am.slice(11, 16), a.bis.slice(11, 16)])).toEqual([
      ['sammeln', '08:00', '08:02'],
      ['mitschrift', '08:03', '08:05']
    ])
    expect(fertig[1].seiten).toBeUndefined()
    expect(m).toBeNull()
  })

  it('ein kurzer Blick (unter 30 s) wird nicht gespeichert', () => {
    const { fertig } = abspielen([
      [0, skript],
      [0.3, skript],
      [1, null]
    ])
    expect(fertig).toEqual([])
  })

  it('die Uhr schreibt lange Abschnitte zwischendurch und misst nahtlos weiter', () => {
    let { m } = abspielen([[0, skript], ...Array.from({ length: 6 }, (_, i): [number, LernKontext] => [i + 1, { ...skript, seite: 12 + i }])])
    const s = uhr(m, T0 + 6 * MIN)
    expect(SCHREIBEN_MS).toBe(5 * MIN)
    expect(s.fertig[0].bis).toBe('2026-11-14T08:06:00.000Z')
    expect(s.messung?.von).toBe(T0 + 6 * MIN)
    expect(s.messung?.seiteVon).toBe(17)
    m = s.messung
    // nach Leerlauf endet er bei der letzten Eingabe
    const e = uhr(eingabe(m, skript, T0 + 8 * MIN).messung, T0 + 20 * MIN)
    expect(e.messung).toBeNull()
    expect(e.fertig[0].am.slice(11, 16)).toBe('08:06')
    expect(e.fertig[0].bis.slice(11, 16)).toBe('08:08')
  })
})

describe('Lernzeit lesen und auswerten', () => {
  const a = (ziel: string, von: number, bis: number, extra: Partial<LernAbschnitt> = {}): LernAbschnitt => ({
    ziel,
    art: 'sammeln',
    am: new Date(T0 + von * MIN).toISOString(),
    bis: new Date(T0 + bis * MIN).toISOString(),
    ...extra
  })

  it('Zeile hin und zurück, kaputte und unvollständige Zeilen werden übergangen', () => {
    const z = lernzeitZeile(a('M1', 0, 10, { quelle: 'P1', seiten: [1, 4] }))
    expect(liesLernzeit(z + '{"ziel":"M1","art":"sammeln","am":"x"\n{kaputt\n{"ziel":"M1","art":"tanzen","am":"2026-11-14T08:00:00Z","bis":"2026-11-14T09:00:00Z"}\n')).toEqual([
      a('M1', 0, 10, { quelle: 'P1', seiten: [1, 4] })
    ])
  })

  it('zwei Geräte und ein Monatswechsel werden zusammengezählt, doppelte Zeilen einmal', () => {
    const z1 = lernzeitZeile(a('M1', 0, 30))
    const z2 = lernzeitZeile(a('P1', 60, 90))
    const b = new Bestand(
      new Map([
        ['lernen/zeit/2026-10.pc.jsonl', z1],
        ['lernen/zeit/2026-11.handy.jsonl', z2],
        ['lernen/zeit/2026-11.handy.sync-conflict-20261114-090000-ABCDEFG.jsonl', z2],
        ['reviews/2026-11.pc.jsonl', z1]
      ])
    )
    const alle = alleLernzeiten(b)
    expect(alle).toHaveLength(2)
    // Zeit am PDF zählt zum Modul, auch wenn es damals noch kein Modul war
    expect(zeitIn(alle, { id: 'M1', quellen: ['P1'] })).toBe(60 * MIN)
    expect(zeitIn(alle, { id: 'M2', quellen: [] })).toBe(0)
  })

  it('Tempo erst ab genug Seiten, Sprünge über viele Seiten zählen nicht', () => {
    const wenige = [a('M1', 0, 50, { quelle: 'P1', seiten: [1, 10] })]
    expect(tempo(wenige)).toBeNull()
    const genug = [...wenige, a('M1', 60, 110, { quelle: 'P1', seiten: [11, MIN_TEMPO_SEITEN] }), a('M1', 120, 130, { quelle: 'P1', seiten: [20, 200] })]
    expect(tempo(genug)).toEqual({ minutenJeSeite: 5, seiten: 20 })
  })

  it('Schnitt erst ab zwei abgeschlossenen Modulen, Stunden je ECTS nur aus Modulen mit ECTS', () => {
    const m = (id: string, abgeschlossen: boolean, ects: number | null): Modul => ({
      id,
      titel: id,
      pfad: '',
      ziel: '',
      quellen: [],
      favorit: false,
      abgeschlossen,
      ects,
      stunden: null,
      termin: null,
      stundenProWoche: null,
      schwer: [],
      uebungen: true
    })
    const zeiten = [a('A', 0, 600), a('B', 0, 1200), a('C', 0, 60)]
    expect(schnitt(zeiten, [m('A', true, 5), m('C', false, 5)])).toBeNull()
    expect(schnitt(zeiten, [m('A', true, 5), m('B', true, 5), m('C', false, 5)])).toEqual({ module: 2, stundenJeModul: 15, stundenJeEcts: 3 })
    expect(schnitt(zeiten, [m('A', true, 5), m('B', true, null)])?.stundenJeEcts).toBeNull()
  })

  it('Stunden als Text', () => {
    expect(stundenText(25 * MIN)).toBe('25 min')
    expect(stundenText(750 * MIN)).toBe('12,5 h')
  })
})
