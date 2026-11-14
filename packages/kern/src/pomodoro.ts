// Pomodoro-Timer beim Lernen (Nils 2026-11-14). Rein: Gespeichert wird nur, wann eine Phase endet, nie ein Zähler.
// Daraus folgt alles andere zu jedem Zeitpunkt, darum übersteht der Timer Hintergrund, Bildschirm aus und Neustart.
// Der Stand gilt je Gerät und liegt nicht im Datenordner (kein Vertrag).

export interface PomodoroEinstellungen {
  /** Lernzeit in Minuten */
  lernen: number
  /** Pause in Minuten */
  pause: number
  /** leiser Ton, wenn die Pause vorbei ist (nur bei offener App, Nils 2026-11-14) */
  ton: boolean
  /** Android: während der Lernzeit „Nicht stören“ über eine eigene Regel */
  stille: boolean
}

export const POMODORO_STANDARD: PomodoroEinstellungen = { lernen: 25, pause: 5, ton: true, stille: false }

export const LERNZEIT_GRENZEN = { min: 1, max: 180 }
export const PAUSE_GRENZEN = { min: 1, max: 60 }

/** Wie lange nach dem Ende der Pause der Ton noch kommen darf; wer später zurückkommt, sieht es still */
export const TON_FENSTER_MS = 30_000

export type PomodoroStand =
  | { art: 'bereit' }
  | { art: 'lernen'; ende: number; minuten: number }
  | { art: 'pause'; ende: number; minuten: number; tonGespielt?: boolean }

/** Was der Chip zeigt: läuft, ist um, Pause läuft, Pause ist um */
export type PomodoroPhase = 'bereit' | 'lernt' | 'abgelaufen' | 'pause' | 'pauseVorbei'

const MINUTE = 60_000

function ganzeMinuten(wert: unknown, grenzen: { min: number; max: number }, standard: number): number {
  const n = typeof wert === 'number' ? wert : typeof wert === 'string' ? Number(wert) : NaN
  if (!Number.isFinite(n)) return standard
  return Math.min(grenzen.max, Math.max(grenzen.min, Math.round(n)))
}

/** Einstellungen aus dem Gerätespeicher, Unlesbares fällt auf den Standard zurück, Zahlen werden begrenzt */
export function liesPomodoroEinstellungen(roh: unknown): PomodoroEinstellungen {
  const o = roh && typeof roh === 'object' ? (roh as Record<string, unknown>) : {}
  return {
    lernen: ganzeMinuten(o.lernen, LERNZEIT_GRENZEN, POMODORO_STANDARD.lernen),
    pause: ganzeMinuten(o.pause, PAUSE_GRENZEN, POMODORO_STANDARD.pause),
    ton: typeof o.ton === 'boolean' ? o.ton : POMODORO_STANDARD.ton,
    stille: typeof o.stille === 'boolean' ? o.stille : POMODORO_STANDARD.stille
  }
}

/** Stand aus dem Gerätespeicher; alles Unlesbare heißt „bereit“, damit nie ein falscher Timer läuft */
export function liesPomodoroStand(roh: unknown): PomodoroStand {
  if (!roh || typeof roh !== 'object') return { art: 'bereit' }
  const o = roh as Record<string, unknown>
  const ende = o.ende
  const minuten = o.minuten
  if ((o.art !== 'lernen' && o.art !== 'pause') || typeof ende !== 'number' || !Number.isFinite(ende) || typeof minuten !== 'number' || !(minuten > 0)) {
    return { art: 'bereit' }
  }
  if (o.art === 'lernen') return { art: 'lernen', ende, minuten }
  return o.tonGespielt === true ? { art: 'pause', ende, minuten, tonGespielt: true } : { art: 'pause', ende, minuten }
}

export function starteLernzeit(e: Pick<PomodoroEinstellungen, 'lernen'>, jetzt: number): PomodoroStand {
  return { art: 'lernen', ende: jetzt + e.lernen * MINUTE, minuten: e.lernen }
}

export function startePause(e: Pick<PomodoroEinstellungen, 'pause'>, jetzt: number): PomodoroStand {
  return { art: 'pause', ende: jetzt + e.pause * MINUTE, minuten: e.pause }
}

