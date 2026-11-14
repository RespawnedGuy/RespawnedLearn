import { describe, expect, it } from 'vitest'
import { abschnittFertig, abschnitteVon, aktuellePakete, erledigt, rechnePlan, planRestMinuten, seitenGesamt, wochenVerteilen, zeitplan } from '../src/lernplan'
import type { Kapitel } from '../src/inhalt'

const k = (titel: string, seite: number, ebene = 1): Kapitel => ({ titel, seite, ebene })
const inhalt = [k('Vorwort', 3), k('1 Grundlagen', 5), k('1.1 Strom', 6, 2), k('2 Netze', 25), k('3 Wechselstrom', 40)]
const teil = { anhang: 'P1', titel: 'ET', seiten: 52, kapitel: inhalt }
const stand = (seite: number) => ({ P1: { seite, am: '2026-11-14T08:00:00Z' } })

describe('Abschnitte', () => {
  it('oberste Ebene, Seiten vor dem ersten Kapitel fehlen, das letzte geht bis zum Ende', () => {
    expect(abschnitteVon(inhalt, 52)).toEqual([
      { titel: 'Vorwort', von: 3, bis: 4 },
      { titel: '1 Grundlagen', von: 5, bis: 24 },
      { titel: '2 Netze', von: 25, bis: 39 },
      { titel: '3 Wechselstrom', von: 40, bis: 52 }
    ])
  })
  it('bei weniger als drei Teilen eine Ebene tiefer', () => {
    expect(abschnitteVon([k('Teil A', 1), k('A.1', 1, 2), k('A.2', 10, 2), k('Teil B', 20)], 30).map((a) => a.titel)).toEqual(['Teil A', 'A.1', 'A.2', 'Teil B'])
    expect(abschnitteVon([k('Teil A', 1), k('A.1', 1, 2), k('A.2', 10, 2), k('Teil B', 20)], 30)[1]).toEqual({ titel: 'A.1', von: 1, bis: 9 })
  })
  it('ohne Inhaltsverzeichnis Abschnitte zu 20 Seiten, ohne Seitenzahl nichts', () => {
    expect(abschnitteVon([], 45)).toEqual([
      { titel: 'S. 1–20', von: 1, bis: 20 },
      { titel: 'S. 21–40', von: 21, bis: 40 },
      { titel: 'S. 41–45', von: 41, bis: 45 }
    ])
    expect(abschnitteVon([], 0)).toEqual([])
  })
})

describe('Pakete', () => {
  const plan = rechnePlan({ teile: [teil], minutenJeSeite: 5, schwer: ['3 Wechselstrom'] })

  it('Pakete von höchstens etwa 25 Minuten, gleichmäßig verteilt, lückenlos', () => {
    const g = plan[1]
    expect(g.pakete.map((p) => [p.von, p.bis, p.minuten])).toEqual([
      [5, 9, 25],
      [10, 14, 25],
      [15, 19, 25],
      [20, 24, 25]
    ])
    for (const a of plan) {
      expect(a.pakete[0].von).toBe(a.von)
      expect(a.pakete.at(-1)!.bis).toBe(a.bis)
      for (let i = 1; i < a.pakete.length; i++) expect(a.pakete[i].von).toBe(a.pakete[i - 1].bis + 1)
    }
    expect(seitenGesamt(plan)).toBe(50)
  })

  it('ein schweres Kapitel bekommt doppelt so viel Zeit je Seite', () => {
    const w = plan[3]
    expect(w.schwer).toBe(true)
    expect(w.pakete.every((p) => p.minuten <= 30 && (p.bis - p.von + 1) * 10 === p.minuten)).toBe(true)
  })

  it('ein langsames Tempo ergibt Pakete von einer Seite', () => {
    const langsam = rechnePlan({ teile: [teil], minutenJeSeite: 40 })
    expect(langsam[0].pakete.map((p) => [p.von, p.bis])).toEqual([
      [3, 3],
      [4, 4]
    ])
  })

  it('erledigt, sobald der Lesestand über die letzte Seite hinaus ist', () => {
    const p = plan[1].pakete[0]
    expect(erledigt(p, stand(9))).toBe(false)
    expect(erledigt(p, stand(10))).toBe(true)
    expect(erledigt(p, {})).toBe(false)
  })

  it('zeigt nur das aktuelle Paket und die nächsten drei', () => {
    const vier = aktuellePakete(plan, stand(12))
    expect(vier.map((p) => p.von)).toEqual([10, 15, 20, 25])
    // offene Stelle gewinnt: wer zurückblättert, sieht das Paket dort
    expect(aktuellePakete(plan, stand(30), { anhang: 'P1', seite: 6 }).map((p) => p.von)).toEqual([5, 10, 15, 20])
    expect(aktuellePakete(plan, stand(53))).toEqual([])
  })

  it('Restzeit zählt nur unerledigte Pakete', () => {
    const alles = planRestMinuten(plan, {})
    expect(planRestMinuten(plan, stand(10))).toBe(alles - 10 - 25)
  })

  it('der zuletzt fertig gelesene Abschnitt', () => {
    expect(abschnittFertig(plan, { anhang: 'P1', seite: 26 })?.titel).toBe('1 Grundlagen')
    expect(abschnittFertig(plan, { anhang: 'P1', seite: 4 })).toBeNull()
    expect(abschnittFertig(plan, { anhang: 'P2', seite: 40 })).toBeNull()
  })
})

describe('Zeitplan bis zum Termin', () => {
  it('eine Woche Wiederholung vor dem Termin, nötige Stunden je Woche', () => {
    const z = zeitplan({ restMinuten: 40 * 60, heute: '2026-11-14', termin: '2026-12-26', stundenProWoche: null })
    expect(z.wiederholungAb).toBe('2026-12-19')
    expect(z.wochen).toBe(5)
    expect(z.noetigJeWoche).toBe(8)
    expect(z.reicht).toBeNull()
  })
  it('reicht die eingeplante Zeit nicht, nennt er, wie viel fehlt', () => {
    const z = zeitplan({ restMinuten: 40 * 60, heute: '2026-11-14', termin: '2026-12-26', stundenProWoche: 6 })
    expect(z.reicht).toBe(false)
    expect(z.fehlen).toBe(10)
    expect(zeitplan({ restMinuten: 40 * 60, heute: '2026-11-14', termin: '2026-12-26', stundenProWoche: 8 }).reicht).toBe(true)
  })
  it('in der Wiederholungswoche oder danach bleibt keine Zeit', () => {
    const z = zeitplan({ restMinuten: 60, heute: '2026-12-22', termin: '2026-12-26', stundenProWoche: 10 })
    expect(z.wochen).toBe(0)
    expect(z.noetigJeWoche).toBeNull()
    expect(z.reicht).toBe(false)
  })
  it('Pakete auf Wochen verteilen', () => {
    const p = (minuten: number) => ({ anhang: 'P1', von: 1, bis: 1, minuten, abschnitt: '' })
    expect(wochenVerteilen([p(30), p(30), p(30), p(30)], 1)).toEqual([0, 0, 1, 1])
  })
})
