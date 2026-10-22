import { describe, expect, it } from 'vitest'
import { Bestand } from '../src/bestand'
import { fragenStand, hilfeStufen, liesKapitelFragen, liesVorfragen, loesungsweg, merkeFrage, offeneFragen } from '../src/fragen'
import { lesestand } from '../src/module'

const kapitel = (anhang: string, von: number, bis: number, seiten: number[]) =>
  JSON.stringify({ anhang, kapitel: `Kapitel ${von}`, von, bis, status: 'fertig', fragen: seiten.map((s, i) => ({ id: `${s}-${i + 1}`, art: i % 2 ? 'sokratisch' : 'verstaendnis', frage: `F${s}`, antwort: 'A', seite: s })) })

describe('Fragen zum Kapitel', () => {
  const texte = new Map([
    ['lernen/fragen/A/S012.json', kapitel('A', 12, 19, [12, 14, 18])],
    ['lernen/fragen/A/S003.json', kapitel('A', 3, 11, [4])],
    ['lernen/fragen/B/S001.json', kapitel('B', 1, 5, [2])],
    ['lernen/fragen/B/S001.sync-conflict-x.json', kapitel('B', 1, 5, [2])],
    ['lernen/stand/pc-a.json', JSON.stringify({ A: { seite: 14, am: '2026-10-21T10:00:00Z' }, B: { seite: 9, am: '2026-10-20T10:00:00Z' } })],
    ['lernen/fragen-stand/pc-a.json', merkeFrage('', 'A/3/4-1', { am: '2026-10-21T11:00:00Z', wie: 'erledigt' })]
  ])
  const b = new Bestand(texte)

  it('zeigt nur Fragen zu schon gelesenem Stoff, jüngstes Buch zuerst, ohne Erledigtes', () => {
    expect(offeneFragen(b, lesestand(b)).map((q) => q.schluessel)).toEqual(['A/12/12-1', 'A/12/14-2', 'B/1/2-1'])
  })

  it('führt den Stand der Geräte zusammen', () => {
    expect(fragenStand(b)['A/3/4-1'].wie).toBe('erledigt')
  })

  it('liest Rechenaufgaben und stuft die Hilfe: Tipps, dann je Schritt Teilziel und Rechnung', () => {
    const k = liesKapitelFragen('p', JSON.stringify({ anhang: 'A', von: 1, fragen: [{ id: '1-r1', art: 'rechnen', frage: 'I?', antwort: '2 mA', seite: 1, tipps: ['Ohm', 3], schritte: [{ ziel: 'R', rechnung: '$R$', ergebnis: '1 k' }, null] }, { id: 'x', art: 'quiz', frage: 'Q' }] }))!
    expect(k.fragen).toHaveLength(1)
    const q = k.fragen[0]
    expect(hilfeStufen(q).map((h) => `${h.art}${h.nr}`)).toEqual(['tipp1', 'ziel1', 'rechnung1'])
    expect(loesungsweg({ ...q, wege: 'Auch direkt.' })).toBe('Ergebnis: 2 mA\n\nEin Lösungsweg:\n- R: $R$ → 1 k\n\nAndere Wege: Auch direkt.')
  })

  it('liest Vorfragen und übergeht Kaputtes', () => {
    expect(liesVorfragen('{"datum":"2026-10-22","fragen":[{"id":"1","anhang":"A","seite":3,"frage":"F","antwort":"A"},{}]}')?.fragen).toHaveLength(1)
    expect(liesVorfragen('kaputt')).toBeNull()
    expect(liesVorfragen(undefined)).toBeNull()
  })
})