export function pomodoroPhase(s: PomodoroStand, jetzt: number): PomodoroPhase {
  if (s.art === 'bereit') return 'bereit'
  if (s.art === 'lernen') return jetzt < s.ende ? 'lernt' : 'abgelaufen'
  return jetzt < s.ende ? 'pause' : 'pauseVorbei'
}

/** Restzeit in ganzen Minuten, aufgerundet (bei 30 s Rest steht „1 min“); 0, wenn nichts läuft */
export function restMinuten(s: PomodoroStand, jetzt: number): number {
  if (s.art === 'bereit' || jetzt >= s.ende) return 0
  return Math.ceil((s.ende - jetzt) / MINUTE)
}

/**
 * Millisekunden bis sich die Anzeige ändert: nächste Minutengrenze der Restzeit oder Ende der Phase.
 * null, wenn sich ohne Zutun nichts mehr ändert. Die Oberfläche plant damit genau einen Zeitgeber.
 */
export function naechsteAenderung(s: PomodoroStand, jetzt: number): number | null {
  if (s.art === 'bereit') return null
  const rest = s.ende - jetzt
  if (rest <= 0) {
    // Nach der Pause endet nur noch das Fenster für den Ton
    if (s.art === 'pause' && !s.tonGespielt && -rest <= TON_FENSTER_MS) return TON_FENSTER_MS + rest + 1
    return null
  }
  const bisMinute = rest % MINUTE
  return bisMinute === 0 ? MINUTE : bisMinute
}

/** Ton genau einmal, und nur, wenn die App das Ende der Pause gerade miterlebt (nicht beim Zurückkommen Stunden später) */
export function tonFaellig(s: PomodoroStand, jetzt: number): boolean {
  return s.art === 'pause' && !s.tonGespielt && jetzt >= s.ende && jetzt - s.ende <= TON_FENSTER_MS
}

export function mitTonGespielt(s: PomodoroStand): PomodoroStand {
  return s.art === 'pause' ? { ...s, tonGespielt: true } : s
}

/** Android: „Nicht stören“ gehört genau zur laufenden Lernzeit */
export function stilleSoll(s: PomodoroStand, e: Pick<PomodoroEinstellungen, 'stille'>, jetzt: number): boolean {
  return e.stille && pomodoroPhase(s, jetzt) === 'lernt'
}

const minutenText = (n: number) => `${n} Minute${n === 1 ? '' : 'n'}`

/** Kurzer Text im Chip */
export function chipText(s: PomodoroStand, jetzt: number): string {
  const p = pomodoroPhase(s, jetzt)
  if (p === 'lernt' || p === 'pause') return `${restMinuten(s, jetzt)} min`
  if (p === 'abgelaufen') return 'Pause?'
  if (p === 'pauseVorbei') return 'Weiter?'
  return ''
}

/** Name des Chips für Screenreader (Zustand und Restzeit, ausgeschrieben) */
export function chipName(s: PomodoroStand, jetzt: number): string {
  const p = pomodoroPhase(s, jetzt)
  const min = minutenText(restMinuten(s, jetzt))
  if (p === 'lernt') return `Lernzeit, noch ${min}`
  if (p === 'pause') return `Pause, noch ${min}`
  if (p === 'abgelaufen') return 'Lernzeit vorbei, Pause machen?'
  if (p === 'pauseVorbei') return 'Pause vorbei, weiterlernen?'
  return 'Lernzeit starten'
}

/** Was bei einem Phasenwechsel angesagt wird (nicht jede Minute) */
export function phasenAnsage(s: PomodoroStand, jetzt: number): string {
  const p = pomodoroPhase(s, jetzt)
  if (p === 'lernt') return `Lernzeit läuft, noch ${minutenText(restMinuten(s, jetzt))}`
  if (p === 'abgelaufen') return 'Lernzeit vorbei'
  if (p === 'pause') return `Pause läuft, noch ${minutenText(restMinuten(s, jetzt))}`
  if (p === 'pauseVorbei') return 'Pause vorbei'
  return ''
}
