// @vitest-environment happy-dom
// Planung der Wiederholungen (FSRS-6) mit festen Werten. Die Erwartungen stammen aus ts-fsrs 5.4.2 mit denselben
// Einstellungen; seit ts-fsrs 6 rundet „Schwer“ in der Lernphase den Lernschritt auf ganze Minuten (6 → 5½ Min. ist
// unten als einzige Abweichung eingetragen). Ändert sich hier etwas, ändern sich die Termine aller Nutzer.
import { describe, expect, it } from 'vitest'
import { Bestand } from '@rl/kern'
import { lernstaende, naechsteAbstaende } from '../src/wissen'

type Zeile = [am: string, note: string]

function bestand(dateien: Record<string, [karte: string, ...Zeile][]>) {
  const texte = new Map<string, string>()
  for (const [pfad, zeilen] of Object.entries(dateien))
    texte.set(pfad, zeilen.map(([karte, am, note]) => JSON.stringify({ karte, am, note })).join('\n') + '\n')
  return new Bestand(texte)
}

function stand(karte: string, zeilen: Zeile[]) {
  const st = lernstaende(bestand({ 'reviews/2026-11.pc.jsonl': zeilen.map((z) => [karte, ...z]) })).get(karte)!
  return {
    faellig: st.karte.dueAt.toISOString(),
    anzahl: st.anzahl,
    wiederholungen: st.karte.reps,
    vergessen: st.karte.lapses,
    zustand: st.karte.state,
    stabilitaet: Number(st.karte.stability.toFixed(6)),
    schwierigkeit: Number(st.karte.difficulty.toFixed(6))
  }
}

describe('Planung aus dem Protokoll (FSRS-6)', () => {
  it('dreimal Gut: Abstand wächst auf Wochen', () => {
    expect(
      stand('a', [
        ['2026-11-01T10:00:00Z', 'gut'],
        ['2026-11-01T10:10:00Z', 'gut'],
        ['2026-11-02T09:00:00Z', 'gut'],
        ['2026-11-06T20:00:00Z', 'gut']
      ])
    ).toEqual({ faellig: '2026-11-29T20:00:00.000Z', anzahl: 4, wiederholungen: 4, vergessen: 0, zustand: 2, stabilitaet: 23.205359, schwierigkeit: 2.097455 })
  })

  it('Nochmal, dann Schwer in der Lernphase (einzige Abweichung zu ts-fsrs 5: 5½ statt 6 Min.)', () => {
    expect(
      stand('b', [
        ['2026-11-01T10:00:00Z', 'nochmal'],
        ['2026-11-01T10:01:30Z', 'schwer']
      ])
    ).toEqual({ faellig: '2026-11-01T10:07:00.000Z', anzahl: 2, wiederholungen: 2, vergessen: 0, zustand: 1, stabilitaet: 0.212, schwierigkeit: 7.60421 })
  })

  it('überfällig vergessen und wiedergelernt', () => {
    expect(
      stand('c', [
        ['2026-10-01T08:00:00Z', 'leicht'],
        ['2026-10-20T08:00:00Z', 'gut'],
        ['2026-12-30T08:00:00Z', 'nochmal'],
        ['2026-12-30T08:12:00Z', 'gut']
      ])
    ).toEqual({ faellig: '2027-01-03T08:12:00.000Z', anzahl: 4, wiederholungen: 4, vergessen: 1, zustand: 2, stabilitaet: 3.50246, schwierigkeit: 7.015191 })
  })

  it('zu früh wiederholt', () => {
    expect(
      stand('d', [
        ['2026-11-01T10:00:00Z', 'gut'],
        ['2026-11-01T10:10:00Z', 'gut'],
        ['2026-11-01T18:00:00Z', 'leicht'],
        ['2026-11-03T07:00:00Z', 'schwer']
      ])
    ).toEqual({ faellig: '2026-11-13T07:00:00.000Z', anzahl: 4, wiederholungen: 4, vergessen: 0, zustand: 2, stabilitaet: 9.983197, schwierigkeit: 4.010609 })
  })

  it('Protokolle von zwei Geräten ergeben denselben Stand wie eines, egal in welcher Reihenfolge', () => {
    const zeilen: [string, ...Zeile][] = [
      ['a', '2026-11-01T10:00:00Z', 'gut'],
      ['a', '2026-11-01T10:10:00Z', 'gut'],
      ['a', '2026-11-02T09:00:00Z', 'gut'],
      ['a', '2026-11-06T20:00:00Z', 'gut']
    ]
    const zwei = bestand({ 'reviews/2026-11.handy.jsonl': [zeilen[3]!, zeilen[0]!], 'reviews/2026-11.pc.jsonl': [zeilen[2]!, zeilen[1]!] })
    expect(lernstaende(zwei).get('a')!.karte.dueAt.toISOString()).toBe('2026-11-29T20:00:00.000Z')
  })
})

describe('Vorschau unter den Bewertungsknöpfen', () => {
  const jetzt = new Date('2026-11-20T12:00:00Z')

  it('neue Karte', () => {
    // ts-fsrs 5 zeigte für Schwer 6 Min.; abstandText rundet 5½ Min. auf „in 6 Min.“, der Knopf bleibt gleich
    expect(naechsteAbstaende(new Bestand(new Map()), 'neu', jetzt)).toEqual({
      nochmal: 'in 1 Min.',
      schwer: 'in 6 Min.',
      gut: 'in 10 Min.',
      leicht: 'in 8 Tagen'
    })
  })

  it('geübte Karte', () => {
    const b = bestand({
      'reviews/2026-11.pc.jsonl': [
        ['a', '2026-11-01T10:00:00Z', 'gut'],
        ['a', '2026-11-01T10:10:00Z', 'gut'],
        ['a', '2026-11-02T09:00:00Z', 'gut'],
        ['a', '2026-11-06T20:00:00Z', 'gut']
      ]
    })
    // ts-fsrs 5: 10 Min., 50 Tage, 68 Tage, 108 Tage
    expect(naechsteAbstaende(b, 'a', jetzt)).toEqual({ nochmal: 'in 10 Min.', schwer: 'in 2 Monaten', gut: 'in 2 Monaten', leicht: 'in 4 Monaten' })
  })
})
