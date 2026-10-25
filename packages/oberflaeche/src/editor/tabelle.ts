// Tabellen im Editor: Der Text bleibt Markdown mit `|`, jede Zeile wird ein Raster aus Zellen. Geschrieben wird
// direkt in der Zelle wie im übrigen Journal (Aufgaben, Links, „/“). Die Striche sind unsichtbar, Tab springt
// zur nächsten Zelle, Enter legt eine neue Zeile an. Steht der Cursor in der Tabelle, gibt es darunter vier Knöpfe.
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type ViewUpdate } from '@codemirror/view'
import { completionStatus } from '@codemirror/autocomplete'
import { EditorSelection, EditorState, Prec, Transaction, type Extension, type Range, type Text } from '@codemirror/state'
import { leereZeile, striche, tabellen, zeilenKorrektur, zellen, type Tabelle } from '@rvx/kern'

export interface TabellenZeile {
  tabelle: Tabelle
  /** 1-basierte Zeilennummern im Dokument */
  kopf: number
  ende: number
  rolle: 'kopf' | 'trenner' | 'zeile'
}

/** Welche Zeilen (1-basiert) zu einer Tabelle gehören */
export function tabellenZeilen(doc: Text): Map<number, TabellenZeile> {
  const out = new Map<number, TabellenZeile>()
  const text = doc.toString()
  if (!text.includes('|')) return out
  for (const t of tabellen(text.split('\n'))) {
    for (let n = t.kopf; n <= t.ende; n++)
      out.set(n + 1, { tabelle: t, kopf: t.kopf + 1, ende: t.ende + 1, rolle: n === t.kopf ? 'kopf' : n === t.kopf + 1 ? 'trenner' : 'zeile' })
  }
  return out
}

/** Steht die Stelle in einer Tabellenzeile (nicht in der Trennzeile)? Dann bietet das Einfügen-Menü nur, was in eine Zelle passt. */
export function inTabelle(state: EditorState, pos: number): boolean {
  const z = tabellenZeilen(state.doc).get(state.doc.lineAt(pos).number)
  return !!z && z.rolle !== 'trenner'
}

class LeereZelle extends WidgetType {
  constructor(readonly pos: number, readonly erste: boolean) {
    super()
  }
  eq(o: LeereZelle) {
    return o.pos === this.pos && o.erste === this.erste
  }
  toDOM(view: EditorView) {
    const s = document.createElement('span')
    s.className = this.erste ? 'cm-zelle erste' : 'cm-zelle'
    s.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ changes: { from: this.pos, insert: ' ' }, selection: { anchor: this.pos + 1 } })
      view.focus()
    })
    return s
  }
  ignoreEvent() {
    return true
  }
}

type Knopf = 'zeile' | 'spalte' | 'zeile-weg' | 'spalte-weg'

const KNOEPFE: [Knopf, string, string][] = [
  ['zeile', '+ Zeile', 'Zeile darunter einfügen'],
  ['spalte', '+ Spalte', 'Spalte rechts einfügen'],
  ['zeile-weg', '− Zeile', 'Diese Zeile löschen'],
  ['spalte-weg', '− Spalte', 'Diese Spalte löschen']
]

/** Knöpfe unter der Tabelle, solange der Cursor darin steht. Sie nehmen dem Editor den Fokus nicht. */
class Leiste extends WidgetType {
  constructor(readonly kopf: number, readonly gesperrt: boolean) {
    super()
  }
  eq(o: Leiste) {
    return o.kopf === this.kopf && o.gesperrt === this.gesperrt
  }
  toDOM(view: EditorView) {
    const d = document.createElement('span')
    d.className = 'cm-tabelle-leiste'
    for (const [art, text, titel] of KNOEPFE) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = text
      b.title = titel
      b.disabled = this.gesperrt
      b.addEventListener('mousedown', (e) => {
        e.preventDefault()
        bearbeite(view, art)
      })
      d.append(b)
    }
    return d
  }
  ignoreEvent() {
    return true
  }
}

/** Spalte der Stelle in ihrer Zeile (0-basiert) */
function spalteAn(t: string, offset: number): number {
  const z = zellen(t)
  const i = z.findIndex((c) => offset <= c.bis)
  return i < 0 ? Math.max(0, z.length - 1) : i
}

