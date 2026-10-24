// Was der Editor einer Mitschrift kann: Text markieren → Knopf „Lernkarte“ (am PC und am Handy), „/“ am PC
// mit Lernkarte und Foto. Die Karte selbst ist eine eigene Datei; in der Mitschrift steht nur die
// Blockkennung `^anker` am Ende des Absatzes, damit die Karte genau hierher zurückfindet.
import { Facet, StateEffect, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, showTooltip, type DecorationSet, type Tooltip } from '@codemirror/view'
import type { CompletionContext, CompletionSource } from '@codemirror/autocomplete'
import { abschnittAn, ankerIn, kurzId } from '@rvx/kern'
import { mitFinger } from '@rvx/oberflaeche'

/** Was zur Lernkarte wird: der Text (Antwort), wo der Anker hinkommt und unter welcher Überschrift das steht */
export interface KartenStelle {
  antwort: string
  /** Position, deren Zeile die Blockkennung bekommt */
  pos: number
  abschnitt: string[]
}

export interface MitschriftAktionen {
  lernkarte(s: KartenStelle): void
  foto(): void
}

const aktionen = Facet.define<MitschriftAktionen, MitschriftAktionen | null>({ combine: (w) => w[0] ?? null })

const ohneAnker = (t: string) =>
  t
    .split('\n')
    .map((z) => z.replace(/\s\^[a-z0-9-]+\s*$/, ''))
    .join('\n')
    .trim()

/** Letzte nicht leere Zeile bis `to`: Dort steht die Blockkennung */
function ankerPos(state: EditorState, from: number, to: number): number {
  let z = state.doc.lineAt(to)
  while (z.number > 1 && !z.text.trim() && z.from > from) z = state.doc.line(z.number - 1)
  return z.from
}

/** Markierter Text als Karte; ohne Markierung der Absatz um den Cursor (bis zur nächsten Leerzeile oder Überschrift) */
export function kartenStelle(state: EditorState): KartenStelle | null {
  const r = state.selection.main
  const rumpf = state.doc.toString()
  if (!r.empty) {
    let antwort = ohneAnker(state.sliceDoc(r.from, r.to))
    // Eine einzelne Listenzeile ohne Aufzählungszeichen
    if (!antwort.includes('\n')) antwort = antwort.replace(/^([-*+]|\d+\.)\s+/, '')
    if (antwort.length < 2) return null
    const pos = ankerPos(state, r.from, r.to)
    return { antwort, pos, abschnitt: abschnittAn(rumpf, state.doc.lineAt(pos).number - 1) }
  }
  const hier = state.doc.lineAt(r.head)
  if (!hier.text.trim()) return null
  const randZeile = (t: string) => !t.trim() || /^#{1,6}\s/.test(t)
  let a = hier.number
  let b = hier.number
  if (!/^#{1,6}\s/.test(hier.text)) {
    while (a > 1 && !randZeile(state.doc.line(a - 1).text)) a--
    while (b < state.doc.lines && !randZeile(state.doc.line(b + 1).text)) b++
  }
  const von = state.doc.line(a).from
  const bis = state.doc.line(b).to
  const antwort = ohneAnker(state.sliceDoc(von, bis))
  if (antwort.length < 2) return null
  return { antwort, pos: state.doc.line(b).from, abschnitt: abschnittAn(rumpf, b - 1) }
}

/** Setzt die Blockkennung an die Zeile von `pos` (eine vorhandene bleibt) und gibt sie zurück */
export function setzeAnker(view: EditorView, pos: number): string {
  const z = view.state.doc.lineAt(Math.min(pos, view.state.doc.length))
  const da = ankerIn(z.text)
  if (da) return da
  const anker = kurzId()
  const ende = z.from + z.text.trimEnd().length
  view.dispatch({ changes: { from: ende, to: z.to, insert: ` ^${anker}` } })
  return anker
}

const markierung = StateField.define<boolean>({
  create: () => false,
  update(v, tr) {
    if (!tr.selection && !tr.docChanged) return v
    const r = tr.state.selection.main
    return !r.empty && tr.state.selection.ranges.length === 1 && tr.state.sliceDoc(r.from, r.to).trim().length >= 2
  },
  provide: (f) =>
    showTooltip.compute([f], (state): Tooltip | null =>
      // unter der Markierung, damit das Menü des Handys (Kopieren, Einfügen) darüber frei bleibt
      state.field(f) ? { pos: state.selection.main.to, above: false, create: (view) => kartenKnopf(view) } : null
    )
})

function kartenKnopf(view: EditorView) {
  const dom = document.createElement('div')
  dom.className = 'cm-markier-knopf'
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = 'Lernkarte'
  b.setAttribute('aria-label', 'Aus dem markierten Text eine Lernkarte machen')
  const behalte = (e: Event) => e.preventDefault()
  b.addEventListener('pointerdown', behalte)
  b.addEventListener('mousedown', behalte)
  b.addEventListener('click', () => {
    const s = kartenStelle(view.state)
    const a = view.state.facet(aktionen)
    if (s && a) a.lernkarte(s)
  })
  dom.append(b)
  return { dom }
}

/** „/“ am PC: Lernkarte aus dem Absatz, Foto einfügen. Am Handy gibt es dafür das „+“ in der Daumenleiste. */
const slash: CompletionSource = (ctx: CompletionContext) => {
  if (mitFinger()) return null
  const m = ctx.matchBefore(/(?:^|\s)\/[\p{L}\d -]{0,24}$/u)
  if (!m) return null
  const start = m.from + m.text.indexOf('/')
  const weg = (view: EditorView, to: number) => view.dispatch({ changes: { from: start, to, insert: '' }, selection: { anchor: start } })
  return {
    from: start + 1,
    options: [
      {
        label: 'Lernkarte',
        detail: 'aus diesem Absatz',
        apply: (view, _c, _f, to) => {
          weg(view, to)
          const s = kartenStelle(view.state)
          if (s) view.state.facet(aktionen)?.lernkarte(s)
        }
      },
      {
        label: 'Foto',
        detail: 'Bild einfügen',
        apply: (view, _c, _f, to) => {
          weg(view, to)
          view.state.facet(aktionen)?.foto()
        }
      }
    ],
    validFor: /^[\p{L}\d -]*$/u
  }
}

/** Kurz hervorheben, wohin ein Sprung führt (etwa aus einer Lernkarte), damit man die Stelle sofort sieht */
export const hebeHervor = StateEffect.define<number | null>()
const hervorhebung = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    for (const e of tr.effects)
      if (e.is(hebeHervor)) return e.value === null ? Decoration.none : Decoration.set([Decoration.line({ class: 'cm-hervor' }).range(tr.state.doc.lineAt(e.value).from)])
    return v.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})

export function mitschriftErweiterung(a: MitschriftAktionen) {
  return [aktionen.of(a), markierung, hervorhebung]
}

export const mitschriftQuellen = [slash]
