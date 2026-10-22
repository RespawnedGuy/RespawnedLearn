// Volltextsuche über Journal, Aufgaben und Projekte (die Lupe oben). Rein funktional, damit sie ohne Browser testbar ist.
// Gesucht wird nach allen Wörtern zugleich, ohne Rücksicht auf Groß/klein und Umlaute („mangel“ findet „Mängel“).
import type { Bestand } from './bestand'
import { blockText } from './journal'

export type TrefferArt = 'journal' | 'aufgabe' | 'projekt'

export interface Treffer {
  art: TrefferArt
  titel: string
  /** lesbarer Ausschnitt um die Fundstelle */
  text: string
  /** Kürzel des Projekts, falls zugeordnet */
  projekt: string | null
  pfad: string
  /** Journal: Tag und Zeile in der Datei */
  datum?: string
  zeile?: number
  /** Aufgabe oder Projekt */
  id?: string
}

export interface SuchFilter {
  /** nur Treffer dieses Projekts (Kürzel) */
  projekt?: string | null
  art?: TrefferArt | null
}

export function normalisiere(s: string): string {
  return s.toLocaleLowerCase('de').replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '')
}

/** Links lesbar machen: `[[ID|Titel]]` → Titel, Einbettungen fallen weg */
export function lesbar(text: string): string {
  return text
    .replace(/!\[\[[^\]\n]*\]\]/g, '')
    .replace(/\[\[([^\]|\n]+)\|([^\]\n]+)\]\]/g, '$2')
    .replace(/\[\[([^\]\n]+)\]\]/g, '$1')
}

export function suchWoerter(frage: string): string[] {
  return normalisiere(frage).split(/\s+/).filter(Boolean)
}

function passt(text: string, woerter: string[]) {
  const n = normalisiere(text)
  return woerter.every((w) => n.includes(w))
}

/** Ausschnitt von etwa 140 Zeichen um das erste gefundene Wort */
function ausschnitt(text: string, woerter: string[]): string {
  const t = text.replace(/\s+/g, ' ').trim()
  const n = normalisiere(t)
  const i = Math.max(0, Math.min(...woerter.map((w) => n.indexOf(w)).filter((x) => x >= 0), t.length))
  const von = Math.max(0, i - 40)
  return (von > 0 ? '…' : '') + t.slice(von, von + 140) + (von + 140 < t.length ? '…' : '')
}

export function suche(b: Bestand, frage: string, filter: SuchFilter = {}): Treffer[] {
  const woerter = suchWoerter(frage)
  if (!woerter.length) return []
  const out: Treffer[] = []
  const projektPasst = (k: string | null) => !filter.projekt || k === filter.projekt
  const art = (a: TrefferArt) => !filter.art || filter.art === a

  if (art('projekt')) {
    for (const p of b.projekte) {
      if (!projektPasst(p.kuerzel)) continue
      if (passt(`${p.titel} ${p.kuerzel}`, woerter)) out.push({ art: 'projekt', titel: p.titel, text: `#${p.kuerzel}`, projekt: p.kuerzel, pfad: p.pfad, id: p.id })
    }
  }

  if (art('aufgabe')) {
    for (const e of b.nachTyp('aufgabe')) {
      const k = b.projektVonAufgabe(e.id)
      if (!projektPasst(k)) continue
      const rumpf = lesbar(e.rumpf)
      if (!passt(`${e.titel}\n${rumpf}`, woerter)) continue
      out.push({ art: 'aufgabe', titel: e.titel, text: ausschnitt(rumpf, woerter), projekt: k, pfad: e.pfad, id: e.id })
    }
  }

  if (art('journal')) {
    for (const j of b.journale) {
      const zeilen = j.text.split('\n')
      for (const t of j.gliederung.teile) {
        if (!projektPasst(t.kuerzel)) continue
        const text = lesbar(blockText(j.text, t))
        if (!passt(text, woerter)) continue
        // Die Zeile mit den meisten Wörtern, damit der Sprung an die richtige Stelle führt
        let zeile = t.von
        let best = -1
        for (let z = t.von; z < t.bis && z < zeilen.length; z++) {
          const n = normalisiere(lesbar(zeilen[z]))
          const zahl = woerter.filter((w) => n.includes(w)).length
          if (zahl > best) (best = zahl), (zeile = z)
        }
        out.push({ art: 'journal', titel: t.zusatz, text: ausschnitt(lesbar(zeilen[zeile] ?? text), woerter) || ausschnitt(text, woerter), projekt: t.kuerzel, pfad: j.pfad, datum: j.datum, zeile })
      }
    }
  }
  return out
}
