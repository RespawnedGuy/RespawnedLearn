// Ablage für Kopieren und Einfügen (Vertrag Lernen 1.12): nur im Arbeitsspeicher dieses Geräts, eine Kopie zur Zeit.
// Dazu die zuletzt angetippte Stelle eines Buchs, an die Strg+V einfügt.
import { useSyncExternalStore } from 'react'
import type { Kopie } from '@rl/kern'

let kopie: Kopie | null = null
let ort: { buch: string; nr: number; x: number; y: number } | null = null
const hoerer = new Set<() => void>()

export function legeInAblage(k: Kopie) {
  kopie = k
  for (const h of hoerer) h()
}

export const ausAblage = () => kopie

export function useAblage(): Kopie | null {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => void hoerer.delete(h)
    },
    () => kopie
  )
}

/** Zuletzt angetippte Stelle eines Buchs (Seitenkoordinaten, Breite 1000) */
export function merkeOrt(o: { buch: string; nr: number; x: number; y: number }) {
  ort = o
}
export const letzterOrt = () => ort
