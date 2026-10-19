import { useSyncExternalStore } from 'react'

// Navigation über den Hash (#/journal/2026-10-19): funktioniert offline und ohne Server-Regeln.
function lesen(): string[] {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

let cache = location.hash
let teile = lesen()

export function useOrt(): string[] {
  return useSyncExternalStore(
    (f) => {
      addEventListener('hashchange', f)
      return () => removeEventListener('hashchange', f)
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
