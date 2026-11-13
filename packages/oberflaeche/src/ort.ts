import { useSyncExternalStore } from 'react'
import { mitUebergang, richtung } from './uebergang'

// Navigation über den Hash (#/journal/2026-10-19): funktioniert offline und ohne Server-Regeln.
function lesen(): string[] {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

let cache = location.hash
let teile = lesen()

// Wer die Adresse liest, hört hier statt direkt am hashchange: so kann der Wechsel in einem Übergang laufen (uebergang.ts)
const hoerer = new Set<() => void>()

export function useOrt(): string[] {
  return useSyncExternalStore(
    (f) => {
      hoerer.add(f)
      return () => hoerer.delete(f)
    },
    () => {
      if (location.hash !== cache) {
        cache = location.hash
        teile = lesen()
      }
      return teile
    }
  )
}

export function geheZu(...ziel: (string | number)[]) {
  location.hash = '#/' + ziel.map((t) => encodeURIComponent(String(t))).join('/')
}

export function ortLink(...ziel: (string | number)[]): string {
  return '#/' + ziel.map((t) => encodeURIComponent(String(t))).join('/')
}

// Verlauf innerhalb der App, damit „Zurück“ dorthin führt, wo man herkam (und nicht aus der App hinaus).
// Jeder Eintrag merkt sich im history.state seine Stelle; der Stapel liegt je App in sessionStorage.
const STAPEL = `rvx-verlauf-${location.pathname}`
let stapel: string[] = []
let stelle = 0
/** Für den Übergang: Adresse vor dem letzten Wechsel und ob er im Verlauf zurück ging */
let vorigerHash = typeof location === 'undefined' ? '' : location.hash
let zurueckGegangen = false

function stapelLesen(): string[] {
  try {
    const s = JSON.parse(sessionStorage.getItem(STAPEL) ?? '[]')
    return Array.isArray(s) ? s : []
  } catch {
    return []
  }
}

function stapelSichern() {
  try {
    sessionStorage.setItem(STAPEL, JSON.stringify(stapel.slice(-200)))
  } catch {
    /* ohne Speicher gilt der Verlauf nur bis zum Neuladen */
  }
}

function merken() {
  const s = (history.state as { rvxStelle?: unknown } | null)?.rvxStelle
  if (typeof s === 'number' && stapel[s] === location.hash) {
    // Vor oder zurück im Browser: nur die Stelle wechselt
    zurueckGegangen = s < stelle
    stelle = s
    return
  }
  zurueckGegangen = false
  stelle = typeof s === 'number' ? s : stapel.length ? stelle + 1 : 0
  stapel = stapel.slice(0, stelle)
  stapel[stelle] = location.hash
  history.replaceState({ ...(history.state ?? {}), rvxStelle: stelle }, '')
  stapelSichern()
}

if (typeof window !== 'undefined') {
  stapel = stapelLesen()
  const s = (history.state as { rvxStelle?: unknown } | null)?.rvxStelle
  if (typeof s === 'number' && stapel[s] === location.hash) stelle = s
  else {
    stapel = []
    merken()
  }
  addEventListener('hashchange', merken)
  // Nach merken(), damit die Richtung den neuen Stand im Verlauf kennt
  addEventListener('hashchange', () => {
    const r = richtung(vorigerHash, location.hash, zurueckGegangen)
    vorigerHash = location.hash
    mitUebergang(r, () => hoerer.forEach((f) => f()))
  })
}

/** Dieselbe Ansicht, nur woanders darin (Seite im Buch, Zeile im Journal): zählt für „Zurück“ nicht */
function ansicht(hash: string): string {
  return hash.replace(/\/\d+$/, '')
}

/** Wohin „Zurück“ im Verlauf führt: Schritte zurück bis zur letzten anderen Ansicht, sonst null */
function schritteZurueck(): number | null {
  const hier = ansicht(location.hash)
  for (let i = stelle - 1; i >= 0; i--) if (stapel[i] && ansicht(stapel[i]) !== hier) return i - stelle
  return null
}

/** Gibt es ein „Zurück“? Entweder im Verlauf oder die übergeordnete Ansicht `oben` */
export function kannZurueck(oben?: string | null): boolean {
  return schritteZurueck() !== null || (!!oben && oben !== location.hash)
}

/** Zur vorigen Ansicht; ohne Verlauf (frisch geöffnet, Lesezeichen) eine Ebene nach oben */
export function zurueck(oben?: string | null) {
  const n = schritteZurueck()
  if (n !== null) history.go(n)
  else if (oben && oben !== location.hash) location.hash = oben
}

/**
 * Stelle in derselben Ansicht festhalten, ohne neu zu navigieren (z. B. die sichtbare Seite beim Scrollen im Skript):
 * kein hashchange, kein neuer Eintrag im Verlauf; „Zurück“ und Neuladen landen trotzdem an dieser Stelle.
 */
export function ersetzeOrt(...ziel: (string | number)[]) {
  const hash = ortLink(...ziel)
  if (hash === location.hash) return
  history.replaceState(history.state, '', hash)
  vorigerHash = hash
  stapel[stelle] = hash
  stapelSichern()
}
