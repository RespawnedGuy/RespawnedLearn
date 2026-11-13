// Schreibhand dieses Geräts (Nils 13.11.): Die Randmarken im Notizbuch stehen auf der Seite gegenüber der Hand, damit
// sie beim Schreiben nicht darunter liegen. Gilt je Gerät (Stift und Halten sind am Tablet anders als am PC),
// darum nicht im Datenordner. Standard ist die rechte Hand, Marken links.
import { useEffect, useState } from 'react'

export type Schreibhand = 'rechts' | 'links'

const SCHLUESSEL = 'rl-schreibhand'
const hoerer = new Set<(h: Schreibhand) => void>()

export function schreibhand(): Schreibhand {
  try {
    return localStorage.getItem(SCHLUESSEL) === 'links' ? 'links' : 'rechts'
  } catch {
    return 'rechts'
  }
}

/** Setzt das Merkmal am Dokument, nach dem lernen.css den Rand umsetzt */
export function wendeSchreibhandAn(h: Schreibhand = schreibhand()) {
  document.documentElement.dataset.schreibhand = h
}

export function setzeSchreibhand(h: Schreibhand) {
  try {
    localStorage.setItem(SCHLUESSEL, h)
  } catch {
    /* ohne Speicher gilt es bis zum Neustart */
  }
  wendeSchreibhandAn(h)
  for (const f of hoerer) f(h)
}

export function useSchreibhand(): Schreibhand {
  const [h, setH] = useState(schreibhand)
  useEffect(() => {
    hoerer.add(setH)
    return () => void hoerer.delete(setH)
  }, [])
  return h
}
