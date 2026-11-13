// Übergänge beim Wechsel der Ansicht (View Transitions, WebView2 und Android-WebView ab Chromium 111).
// Die Richtung sagt, wie die neue Ansicht kommt: tiefer von rechts, zurück von links, anderer Bereich blendet über.
// Ohne Unterstützung wechselt die Ansicht wie bisher sofort. Die Bewegung selbst steht in bewegung.css.
import { flushSync } from 'react-dom'

export type Richtung = 'keine' | 'wechsel' | 'tiefer' | 'zurueck'

function teile(hash: string): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

/** Seite im Buch oder Zeile am Ende gehört zur selben Ansicht (wie `ansicht()` in ort.ts) */
function ohneStelle(t: string[]): string[] {
  return t.length > 1 && /^\d+$/.test(t[t.length - 1]) ? t.slice(0, -1) : t
}

const beginntMit = (lang: string[], kurz: string[]) => kurz.every((x, i) => lang[i] === x)

/**
 * Wie die neue Ansicht kommen soll. `zurueckImVerlauf`: Der Wechsel kam über „Zurück“ (Knopf, Geste, Browser).
 * Eine andere Stelle in derselben Ansicht (Seite im Skript) bewegt nichts.
 */
export function richtung(alt: string, neu: string, zurueckImVerlauf = false): Richtung {
  const a = ohneStelle(teile(alt))
  const n = ohneStelle(teile(neu))
  if (a.join('/') === n.join('/')) return 'keine'
  if (zurueckImVerlauf) return 'zurueck'
  if (!a.length || !n.length || a[0] !== n[0]) return 'wechsel'
  if (n.length > a.length && beginntMit(n, a)) return 'tiefer'
  if (n.length < a.length && beginntMit(a, n)) return 'zurueck'
  // Kein Teil des anderen (Modul → Skript, Skript → Modul über „oben“): ohne klare Richtung nur überblenden
  return 'wechsel'
}

type MitUebergang = Document & { startViewTransition?: (f: () => void) => { finished: Promise<void> } }

/**
 * Führt `aendern` aus, mit Übergang, wenn die WebView ihn kann und die Seite sichtbar ist. `flushSync` sorgt dafür,
 * dass React die neue Ansicht zeichnet, bevor der Übergang das neue Bild aufnimmt.
 */
export function mitUebergang(r: Richtung, aendern: () => void) {
  const d = document as MitUebergang
  if (r === 'keine' || !d.startViewTransition || d.hidden) {
    aendern()
    return
  }
  const wurzel = d.documentElement
  wurzel.dataset.uebergang = r
  try {
    d.startViewTransition(() => flushSync(aendern)).finished.finally(() => {
      if (wurzel.dataset.uebergang === r) delete wurzel.dataset.uebergang
    })
  } catch {
    delete wurzel.dataset.uebergang
    aendern()
  }
}