function bearbeite(view: EditorView, art: Knopf) {
  const state = view.state
  const pos = state.selection.main.head
  const zeile = state.doc.lineAt(pos)
  const info = tabellenZeilen(state.doc).get(zeile.number)
  if (!info) return
  const spalte = spalteAn(zeile.text, pos - zeile.from)
  const n = info.tabelle.spalten
  if (art === 'zeile') {
    const ziel = info.rolle === 'trenner' ? state.doc.line(zeile.number) : zeile
    const insert = '\n' + leereZeile(n)
    view.dispatch({ changes: { from: ziel.to, insert }, selection: { anchor: ziel.to + 3 }, userEvent: 'input.tabelle' })
  } else if (art === 'zeile-weg') {
    if (info.rolle !== 'zeile') return
    const vor = state.doc.line(zeile.number - 1)
    const g = grenzen(vor.text)
    view.dispatch({ changes: { from: vor.to, to: zeile.to }, selection: { anchor: vor.from + (g ? g[0] : 0) }, userEvent: 'delete.tabelle' })
  } else {
    const changes: { from: number; to?: number; insert?: string }[] = []
    if (art === 'spalte-weg' && n <= 1) return
    for (let i = info.kopf; i <= info.ende; i++) {
      const l = state.doc.line(i)
      const s = striche(l.text)
      if (art === 'spalte') {
        // hinter der Zelle der Cursorspalte einfügen; fehlt der Strich am Ende, bleibt die Zeile am Ende offen
        const nach = s[spalte + 1]
        const insert = i === info.kopf + 1 ? '---|' : '   |'
        if (nach !== undefined) changes.push({ from: l.from + nach + 1, insert })
        else changes.push({ from: l.to, insert: (l.text.trimEnd().endsWith('|') ? '' : '|') + insert })
      } else {
        const von = s[spalte]
        if (von === undefined) continue
        const bis = s[spalte + 1] ?? l.text.length
        changes.push({ from: l.from + von, to: l.from + bis })
      }
    }
    const set = state.changes(changes)
    view.dispatch({ changes: set, selection: EditorSelection.cursor(set.mapPos(pos, -1)), userEvent: art === 'spalte' ? 'input.tabelle' : 'delete.tabelle' })
  }
  view.focus()
}

/** Dekoration einer Tabellenzeile; ruft `baue` in darstellung.ts für jede Zeile der Tabelle auf */
export function dekoriereZeile(
  deko: Range<Decoration>[],
  zeile: { from: number; to: number; text: string; number: number },
  info: TabellenZeile,
  cursorIn: boolean,
  gesperrt: boolean
) {
  const t = zeile.text
  if (info.rolle === 'trenner') {
    deko.push(Decoration.line({ class: 'cm-tabelle-trenner' }).range(zeile.from))
    if (t.length) deko.push(Decoration.replace({}).range(zeile.from, zeile.to))
    return
  }
  const s = striche(t)
  const z = zellen(t)
  const klasse = `cm-tabelle-zeile${info.rolle === 'kopf' ? ' kopf' : ''}${zeile.number === info.ende ? ' letzte' : ''}`
  deko.push(Decoration.line({ class: klasse, attributes: { style: `--spalten: ${info.tabelle.spalten}` } }).range(zeile.from))
  // Einrückung vor dem ersten Strich und Rest hinter dem letzten gehören zu keiner Zelle
  if (s[0] > 0) deko.push(Decoration.replace({}).range(zeile.from, zeile.from + s[0]))
  for (let i = 0; i < z.length; i++) {
    const strich = zeile.from + z[i].von - 1
    if (z[i].bis > z[i].von) {
      deko.push(Decoration.replace({}).range(strich, strich + 1))
      deko.push(Decoration.mark({ class: i === 0 ? 'cm-zelle erste' : 'cm-zelle', inclusive: true }).range(zeile.from + z[i].von, zeile.from + z[i].bis))
    } else deko.push(Decoration.replace({ widget: new LeereZelle(strich + 1, i === 0) }).range(strich, strich + 1))
  }
  const restVon = z.length ? z[z.length - 1].bis : s[0] + 1
  if (restVon < t.length) deko.push(Decoration.replace({}).range(zeile.from + restVon, zeile.to))
  if (cursorIn && zeile.number === info.ende) deko.push(Decoration.widget({ widget: new Leiste(info.kopf, gesperrt), side: 1 }).range(zeile.to))
}

/** Erlaubter Cursorbereich einer Tabellenzeile: hinter dem ersten Strich bis vor den letzten */
function grenzen(t: string): [number, number] | null {
  const z = zellen(t)
  if (!z.length) return null
  return [z[0].von, z[z.length - 1].bis]
}

