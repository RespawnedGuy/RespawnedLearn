import { describe, expect, it } from 'vitest'
import {
  chipName,
  chipText,
  liesPomodoroEinstellungen,
  liesPomodoroStand,
  mitTonGespielt,
  naechsteAenderung,
  phasenAnsage,
  POMODORO_STANDARD,
  pomodoroPhase,
  restMinuten,
  starteLernzeit,
  startePause,
  stilleSoll,
  TON_FENSTER_MS,
  tonFaellig
} from '../src'

const MIN = 60_000
const T0 = Date.parse('2026-11-14T08:00:00Z')
const e = { ...POMODORO_STANDARD }

describe('Pomodoro: Phasen aus der Endzeit', () => {
  it('Lernzeit läuft, ist um, Pause läuft, Pause ist um', () => {
    const l = starteLernzeit(e, T0)
    expect(l).toEqual({ art: 'lernen', ende: T0 + 25 * MIN, minuten: 25 })
    expect(pomodoroPhase(l, T0)).toBe('lernt')
    expect(pomodoroPhase(l, T0 + 25 * MIN - 1)).toBe('lernt')
    expect(pomodoroPhase(l, T0 + 25 * MIN)).toBe('abgelaufen')
    const p = startePause(e, T0 + 26 * MIN)
    expect(pomodoroPhase(p, T0 + 30 * MIN)).toBe('pause')
    expect(pomodoroPhase(p, T0 + 31 * MIN)).toBe('pauseVorbei')
    expect(pomodoroPhase({ art: 'bereit' }, T0)).toBe('bereit')
  })

  it('Bildschirm 40 Minuten aus: beim Zurückkommen ist die Lernzeit um, nichts lief weiter', () => {
    const l = starteLernzeit(e, T0)
    expect(pomodoroPhase(l, T0 + 40 * MIN)).toBe('abgelaufen')
    expect(restMinuten(l, T0 + 40 * MIN)).toBe(0)
    expect(chipText(l, T0 + 40 * MIN)).toBe('Pause?')
  })

  it('Neustart der App: der gespeicherte Stand gibt dieselbe Restzeit', () => {
    const l = starteLernzeit({ lernen: 50 }, T0)
    const wieder = liesPomodoroStand(JSON.parse(JSON.stringify(l)))
    expect(restMinuten(wieder, T0 + 20 * MIN)).toBe(30)
  })

  it('Restzeit wird aufgerundet, Chip ohne Sekunden', () => {
    const l = starteLernzeit(e, T0)
    expect(restMinuten(l, T0)).toBe(25)
    expect(restMinuten(l, T0 + 30_000)).toBe(25)
    expect(restMinuten(l, T0 + 24 * MIN + 59_000)).toBe(1)
    expect(chipText(l, T0 + 7 * MIN)).toBe('18 min')
    expect(chipText(startePause(e, T0), T0 + 1)).toBe('5 min')
    expect(chipText({ art: 'bereit' }, T0)).toBe('')
  })
})

describe('Pomodoro: nur ein Zeitgeber, genau bis zur nächsten Änderung', () => {
  it('bis zur nächsten Minutengrenze, dann bis zum Ende', () => {
    const l = starteLernzeit(e, T0)
    expect(naechsteAenderung(l, T0)).toBe(MIN)
    expect(naechsteAenderung(l, T0 + 10_000)).toBe(50_000)
    expect(naechsteAenderung(l, T0 + 25 * MIN - 1)).toBe(1)
  })

  it('nach der Lernzeit und ohne Timer ändert sich von selbst nichts', () => {
    expect(naechsteAenderung({ art: 'bereit' }, T0)).toBeNull()
    expect(naechsteAenderung(starteLernzeit(e, T0), T0 + 25 * MIN)).toBeNull()
  })

  it('nach der Pause nur noch bis zum Ende des Tonfensters', () => {
    const p = startePause(e, T0)
    const ende = T0 + 5 * MIN
    expect(naechsteAenderung(p, ende)).toBe(TON_FENSTER_MS + 1)
    expect(naechsteAenderung(p, ende + TON_FENSTER_MS + 1)).toBeNull()
    expect(naechsteAenderung(mitTonGespielt(p), ende)).toBeNull()
  })
})

