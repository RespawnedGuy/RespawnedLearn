import { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gliederung, kartenAus, obersteEbene, linkZiel, zeileVonAnker, type Eintrag } from '@rl/kern'
import { Dialog, Editor, melde, neuerAnhang, ortLink, useDaten, type EditorGriff } from '@rl/oberflaeche'
import { useHilfen } from './Bearbeiten'
import { aendereEintrag, karteAusMitschrift } from './wissen'
import { frageZurMitschrift } from './ki'
import { hebeHervor, kartenStelle, mitschriftErweiterung, mitschriftQuellen, setzeAnker, type KartenStelle } from './mitschriftEditor'
import { useLernzeit } from './lernzeitMessen'
import { useMeldePlus, type PlusZiel } from './plus'

/**
 * Mitschrift eines Moduls: Wissen sammeln in normalem Markdown, die Überschriften sind die Gliederung.
 * Fragen stehen nicht darin. Markieren → „Lernkarte“ (oder „/“, am Handy „+“) macht eine eigene Karte,
 * die auf genau diese Stelle zurückzeigt.
 */
export function Mitschrift({ id, anker }: { id: string; anker?: string }) {
  const { bestand } = useDaten()
  const e = bestand.dokumente.get(id)
  if (!e || e.typ !== 'notiz')
    return (
      <div className="seite">
        <div className="leer">
          Diese Mitschrift gibt es nicht. <a href={ortLink('sammeln')}>Zur Startseite</a>
        </div>
      </div>
    )
  return <MitschriftSeite key={id} e={e} anker={anker} />
}

