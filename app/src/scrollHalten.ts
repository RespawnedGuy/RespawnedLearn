// Ansichten im Übungsplatz tauschen (‹ ›): React hängt dabei eine Ansicht im Dokument um, und der Browser setzt ihre
// Scrollposition auf 0. Das Skript stand danach auf Seite 1, und das nächste Scrollen speicherte das als Lesestand
// (Fehler 2026-11-15). Darum merkt sich jede Ansicht ihre Stelle und bekommt sie nach dem Umhängen zurück, bevor
// der Browser zeichnet. Die Breite bleibt beim Tauschen gleich, also stimmen die Pixel.
import { useLayoutEffect, useRef, type UIEvent } from 'react'

export function useScrollHalten(reihe: string) {
  const flaechen = useRef(new Map<string, HTMLElement>())
  const stellen = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    for (const [id, el] of flaechen.current) {
      const s = stellen.current.get(id)
      if (s !== undefined && Math.abs(el.scrollTop - s) > 1) el.scrollTop = s
    }
  }, [reihe])
  return {
    anmelden: (id: string, el: HTMLElement | null) => (el ? flaechen.current.set(id, el) : flaechen.current.delete(id)),
    merken: (id: string) => (e: UIEvent<HTMLElement>) => void stellen.current.set(id, e.currentTarget.scrollTop)
  }
}