describe('Pomodoro: Ton nach der Pause genau einmal, nur bei offener App', () => {
  const p = startePause(e, T0)
  const ende = T0 + 5 * MIN
  it('während der Pause und in der Lernzeit kein Ton', () => {
    expect(tonFaellig(p, ende - 1)).toBe(false)
    expect(tonFaellig(starteLernzeit(e, T0), T0 + 30 * MIN)).toBe(false)
    expect(tonFaellig({ art: 'bereit' }, T0)).toBe(false)
  })
  it('am Ende der Pause einmal, danach nicht mehr', () => {
    expect(tonFaellig(p, ende)).toBe(true)
    expect(tonFaellig(mitTonGespielt(p), ende + 1000)).toBe(false)
  })
  it('wer erst später zurückkommt, bekommt keinen Ton', () => {
    expect(tonFaellig(p, ende + TON_FENSTER_MS)).toBe(true)
    expect(tonFaellig(p, ende + TON_FENSTER_MS + 1)).toBe(false)
    expect(tonFaellig(p, ende + 3 * 60 * MIN)).toBe(false)
  })
  it('„Ton gespielt“ übersteht das Speichern', () => {
    expect(liesPomodoroStand(JSON.parse(JSON.stringify(mitTonGespielt(p))))).toEqual({ ...p, tonGespielt: true })
  })
})

describe('Pomodoro: Nicht stören gehört genau zur laufenden Lernzeit', () => {
  const an = { stille: true }
  it('an während der Lernzeit, aus ab ihrem Ende, in der Pause und ohne Timer', () => {
    const l = starteLernzeit(e, T0)
    expect(stilleSoll(l, an, T0 + MIN)).toBe(true)
    expect(stilleSoll(l, an, T0 + 25 * MIN)).toBe(false)
    expect(stilleSoll(startePause(e, T0), an, T0 + MIN)).toBe(false)
    expect(stilleSoll({ art: 'bereit' }, an, T0)).toBe(false)
  })
  it('ausgeschaltet nie', () => {
    expect(stilleSoll(starteLernzeit(e, T0), { stille: false }, T0 + MIN)).toBe(false)
  })
})

describe('Pomodoro: Gerätespeicher robust lesen', () => {
  it('Unlesbares gibt „bereit“', () => {
    for (const roh of [null, undefined, 'x', 42, {}, { art: 'lernen' }, { art: 'lernen', ende: 'morgen', minuten: 25 }, { art: 'lernen', ende: T0, minuten: 0 }, { art: 'schlafen', ende: T0, minuten: 5 }, { art: 'pause', ende: NaN, minuten: 5 }]) {
      expect(liesPomodoroStand(roh)).toEqual({ art: 'bereit' })
    }
  })
  it('Einstellungen: Standard, begrenzt und gerundet', () => {
    expect(liesPomodoroEinstellungen(undefined)).toEqual({ lernen: 25, pause: 5, ton: true, stille: false })
    expect(liesPomodoroEinstellungen({ lernen: 0, pause: 999, ton: false, stille: true })).toEqual({ lernen: 1, pause: 60, ton: false, stille: true })
    expect(liesPomodoroEinstellungen({ lernen: '45', pause: 7.6 })).toMatchObject({ lernen: 45, pause: 8 })
    expect(liesPomodoroEinstellungen({ lernen: 'viel', ton: 'ja' })).toMatchObject({ lernen: 25, ton: true })
    expect(liesPomodoroEinstellungen({ lernen: 500 }).lernen).toBe(180)
  })
})

describe('Pomodoro: Texte für Screenreader', () => {
  it('Name des Chips mit Zustand und Restzeit', () => {
    const l = starteLernzeit(e, T0)
    expect(chipName({ art: 'bereit' }, T0)).toBe('Lernzeit starten')
    expect(chipName(l, T0 + 24 * MIN)).toBe('Lernzeit, noch 1 Minute')
    expect(chipName(l, T0 + 7 * MIN)).toBe('Lernzeit, noch 18 Minuten')
    expect(chipName(l, T0 + 25 * MIN)).toBe('Lernzeit vorbei, Pause machen?')
    expect(chipName(startePause(e, T0), T0 + 5 * MIN)).toBe('Pause vorbei, weiterlernen?')
  })
  it('Ansage nur je Phase', () => {
    expect(phasenAnsage(starteLernzeit(e, T0), T0)).toBe('Lernzeit läuft, noch 25 Minuten')
    expect(phasenAnsage(starteLernzeit(e, T0), T0 + 25 * MIN)).toBe('Lernzeit vorbei')
    expect(phasenAnsage(startePause(e, T0), T0)).toBe('Pause läuft, noch 5 Minuten')
    expect(phasenAnsage({ art: 'bereit' }, T0)).toBe('')
  })
})