/** Der Cursor bleibt in den Zellen: vor dem ersten oder hinter dem letzten Strich ließe sich die Zeile nur zerbrechen */
const inZellenHalten = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection || tr.selection.ranges.length !== 1 || !tr.selection.main.empty) return tr
  const state = tr.state
  const pos = tr.selection.main.head
  const zeile = state.doc.lineAt(pos)
  if (!zeile.text.includes('|')) return tr
  const info = tabellenZeilen(state.doc).get(zeile.number)
  if (!info || info.rolle === 'trenner') return tr
  const g = grenzen(zeile.text)
  if (!g) return tr
  const neu = Math.min(Math.max(pos - zeile.from, g[0]), g[1]) + zeile.from
  if (neu === pos) return tr
  return [tr, { selection: { anchor: neu }, sequential: true }]
})

function zelleWaehlen(view: EditorView, richtung: 1 | -1): boolean {
  const state = view.state
  const pos = state.selection.main.head
  const zeile = state.doc.lineAt(pos)
  const map = tabellenZeilen(state.doc)
  const info = map.get(zeile.number)
  if (!info || info.rolle === 'trenner') return false
  const z = zellen(zeile.text)
  const i = spalteAn(zeile.text, pos - zeile.from)
  const geheZu = (l: { from: number; text: string }, c: { von: number; bis: number }) => {
    const innen = l.text.slice(c.von, c.bis)
    const a = l.from + c.von + (innen.length - innen.trimStart().length)
    const b = l.from + c.von + innen.trimEnd().length
    // Leere Zelle: hinter das erste Leerzeichen, nicht direkt vor den unsichtbaren Strich (dort landet die Eingabe sonst in der Nachbarzelle)
    view.dispatch({ selection: b > a ? { anchor: a, head: b } : { anchor: l.from + Math.min(c.von + 1, c.bis) }, scrollIntoView: true })
    return true
  }
  if (z[i + richtung]) return geheZu(zeile, z[i + richtung])
  // Über das Zeilenende hinaus: nächste bzw. vorige Zeile, hinter der letzten Zeile entsteht eine neue
  let n = zeile.number + richtung
  if (map.get(n)?.rolle === 'trenner') n += richtung
  if (n >= info.kopf && n <= info.ende) {
    const l = state.doc.line(n)
    const zz = zellen(l.text)
    if (zz.length) return geheZu(l, richtung === 1 ? zz[0] : zz[zz.length - 1])
  }
  if (richtung === -1) return true
  neueZeile(view)
  return true
}

function neueZeile(view: EditorView): boolean {
  const state = view.state
  const zeile = state.doc.lineAt(state.selection.main.head)
  const info = tabellenZeilen(state.doc).get(zeile.number)
  if (!info) return false
  const ziel = info.rolle === 'kopf' ? state.doc.line(zeile.number + 1) : zeile
  const insert = '\n' + leereZeile(info.tabelle.spalten)
  view.dispatch({ changes: { from: ziel.to, insert }, selection: { anchor: ziel.to + 3 }, scrollIntoView: true, userEvent: 'input.tabelle' })
  return true
}

/** Enter in einer Tabelle: neue Zeile darunter. In einer leeren letzten Zeile beendet Enter die Tabelle. */
function enter(view: EditorView): boolean {
  const state = view.state
  if (!state.selection.main.empty || completionStatus(state) === 'active') return false
  const zeile = state.doc.lineAt(state.selection.main.head)
  const info = tabellenZeilen(state.doc).get(zeile.number)
  if (!info || info.rolle === 'trenner') return false
  const leer = zellen(zeile.text).every((c) => !zeile.text.slice(c.von, c.bis).trim())
  if (leer && info.rolle === 'zeile' && zeile.number === info.ende) {
    view.dispatch({ changes: { from: zeile.from, to: zeile.to, insert: '' }, selection: { anchor: zeile.from }, userEvent: 'delete.tabelle' })
    return true
  }
  return neueZeile(view)
}

/** Pos1 und Ende bleiben in der Zelle; steht der Cursor schon am Rand, gilt die ganze Zeile wie sonst */
function zellenRand(ende: boolean, erweitern: boolean) {
  return (view: EditorView): boolean => {
    const state = view.state
    const r = state.selection.main
    const zeile = state.doc.lineAt(r.head)
    const info = tabellenZeilen(state.doc).get(zeile.number)
    if (!info || info.rolle === 'trenner') return false
    const c = zellen(zeile.text)[spalteAn(zeile.text, r.head - zeile.from)]
    if (!c) return false
    const innen = zeile.text.slice(c.von, c.bis)
    const ziel = zeile.from + (ende ? c.von + innen.trimEnd().length : c.von + (innen.length - innen.trimStart().length))
    if (ziel === r.head) return false
    view.dispatch({ selection: erweitern ? { anchor: r.anchor, head: ziel } : { anchor: ziel }, scrollIntoView: true })
    return true
  }
}

