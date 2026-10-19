// Darstellung im Editor: Markdown bleibt der gespeicherte Text, angezeigt wird es ruhig und direkt bedienbar.
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { Range } from '@codemirror/state'
import { ankerParameter, findeLinks, type Link } from '@rvx/kern'

export interface DarstellungHilfen {
  /** Bild eines markierten Ausschnitts (Stelle im Plan oder Skript) */
  ausschnitt(anhangId: string, seite: number, markeId: string): Promise<string | null>
  /** Bild eines Anhangs (Foto, Screenshot) */
  bild(id: string): Promise<string | null>
  /** Wissen aus der Lern-App zum Einbetten, null wenn die ID kein Wissen ist */
  wissen(id: string): { titel: string; text: string } | null
  titel(id: string): string | null
  oeffne(l: Link): void
}

class Kasten extends WidgetType {
  constructor(readonly an: boolean, readonly pos: number) {
    super()
  }
  eq(o: Kasten) {
    return o.an === this.an && o.pos === this.pos
  }
  toDOM(view: EditorView) {
    const s = document.createElement('span')
    s.className = `cm-kasten${this.an ? ' an' : ''}`
    s.setAttribute('role', 'checkbox')
    s.setAttribute('aria-checked', String(this.an))
    s.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ changes: { from: this.pos, to: this.pos + 1, insert: this.an ? ' ' : 'x' } })
    })
    return s
  }
  ignoreEvent() {
    return true
  }
}

class StatusMarke extends WidgetType {
  constructor(readonly status: string) {
    super()
  }
  eq(o: StatusMarke) {
    return o.status === this.status
  }
  toDOM() {
    const s = document.createElement('span')
    s.className = `cm-status cm-status-${this.status}`
    s.textContent = this.status
    return s
  }
}

class Verweis extends WidgetType {
  constructor(readonly text: string, readonly link: Link, readonly oeffne: (l: Link) => void) {
    super()
  }
  eq(o: Verweis) {
    return o.text === this.text && o.link.ziel === this.link.ziel && o.link.anker === this.link.anker
  }
  toDOM() {
    const s = document.createElement('span')
    s.className = 'cm-link'
    s.textContent = this.text
    s.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.oeffne(this.link)
    })
    return s
  }
  ignoreEvent() {
    return true
  }
}

class Bild extends WidgetType {
  constructor(readonly schluessel: string, readonly titel: string, readonly laden: () => Promise<string | null>, readonly klick: () => void) {
    super()
  }
  eq(o: Bild) {
    return o.schluessel === this.schluessel && o.titel === this.titel
  }
  toDOM() {
    const s = document.createElement('span')
    s.className = 'cm-ausschnitt'
    const platz = document.createElement('span')
    platz.className = 'platz'
    s.append(platz)
    const t = document.createElement('span')
    t.textContent = this.titel
    s.append(t)
    void this.laden().then((url) => {
      if (!url) return
      const img = document.createElement('img')
      img.src = url
      img.alt = this.titel
      platz.replaceWith(img)
    })
    s.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.klick()
    })
    return s
  }
  ignoreEvent() {
    return true
  }
}

class Wissen extends WidgetType {
  constructor(readonly titel: string, readonly text: string, readonly klick: () => void) {
    super()
  }
  eq(o: Wissen) {
    return o.titel === this.titel && o.text === this.text
  }
  toDOM() {
    const s = document.createElement('span')
    s.className = 'cm-wissen'
    const b = document.createElement('b')
    b.textContent = this.titel
    s.append(b, document.createElement('br'), this.text)
    s.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.klick()
    })
    return s
  }
  ignoreEvent() {
    return true
  }
}

