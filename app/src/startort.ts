// Womit die App startet (Nils 2026-11-14): mit der Übersicht oder direkt im zuletzt offenen Skript. Gilt je Gerät
// (am Handy will man vielleicht gleich lesen, am PC erst planen), darum in localStorage, nicht im Datenordner.
import { useEffect, useState } from 'react'
import { lernziele, type Bestand } from '@rl/kern'
import { ortLink } from '@rl/oberflaeche'

export type Startort = 'uebersicht' | 'skript'

const SCHLUESSEL = 'rl-start'
const hoerer = new Set<(s: Startort) => void>()

export function startort(): Startort {
  try {
    return localStorage.getItem(SCHLUESSEL) === 'skript' ? 'skript' : 'uebersicht'
  } catch {
    return 'uebersicht'
  }
}

export function setzeStartort(s: Startort) {
  try {
    localStorage.setItem(SCHLUESSEL, s)
  } catch {
    /* ohne Speicher gilt es bis zum Neustart */
  }
  for (const f of hoerer) f(s)
}

export function useStartort(): Startort {
  const [s, setS] = useState(startort)
  useEffect(() => {
    hoerer.add(setS)
    return () => void hoerer.delete(setS)
  }, [])
  return s
}

/** Die Stelle, an der zuletzt gelesen wurde (über alle Module und Bücher); null, wenn noch nirgends */
export function letztesSkript(b: Bestand): string | null {
  let best: { anhang: string; seite: number; am: string } | null = null
  for (const z of lernziele(b)) if (z.zuletzt && (!best || z.zuletzt.am > best.am)) best = z.zuletzt
  return best ? ortLink('sammeln', best.anhang, best.seite) : null
}

/** Ziel beim Start: nur wenn die App ohne Adresse geöffnet wird; sonst null (Adresse bleibt) */
export function startZiel(hash: string, s: Startort, b: Bestand): string | null {
  if (hash.replace(/^#\/?/, '')) return null
  return (s === 'skript' && letztesSkript(b)) || ortLink('uebersicht')
}
