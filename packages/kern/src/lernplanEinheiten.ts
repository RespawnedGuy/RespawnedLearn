// Eigene Lerneinheiten eines Moduls (Vertrag Lernen 1.7, 5.3): eine Aufgabenliste unter `## Lernplan` im Rumpf der
// Moduldatei, ein Fakt oder eine Aufgabe je Zeile, optional mit Seite. Die App ändert nur das Kästchen einer Zeile und
// hängt neue Zeilen an; alles andere in der Datei bleibt Byte für Byte, wie es ist.

export const LERNPLAN_UEBERSCHRIFT = '## Lernplan'

export interface Einheit {
  /** Zeile in der ganzen Datei (ab 0) */
  zeile: number
  erledigt: boolean
  seite: number | null
  text: string
}

const AUFGABE = /^(\s*[-*] \[)([ xX])(\]\s+)(.*)$/
const SEITE = /^S\.\s*(\d+)\s*:\s*/

/** Erste Zeile nach dem Kopfbereich (`---` … `---`) */
function rumpfAb(zeilen: string[]): number {
  if (zeilen[0]?.trim() !== '---') return 0
  for (let i = 1; i < zeilen.length; i++) if (zeilen[i].trim() === '---') return i + 1
  return zeilen.length
}

/** Zeilen des Abschnitts `## Lernplan`: [erste Zeile nach der Überschrift, Ende) oder null */
function abschnitt(zeilen: string[]): [number, number] | null {
  const start = zeilen.findIndex((z, i) => i >= rumpfAb(zeilen) && z.trim() === LERNPLAN_UEBERSCHRIFT)
  if (start < 0) return null
  let ende = start + 1
  while (ende < zeilen.length && !/^#{1,2} /.test(zeilen[ende])) ende++
  return [start + 1, ende]
}

export function liesEinheiten(text: string): Einheit[] {
  const zeilen = text.split('\n')
  const b = abschnitt(zeilen)
  if (!b) return []
  const out: Einheit[] = []
  for (let i = b[0]; i < b[1]; i++) {
    const m = AUFGABE.exec(zeilen[i])
    if (!m) continue
    const s = SEITE.exec(m[4])
    out.push({ zeile: i, erledigt: m[2] !== ' ', seite: s ? Number(s[1]) : null, text: s ? m[4].slice(s[0].length) : m[4] })
  }
  return out
}

/** Kästchen einer Zeile umschalten; ist die Zeile inzwischen keine Einheit mehr, bleibt der Text unverändert */
export function schalteEinheit(text: string, zeile: number): string {
  const zeilen = text.split('\n')
  const b = abschnitt(zeilen)
  const m = AUFGABE.exec(zeilen[zeile] ?? '')
  if (!b || !m || zeile < b[0] || zeile >= b[1]) return text
  zeilen[zeile] = `${m[1]}${m[2] === ' ' ? 'x' : ' '}${m[3]}${m[4]}`
  return zeilen.join('\n')
}

/** Neue Einheit ans Ende des Abschnitts; fehlt er, kommt er ans Ende der Datei */
export function neueEinheit(text: string, inhalt: string, seite: number | null = null): string {
  const t = inhalt.replace(/\s+/g, ' ').trim()
  if (!t) return text
  const zeile = `- [ ] ${seite ? `S. ${seite}: ` : ''}${t}`
  const zeilen = text.split('\n')
  const b = abschnitt(zeilen)
  if (!b) {
    const basis = text.replace(/\n*$/, '')
    return `${basis}${basis.endsWith('---') ? '\n' : '\n\n'}${LERNPLAN_UEBERSCHRIFT}\n${zeile}\n`
  }
  let ende = b[1]
  while (ende > b[0] && !zeilen[ende - 1].trim()) ende--
  zeilen.splice(ende, 0, zeile)
  return zeilen.join('\n')
}
