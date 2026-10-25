// Tabellen im Journal (Vertrag 5.2): normales Markdown mit `|`, angezeigt als echte Tabelle.
// In einer Zelle steht ein Link als `[[ID\|Text]]`, damit sein `|` die Zelle nicht teilt.

/** Zeile einer Tabelle: beginnt mit `|` */
export function istTabellenZeile(t: string): boolean {
  return /^\s*\|/.test(t) && t.trim().length > 1
}

/** Trennzeile unter dem Kopf: `|---|:---:|` */
export function istTrennzeile(t: string): boolean {
  return /^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(t)
}

/**
 * Stellen der Spaltenstriche einer Zeile. Ein `|` nach `\` oder innerhalb von `[[ ]]` trennt keine Zelle.
 * Der erste Strich steht vor der ersten Zelle, der letzte hinter der letzten (fehlt er, endet die Zelle am Zeilenende).
 */
export function striche(t: string): number[] {
  const out: number[] = []
  let imLink = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '[' && t[i + 1] === '[') {
      imLink = true
      i++
    } else if (c === ']' && t[i + 1] === ']') {
      imLink = false
      i++
    } else if (c === '|' && !imLink) out.push(i)
  }
  return out
}

/** Zellen einer Zeile als Bereiche zwischen den Strichen (ohne die Striche) */
export function zellen(t: string): { von: number; bis: number }[] {
  const s = striche(t)
  const out: { von: number; bis: number }[] = []
  for (let i = 0; i < s.length; i++) {
    const bis = i + 1 < s.length ? s[i + 1] : t.trimEnd().length
    if (i + 1 >= s.length && bis <= s[i] + 1) break
    out.push({ von: s[i] + 1, bis })
  }
  return out
}

export interface Tabelle {
  /** Zeile des Kopfes (0-basiert) */
  kopf: number
  /** letzte Zeile der Tabelle (inklusiv) */
  ende: number
  spalten: number
}

/** Alle Tabellen eines Textes: Kopfzeile, darunter die Trennzeile, dann Zeilen mit `|`. Codeblöcke zählen nicht. */
export function tabellen(zeilen: string[]): Tabelle[] {
  const out: Tabelle[] = []
  let imCode = false
  for (let n = 0; n < zeilen.length; n++) {
    if (/^\s*(```|~~~)/.test(zeilen[n])) imCode = !imCode
    if (imCode || !istTabellenZeile(zeilen[n]) || istTrennzeile(zeilen[n]) || !istTrennzeile(zeilen[n + 1] ?? '')) continue
    let ende = n + 1
    while (ende + 1 < zeilen.length && istTabellenZeile(zeilen[ende + 1]) && !istTrennzeile(zeilen[ende + 1])) ende++
    const spalten = Math.max(zellen(zeilen[n + 1]).length, zellen(zeilen[n]).length, 1)
    out.push({ kopf: n, ende, spalten })
    n = ende
  }
  return out
}

/** Neue leere Tabelle zum Einfügen */
export function neueTabelle(spalten = 3, zeilen = 2): string {
  const zeile = '|' + '   |'.repeat(spalten)
  return [zeile, '|' + '---|'.repeat(spalten), ...Array.from({ length: zeilen }, () => zeile)].join('\n')
}

/** Leere Zeile mit gleich vielen Spalten */
export function leereZeile(spalten: number): string {
  return '|' + '   |'.repeat(spalten)
}

/**
 * Macht eine Tabellenzeile sauber: `|` in Links wird `\|` (sonst teilt er die Zelle für jedes andere Programm),
 * und jeder Spaltenstrich hat innen ein Leerzeichen neben sich (`| a | b |`). So hat auch eine leere Zelle Platz
 * für den Cursor, und am Rand einer Zelle Getipptes bleibt in ihr. Gibt die Einfügungen zurück (Stelle, Text), leer wenn alles passt.
 */
export function zeilenKorrektur(t: string): { pos: number; text: string }[] {
  const out: { pos: number; text: string }[] = []
  let imLink = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '[' && t[i + 1] === '[') {
      imLink = true
      i++
    } else if (c === ']' && t[i + 1] === ']') {
      imLink = false
      i++
    } else if (c === '|' && imLink) out.push({ pos: i, text: '\\' })
  }
  const s = striche(t)
  const leer = (x: string | undefined) => x === ' ' || x === '\t'
  for (let k = 0; k < s.length; k++) {
    if (k > 0 && !leer(t[s[k] - 1])) out.push({ pos: s[k], text: ' ' })
    if (k < s.length - 1 && !leer(t[s[k] + 1]) && t[s[k] + 1] !== '|') out.push({ pos: s[k] + 1, text: ' ' })
  }
  return out.sort((x, y) => x.pos - y.pos)
}

/** Text so umschreiben, dass er in eine Zelle passt: Links mit `\|`, Zeilenumbrüche als Leerzeichen */
export function fuerZelle(text: string): string {
  let t = text.replace(/\n+/g, ' ')
  for (const k of zeilenKorrektur(t).reverse()) t = t.slice(0, k.pos) + k.text + t.slice(k.pos)
  return t
}
