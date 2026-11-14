// Mitschriften der Lern-App (Vertrag 5.3): eine `notiz`, deren `thema` ein Modul ist. Die Überschriften sind
// die Gliederung, so wie sie dastehen. Lernkarten stehen nicht in der Mitschrift, sondern zeigen mit
// `stelle: "[[notiz#^anker]]"` auf einen Absatz; dort steht nur die Blockkennung `^anker` am Zeilenende.
import type { Bestand, Eintrag } from './bestand'
import { linkZiel } from './frontmatter'
import { findeLinks } from './links'

export interface Ueberschrift {
  ebene: number
  titel: string
  /** Zeile im Rumpf (0-basiert) */
  zeile: number
}

const UEBERSCHRIFT = /^(#{1,6})\s+(.*?)\s*$/
const ANKER = /\s\^([a-z0-9-]+)\s*$/

/** Überschrift ohne Linkklammern, Blockkennung und Markdown-Zeichen */
export function klarTitel(t: string): string {
  return t
    .replace(/!?\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/!?\[\[([^\]#|]*)[^\]]*\]\]/g, '$1')
    .replace(ANKER, '')
    .replace(/[*_`]/g, '')
    .trim()
}

/** Alle Überschriften außerhalb von Codeblöcken, in der Reihenfolge des Textes */
export function gliederung(rumpf: string): Ueberschrift[] {
  const out: Ueberschrift[] = []
  let code = false
  rumpf.split('\n').forEach((z, zeile) => {
    if (/^\s*(```|~~~)/.test(z)) code = !code
    if (code) return
    const m = UEBERSCHRIFT.exec(z)
    if (m && m[2].trim()) out.push({ ebene: m[1].length, titel: klarTitel(m[2]), zeile })
  })
  return out
}

/**
 * Oberste Ebene, die wirklich gliedert. Eine Hülle wie „## Mitschrift“, unter der fast alles steht (neben
 * kurzem „## Beschreibung“), zählt nicht: Dann gilt die Ebene darunter (wie bei Büchern mit nur einem Teil).
 */
export function obersteEbene(teile: Ueberschrift[], zeilen = Infinity): number {
  const ebenen = [...new Set(teile.map((u) => u.ebene))].sort((a, b) => a - b)
  if (!ebenen.length) return 1
  const ende = Math.min(zeilen, (teile[teile.length - 1]?.zeile ?? 0) + 1)
  for (const e of ebenen.slice(0, -1)) {
    const oben = teile.filter((u) => u.ebene <= e)
    const auf = teile.filter((u) => u.ebene === e)
    const gesamt = ende - auf[0].zeile
    // Umfang jedes Abschnitts dieser Ebene: bis zur nächsten Überschrift gleicher oder höherer Ebene
    const groesster = Math.max(...auf.map((u) => (oben.find((x) => x.zeile > u.zeile)?.zeile ?? ende) - u.zeile))
    if (auf.length > 1 && groesster < 0.8 * gesamt) return e
  }
  return ebenen[ebenen.length - 1]
}

/** Die Überschriften über einer Zeile, von außen nach innen (etwa „Apparatur › Zimmersignalleuchten“), ohne Hüllen */
export function abschnittAn(rumpf: string, zeile: number): string[] {
  const teile = gliederung(rumpf)
  const oben = obersteEbene(teile, rumpf.split('\n').length)
  const pfad: Ueberschrift[] = []
  for (const u of teile.filter((x) => x.ebene >= oben)) {
    if (u.zeile > zeile) break
    while (pfad.length && pfad[pfad.length - 1].ebene >= u.ebene) pfad.pop()
    pfad.push(u)
  }
  return pfad.map((u) => u.titel)
}

/** Blockkennung am Ende einer Zeile, falls vorhanden */
export function ankerIn(zeile: string): string | null {
  return ANKER.exec(zeile)?.[1] ?? null
}

/** Zeile (0-basiert) mit dieser Blockkennung, sonst -1 */
export function zeileVonAnker(rumpf: string, anker: string): number {
  const a = anker.replace(/^\^/, '')
  return rumpf.split('\n').findIndex((z) => ankerIn(z) === a)
}

/** Mitschriften eines Moduls, älteste zuerst (so wie der Lehrgang lief) */
export function mitschriftenVon(b: Bestand, modulId: string): Eintrag[] {
  const zeit = (e: Eintrag) => String(e.felder.erstellt ?? '')
  return b
    .nachTyp('notiz')
    .filter((e) => linkZiel(e.felder.thema) === modulId)
    .sort((x, y) => zeit(x).localeCompare(zeit(y)) || x.titel.localeCompare(y.titel, 'de'))
}

/** Wohin eine Lernkarte zeigt: Mitschrift und Blockkennung aus `stelle` */
export function stelleVon(e: Eintrag): { notiz: string; anker: string } | null {
  const w = e.felder.stelle
  if (typeof w !== 'string') return null
  const l = findeLinks(w)[0]
  if (!l?.anker?.startsWith('^')) return null
  return { notiz: l.ziel, anker: l.anker.slice(1) }
}

/** Lernkarten, die auf eine Mitschrift zeigen */
export function kartenAus(b: Bestand, notizId: string): Eintrag[] {
  return b.nachTyp('frage').filter((e) => stelleVon(e)?.notiz === notizId)
}

/**
 * Text eines Bausteins aus einer Mitschrift (Vertrag Lernen 1.10, 5.4): der Absatz, an dessen letzter Zeile die
 * Blockkennung steht, nach oben bis zur Leerzeile oder Überschrift; eine Überschrift mit Kennung steht für sich.
 * Ohne die Kennung selbst. Gibt es die Kennung nicht (mehr), null.
 */
export function absatzAmAnker(rumpf: string, anker: string): string | null {
  const zeilen = rumpf.split('\n')
  const bis = zeileVonAnker(rumpf, anker)
  if (bis < 0) return null
  let von = bis
  if (!/^#{1,6}\s/.test(zeilen[bis])) while (von > 0 && zeilen[von - 1].trim() && !/^#{1,6}\s/.test(zeilen[von - 1])) von--
  return zeilen
    .slice(von, bis + 1)
    .map((z) => z.replace(ANKER, ''))
    .join('\n')
    .trim()
}