/** Löschen über einen unsichtbaren Strich hinweg würde zwei Zellen verschmelzen: dort passiert nichts */
function loeschen(richtung: 1 | -1) {
  return (view: EditorView): boolean => {
    const state = view.state
    const r = state.selection.main
    if (!r.empty) {
      // Markierung über mehrere Zellen: nur den Inhalt der Zellen leeren, die Striche bleiben
      const a = state.doc.lineAt(r.from)
      const info = tabellenZeilen(state.doc).get(a.number)
      if (!info || !state.sliceDoc(r.from, r.to).includes('|')) return false
      const changes: { from: number; to: number }[] = []
      for (let n = a.number; n <= state.doc.lineAt(r.to).number; n++) {
        const l = state.doc.line(n)
        for (const c of zellen(l.text)) {
          const von = Math.max(l.from + c.von, r.from)
          const bis = Math.min(l.from + c.bis, r.to)
          if (bis > von) changes.push({ from: von, to: bis })
        }
      }
      view.dispatch({ changes, selection: { anchor: r.from }, userEvent: 'delete.tabelle' })
      return true
    }
    const zeile = state.doc.lineAt(r.head)
    const info = tabellenZeilen(state.doc).get(zeile.number)
    if (!info || info.rolle === 'trenner') return false
    const o = r.head - zeile.from
    const nachbar = richtung === -1 ? zeile.text[o - 1] : zeile.text[o]
    if (nachbar !== '|' || (richtung === -1 && zeile.text[o - 2] === '\\')) return false
    if (!striche(zeile.text).includes(richtung === -1 ? o - 1 : o)) return false
    // Ganz leere Zeile (nicht der Kopf) mit Rückschritt am Anfang: die Zeile verschwindet
    const leer = zellen(zeile.text).every((c) => !zeile.text.slice(c.von, c.bis).trim())
    if (richtung === -1 && leer && info.rolle === 'zeile' && o === zellen(zeile.text)[0]?.von) {
      const vor = state.doc.line(zeile.number - 1)
      const g = grenzen(vor.text)
      view.dispatch({ changes: { from: vor.to, to: zeile.to }, selection: { anchor: vor.from + (g ? g[1] : vor.text.length) }, userEvent: 'delete.tabelle' })
    }
    return true
  }
}

/**
 * Nach jeder Eingabe die berührten Tabellenzeilen sauber halten: `|` in Links wird `\|`, leere Zellen behalten
 * ein Leerzeichen. So bleibt die Datei gültiges Markdown, egal ob die Aufgabe, ein Link oder ein Kontakt eingefügt wurde.
 */
const sauberHalten = ViewPlugin.fromClass(
  class {
    update(u: ViewUpdate) {
      if (!u.docChanged || u.transactions.every((t) => t.annotation(Transaction.remote))) return
      const doc = u.state.doc
      const zeilen = new Set<number>()
      u.changes.iterChangedRanges((_a, _b, von, bis) => {
        for (let n = doc.lineAt(von).number; n <= doc.lineAt(bis).number; n++) zeilen.add(n)
      })
      const map = tabellenZeilen(doc)
      const changes: { from: number; insert: string }[] = []
      for (const n of zeilen) {
        const info = map.get(n)
        if (!info || info.rolle === 'trenner') continue
        const l = doc.line(n)
        for (const k of zeilenKorrektur(l.text)) changes.push({ from: l.from + k.pos, insert: k.text })
      }
      if (!changes.length) return
      const view = u.view
      queueMicrotask(() => {
        if (view.state.doc !== doc) return
        view.dispatch({ changes, userEvent: 'input.tabelle' })
      })
    }
  }
)

export const tabellenBedienung: Extension = [
  inZellenHalten,
  sauberHalten,
  Prec.high(keymap.of([
    { key: 'Tab', run: (v) => zelleWaehlen(v, 1), shift: (v) => zelleWaehlen(v, -1) },
    { key: 'Enter', run: enter },
    { key: 'Home', run: zellenRand(false, false), shift: zellenRand(false, true) },
    { key: 'End', run: zellenRand(true, false), shift: zellenRand(true, true) },
    { key: 'Backspace', run: loeschen(-1) },
    { key: 'Delete', run: loeschen(1) }
  ]))
]
