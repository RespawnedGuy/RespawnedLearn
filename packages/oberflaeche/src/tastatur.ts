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
