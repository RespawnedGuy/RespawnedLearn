// Handballen beim Schreiben mit Stift: Der Browser meldet die aufliegende Hand als Finger. Ohne Schutz
// tippt sie Knöpfe an, öffnet das Menü oder scrollt die Seite weg. Erkannt wird sie so:
// - Sie setzt auf, während der Stift schreibt oder ihn gerade erst verlassen hat.
// - Der Stift setzt auf, während sie schon liegt (die Hand liegt meist vor dem Stift auf).
// Die Größe der Auflagefläche zählt nicht: Windows meldet auf dem Surface schon einen normalen Finger als groß,
// dann ging außerhalb der Schreibfläche kein Fingertipp mehr durch. Windows übergeht die Hand dort selbst.
// Ein bewusster Fingertipp kurz nach dem Schreiben (mehr als STIFT_NACHLAUF) geht weiter durch.

// Einmal gesehen, gilt es für dieses Gerät dauerhaft: Nach dem Neuladen würde der Finger sonst wieder
// schreiben und radieren, bis der Stift zum ersten Mal aufsetzt (Wischen zum Blättern löschte so Tinte).
const STIFT_MERKER = 'rvx-stift'
let stiftGesehen = (() => {
  try {
    return localStorage.getItem(STIFT_MERKER) === '1'
  } catch {
    return false
  }
})()
let stiftUnten = false
let stiftZuletzt = 0
let gestartet = false
let klickSperreBis = 0
let zuletztUnten = ''
/** Aufliegende Finger mit der Zeit ihres letzten Lebenszeichens */
const liegend = new Map<number, number>()
const ballen = new Set<number>()

const STIFT_NACHLAUF = 800
const KLICK_NACHLAUF = 450
// Ein Finger ohne Lebenszeichen so lange gilt als verloren (Abheben nie gemeldet, z. B. beim App-Wechsel).
// Sonst bliebe er als Hand liegen und sperrte jeden Fingertipp, bis die Seite neu lädt.
const VERLOREN = 10000

/** Hat dieses Gerät einen Stift? Dann scrollt der Finger auf Seiten, sonst (Handy) zeichnet er. */
export const hatStift = () => stiftGesehen

/** Ist dieser Finger eine aufliegende Hand? */
export const istHandballen = (id: number) => ballen.has(id)

const stiftAktiv = () => stiftUnten || performance.now() - stiftZuletzt < STIFT_NACHLAUF

function vergiss() {
  liegend.clear()
  ballen.clear()
  stiftUnten = false
}

function aufraeumen() {
  // Solange der Stift schreibt, darf die Hand auch reglos liegen
  if (stiftAktiv()) return
  const jetzt = performance.now()
  for (const [id, zeit] of liegend) {
    if (jetzt - zeit < VERLOREN) continue
    liegend.delete(id)
    ballen.delete(id)
  }
  for (const id of ballen) if (!liegend.has(id)) ballen.delete(id)
}

function runter(e: PointerEvent) {
  zuletztUnten = e.pointerType
  if (e.pointerType === 'pen') {
    if (!stiftGesehen) {
      try {
        localStorage.setItem(STIFT_MERKER, '1')
      } catch {
        /* dann nur für diese Sitzung */
      }
    }
    stiftGesehen = true
    stiftUnten = true
    stiftZuletzt = performance.now()
    // Was jetzt schon aufliegt, ist die Hand
    for (const id of liegend.keys()) ballen.add(id)
    return
  }
  if (e.pointerType !== 'touch' || !stiftGesehen) return
  aufraeumen()
  liegend.set(e.pointerId, performance.now())
  if (stiftAktiv()) ballen.add(e.pointerId)
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
  aufraeumen()
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
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'pen') stiftZuletzt = performance.now()
      else if (e.pointerType === 'touch' && liegend.has(e.pointerId)) liegend.set(e.pointerId, performance.now())
    },
    { capture: true, passive: true },
  )
  // Wer die Seite verlässt, während etwas aufliegt, bekommt das Abheben nicht mehr gemeldet
  window.addEventListener('blur', vergiss)
  document.addEventListener('visibilitychange', () => document.hidden && vergiss())
  window.addEventListener('click', klick, true)
  window.addEventListener('contextmenu', klick, true)
}
