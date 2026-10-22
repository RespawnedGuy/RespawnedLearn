// Darstellung im Editor: Markdown bleibt der gespeicherte Text, angezeigt wird es ruhig und direkt bedienbar.
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { StateEffect, type Range } from '@codemirror/state'
import { ankerParameter, findeLinks, type Link } from '@rvx/kern'

export interface DarstellungHilfen {
  /** Bild eines markierten Ausschnitts (Stelle im Plan oder Skript) */
  ausschnitt(anhangId: string, seite: number, markeId: string): Promise<string | null>
  /** Bild eines Anhangs (Foto, Screenshot) */
  bild(id: string): Promise<string | null>
  /** Stand der Zeichnung auf einem Bild: ändert er sich, wird die Vorschau neu geladen */
  bildStand?(id: string): string
  /** Wissen aus der Lern-App zum Einbetten, null wenn die ID kein Wissen ist */
  wissen(id: string): { titel: string; text: string } | null
  titel(id: string): string | null
  oeffne(l: Link): void
  /** Zustand einer eigenen Aufgabe (offen, wartet, blockiert, faellig, erledigt, verworfen), null bei allem anderen */
  zustand?(id: string): string | null
  /** Bei einer blockierten Aufgabe die erste offene, an der sie hängt; sie steht im Satz gleich dahinter */
  blockierer?(id: string): { id: string; titel: string; zustand: string } | null
  /** Fotos in der Notiz einer Aufgabe; sie stehen im Journal klein direkt hinter dem Aufgabenlink */
  aufgabeBilder?(id: string): string[]
  /** Aufnahme eines Anhangs (Sprachnotiz), null bei allem, was kein Audio ist */
  ton?(id: string): (() => Promise<string | null>) | null
}

/** Neu zeichnen, ohne dass sich der Text geändert hat (z. B. eine Aufgabe wurde im Popup erledigt) */
export const neuZeichnen = StateEffect.define<null>()

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
  constructor(
    readonly text: string,
    readonly link: Link,
    readonly oeffne: (l: Link) => void,
    readonly zustand: string | null = null,
    readonly bilder: { id: string; stand: string }[] = [],
    readonly laden: (id: string) => Promise<string | null> = async () => null,
    readonly blockierer: { id: string; titel: string; zustand: string } | null = null
  ) {
    super()
  }
  eq(o: Verweis) {
    return (
      o.text === this.text &&
      o.link.ziel === this.link.ziel &&
      o.link.anker === this.link.anker &&
      o.zustand === this.zustand &&
      `${o.blockierer?.id}|${o.blockierer?.titel}|${o.blockierer?.zustand}` === `${this.blockierer?.id}|${this.blockierer?.titel}|${this.blockierer?.zustand}` &&
      o.bilder.map((b) => `${b.id}|${b.stand}`).join() === this.bilder.map((b) => `${b.id}|${b.stand}`).join()
    )
  }
  toDOM() {
    const s = document.createElement('span')
    // Eigene Aufgabe: die Farbe zeigt den Zustand, der Kreis davor macht sie im Satz als Aufgabe erkennbar
    s.className = this.zustand ? `cm-link cm-aufgabe zustand-${this.zustand}` : 'cm-link'
    if (this.zustand) s.title = ZUSTAND_TEXT[this.zustand] ?? this.zustand
    s.textContent = this.text
    s.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.oeffne(this.link)
    })
    if (!this.bilder.length && !this.blockierer) return s
    const huelle = document.createElement('span')
    huelle.append(s)
    if (this.blockierer) {
      // Blockiert: Woran es hängt, steht klein dahinter, als eigener Link (immer nur eine offene Aufgabe)
      const b = this.blockierer
      const durch = document.createElement('span')
      durch.className = 'cm-blockierer'
      durch.textContent = 'durch '
      const l = document.createElement('span')
      l.className = `cm-link cm-aufgabe zustand-${b.zustand}`
      l.title = ZUSTAND_TEXT[b.zustand] ?? b.zustand
      l.textContent = b.titel
      l.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.oeffne({ einbettung: false, ziel: b.id, anker: null, stand: null, anzeige: null, von: 0, bis: 0 })
      })
      durch.append(l)
      huelle.append(durch)
    }
    if (!this.bilder.length) return huelle
    // Fotos der Aufgabe klein direkt hinter dem Link, so stehen sie fast im Fließtext. Antippen öffnet das Foto.
    const reihe = document.createElement('span')
    reihe.className = 'cm-aufgabe-bilder'
    for (const b of this.bilder.slice(0, 3)) {
      const k = document.createElement('span')
      k.className = 'cm-aufgabe-bild'
      void this.laden(b.id).then((url) => {
        if (!url) return
        const img = document.createElement('img')
        img.src = url
        img.alt = 'Foto'
        k.append(img)
      })
      k.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.oeffne({ einbettung: true, ziel: b.id, anker: null, stand: null, anzeige: null, von: 0, bis: 0 })
      })
      reihe.append(k)
    }
    if (this.bilder.length > 3) {
      const mehr = document.createElement('span')
      mehr.className = 'cm-aufgabe-bild mehr'
      mehr.textContent = `+${this.bilder.length - 3}`
      mehr.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.oeffne(this.link)
      })
      reihe.append(mehr)
    }
    huelle.append(reihe)
    return huelle
  }
  ignoreEvent() {
    return true
  }
}

