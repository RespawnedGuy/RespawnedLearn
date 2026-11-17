// Wo die Werkzeugleiste am PC und Tablet steht (Nils 2026-11-17): oben (Standard), links oder rechts. Die Spalte
// am Rand verdeckte eine der beiden Seiten, darum steht sie oben zwischen Inhaltsverzeichnis und Seitenzahl, im
// Vollbild oben mittig. Gilt je Gerät (Tablet und PC halten den Stift verschieden), darum nicht im Datenordner.
// Am Handy (bis 720 px) bleibt die Funktionsleiste unten; dort wirkt die Einstellung nicht.
import { useEffect, useState } from 'react'

export type LeistenLage = 'oben' | 'links' | 'rechts'
export const LEISTEN_LAGEN: readonly LeistenLage[] = ['oben', 'links', 'rechts']

const SCHLUESSEL = 'rl-werkzeugleiste'
const hoerer = new Set<(l: LeistenLage) => void>()

export function leistenLage(): LeistenLage {
  try {
    const l = localStorage.getItem(SCHLUESSEL)
    return l === 'links' || l === 'rechts' ? l : 'oben'
  } catch {
    return 'oben'
  }
}

/** Setzt das Merkmal am Dokument, nach dem glas.css die Leiste stellt */
export function wendeLeistenLageAn(l: LeistenLage = leistenLage()) {
  document.documentElement.dataset.leiste = l
}

export function setzeLeistenLage(l: LeistenLage) {
  try {
    localStorage.setItem(SCHLUESSEL, l)
  } catch {
    /* ohne Speicher gilt es bis zum Neustart */
  }
  wendeLeistenLageAn(l)
  for (const f of hoerer) f(l)
}

export function useLeistenLage(): LeistenLage {
  const [l, setL] = useState(leistenLage)
  useEffect(() => {
    hoerer.add(setL)
    return () => void hoerer.delete(setL)
  }, [])
  return l
}
