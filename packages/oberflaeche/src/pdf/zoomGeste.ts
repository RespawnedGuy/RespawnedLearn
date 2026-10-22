// Zwei Finger zoomen nur den Inhalt (Plan, Skript), nie die ganze Seite mit Kopf und Werkzeugleiste.
// Die Zeichenebene (Tinte.tsx) fängt die Finger selbst ab; hier geht es um alles andere, vor allem um „Lesen“.
import { useEffect, type RefObject } from 'react'

export type Punkt = { x: number; y: number }
export const mitteVon = (p: Punkt[]): Punkt => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 })
export const abstandVon = (p: Punkt[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)

/** Scrollbare Vorfahren je Richtung, sonst die Seite selbst */
export function scroller(el: Element | null, achse: 'x' | 'y'): Element {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p)[achse === 'x' ? 'overflowX' : 'overflowY']
    const passt = achse === 'x' ? p.scrollWidth > p.clientWidth : p.scrollHeight > p.clientHeight
    if ((o === 'auto' || o === 'scroll') && passt) return p
  }
  return document.scrollingElement ?? document.documentElement
}

/** Während der Geste nur skalieren (flüssig), am Ende einmal neu zeichnen lassen; die Stelle unter den Fingern bleibt dort */
export function zoomeUm(el: Element | null, faktor: number, mitte: Punkt, onZoom: (faktor: number) => void) {
  // Welcher Vorfahr danach scrollt, steht erst nach dem Neuzeichnen fest, deshalb vorher alle Stände merken
  const vorher = new Map<Element, { x: number; y: number; l: number; t: number }>()
  const seite = document.scrollingElement ?? document.documentElement
  for (let p: Element | null = el?.parentElement ?? null; p; p = p.parentElement) {
    const r = p === seite ? { left: 0, top: 0 } : p.getBoundingClientRect()
    vorher.set(p, { x: p.scrollLeft, y: p.scrollTop, l: r.left, t: r.top })
  }
  onZoom(faktor)
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const nx = scroller(el, 'x')
      const ny = scroller(el, 'y')
      const ax = vorher.get(nx)
      const ay = vorher.get(ny)
      if (ax) nx.scrollLeft = (ax.x + mitte.x - ax.l) * faktor - (mitte.x - ax.l)
      if (ay) ny.scrollTop = (ay.y + mitte.y - ay.t) * faktor - (mitte.y - ay.t)
    })
  )
}

const punkte = (t: TouchList): Punkt[] => [...t].slice(0, 2).map((p) => ({ x: p.clientX, y: p.clientY }))
/** Diese Finger gehören der Zeichenebene (Stift, Markieren …), die zoomt selbst */
const zeichnet = (t: TouchList) => [...t].some((p) => p.target instanceof Element && !!p.target.closest('.zeichnen .ebene'))

/** Zwei Finger auf der Fläche (data-zoomflaeche) verschieben und zoomen sie */
export function useZweiFingerZoom(ref: RefObject<HTMLElement | null>, onZoom: ((faktor: number) => void) | undefined, bereit: unknown) {
  useEffect(() => {
    const el = ref.current
    if (!el || !onZoom) return
    let g: { abstand: number; letzte: Punkt; faktor: number; ziel: HTMLElement } | null = null

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2 || zeichnet(e.touches)) return
      const ziel = el.querySelector<HTMLElement>('[data-zoomflaeche]') ?? el
      const p = punkte(e.touches)
      const mitte = mitteVon(p)
      const r = ziel.getBoundingClientRect()
      ziel.style.transformOrigin = `${mitte.x - r.left}px ${mitte.y - r.top}px`
      g = { abstand: abstandVon(p), letzte: mitte, faktor: 1, ziel }
      if (e.cancelable) e.preventDefault()
    }
    const bewegen = (e: TouchEvent) => {
      if (!g || e.touches.length < 2) return
      const p = punkte(e.touches)
      const mitte = mitteVon(p)
      // Läuft schon ein Scrollen des Browsers, verschiebt er selbst; sonst schieben beide Finger
      if (e.cancelable) {
        e.preventDefault()
        scroller(el, 'x').scrollLeft -= mitte.x - g.letzte.x
        scroller(el, 'y').scrollTop -= mitte.y - g.letzte.y
      }
      g.letzte = mitte
      if (g.abstand > 0) {
        g.faktor = abstandVon(p) / g.abstand
        g.ziel.style.transform = `scale(${g.faktor})`
      }
    }
    const ende = (e: TouchEvent) => {
      if (!g || e.touches.length >= 2) return
      const { ziel, faktor, letzte } = g
      g = null
      ziel.style.transform = ''
      if (Math.abs(faktor - 1) >= 0.02) zoomeUm(ziel, faktor, letzte, onZoom)
    }
    el.addEventListener('touchstart', start, { passive: false })
    el.addEventListener('touchmove', bewegen, { passive: false })
    el.addEventListener('touchend', ende)
    el.addEventListener('touchcancel', ende)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', bewegen)
      el.removeEventListener('touchend', ende)
      el.removeEventListener('touchcancel', ende)
    }
  }, [ref, onZoom, bereit])
}
