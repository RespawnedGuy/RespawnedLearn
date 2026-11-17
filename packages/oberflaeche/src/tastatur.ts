// Bildschirmtastatur am Handy: Sie schiebt nur den sichtbaren Bereich zusammen, nicht die Seite.
// Was unten „fest“ sitzt, läge sonst hinter der Tastatur. Darum steht ihre Höhe in --tastatur.
let gestartet = false

export function beobachteTastatur() {
  const vv = window.visualViewport
  if (gestartet || !vv) return
  gestartet = true
  const setze = () => {
    const unten = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    document.documentElement.style.setProperty('--tastatur', `${unten}px`)
    document.documentElement.style.setProperty('--sichtbar', `${Math.round(vv.height)}px`)
  }
  vv.addEventListener('resize', setze)
  vv.addEventListener('scroll', setze)
  setze()
}

/** Finger statt Maus: Handy und Tablet ohne Tastatur */
export const mitFinger = () => window.matchMedia('(pointer: coarse)').matches

/** Abstand zum Rand des sichtbaren Bereichs, damit das Menü nicht an der Tastatur klebt */
export const SICHT_RAND = 12

/**
 * Wie weit ein Element nach oben rücken muss, damit es im sichtbaren Bereich liegt (positiv = nach oben rücken).
 * Passt es nicht ganz hinein, bleibt sein oberer Rand sichtbar: Dort sitzt das Eingabefeld. Alle Maße in Pixeln
 * gegenüber dem Fenster (getBoundingClientRect); `sicht` ist der Teil, den die Tastatur frei lässt.
 */
export function rueckung(el: { oben: number; unten: number }, sicht: { oben: number; unten: number }, rand = SICHT_RAND): number {
  const zuTief = el.unten - (sicht.unten - rand)
  if (zuTief <= 0) return Math.min(0, el.oben - (sicht.oben + rand))
  return Math.min(zuTief, el.oben - (sicht.oben + rand))
}

function scrollVorfahr(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/**
 * Hält ein schwebendes Menü mit Eingabefeld über der Bildschirmtastatur: beim Öffnen, wenn die Tastatur aufgeht und
 * wenn das Menü wächst (z. B. der KI-Vorschlag kommt nach). Gerückt wird der scrollende Inhalt darunter, nicht das Menü.
 * Liefert eine Funktion zum Aufräumen; taugt so direkt als Ref (React 19).
 */
export function haltSichtbar(el: HTMLElement | null): () => void {
  if (!el) return () => {}
  const vv = window.visualViewport
  const pruefe = () => {
    const r = el.getBoundingClientRect()
    const oben = vv ? vv.offsetTop : 0
    let unten = oben + (vv ? vv.height : window.innerHeight)
    // Was unten fest sitzt (Funktionsleiste am Handy), deckt ebenfalls zu
    for (const f of document.querySelectorAll<HTMLElement>('.funktionsleiste')) {
      const fr = f.getBoundingClientRect()
      if (fr.height > 0 && getComputedStyle(f).position === 'fixed') unten = Math.min(unten, fr.top)
    }
    const d = rueckung({ oben: r.top, unten: r.bottom }, { oben, unten })
    if (d === 0) return
    const p = scrollVorfahr(el)
    if (p) p.scrollTop += d
    else window.scrollBy(0, d)
  }
  pruefe()
  vv?.addEventListener('resize', pruefe)
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(pruefe)
  ro?.observe(el)
  return () => {
    vv?.removeEventListener('resize', pruefe)
    ro?.disconnect()
  }
}