const UEBERSCHRIFT = /^(#{1,6})( +)(.*)$/
const STATUS = /\s+[-–]\s+(offen|blockiert|wartet|erledigt|gelöst)(?=\s+\^[a-z0-9-]+$|$)/i
const AUFGABE = /^(\s*)([-*] \[( |x|X)\] )/

function baue(view: EditorView, h: DarstellungHilfen): DecorationSet {
  const doc = view.state.doc
  const deko: Range<Decoration>[] = []
  const cursorZeilen = new Set<number>()
  if (view.hasFocus) for (const r of view.state.selection.ranges) {
    const a = doc.lineAt(r.from).number
    const b = doc.lineAt(r.to).number
    for (let n = a; n <= b; n++) cursorZeilen.add(n)
  }
  let imCode = false
  let callout: 'blockade' | 'sonst' | null = null

  for (let n = 1; n <= doc.lines; n++) {
    const zeile = doc.line(n)
    const t = zeile.text
    if (/^\s*(```|~~~)/.test(t)) {
      imCode = !imCode
      continue
    }
    if (imCode) continue
    const roh = cursorZeilen.has(n)

    if (t.startsWith('>')) {
      if (callout === null) callout = /^>\s*\[!blockade\]/i.test(t) ? 'blockade' : 'sonst'
      deko.push(Decoration.line({ class: callout === 'blockade' ? 'cm-blockade' : 'cm-callout' }).range(zeile.from))
      if (!roh) {
        // `> ` und `[!blockade]` ausblenden, „Wenn/Dann/Prüfen“ hervorheben
        const zeichen = /^>\s?/.exec(t)![0].length
        deko.push(Decoration.replace({}).range(zeile.from, zeile.from + zeichen))
        const art = /^\[!(\w+)\][+-]?\s?/.exec(t.slice(zeichen))
        if (art) deko.push(Decoration.replace({ widget: new StatusMarke(art[1].toLowerCase()) }).range(zeile.from + zeichen, zeile.from + zeichen + art[0].length))
        const feld = /^(Wenn|Dann|Prüfen|Pruefen):/i.exec(t.slice(zeichen))
        if (feld) deko.push(Decoration.mark({ class: 'cm-feld' }).range(zeile.from + zeichen, zeile.from + zeichen + feld[0].length))
      }
    } else callout = null

    const u = UEBERSCHRIFT.exec(t)
    if (u) {
      const ebene = u[1].length
      deko.push(Decoration.line({ class: `cm-h${ebene}` }).range(zeile.from))
      deko.push(Decoration.mark({ class: 'cm-zeichen' }).range(zeile.from, zeile.from + ebene))
      if (ebene === 1) {
        const tag = /^#[\p{L}\d_][\p{L}\d_/-]*/u.exec(u[3])
        if (tag) {
          const von = zeile.from + ebene + u[2].length
          deko.push(Decoration.mark({ class: 'cm-projekttag' }).range(von, von + tag[0].length))
        }
      }
      const s = STATUS.exec(t)
      if (s && !roh) deko.push(Decoration.replace({ widget: new StatusMarke(s[1].toLowerCase()) }).range(zeile.from + s.index, zeile.from + s.index + s[0].length))
      continue
    }

    const a = AUFGABE.exec(t)
    if (a) {
      const von = zeile.from + a[1].length
      const an = a[3] !== ' '
      deko.push(Decoration.replace({ widget: new Kasten(an, von + 3) }).range(von, von + a[2].length))
      if (an && zeile.to > von + a[2].length) deko.push(Decoration.mark({ class: 'cm-erledigt-text' }).range(von + a[2].length, zeile.to))
    }

    if (roh) continue
    for (const l of findeLinks(t)) {
      const von = zeile.from + l.von
      const bis = zeile.from + l.bis
      const p = ankerParameter(l.anker)
      let w: WidgetType
      if (l.einbettung && p.marke) {
        w = new Bild(`${l.ziel}#${l.anker}`, l.anzeige ?? 'Stelle', () => h.ausschnitt(l.ziel, Number(p.seite) || 1, p.marke), () => h.oeffne(l))
      } else if (l.einbettung && h.wissen(l.ziel)) {
        const wi = h.wissen(l.ziel)!
        w = new Wissen(wi.titel, wi.text, () => h.oeffne(l))
      } else if (l.einbettung) {
        w = new Bild(l.ziel, l.anzeige ?? h.titel(l.ziel) ?? 'Anhang', () => h.bild(l.ziel), () => h.oeffne(l))
      } else {
        w = new Verweis(l.anzeige ?? h.titel(l.ziel) ?? 'nicht gefunden', l, h.oeffne)
      }
      deko.push(Decoration.replace({ widget: w }).range(von, bis))
    }
  }
  return Decoration.set(deko, true)
}

export function darstellung(hilfen: () => DarstellungHilfen) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = baue(view, hilfen())
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged) this.decorations = baue(u.view, hilfen())
      }
    },
    { decorations: (v) => v.decorations }
  )
}
