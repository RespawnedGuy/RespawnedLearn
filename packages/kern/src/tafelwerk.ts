// Tafelwerk (Vertrag Lernen 1.13, 5.3): eigene Nachschlage-Seiten aus Bausteinen. Jeder Tab ist ein Notizbuch mit
// `art: tafelwerk`; hinein kommt nur, was der Nutzer hineinlegt, immer als Ausschnitt mit ✦-Verweis aufs Original.
// Ob ein Baustein schon drin ist, wird aus den Buchseiten der Tabs gerechnet. Ein „Nein“ schreibt jedes Gerät in seine
// eigene Datei `lernen/tafelwerk/nein.<geraet>.jsonl`; gelesen wird die Vereinigung aller Geräte.
import type { Baustein } from './bausteine'
import type { Eintrag } from './bestand'
import { liesBuchSeite } from './buecher'
import { normalisiere } from './suche'

export const TAFELWERK = 'tafelwerk'

type Doc = Pick<Eintrag, 'id' | 'typ' | 'titel' | 'felder'>

/** Ist das ein Tab des Tafelwerks? */
export function istTafel(e: Pick<Eintrag, 'typ' | 'felder'> | undefined | null): boolean {
  return !!e && e.typ === 'notizbuch' && e.felder.art === TAFELWERK
}

/** Die Tabs, die nicht weggelegt sind, in der Reihenfolge des Anlegens (bei Gleichstand nach ID) */
export function tafeln<T extends Doc>(dokumente: Iterable<T>): T[] {
  const erstellt = (e: T) => String(e.felder.erstellt ?? '')
  return [...dokumente].filter((e) => istTafel(e) && e.felder.status !== 'archiviert').sort((a, b) => erstellt(a).localeCompare(erstellt(b)) || a.id.localeCompare(b.id))
}

/** Schlüssel eines Bausteins: Quelle (Skript, Buch, Mitschrift) und ID der Markierung */
export const bausteinSchluessel = (anhang: string, marke: string) => `${anhang}#${marke}`

const BUCHSEITE = /^lernen\/buecher\/([^/]+)\/S\d{3,}\.json$/

/**
 * Wo liegen welche Bausteine im Tafelwerk? Schlüssel → Tab-IDs, aus den ✦-Verweisen (`marke`) der Seiten aller Tabs
 * in `tabs` (auch weggelegter, damit ein Baustein in einem weggelegten Tab nicht erneut angeboten wird).
 */
export function imTafelwerk(texte: ReadonlyMap<string, string>, tabs: ReadonlySet<string>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [pfad, text] of texte) {
    const tab = BUCHSEITE.exec(pfad)?.[1]
    if (!tab || !tabs.has(tab) || !text.includes('"marke"')) continue
    for (const v of liesBuchSeite(text).verweise) {
      if (v.marke === undefined) continue
      const k = bausteinSchluessel(v.anhang, v.marke)
      const da = out.get(k)
      if (!da) out.set(k, [tab])
      else if (!da.includes(tab)) da.push(tab)
    }
  }
  return out
}

/** Eine Zeile für die Nein-Datei des Geräts (JSON Lines, nur anhängen) */
export function neinZeile(anhang: string, marke: string, am: string): string {
  return JSON.stringify({ am, anhang, marke }) + '\n'
}

const NEIN = /^lernen\/tafelwerk\/nein\.[^/]+\.jsonl$/

/** Alle Bausteine, die irgendein Gerät nicht im Tafelwerk haben will; beschädigte Zeilen zählen nicht */
export function liesNein(texte: ReadonlyMap<string, string>): Set<string> {
  const out = new Set<string>()
  for (const [pfad, text] of texte) {
    if (!NEIN.test(pfad)) continue
    for (const z of text.split('\n')) {
      if (!z.trim()) continue
      try {
        const w = JSON.parse(z) as { anhang?: unknown; marke?: unknown }
        if (typeof w.anhang === 'string' && typeof w.marke === 'string') out.add(bausteinSchluessel(w.anhang, w.marke))
      } catch {
        /* halb übertragen oder von Hand verändert: diese Zeile übergehen */
      }
    }
  }
  return out
}

/**
 * Was „Neu n“ anbietet: benannte Bausteine mit Bereich (Skript oder Buch), nicht weggelegt, nicht offen, nicht im
 * Tafelwerk selbst markiert, noch in keinem Tab und nicht abgelehnt. Die neuesten zuerst.
 */
export function neuFuerTafelwerk(alle: Baustein[], drin: ReadonlyMap<string, unknown>, nein: ReadonlySet<string>, tabs: ReadonlySet<string>): Baustein[] {
  return alle
    .filter((b) => {
      if (b.archiviert || b.offen || b.marke.anker !== undefined || b.marke.bereich.b <= 0 || tabs.has(b.anhang)) return false
      const k = bausteinSchluessel(b.anhang, b.marke.id)
      return !drin.has(k) && !nein.has(k)
    })
    .sort((a, b) => b.marke.datum.localeCompare(a.marke.datum) || a.anhang.localeCompare(b.anhang) || b.marke.seite - a.marke.seite || a.marke.zeile - b.marke.zeile)
}

/**
 * Reihenfolge der Tabs für einen Baustein, ohne KI: zuerst ein Tab, dessen Name ein Schlagwort ist oder im Namen des
 * Bausteins steht, dann Tabs, in denen schon Bausteine derselben Quelle liegen (die meisten zuerst), dann die übrigen
 * in ihrer Reihenfolge.
 */
export function tabVorschlag(b: Pick<Baustein, 'anhang' | 'name' | 'schlagworte'>, tabs: { id: string; titel: string }[], drin: ReadonlyMap<string, string[]>): string[] {
  const worte = b.schlagworte.map(normalisiere)
  const name = normalisiere(b.name)
  const passt = (titel: string) => {
    const t = normalisiere(titel).trim()
    return !!t && (worte.includes(t) || worte.includes(t.replace(/\s+/g, '-')) || ` ${name} `.includes(` ${t} `))
  }
  const gleicheQuelle = new Map<string, number>()
  const vorne = `${b.anhang}#`
  for (const [k, ids] of drin) if (k.startsWith(vorne)) for (const id of ids) gleicheQuelle.set(id, (gleicheQuelle.get(id) ?? 0) + 1)
  const wert = (t: { titel: string; id: string }) => (passt(t.titel) ? 1e6 : 0) + (gleicheQuelle.get(t.id) ?? 0)
  return tabs
    .map((t, i) => ({ t, i, w: wert(t) }))
    .sort((x, y) => y.w - x.w || x.i - y.i)
    .map((x) => x.t.id)
}
