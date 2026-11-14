// Pomodoro-Timer dieses Geräts (Nils 2026-11-14): Stand und Einstellungen im Gerätespeicher wie die Schreibhand,
// nicht im Datenordner. Die Logik steht rein in kern/pomodoro.ts; hier nur Speicher, ein Zeitgeber, Ton und
// „Nicht stören“ über die Android-Brücke.
import { useEffect, useState } from 'react'
import {
  liesPomodoroEinstellungen,
  liesPomodoroStand,
  mitTonGespielt,
  naechsteAenderung,
  startePause,
  starteLernzeit,
  stilleSoll,
  tonFaellig,
  type PomodoroEinstellungen,
  type PomodoroStand
} from '@rl/kern'
import { stilleAn, stilleAus, stilleMoeglich } from '@rl/oberflaeche'

const STAND = 'rl-pomodoro'
const EINSTELLUNGEN = 'rl-pomodoro-einstellungen'

function lies(schluessel: string): unknown {
  try {
    const t = localStorage.getItem(schluessel)
    return t ? JSON.parse(t) : undefined
  } catch {
    return undefined
  }
}

function schreib(schluessel: string, wert: unknown) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert))
  } catch {
    /* ohne Speicher gilt es bis zum Neustart */
  }
}

let stand: PomodoroStand = liesPomodoroStand(lies(STAND))
let einstellungen: PomodoroEinstellungen = liesPomodoroEinstellungen(lies(EINSTELLUNGEN))
const hoerer = new Set<() => void>()

function melden() {
  for (const f of hoerer) f()
}

function setzeStand(neu: PomodoroStand) {
  stand = neu
  schreib(STAND, neu)
  stilleAbgleichen()
  ticken()
}

export function pomodoroEinstellungen(): PomodoroEinstellungen {
  return einstellungen
}

export function setzePomodoroEinstellungen(teil: Partial<PomodoroEinstellungen>) {
  einstellungen = liesPomodoroEinstellungen({ ...einstellungen, ...teil })
  schreib(EINSTELLUNGEN, einstellungen)
  stilleAbgleichen()
  melden()
}

// ---------- Ton nach der Pause ----------
// Browser und Android-WebView spielen Ton erst nach einer Berührung. Darum entsteht der AudioContext beim Tippen auf
// „Pause“ und bleibt bis zum Ende der Pause bereit. Ein leiser Zweiklang, ohne Tondatei.
let klang: AudioContext | null = null

function klangBereit() {
  if (!einstellungen.ton) return
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    klang ??= new AC()
    void klang.resume()
  } catch {
    klang = null
  }
}

export function spieleSanftenTon() {
  const ctx = klang
  if (!ctx) return
  try {
    void ctx.resume()
    const t0 = ctx.currentTime + 0.05
    // zwei weiche Sinustöne (E5, A5), je 0,7 s mit langsamem Ein- und Ausklingen, leise
    for (const [frequenz, start] of [
      [659.25, 0],
      [880, 0.32]
    ] as const) {
      const ton = ctx.createOscillator()
      const laut = ctx.createGain()
      ton.type = 'sine'
      ton.frequency.value = frequenz
      laut.gain.setValueAtTime(0, t0 + start)
      laut.gain.linearRampToValueAtTime(0.12, t0 + start + 0.06)
      laut.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.7)
      ton.connect(laut).connect(ctx.destination)
      ton.start(t0 + start)
      ton.stop(t0 + start + 0.75)
    }
  } catch {
    /* ohne Ton geht es auch */
  }
}

// ---------- Nicht stören (Android) ----------
function stilleAbgleichen() {
  if (!stilleMoeglich()) return
  if (stilleSoll(stand, einstellungen, Date.now()) && stand.art === 'lernen') stilleAn(stand.ende)
  else stilleAus()
}

// ---------- Handlungen ----------
export function lernzeitStarten() {
  setzeStand(starteLernzeit(einstellungen, Date.now()))
}

export function pauseStarten() {
  klangBereit()
  setzeStand(startePause(einstellungen, Date.now()))
}

export function pomodoroBeenden() {
  setzeStand({ art: 'bereit' })
}

// ---------- ein Zeitgeber für alle ----------
let zeitgeber: ReturnType<typeof setTimeout> | undefined

/** Prüft den Ton und plant genau einen Zeitgeber bis zur nächsten Änderung der Anzeige */
function ticken() {
  clearTimeout(zeitgeber)
  const jetzt = Date.now()
  if (tonFaellig(stand, jetzt)) {
    if (einstellungen.ton) spieleSanftenTon()
    stand = mitTonGespielt(stand)
    schreib(STAND, stand)
  }
  // Lernzeit vorbei, während die App offen ist: Nicht stören sofort aus (sonst schaltet der Wecker ab)
  if (stand.art === 'lernen' && jetzt >= stand.ende) stilleAbgleichen()
  melden()
  const bis = naechsteAenderung(stand, jetzt)
  if (bis !== null && hoerer.size) zeitgeber = setTimeout(ticken, bis + 20)
}

let verbunden = false
function verbinden() {
  if (verbunden || typeof document === 'undefined') return
  verbunden = true
  // Hintergrund, Bildschirm aus: Zeitgeber schlafen, beim Zurückkommen zählt nur die Uhr
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && ticken())
  // Anderes Fenster derselben App (PC) hat den Timer geändert
  window.addEventListener('storage', (e) => {
    if (e.key === STAND) stand = liesPomodoroStand(lies(STAND))
    else if (e.key === EINSTELLUNGEN) einstellungen = liesPomodoroEinstellungen(lies(EINSTELLUNGEN))
    else return
    ticken()
  })
  // Beim Start aufräumen: Lief keine Lernzeit mehr, ist „Nicht stören“ aus
  stilleAbgleichen()
}

/** Meldet jede Änderung der Anzeige; der erste Beobachter verbindet Sichtbarkeit, Speicher und räumt „Nicht stören“ auf */
export function beobachtePomodoro(f: () => void): () => void {
  verbinden()
  hoerer.add(f)
  ticken()
  return () => {
    hoerer.delete(f)
    if (!hoerer.size) clearTimeout(zeitgeber)
  }
}

/** Stand, Einstellungen und Uhrzeit; die Komponente rendert neu, wenn sich die Anzeige ändert */
export function usePomodoro(): { stand: PomodoroStand; einstellungen: PomodoroEinstellungen; jetzt: number } {
  const [, setZaehler] = useState(0)
  useEffect(() => beobachtePomodoro(() => setZaehler((n) => n + 1)), [])
  return { stand, einstellungen, jetzt: Date.now() }
}

export function pomodoroStand(): PomodoroStand {
  return stand
}
