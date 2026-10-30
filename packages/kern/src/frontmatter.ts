// Frontmatter lesen und gezielt ändern, ohne den Rest anzufassen (Vertrag 1.3: Unbekanntes bleibt erhalten).
// Bewusst nur ein kleiner YAML-Ausschnitt: oberste Ebene `schluessel: wert`, Listen in Klammerschreibweise.
// Verschachtelte Blöcke (z. B. `abgeleitet:`) werden gelesen als roher Text und nie umgeschrieben.

export type Wert = string | number | boolean | null | Wert[]

export interface Dokument {
  /** Zeilen zwischen den `---`, ohne die Begrenzer; null, wenn die Datei keinen Kopf hat */
  kopf: string | null
  rumpf: string
}

const KOPF = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export function zerlege(text: string): Dokument {
  const m = KOPF.exec(text)
  if (!m) return { kopf: null, rumpf: text }
  return { kopf: m[1], rumpf: text.slice(m[0].length) }
}

export function zusammen(d: Dokument): string {
  if (d.kopf === null) return d.rumpf
  return `---\n${d.kopf}\n---\n${d.rumpf}`
}

function liesWert(roh: string): Wert {
  const s = roh.trim()
  if (s === '' || s === '~' || s === 'null') return null
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    try {
      return JSON.parse(s) as string
    } catch {
      return s.slice(1, -1)
    }
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'")
  if (s.startsWith('[') && s.endsWith(']')) return teileListe(s.slice(1, -1)).map(liesWert)
  return s.replace(/\s+#.*$/, '')
}

/** Trennt `a, "b, c", [[x]]` an Kommas außerhalb von Anführungszeichen und Klammern */
function teileListe(s: string): string[] {
  const teile: string[] = []
  let tiefe = 0
  let in_ = ''
  let akt = ''
  for (const z of s) {
    if (in_) {
      if (z === in_) in_ = ''
    } else if (z === '"' || z === "'") in_ = z
    else if (z === '[' || z === '{') tiefe++
    else if (z === ']' || z === '}') tiefe--
    else if (z === ',' && tiefe === 0) {
      teile.push(akt)
      akt = ''
      continue
    }
    akt += z
  }
  if (akt.trim()) teile.push(akt)
  return teile.map((t) => t.trim())
}

export function felder(kopf: string | null): Record<string, Wert> {
  const out: Record<string, Wert> = {}
  if (!kopf) return out
  const zeilen = kopf.split(/\r?\n/)
  for (let i = 0; i < zeilen.length; i++) {
    const m = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*))?$/.exec(zeilen[i])
    if (!m) continue
    const roh = m[2] ?? ''
    if (roh.trim() === '') {
      // Blockliste `- a` darunter lesen, verschachtelte Objekte bleiben unberührt
      const liste: Wert[] = []
      let j = i + 1
      while (j < zeilen.length && /^\s+-\s+/.test(zeilen[j])) {
        liste.push(liesWert(zeilen[j].replace(/^\s+-\s+/, '')))
        j++
      }
      out[m[1]] = liste.length ? liste : null
      continue
    }
    out[m[1]] = liesWert(roh)
  }
  return out
}

function braucht_anfuehrung(s: string): boolean {
  return (
    s === '' ||
    /^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(s) ||
    /:\s|\s#/.test(s) ||
    /\s$/.test(s) ||
    // Mehrzeiliges (Beschreibung eines Fotos) steht in einer Zeile mit \n, sonst zerfällt der Kopf
    /[\n\r\t]/.test(s) ||
    /^(true|false|null|~|-?\d+(\.\d+)?)$/.test(s)
  )
}

export function schreibWert(w: Wert): string {
  if (w === null) return ''
  if (typeof w === 'number' || typeof w === 'boolean') return String(w)
  if (Array.isArray(w)) return `[${w.map(schreibWert).join(', ')}]`
  return braucht_anfuehrung(w) ? JSON.stringify(w) : w
}

/** Setzt ein Feld der obersten Ebene. Alle anderen Zeilen bleiben byte-genau erhalten. */
export function setzeFeld(text: string, schluessel: string, wert: Wert | undefined): string {
  const d = zerlege(text)
  const zeilen = d.kopf === null ? [] : d.kopf.split('\n')
  const start = zeilen.findIndex((z) => z.startsWith(`${schluessel}:`))
  let ende = start
  if (start >= 0) while (ende + 1 < zeilen.length && /^\s+\S/.test(zeilen[ende + 1])) ende++
  const neu = wert === undefined ? [] : [`${schluessel}: ${schreibWert(wert)}`.trimEnd()]
  if (start >= 0) zeilen.splice(start, ende - start + 1, ...neu)
  else zeilen.push(...neu)
  return zusammen({ kopf: zeilen.join('\n'), rumpf: d.rumpf })
}

export function neuesDokument(kopf: [string, Wert][], rumpf = ''): string {
  const zeilen = kopf.map(([k, w]) => `${k}: ${schreibWert(w)}`.trimEnd())
  return `---\n${zeilen.join('\n')}\n---\n${rumpf}`
}

/** `[[ID]]` oder `[[ID|Text]]` → ID */
export function linkZiel(w: Wert | undefined): string | null {
  if (typeof w !== 'string') return null
  const m = /^\[\[([^\]|#]+)/.exec(w.trim())
  return m ? m[1] : null
}
