// @vitest-environment happy-dom
// Pomodoro im Gerätespeicher: Ton genau einmal nach der Pause, „Nicht stören“ nur während der Lernzeit, Aufräumen beim Start.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const MIN = 60_000
const T0 = Date.parse('2026-11-14T08:00:00Z')

interface Bruecke {
  an: number[]
  aus: number
}

/** Frisches Modul mit nachgestellter Android-Brücke und gezählten Tönen */
async function laden(gespeichert: Record<string, unknown> = {}, android = true) {
  vi.resetModules()
  localStorage.clear()
  for (const [k, v] of Object.entries(gespeichert)) localStorage.setItem(k, JSON.stringify(v))
  const b: Bruecke = { an: [], aus: 0 }
  const w = window as unknown as Record<string, unknown>
  w.RespawnedAndroid = android
    ? {
        vorhanden: () => true,
        anfragen: () => {},
        stilleMoeglich: () => true,
        stilleErlaubt: () => true,
        stilleAn: (ende: number) => (b.an.push(ende), true),
        stilleAus: () => void b.aus++
      }
    : undefined
  const toene = { n: 0 }
  w.AudioContext = class {
    currentTime = 0
    destination = {}
    resume() {
      return Promise.resolve()
    }
    createOscillator() {
      toene.n++
      return { type: '', frequency: { value: 0 }, connect: (x: unknown) => x, start() {}, stop() {} }
    }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }
    }
  }
  const m = await import('../src/pomodoroStand')
  return { m, b, toene }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})
afterEach(() => vi.useRealTimers())

describe('Pomodoro im Gerätespeicher', () => {
  it('Nicht stören: an mit der Endzeit beim Start, aus beim Ablauf, ohne Neustart', async () => {
    const { m, b } = await laden({ 'rl-pomodoro-einstellungen': { stille: true } })
    const weg = m.beobachtePomodoro(() => {})
    const ausVorher = b.aus
    m.lernzeitStarten()
    expect(b.an).toEqual([T0 + 25 * MIN])
    vi.advanceTimersByTime(25 * MIN + 100)
    expect(b.aus).toBeGreaterThan(ausVorher)
    weg()
  })

  it('Nicht stören ausgeschaltet: nie an', async () => {
    const { m, b } = await laden()
    m.lernzeitStarten()
    expect(b.an).toEqual([])
  })

  it('beim Start aufgeräumt: abgelaufene Lernzeit schaltet Nicht stören aus', async () => {
    const { m, b } = await laden({ 'rl-pomodoro': { art: 'lernen', ende: T0 - MIN, minuten: 25 }, 'rl-pomodoro-einstellungen': { stille: true } })
    m.beobachtePomodoro(() => {})()
    expect(b.an).toEqual([])
    expect(b.aus).toBeGreaterThan(0)
  })

  it('Pause in der App: genau ein Ton am Ende, keiner danach', async () => {
    const { m, toene } = await laden()
    const weg = m.beobachtePomodoro(() => {})
    m.pauseStarten()
    vi.advanceTimersByTime(5 * MIN - 1000)
    expect(toene.n).toBe(0)
    vi.advanceTimersByTime(2000)
    expect(toene.n).toBe(2) // Zweiklang
    vi.advanceTimersByTime(10 * MIN)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(toene.n).toBe(2)
    expect(m.pomodoroStand()).toMatchObject({ art: 'pause', tonGespielt: true })
    weg()
  })

  it('Ton ausgeschaltet: still, aber als erledigt vermerkt', async () => {
    const { m, toene } = await laden({ 'rl-pomodoro-einstellungen': { ton: false } })
    const weg = m.beobachtePomodoro(() => {})
    m.pauseStarten()
    vi.advanceTimersByTime(5 * MIN + 1000)
    expect(toene.n).toBe(0)
    expect(m.pomodoroStand()).toMatchObject({ tonGespielt: true })
    weg()
  })

  it('Neustart der App während der Lernzeit: Stand und Restzeit bleiben', async () => {
    const { m } = await laden()
    m.lernzeitStarten()
    vi.setSystemTime(T0 + 10 * MIN)
    const neu = await laden({ 'rl-pomodoro': JSON.parse(localStorage.getItem('rl-pomodoro')!) })
    expect(neu.m.pomodoroStand()).toEqual({ art: 'lernen', ende: T0 + 25 * MIN, minuten: 25 })
  })

  it('am PC (keine Brücke) läuft alles ohne Nicht stören', async () => {
    const { m } = await laden({ 'rl-pomodoro-einstellungen': { stille: true } }, false)
    expect(() => m.lernzeitStarten()).not.toThrow()
  })
})
