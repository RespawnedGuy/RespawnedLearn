// Tastatur statt Halten (WCAG 2.1.1): Entf löscht die gewählte Markierung oder das gewählte Bild, mit Rückgängig wie
// beim Radierer. Nicht, solange man in ein Feld schreibt.
import { useEffect, useRef } from 'react'

export function useEntfLoescht(loeschen: (() => void) | null) {
  const aktuell = useRef(loeschen)
  aktuell.current = loeschen
  const an = !!loeschen
  useEffect(() => {
    if (!an) return
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      aktuell.current?.()
    }
    addEventListener('keydown', taste)
    return () => removeEventListener('keydown', taste)
  }, [an])
}