const ZUSTAND_TEXT: Record<string, string> = {
  offen: 'Aufgabe, offen',
  wartet: 'Aufgabe, wartet',
  blockiert: 'Aufgabe, blockiert',
  faellig: 'Aufgabe, fällig',
  erledigt: 'Aufgabe, erledigt',
  verworfen: 'Aufgabe, verworfen'
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
    // Fehlt das Bild noch auf dem Server, weil das andere Gerät es gerade hochlädt, später noch einmal versuchen
    const lade = (versuch: number) =>
      void this.laden().then((url) => {
        if (!url) {
          if (versuch < 30) setTimeout(() => s.isConnected && lade(versuch + 1), 5000)
          return
        }
        const img = document.createElement('img')
        img.src = url
        img.alt = this.titel
        platz.replaceWith(img)
      })
    lade(0)
    s.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.klick()
    })
    // Antippen am Handy: selbst erledigen, sonst setzt der Browser den Cursor und die Tastatur geht auf.
    // Wer über das Bild scrollt, öffnet nichts.
    let start: { x: number; y: number } | null = null
    s.addEventListener('touchstart', (e) => (start = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true })
    s.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0]
      if (!start || Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) return
      e.preventDefault()
      ;(document.activeElement as HTMLElement | null)?.blur()
      this.klick()
    })
    return s
  }
  ignoreEvent() {
    return true
  }
}

/** Sprachnotiz: kleiner Abspieler. Geladen wird erst beim Antippen, damit das Journal nicht alles herunterlädt. */
class Ton extends WidgetType {
  constructor(readonly id: string, readonly titel: string, readonly laden: () => Promise<string | null>) {
    super()
  }
  eq(o: Ton) {
    return o.id === this.id && o.titel === this.titel
  }
  toDOM() {
    const s = document.createElement('span')
    s.className = 'cm-ton'
    const knopf = document.createElement('button')
    knopf.type = 'button'
    knopf.textContent = `▶ ${this.titel}`
    knopf.setAttribute('aria-label', `${this.titel} abspielen`)
    knopf.addEventListener('mousedown', (e) => e.preventDefault())
    knopf.addEventListener('click', () => {
      knopf.disabled = true
      knopf.textContent = `… ${this.titel}`
      void this.laden().then((url) => {
        if (!url) {
          knopf.disabled = false
          knopf.textContent = `▶ ${this.titel} (noch nicht da)`
          return
        }
        const a = document.createElement('audio')
        a.controls = true
        a.src = url
        knopf.replaceWith(a)
        void a.play().catch(() => undefined)
      })
    })
    s.append(knopf)
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
const WICHTIG = /(?:^|\s+)#wichtig(?=\s|$)/i

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
        if (tag && tag[0].toLowerCase() !== '#wichtig') {
          const von = zeile.from + ebene + u[2].length
          deko.push(Decoration.mark({ class: 'cm-projekttag' }).range(von, von + tag[0].length))
        }
      }
      const w = WICHTIG.exec(u[3])
      if (w && !roh) {
        const von = zeile.from + ebene + u[2].length + w.index
        deko.push(Decoration.replace({ widget: new StatusMarke('wichtig') }).range(von, von + w[0].length))
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

    for (const l of findeLinks(t)) {
      const von = zeile.from + l.von
      const bis = zeile.from + l.bis
      // In der Cursorzeile bleibt nur der Link roh, in dem der Cursor steht. So steht nach einer neuen
      // Aufgabe im Satz nicht plötzlich die ID da, während man weiterschreibt.
      if (roh && view.state.selection.ranges.some((r) => r.from < bis && r.to > von)) continue
      const p = ankerParameter(l.anker)
      let w: WidgetType
      if (l.einbettung && p.marke) {
        w = new Bild(`${l.ziel}#${l.anker}`, l.anzeige ?? 'Stelle', () => h.ausschnitt(l.ziel, Number(p.seite) || 1, p.marke), () => h.oeffne(l))
      } else if (l.einbettung && h.wissen(l.ziel)) {
        const wi = h.wissen(l.ziel)!
        w = new Wissen(wi.titel, wi.text, () => h.oeffne(l))
      } else if (l.einbettung && h.ton?.(l.ziel)) {
        w = new Ton(l.ziel, l.anzeige ?? h.titel(l.ziel) ?? 'Aufnahme', h.ton(l.ziel)!)
      } else if (l.einbettung) {
        w = new Bild(`${l.ziel}|${h.bildStand?.(l.ziel) ?? ''}`, l.anzeige ?? h.titel(l.ziel) ?? 'Anhang', () => h.bild(l.ziel), () => h.oeffne(l))
      } else {
        const zustand = h.zustand?.(l.ziel) ?? null
        const bilder = zustand ? (h.aufgabeBilder?.(l.ziel) ?? []).map((id) => ({ id, stand: h.bildStand?.(id) ?? '' })) : []
        const blockierer = zustand === 'blockiert' ? (h.blockierer?.(l.ziel) ?? null) : null
        w = new Verweis(l.anzeige ?? h.titel(l.ziel) ?? 'nicht gefunden', l, h.oeffne, zustand, bilder, h.bild, blockierer)
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
        const neu = u.transactions.some((t) => t.effects.some((e) => e.is(neuZeichnen)))
        if (neu || u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged) this.decorations = baue(u.view, hilfen())
      }
    },
    { decorations: (v) => v.decorations }
  )
}
