// Bausteine (Vertrag Lernen 1.8, 5.4): Jede Markierung ist ein Baustein, den man in allen Skripten wiederfindet.
// Der Text der Markierungszeile trägt Name, Schlagworte `#wort` und Verweise `[[ID|Titel]]`:
//
//   - S. 12 · Stammfunktion umformen #integral [[01JB…|Wie lautet …?]] %%rn …%% ^c4n8q1
//
// Ohne Name, Schlagwort und Verweis ist ein Baustein offen; `#archiv` legt ihn weg, ohne ihn zu löschen.
import { findeLinks } from './links'
import { liesMarken, type Marke } from './marken'
import { normalisiere } from './suche'

export const ARCHIV = 'archiv'

/** Was „Nur markieren“ bis Lernen 1.6 als Text schrieb; zählt nicht als Name */
const PLATZHALTER = 'Markiert'

const SCHLAGWORT = /(^|\s)#([\p{L}\p{N}_/-]+)/gu

export interface BausteinText {
  /** eigener Name, ohne Schlagworte und Verweise */
  name: string
  /** Schlagworte ohne `#`, ohne `archiv`, in der Reihenfolge des Textes, jedes einmal */
  schlagworte: string[]
  /** Verweise auf Karten: Ziel und Titel */
  verweise: { ziel: string; titel: string }[]
  archiviert: boolean
}

export function liesBausteinText(text: string): BausteinText {
  const links = findeLinks(text)
  const verweise = links.filter((l) => !l.einbettung).map((l) => ({ ziel: l.ziel, titel: (l.anzeige ?? '').trim() }))
  let rest = ''
  let ab = 0
  for (const l of links) {
    rest += text.slice(ab, l.von) + ' '
    ab = l.bis
  }
  rest += text.slice(ab)
  const worte: string[] = []
  rest = rest.replace(SCHLAGWORT, (_, vor: string, w: string) => {
    worte.push(w)
    return vor
  })
  const name = rest.replace(/\s+/g, ' ').trim()
  const archiviert = worte.some((w) => w.toLowerCase() === ARCHIV)
  const schlagworte = [...new Set(worte.filter((w) => w.toLowerCase() !== ARCHIV))]
  return { name: name === PLATZHALTER ? '' : name, schlagworte, verweise, archiviert }
}

/** Text der Zeile aus den Teilen; Reihenfolge: Name, Schlagworte, `#archiv`, Verweise */
export function bausteinText(t: BausteinText): string {
  const teile = [t.name.replace(/\s+/g, ' ').trim()]
  for (const w of t.schlagworte) teile.push(`#${w}`)
  if (t.archiviert) teile.push(`#${ARCHIV}`)
  for (const v of t.verweise) teile.push(`[[${v.ziel}${v.titel ? `|${v.titel.replace(/[[\]|]/g, '')}` : ''}]]`)
  return teile.filter(Boolean).join(' ')
}

/**
 * Neuer Name samt Schlagworten aus einer Eingabe wie „Stammfunktion #integral“. Verweise und der Archiv-Stand
 * bleiben, wie sie sind; ein `#archiv` in der Eingabe zählt nicht (weglegen geht über `archiviere`).
 */
export function benenne(text: string, eingabe: string): string {
  const alt = liesBausteinText(text)
  const neu = liesBausteinText(eingabe)
  return bausteinText({ ...alt, name: neu.name, schlagworte: neu.schlagworte })
}

export function archiviere(text: string, ja: boolean): string {
  return bausteinText({ ...liesBausteinText(text), archiviert: ja })
}

/** Verweis auf eine Karte anhängen (aus dem Baustein wird eine Lernkarte); Name und Schlagworte bleiben */
export function mitVerweis(text: string, ziel: string, titel: string): string {
  const alt = liesBausteinText(text)
  if (alt.verweise.some((v) => v.ziel === ziel)) return bausteinText(alt)
  return bausteinText({ ...alt, verweise: [...alt.verweise, { ziel, titel }] })
}

/** Eingabe fürs Namensfeld: Name und Schlagworte, so wie man sie tippt */
export function eingabeVon(t: BausteinText): string {
  return [t.name, ...t.schlagworte.map((w) => `#${w}`)].filter(Boolean).join(' ')
}

export interface Baustein extends BausteinText {
  /** Anhang (Skript), zu dem die Markierung gehört */
  anhang: string
  marke: Marke
  /** angezeigter Name: eigener Name, sonst Titel des ersten Verweises, sonst leer */
  titel: string
  offen: boolean
}

export function istOffen(t: BausteinText): boolean {
  return !t.archiviert && !t.name && !t.schlagworte.length && !t.verweise.length
}

const MARKEN = /^lernen\/markierungen\/([^/]+)\.md$/

/** Alle Bausteine aus den Markierungsdateien (`lernen/markierungen/<anhang-id>.md`), auch weggelegte */
export function alleBausteine(texte: ReadonlyMap<string, string>): Baustein[] {
  const out: Baustein[] = []
  for (const [pfad, text] of texte) {
    const anhang = MARKEN.exec(pfad)?.[1]
    if (!anhang) continue
    for (const marke of liesMarken(text)) {
      const t = liesBausteinText(marke.text)
      out.push({ ...t, anhang, marke, titel: t.name || t.verweise.find((v) => v.titel)?.titel || '', offen: istOffen(t) })
    }
  }
  return out
}

/** Offene Bausteine, die ältesten zuerst (die fragt man zuerst: „brauchst du das noch?“) */
export function offeneBausteine(alle: Baustein[]): Baustein[] {
  return alle.filter((b) => b.offen).sort((a, b) => a.marke.datum.localeCompare(b.marke.datum) || a.anhang.localeCompare(b.anhang) || a.marke.seite - b.marke.seite)
}

/**
 * Suche über Name, Schlagworte und Titel der Verweise, ohne Rücksicht auf Groß/klein, Umlaute und `#`. Jedes Wort der
 * Anfrage muss vorkommen. Weggelegte Bausteine kommen nicht vor. Reihenfolge: Treffer im Namen vor Schlagworten vor
 * Verweisen, bei Gleichstand die jüngsten zuerst. `quelle` liefert den Titel des Skripts, der mitgesucht wird.
 */
export function sucheBausteine(alle: Baustein[], anfrage: string, quelle: (anhang: string) => string = () => ''): Baustein[] {
  const worte = normalisiere(anfrage).replace(/#/g, ' ').split(/\s+/).filter(Boolean)
  if (!worte.length) return []
  const treffer: { b: Baustein; wert: number }[] = []
  for (const b of alle) {
    if (b.archiviert || b.offen) continue
    const name = normalisiere(b.titel)
    const worteB = b.schlagworte.map(normalisiere)
    const verweise = normalisiere(b.verweise.map((v) => v.titel).join(' '))
    const skript = normalisiere(quelle(b.anhang))
    let wert = 0
    let alleDa = true
    for (const w of worte) {
      const im = worteB.some((s) => s === w) ? 3 : name.includes(w) ? 2 : worteB.some((s) => s.includes(w)) ? 1.5 : verweise.includes(w) ? 1 : skript.includes(w) ? 0.5 : 0
      if (!im) {
        alleDa = false
        break
      }
      wert += im
    }
    if (alleDa) treffer.push({ b, wert })
  }
  return treffer.sort((x, y) => y.wert - x.wert || y.b.marke.datum.localeCompare(x.b.marke.datum)).map((t) => t.b)
}
