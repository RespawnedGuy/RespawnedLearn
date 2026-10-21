// Handballen beim Schreiben mit Stift: Der Browser meldet die aufliegende Hand als Finger. Ohne Schutz
// tippt sie Knöpfe an, öffnet das Menü oder scrollt die Seite weg. Erkannt wird sie so:
// - Sie setzt auf, während der Stift schreibt oder ihn gerade erst verlassen hat.
// - Der Stift setzt auf, während sie schon liegt (die Hand liegt meist vor dem Stift auf).
// - Ihre Auflagefläche ist groß (Windows meldet sie, iPad meist nicht).
// Ein bewusster Fingertipp kurz nach dem Schreiben (mehr als STIFT_NACHLAUF) geht weiter durch.

let stiftGesehen = false
let stiftUnten = false
let stiftZuletzt = 0
let gestartet = false
let klickSperreBis = 0
let zuletztUnten = ''
const liegend = new Set<number>()
const ballen = new Set<number>()

const STIFT_NACHLAUF = 800
const KLICK_NACHLAUF = 450
const GROSS = 32

/** Hat dieses Gerät einen Stift? Dann scrollt der Finger auf Seiten, sonst (Handy) zeichnet er. */
export const hatStift = () => stiftGesehen

/** Ist dieser Finger eine aufliegende Hand? */
export const istHandballen = (id: number) => ballen.has(id)

const stiftAktiv = () => stiftUnten || performance.now() - stiftZuletzt < STIFT_NACHLAUF

function runter(e: PointerEvent) {
  zuletztUnten = e.pointerType
  if (e.pointerType === 'pen') {
    stiftGesehen = true
    stiftUnten = true
    stiftZuletzt = performance.now()
    // Was jetzt schon aufliegt, ist die Hand
    for (const id of liegend) ballen.add(id)
    return
  }
  if (e.pointerType !== 'touch' || !stiftGesehen) return
  liegend.add(e.pointerId)
  if (stiftAktiv() || e.width > GROSS || e.height > GROSS) ballen.add(e.pointerId)
  if (!ballen.has(e.pointerId)) return
  // Auf der Schreibfläche entscheidet TintenEbene selbst, überall sonst kommt die Hand nicht an
  if ((e.target as Element | null)?.closest?.('.ebene')) return
  e.preventDefault()
  e.stopPropagation()
}

function hoch(e: PointerEvent) {
  if (e.pointerType === 'pen') {
    stiftUnten = false
    stiftZuletzt = performance.now()
    return
  }
  if (e.pointerType !== 'touch') return
  liegend.delete(e.pointerId)
  if (ballen.delete(e.pointerId)) klickSperreBis = performance.now() + KLICK_NACHLAUF
}

/** Klicks, die eine aufliegende Hand auslöst (beim Abheben), kommen nie an */
function klick(e: Event) {
  const pe = e as PointerEvent
  // Safari kennt pointerType am Klick nicht immer, dann zählt, was zuletzt aufgesetzt hat
  const art = pe.pointerType || zuletztUnten
  if (art === 'pen' || art === 'mouse') return
  const jetzt = performance.now()
  if (ballen.size === 0 && jetzt > klickSperreBis) return
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
}

/** Einmal je Seite: Schutz vor dem Handballen, sobald eine Schreibfläche da ist */
export function beachteHandballen() {
  if (gestartet || typeof window === 'undefined') return
  gestartet = true
  const opt = { capture: true, passive: false }
  window.addEventListener('pointerdown', runter, opt)
  window.addEventListener('pointerup', hoch, true)
  window.addEventListener('pointercancel', hoch, true)
  // Stift über der Fläche (Surface Pen, Apple Pencil mit Schweben) zählt als „gerade aktiv“
  window.addEventListener('pointermove', (e) => e.pointerType === 'pen' && (stiftZuletzt = performance.now()), { capture: true, passive: true })
  window.addEventListener('click', klick, true)
  window.addEventListener('contextmenu', klick, true)
}
