import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState, Transaction, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as platzhalter, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { autocompletion, completionKeymap, type CompletionSource } from '@codemirror/autocomplete'
import { projektTag } from '@rvx/kern'
import { darstellung, type DarstellungHilfen } from './darstellung'

export interface EditorKontext {
  kuerzel: string | null
  /** Text des Abschnitts um den Cursor, für „Passt dazu“ */
  text: string
  zeile: number
}

export interface EditorGriff {
  einfuegen(text: string): void
  /** Ersetzt die aktuelle Zeile bzw. setzt am Zeilenanfang ein (für Status an Überschriften) */
  view(): EditorView | null
  fokus(): void
}

export interface EditorProps {
  wert: string
  onAenderung: (text: string) => void
  quellen?: CompletionSource[]
  hilfen: DarstellungHilfen
  onKontext?: (k: EditorKontext) => void
  platzhalter?: string
  autofokus?: boolean
  /** Zeile (0-basiert), an die der Cursor beim Öffnen springt */
  startZeile?: number
}

function kontextAus(state: EditorState): EditorKontext {
  const pos = state.selection.main.head
  const zeile = state.doc.lineAt(pos)
  let kuerzel: string | null = null
  let von = 1
  for (let n = zeile.number; n >= 1; n--) {
    const t = state.doc.line(n).text
    if (/^# /.test(t)) {
      kuerzel = projektTag(t.slice(2))?.kuerzel ?? null
      von = n
      break
    }
  }
  const bis = Math.min(state.doc.lines, zeile.number + 3)
  const text = state.doc.sliceString(state.doc.line(von).from, state.doc.line(bis).to).slice(-1500)
  return { kuerzel, text, zeile: zeile.number - 1 }
}

/**
 * Markdown-Editor: Der Text bleibt echtes Markdown, die Darstellung macht ihn ruhig (Haken statt `- [ ]`,
 * Ausschnitt statt Link, Status als Marke). Steht der Cursor in einer Zeile, zeigt sie wieder den Rohtext.
 */
export const Editor = forwardRef<EditorGriff, EditorProps>(function Editor(p, griff) {
  const huelle = useRef<HTMLDivElement>(null)
  const ansicht = useRef<EditorView | null>(null)
  // Zuletzt gesendete Fassungen: Kommt eine davon verspätet als Wert zurück (Speichern ist entprellt),
  // darf sie den Editor nicht auf einen älteren Stand zurücksetzen.
  const gesendet = useRef<string[]>([p.wert])
  const merke = (t: string) => {
    gesendet.current.push(t)
    if (gesendet.current.length > 50) gesendet.current.shift()
  }
  const props = useRef(p)
  props.current = p
  const kontextTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const erweiterungen: Extension[] = [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown(),
      keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      autocompletion({ override: p.quellen ?? [], icons: false, activateOnTyping: true, closeOnBlur: true }),
      darstellung(() => props.current.hilfen),
      EditorView.contentAttributes.of({ spellcheck: 'true', lang: 'de', autocapitalize: 'sentences' }),
      EditorView.updateListener.of((u) => {
        const vonAussen = u.transactions.some((t) => t.annotation(Transaction.remote))
        if (u.docChanged && !vonAussen) {
          const text = u.state.doc.toString()
          merke(text)
          props.current.onAenderung(text)
        }
        if ((u.docChanged || u.selectionSet) && props.current.onKontext) {
          if (kontextTimer.current) clearTimeout(kontextTimer.current)
          kontextTimer.current = setTimeout(() => props.current.onKontext?.(kontextAus(u.state)), 250)
        }
      })
    ]
    if (p.platzhalter) erweiterungen.push(platzhalter(p.platzhalter))
    const start = p.startZeile !== undefined ? Math.min(p.startZeile + 1, p.wert.split('\n').length) : null
    const state = EditorState.create({ doc: p.wert, extensions: erweiterungen })
    const v = new EditorView({
      state,
      parent: huelle.current!,
      selection: start ? { anchor: state.doc.line(start).to } : undefined
    })
    ansicht.current = v
    if (p.autofokus) v.focus()
    if (start) v.dispatch({ effects: EditorView.scrollIntoView(v.state.selection.main.head, { y: 'center' }) })
    props.current.onKontext?.(kontextAus(v.state))
    return () => {
      v.destroy()
      ansicht.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Änderungen von außen (anderes Gerät, Projektansicht, Plan) übernehmen, ohne den Cursor zu verlieren
  useEffect(() => {
    const v = ansicht.current
    if (!v || gesendet.current.includes(p.wert)) return
    const alt = v.state.doc.toString()
    if (alt === p.wert) return
    let a = 0
    while (a < alt.length && a < p.wert.length && alt[a] === p.wert[a]) a++
    let e = 0
    while (e < alt.length - a && e < p.wert.length - a && alt[alt.length - 1 - e] === p.wert[p.wert.length - 1 - e]) e++
    gesendet.current = [p.wert]
    v.dispatch({ changes: { from: a, to: alt.length - e, insert: p.wert.slice(a, p.wert.length - e) }, annotations: Transaction.remote.of(true) })
  }, [p.wert])

  useImperativeHandle(griff, () => ({
    einfuegen(text: string) {
      const v = ansicht.current
      if (!v) return
      const { from, to } = v.state.selection.main
      const davor = from > 0 ? v.state.sliceDoc(from - 1, from) : ''
      const ins = (davor && !/\s/.test(davor) ? ' ' : '') + text
      v.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + ins.length } })
      v.focus()
    },
    view: () => ansicht.current,
    fokus: () => ansicht.current?.focus()
  }))

  return <div ref={huelle} className="editor" />
})
