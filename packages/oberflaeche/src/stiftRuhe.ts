// Stift und Handballen am PC und Tablet: Solange der Stift aufliegt und eine halbe Sekunde danach, gilt „schreibt“.
// Dann wird die Werkzeugspalte durchlässig (glas.css über data-stift) und ein Finger oder Handballen schaltet in
// den Leisten nichts um. Ein Stifttipp auf eine Leiste selbst zählt nicht als Schreiben, sonst verschwände sie
// mitten im Tippen.

/** So lange nach dem Absetzen des Stifts gilt noch „schreibt“ (ms) */
export const RUHE_MS = 500

export class StiftRuhe {
  private auf = false
  private zuletzt = Number.NEGATIVE_INFINITY

  ab(t: number) {
    this.auf = true
    this.zuletzt = t
  }

  hoch(t: number) {
    this.auf = false
    this.zuletzt = t
  }

  schreibt(t: number): boolean {
    return this.auf || t - this.zuletzt < RUHE_MS
  }

  /** Darf ein Finger (oder Handballen) gerade etwas in einer Leiste auslösen? */
  fingerErlaubt(t: number): boolean {
    return !this.schreibt(t)
  }
}

export const stiftRuhe = new StiftRuhe()

/** Hört auf den Stift und setzt data-stift="schreibt" am Dokument; gibt das Abmelden zurück */
export function beobachteStift(): () => void {
  const wurzel = document.documentElement
  let zeit: ReturnType<typeof setTimeout> | undefined
  const inLeiste = (e: PointerEvent) => e.target instanceof Element && !!e.target.closest('.funktionsleiste')
  const ab = (e: PointerEvent) => {
    if (e.pointerType !== 'pen' || inLeiste(e)) return
    clearTimeout(zeit)
    stiftRuhe.ab(e.timeStamp)
    wurzel.dataset.stift = 'schreibt'
  }
  const hoch = (e: PointerEvent) => {
    if (e.pointerType !== 'pen' || wurzel.dataset.stift !== 'schreibt') return
    stiftRuhe.hoch(e.timeStamp)
    clearTimeout(zeit)
    zeit = setTimeout(() => delete wurzel.dataset.stift, RUHE_MS)
  }
  addEventListener('pointerdown', ab, true)
  addEventListener('pointerup', hoch, true)
  addEventListener('pointercancel', hoch, true)
  return () => {
    removeEventListener('pointerdown', ab, true)
    removeEventListener('pointerup', hoch, true)
    removeEventListener('pointercancel', hoch, true)
    clearTimeout(zeit)
  }
}