function MitschriftSeite({ e, anker }: { e: Eintrag; anker?: string }) {
  const { speicher, bestand } = useDaten()
  const hilfen = useHilfen()
  const griff = useRef<EditorGriff>(null)
  const aktuell = bestand.dokumente.get(e.id) ?? e
  const ref = useRef(aktuell)
  ref.current = aktuell
  const [titel, setTitel] = useState(aktuell.titel)
  const [inhalt, setInhalt] = useState(false)
  const [entwurf, setEntwurf] = useState<KartenStelle | null>(null)
  const fotoEingabe = useRef<HTMLInputElement>(null)
  const kameraEingabe = useRef<HTMLInputElement>(null)
  const karten = kartenAus(bestand, e.id)
  const modulId = linkZiel(aktuell.felder.thema)
  const modul = modulId ? bestand.dokumente.get(modulId) : undefined
  useLernzeit(modulId ? { ziel: modulId, art: 'mitschrift' } : null)

  // Speichern wie beim Bearbeiten: entprellt, beim Verlassen sofort
  const offen = useRef<{ titel?: string; rumpf?: string }>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sichern = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const neu = offen.current
    offen.current = {}
    if (neu.titel !== undefined || neu.rumpf !== undefined) return aendereEintrag(speicher, ref.current, neu)
  }, [speicher])
  const spaeter = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void sichern(), 700)
  }
  useEffect(() => () => void sichern(), [sichern])

  // Beim Öffnen über eine Karte genau an die Stelle springen; eine neue, leere Mitschrift bekommt gleich den Cursor
  const [start] = useState(() => {
    // `z12` = Zeile 12 (aus der Gliederung), sonst eine Blockkennung (aus einer Lernkarte)
    const z = !anker ? -1 : /^z\d+$/.test(anker) ? Number(anker.slice(1)) : zeileVonAnker(aktuell.rumpf, anker)
    return z >= 0 ? z : undefined
  })

  const springe = (zeile: number, fokus = true) => {
    const v = griff.current?.view()
    if (!v) return
    const z = v.state.doc.line(Math.min(zeile + 1, v.state.doc.lines))
    v.dispatch({ selection: { anchor: z.to }, effects: [EditorView.scrollIntoView(z.from, { y: 'center' }), hebeHervor.of(z.from)] })
    setTimeout(() => griff.current?.view()?.dispatch({ effects: hebeHervor.of(null) }), 2200)
    if (fokus) v.focus()
  }
  // Erst springen, wenn der Editor steht (sonst stimmt die Höhe noch nicht); ohne Fokus, damit am Handy keine Tastatur aufgeht
  useEffect(() => {
    if (start === undefined) return
    const t = setTimeout(() => springe(start, false), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lernkarte = useCallback((s?: KartenStelle | null) => {
    const v = griff.current?.view()
    const stelle = s ?? (v ? kartenStelle(v.state) : null)
    if (!stelle) return melde('Erst Text markieren oder den Cursor in einen Absatz setzen.')
    setEntwurf(stelle)
  }, [])
  const aktionen = useMemo(() => [mitschriftErweiterung({ lernkarte: (s) => lernkarte(s), foto: () => fotoEingabe.current?.click() })], [lernkarte])
  const plus = useMemo<PlusZiel>(
    () => ({ lernkarte: () => lernkarte(), foto: () => fotoEingabe.current?.click(), kamera: () => kameraEingabe.current?.click() }),
    [lernkarte]
  )
  useMeldePlus(plus)

  const fotos = async (liste: FileList | null) => {
    for (const f of Array.from(liste ?? [])) {
      const id = await neuerAnhang(speicher, f)
      griff.current?.einfuegen(`\n![[${id}]]\n`)
    }
  }

  const anlegen = async (frage: string, antwort: string) => {
    const v = griff.current?.view()
    if (!v || !entwurf) return
    const a = setzeAnker(v, entwurf.pos)
    await sichern()
    await karteAusMitschrift(speicher, { mitschrift: ref.current, anker: a, frage, antwort })
    setEntwurf(null)
    melde('Lernkarte angelegt')
  }

  const teile = gliederung(aktuell.rumpf)
  return (
    <div className="seite mitschrift-seite">
      <div className="seite-kopf">
        <h1 className="nur-vorleser">{titel || 'Mitschrift'}</h1>
        <input
          className="titel-eingabe"
          aria-label="Titel der Mitschrift"
          value={titel}
          size={Math.max(8, titel.length + 1)}
          onChange={(ev) => {
            setTitel(ev.target.value)
            offen.current.titel = ev.target.value
            spaeter()
          }}
        />
        <span style={{ flex: 1 }} />
        {teile.length > 0 && (
          <button type="button" className="knopf klein" onClick={() => setInhalt(true)}>
            Inhalt
          </button>
        )}
      </div>
      <div className="klein-leise mitschrift-unter">
        {modul ? <a className="ziel-gross" href={ortLink('sammeln', 'modul', modul.id)}>{modul.titel}</a> : 'Ohne Modul'}
        {karten.length > 0 && ` · ${karten.length} ${karten.length === 1 ? 'Lernkarte' : 'Lernkarten'}`}
        <span className="nur-breit"> · Text markieren → „Lernkarte“, „/“ fügt ein, Esc und dann Tab verlässt den Text</span>
      </div>
      <div className="mitschrift-text karte">
        <Editor
          ref={griff}
          wert={aktuell.rumpf}
          onAenderung={(text) => {
            offen.current.rumpf = text
            spaeter()
          }}
          hilfen={hilfen}
          quellen={mitschriftQuellen}
          erweiterungen={aktionen}
          autofokus={!aktuell.rumpf.trim()}
          platzhalter="Mitschreiben … Überschriften (#, ##, ###) gliedern den Lehrgang."
          name="Mitschrift"
        />
      </div>
      <input ref={fotoEingabe} type="file" accept="image/*" multiple hidden onChange={(ev) => void fotos(ev.target.files).then(() => (ev.target.value = ''))} />
      <input ref={kameraEingabe} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => void fotos(ev.target.files).then(() => (ev.target.value = ''))} />
      {inhalt && (
        <Dialog titel="Inhalt" onZu={() => setInhalt(false)}>
          <nav className="mitschrift-inhalt" aria-label="Gliederung">
            {teile.map((u) => (
              <button
                key={u.zeile}
                type="button"
                className="mitschrift-inhalt-zeile"
                style={{ paddingLeft: 8 + Math.max(0, u.ebene - obersteEbene(teile, aktuell.rumpf.split('\n').length)) * 16 }}
                onClick={() => {
                  setInhalt(false)
                  setTimeout(() => springe(u.zeile, false), 0)
                }}
              >
                {u.titel}
              </button>
            ))}
          </nav>
        </Dialog>
      )}
      {entwurf && <KartenDialog stelle={entwurf} titel={aktuell.titel} onZu={() => setEntwurf(null)} onAnlegen={anlegen} />}
    </div>
  )
}

/** Neue Lernkarte: die Stelle ist die Antwort, die KI schlägt die Frage vor (ohne KI tippt man sie selbst) */
function KartenDialog({ stelle, titel, onZu, onAnlegen }: { stelle: KartenStelle; titel: string; onZu: () => void; onAnlegen: (frage: string, antwort: string) => Promise<void> }) {
  const [frage, setFrage] = useState('')
  const [antwort, setAntwort] = useState(stelle.antwort)
  const [denkt, setDenkt] = useState(true)
  const [laeuft, setLaeuft] = useState(false)
  const getippt = useRef(false)
  const { speicher } = useDaten()
  useEffect(() => {
    const ab = new AbortController()
    void frageZurMitschrift(speicher, titel, stelle.abschnitt, stelle.antwort, ab.signal).then((f) => {
      if (ab.signal.aborted) return
      if (f && !getippt.current) setFrage(f)
      setDenkt(false)
    })
    return () => ab.abort()
  }, [speicher, titel, stelle])
  const fertig = async () => {
    if (!frage.trim() || !antwort.trim() || laeuft) return
    setLaeuft(true)
    await onAnlegen(frage.trim(), antwort.trim())
  }
  return (
    <Dialog titel="Lernkarte" onZu={onZu}>
      {stelle.abschnitt.length > 0 && <div className="klein-leise">{stelle.abschnitt.join(' › ')}</div>}
      <label className="feld">
        Frage
        <input
          className="eingabe"
          value={frage}
          autoFocus
          placeholder={denkt ? 'Die KI schlägt eine Frage vor …' : 'Frage, auf die diese Stelle die Antwort ist'}
          onChange={(ev) => {
            getippt.current = true
            setFrage(ev.target.value)
          }}
          onKeyDown={(ev) => ev.key === 'Enter' && void fertig()}
        />
      </label>
      <label className="feld">
        Antwort
        <textarea className="eingabe" rows={Math.min(8, Math.max(3, antwort.split('\n').length))} value={antwort} onChange={(ev) => setAntwort(ev.target.value)} />
      </label>
      <div className="dialog-knoepfe">
        <button type="button" className="knopf still" onClick={onZu}>
          Abbrechen
        </button>
        <button type="button" className="knopf haupt" disabled={!frage.trim() || !antwort.trim() || laeuft} onClick={() => void fertig()}>
          Anlegen
        </button>
      </div>
    </Dialog>
  )
}
