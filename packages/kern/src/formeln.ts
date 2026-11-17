// Formeln im Satz: `$…$` (LaTeX, so schreiben es die KI-Anweisungen vor). Rein, damit Anzeige und Kürzen dieselbe Regel nutzen.

export type FormelTeil = { art: 'text' | 'formel'; text: string }

/** Eine Formel im Satz: zwischen zwei `$`, ohne `$` und ohne Zeilenumbruch dazwischen (Blockformeln `$$…$$` behandelt die Anzeige vorher) */
const FORMEL = /\$([^$\n]+)\$/g

/** Zerlegt Text in Text- und Formelstücke; ein einzelnes `$` (z. B. ein Betrag) bleibt Text */
export function formelTeile(text: string): FormelTeil[] {
  const teile: FormelTeil[] = []
  let pos = 0
  for (const m of text.matchAll(FORMEL)) {
    if (m.index > pos) teile.push({ art: 'text', text: text.slice(pos, m.index) })
    teile.push({ art: 'formel', text: m[1] })
    pos = m.index + m[0].length
  }
  if (pos < text.length) teile.push({ art: 'text', text: text.slice(pos) })
  return teile
}

/**
 * Kürzt einen Titel auf höchstens `max` Zeichen samt „…“, ohne eine Formel zu zerschneiden:
 * Fiele der Schnitt in eine Formel, wird vor ihr gekürzt; steht die Formel ganz vorn, bleibt sie ganz.
 */
export function kuerzeOhneFormelbruch(text: string, max: number): string {
  if (text.length <= max) return text
  let schnitt = max - 1
  for (const m of text.matchAll(FORMEL)) {
    const von = m.index
    const bis = von + m[0].length
    if (schnitt > von && schnitt < bis) {
      schnitt = text.slice(0, von).trim() ? von : bis
      break
    }
  }
  const rest = text.slice(0, schnitt).trimEnd()
  return rest.length < text.length ? `${rest}…` : text
}
