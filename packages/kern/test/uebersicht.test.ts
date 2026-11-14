import { describe, expect, it } from 'vitest'
import { rechnePlan } from '../src/lernplan'
import { gelesenImPlan, geplantJeWoche, modulStand, ordneUebersicht, wochenAnfang, zeitSeit, type ModulStand } from '../src/uebersicht'
import type { LernAbschnitt } from '../src/lernzeit'

// 40 Seiten in zwei Kapiteln, 5 min je Seite → Pakete zu 5 Seiten, 200 min gesamt
const plan = rechnePlan({
  teile: [{ anhang: 'P1', titel: 'ET', seiten: 40, kapitel: [{ titel: 'A', seite: 1, ebene: 1 }, { titel: 'B', seite: 21, ebene: 1 }] }],
  minutenJeSeite: 5
})
const stand = (seite: number) => ({ P1: { seite, am: '2026-11-14T08:00:00Z' } })
const modul = (termin: string | null, stundenProWoche: number | null = null) => ({ id: 'M', titel: 'ET', termin, stundenProWoche })
const heute = '2026-11-14'

describe('Stand eines Moduls', () => {
  it('gelesene Seiten sind alles vor der aktuellen Seite, über Kapitelgrenzen', () => {
    expect(gelesenImPlan(plan, {})).toBe(0)
    expect(gelesenImPlan(plan, stand(1))).toBe(0)
    expect(gelesenImPlan(plan, stand(26))).toBe(25)
    expect(gelesenImPlan(plan, stand(99))).toBe(40)
  })
  it('nächstes Paket ist das erste unerledigte', () => {
    const s = modulStand({ modul: modul(null), plan, stand: stand(11), heute })
    expect(s.naechstes).toMatchObject({ von: 11, bis: 15 })
    expect(s.restMinuten).toBe(150)
    expect(s.lage).toBe('ohne')
  })
  it('Lage: im Plan, hinten, nur noch Wiederholung, fertig, vorbei', () => {
    // Termin in 5 Wochen → 4 Wochen bis zur Wiederholung, Rest 200 min = 3,3 h
    expect(modulStand({ modul: modul('2026-12-19', 1), plan, stand: {}, heute }).lage).toBe('plan')
    expect(modulStand({ modul: modul('2026-12-19', 0.5), plan, stand: {}, heute }).lage).toBe('hinten')
    expect(modulStand({ modul: modul('2026-12-19'), plan, stand: {}, heute }).lage).toBe('plan')
    expect(modulStand({ modul: modul('2026-11-18'), plan, stand: {}, heute }).lage).toBe('hinten')
    expect(modulStand({ modul: modul('2026-12-19', 0.5), plan, stand: stand(41), heute }).lage).toBe('fertig')
    expect(modulStand({ modul: modul('2026-11-13'), plan, stand: {}, heute }).lage).toBe('vorbei')
  })
  it('ohne Plan (Seitenzahl unbekannt) kein Paket und nicht fertig', () => {
    const s = modulStand({ modul: modul(null), plan: [], stand: {}, heute })
    expect(s.naechstes).toBeNull()
    expect(s.lage).toBe('ohne')
  })
})

describe('Reihenfolge', () => {
  const s = (titel: string, lage: ModulStand['lage'], termin: string | null = null, zuletzt: string | null = null) =>
    ({ id: titel, titel, lage, termin, zuletzt }) as ModulStand
  it('hinten zuerst, dann nächster Termin, dann zuletzt gelesen, Fertiges und Vergangenes unten', () => {
    const liste = [
      s('vorbei', 'vorbei', '2026-11-01'),
      s('ohne alt', 'ohne', null, '2026-11-01T10:00:00Z'),
      s('plan spät', 'plan', '2027-02-01'),
      s('fertig', 'fertig'),
      s('ohne neu', 'ohne', null, '2026-11-13T10:00:00Z'),
      s('plan früh', 'plan', '2026-12-19'),
      s('hinten', 'hinten', '2027-03-01')
    ]
    expect(ordneUebersicht(liste).map((x) => x.titel)).toEqual(['hinten', 'plan früh', 'plan spät', 'ohne neu', 'ohne alt', 'fertig', 'vorbei'])
  })
})

describe('Woche', () => {
  it('Montag nach ISO 8601, auch über Monats- und Jahresgrenzen', () => {
    expect(wochenAnfang('2026-11-14')).toBe('2026-11-09') // Samstag
    expect(wochenAnfang('2026-11-15')).toBe('2026-11-09') // Sonntag gehört zur Woche davor
    expect(wochenAnfang('2026-11-16')).toBe('2026-11-16') // Montag
    expect(wochenAnfang('2027-01-01')).toBe('2026-12-28')
  })
  it('Zeit ab Wochenbeginn, gesamt und je Modul', () => {
    const a = (ziel: string, am: string, min: number): LernAbschnitt => ({ ziel, art: 'sammeln', am, bis: new Date(Date.parse(am) + min * 60_000).toISOString() })
    const zeiten = [a('M', '2026-11-08T20:00:00Z', 30), a('M', '2026-11-10T08:00:00Z', 25), a('P1', '2026-11-12T08:00:00Z', 20), a('X', '2026-11-13T08:00:00Z', 10)]
    const ab = Date.parse('2026-11-09T00:00:00Z')
    expect(zeitSeit(zeiten, ab)).toBe(55 * 60_000)
    expect(zeitSeit(zeiten, ab, { id: 'M', quellen: ['P1'] })).toBe(45 * 60_000)
  })
  it('eingeplant zählen nur laufende Module mit eigener Angabe', () => {
    expect(
      geplantJeWoche(
        [
          { stundenProWoche: 6, abgeschlossen: false, termin: '2026-12-19' },
          { stundenProWoche: 4, abgeschlossen: false, termin: null },
          { stundenProWoche: 3, abgeschlossen: true, termin: null },
          { stundenProWoche: 2, abgeschlossen: false, termin: '2026-11-01' },
          { stundenProWoche: null, abgeschlossen: false, termin: null }
        ],
        heute
      )
    ).toBe(10)
  })
})
