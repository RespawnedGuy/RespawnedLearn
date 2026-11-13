// Einfügen in der Funktionsleiste (Lernkarte, Kamera, Foto): gibt es nur, solange eine Seite es anbietet (die Mitschrift).
import { useEffect, useSyncExternalStore } from 'react'

export interface PlusZiel {
  lernkarte(): void
  foto(): void
  kamera(): void
}

let ziel: PlusZiel | null = null
const hoerer = new Set<() => void>()
const melden = () => hoerer.forEach((f) => f())

export function useMeldePlus(z: PlusZiel) {
  useEffect(() => {
    ziel = z
    melden()
    return () => {
      if (ziel === z) (ziel = null), melden()
    }
  }, [z])
}

export function usePlus(): PlusZiel | null {
  return useSyncExternalStore(
    (f) => {
      hoerer.add(f)
      return () => hoerer.delete(f)
    },
    () => ziel
  )
}
