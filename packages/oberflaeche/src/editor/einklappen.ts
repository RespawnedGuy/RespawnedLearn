// Eingeklappte Callouts (`> [!transkript]- Titel`, wie in Obsidian): Nur die erste Zeile ist zu sehen.
// Ein Tipp auf „aufklappen“ oder der Cursor im Callout zeigt den Rest. Der Text selbst bleibt unverändert.
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { StateEffect, StateField, type EditorState, type Range } from '@codemirror/state'

const KOPF = /^>\s*\[!\w+\]-/

const umschalten = StateEffect.define<number>()

class Schalter extends WidgetType {
  constructor(readonly start: number, readonly kopfEnde: number, readonly zu: boolean) {
    super()
  }
  eq(o: Schalter) {
    return o.start === this.start && o.kopfEnde === this.kopfEnde && o.zu === this.zu
  }
  toDOM(view: EditorView) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'cm-klapp'
    b.textContent = this.zu ? `▸ aufklappen` : '▾ zuklappen'
    b.setAttribute('aria-expanded', String(!this.zu))
    b.onmousedown = (e) => e.preventDefault()
    b.onclick = (e) => {
      e.preventDefault()
      // Zuklappen holt den Cursor aus dem Callout, sonst bliebe es offen
      view.dispatch({ effects: umschalten.of(this.start), selection: this.zu ? undefined : { anchor: this.kopfEnde } })
    }
    return b
  }
  ignoreEvent() {
    return true
  }
}

/** Callouts mit `-` hinter dem Typ: Anfang der ersten Zeile, Ende der ersten und der letzten Zeile */
function callouts(state: EditorState) {
  const doc = state.doc
  const out: { start: number; kopfEnde: number; ende: number }[] = []
  for (let n = 1; n <= doc.lines; n++) {
    const z = doc.line(n)
    if (!KOPF.test(z.text)) continue
    let m = n
    while (m < doc.lines && doc.line(m + 1).text.startsWith('>')) m++
    if (m > n) out.push({ start: z.from, kopfEnde: z.to, ende: doc.line(m).to })
    n = m
  }
  return out
}

function baue(state: EditorState, offen: number[]): DecorationSet {
  const deko: Range<Decoration>[] = []
  for (const c of callouts(state)) {
    // nur der Cursor in den eingeklappten Zeilen klappt auf, nicht in der Kopfzeile
    const cursorDrin = state.selection.ranges.some((r) => r.to > c.kopfEnde && r.from <= c.ende)
    const zu = !offen.includes(c.start) && !cursorDrin
    deko.push(Decoration.widget({ widget: new Schalter(c.start, c.kopfEnde, zu), side: 1 }).range(c.kopfEnde))
    if (zu) deko.push(Decoration.replace({}).range(c.kopfEnde, c.ende))
  }
  return Decoration.set(deko, true)
}

export const einklappen = StateField.define<{ offen: number[]; deko: DecorationSet }>({
  create: (state) => ({ offen: [], deko: baue(state, []) }),
  update(wert, tr) {
    let offen = tr.docChanged ? wert.offen.map((p) => tr.changes.mapPos(p)) : wert.offen
    for (const e of tr.effects) if (e.is(umschalten)) offen = offen.includes(e.value) ? offen.filter((p) => p !== e.value) : [...offen, e.value]
    if (!tr.docChanged && !tr.selection && offen === wert.offen) return wert
    return { offen, deko: baue(tr.state, offen) }
  },
  provide: (f) => EditorView.decorations.from(f, (w) => w.deko)
})
