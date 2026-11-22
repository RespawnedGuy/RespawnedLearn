// Textfelder auf Buchseiten (Vertrag Lernen 1.14): ein Kommentar oder eine Formel, getippt statt geschrieben, in jedem
// Notizbuch und im Tafelwerk. Anzeige wie eine Mitschrift (Markdown, Formeln), bedient wie ein Bild: mit „Markieren“
// antippen wählt, Halten 0,4 s verschiebt, die Ecke ändert die Breite, × nimmt es von der Seite.
import { useLayoutEffect, useRef, useState } from 'react'
import { ANHEBEN_MS, SEITE_BREITE, TEXT_MIN_BREITE, buchSeiteJson, liesBuchSeite, pfade, ulid, type BuchSeite, type BuchText } from '@rl/kern'
import { Symbol, melde, useHalten, type Speicher } from '@rl/oberflaeche'
import { Inhalt } from './Inhalt'
import type { Uebernahme } from './MarkeRahmen'

const aendereTexte = (speicher: Speicher, id: string, nr: number, f: (t: BuchText[], s: BuchSeite) => BuchText[]) =>
  speicher.aendere(pfade.buchSeite(id, nr), (alt) => {
    const s = liesBuchSeite(alt)
    return buchSeiteJson({ ...s, texte: f(s.texte ?? [], s) })
  })

/** Neues Textfeld an der angetippten Stelle (Seitenkoordinaten); erst mit Text wird es gespeichert */
export function neuesTextfeld(x: number, y: number): BuchText {
  const b = Math.min(560, SEITE_BREITE - Math.max(0, x) - 24)
  return { id: `t${ulid().slice(-7).toLowerCase()}`, x: Math.min(Math.max(0, x), SEITE_BREITE - TEXT_MIN_BREITE), y: Math.max(0, y), b: Math.max(TEXT_MIN_BREITE, b), text: '' }
}

/** Text setzen: anlegen, ändern oder bei leerem Text entfernen (ein leeres Textfeld gibt es nicht, 5.3) */
export function setzeText(speicher: Speicher, id: string, nr: number, t: BuchText) {
  const leer = !t.text.trim()
  return aendereTexte(speicher, id, nr, (alle) => {
    const da = alle.some((x) => x.id === t.id)
    if (leer) return alle.filter((x) => x.id !== t.id)
    const neu = { ...t, am: t.am ?? new Date().toISOString() }
    return da ? alle.map((x) => (x.id === t.id ? neu : x)) : [...alle, neu]
  })
}

/** Textfeld von der Seite nehmen, mit Rückgängig */
export async function nimmTextMitMeldung(speicher: Speicher, id: string, nr: number, textId: string) {
  const weg = (liesBuchSeite(speicher.text(pfade.buchSeite(id, nr))).texte ?? []).find((t) => t.id === textId)
  if (!weg) return
  await aendereTexte(speicher, id, nr, (alle) => alle.filter((t) => t.id !== textId))
  melde('Textfeld entfernt', () => void aendereTexte(speicher, id, nr, (alle) => (alle.some((t) => t.id === weg.id) ? alle : [...alle, weg])))
}

/** Textfeld an einer Stelle der Seite (Seitenkoordinaten); `hoehe` liefert die gemessene Höhe je Feld */
export function textAn(texte: BuchText[], x: number, y: number, hoehe: (id: string) => number): BuchText | null {
  for (let i = texte.length - 1; i >= 0; i--) {
    const t = texte[i]
    if (x >= t.x && x <= t.x + t.b && y >= t.y && y <= t.y + Math.max(24, hoehe(t.id))) return t
  }
  return null
}

export function TextAufBlatt({
  text,
  hoehe,
  aktiv,
  gewaehlt,
  bearbeiten,
  uebernimm,
  onWahl,
  onBearbeiten,
  onFertig,
  onAendern,
  onEntfernen,
  onHoehe
}: {
  text: BuchText
  /** Höhe der Seite in Seitenkoordinaten */
  hoehe: number
  /** Werkzeug Markieren: wählen, verschieben, bearbeiten */
  aktiv: boolean
  gewaehlt: boolean
  bearbeiten: boolean
  uebernimm?: Uebernahme | null
  onWahl: () => void
  onBearbeiten: () => void
  /** Bearbeiten beendet: neuer Text (leer = entfernen) */
  onFertig: (text: string) => void
  onAendern: (t: BuchText) => void
  onEntfernen: () => void
  /** gemessene Höhe in Seitenkoordinaten, für Treffer und Platz */
  onHoehe: (h: number) => void
}) {
  const [lage, setLage] = useState<BuchText | null>(null)
  const [entwurf, setEntwurf] = useState(text.text)
  const el = useRef<HTMLDivElement>(null)
  const zug = useRef<{ art: 'ziehen' | 'breite'; x: number; y: number; proPx: number; start: BuchText } | null>(null)
  const t = lage ?? text
  useLayoutEffect(() => {
    const e = el.current
    const breite = e?.parentElement?.getBoundingClientRect().width
    if (e && breite) onHoehe((e.offsetHeight / breite) * SEITE_BREITE)
  })
  const starte = (art: 'ziehen' | 'breite', ziel: HTMLElement, pointerId: number, x: number, y: number) => {
    const flaeche = ziel.closest('.blatt-flaeche')?.getBoundingClientRect()
    if (!flaeche) return
    try {
      ziel.setPointerCapture(pointerId)
    } catch {
      return
    }
    zug.current = { art, x, y, proPx: SEITE_BREITE / flaeche.width, start: text }
  }
  useLayoutEffect(() => {
    if (uebernimm && el.current) starte('ziehen', el.current, uebernimm.pointerId, uebernimm.clientX, uebernimm.clientY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uebernimm])
  const halten = useHalten({ dauer: ANHEBEN_MS, art: 'anheben', aktiv: aktiv && gewaehlt && !bearbeiten, onFertig: (z) => starte('ziehen', z.el, z.pointerId, z.clientX, z.clientY) })
  const runter = (art: 'ziehen' | 'breite') => (e: React.PointerEvent<HTMLElement>) => {
    if (!aktiv || bearbeiten || e.pointerType === 'pen') return
    e.stopPropagation()
    if (!gewaehlt) return onWahl()
    if (art === 'ziehen') return halten.griffe.onPointerDown(e)
    e.preventDefault()
    starte(art, e.currentTarget, e.pointerId, e.clientX, e.clientY)
  }
  const bewegen = (e: React.PointerEvent) => {
    const z = zug.current
    if (!z) return
    const dx = (e.clientX - z.x) * z.proPx
    const dy = (e.clientY - z.y) * z.proPx
    const s = z.start
    if (z.art === 'ziehen') setLage({ ...s, x: Math.min(SEITE_BREITE - s.b, Math.max(0, s.x + dx)), y: Math.min(hoehe - 24, Math.max(0, s.y + dy)) })
    else setLage({ ...s, b: Math.min(SEITE_BREITE - s.x, Math.max(TEXT_MIN_BREITE, s.b + dx)) })
  }
  const hoch = (e: React.PointerEvent<HTMLElement>) => {
    halten.griffe.onPointerUp(e)
    if (zug.current && lage) onAendern(lage)
    zug.current = null
    setLage(null)
  }
  const fertig = () => onFertig(entwurf)
  return (
    <div
      ref={el}
      className={`buch-text${aktiv && gewaehlt ? ' beweglich gewaehlt' : ''}${bearbeiten ? ' bearbeiten' : ''}`}
      style={{ left: `${(t.x / SEITE_BREITE) * 100}%`, top: `${(t.y / hoehe) * 100}%`, width: `${(t.b / SEITE_BREITE) * 100}%` }}
      onPointerDown={runter('ziehen')}
      onPointerMove={(e) => {
        halten.griffe.onPointerMove(e)
        bewegen(e)
      }}
      onPointerUp={hoch}
      onPointerCancel={hoch}
      onDoubleClick={() => aktiv && !bearbeiten && onBearbeiten()}
    >
      {bearbeiten ? (
        <textarea
          className="buch-text-eingabe"
          autoFocus
          value={entwurf}
          placeholder="Text, Formeln mit $…$"
          aria-label="Text des Textfelds"
          rows={Math.max(2, entwurf.split('\n').length)}
          onChange={(e) => setEntwurf(e.target.value)}
          onBlur={fertig}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
              e.preventDefault()
              fertig()
            }
          }}
        />
      ) : (
        <div className="buch-text-inhalt">
          <Inhalt text={text.text} abrufeZeigen={false} />
        </div>
      )}
      {gewaehlt && aktiv && !bearbeiten && (
        <>
          <button type="button" className="blatt-bild-weg" onPointerDown={(e) => e.stopPropagation()} onClick={onEntfernen} aria-label="Textfeld entfernen" title="Textfeld entfernen (Rückgängig in der Meldung)">
            ×
          </button>
          <button type="button" className="blatt-bild-kopie" onPointerDown={(e) => e.stopPropagation()} onClick={onBearbeiten} aria-label="Text bearbeiten" title="Text bearbeiten">
            <Symbol name="stift" groesse={16} />
          </button>
          <span className="blatt-bild-ecke" onPointerDown={runter('breite')} aria-hidden="true" />
        </>
      )}
      {halten.ring}
    </div>
  )
}

/** Textfeld nur zum Ansehen, z. B. in einem Ausschnitt aus einem Buch */
export function TextFest({ text, hoehe }: { text: BuchText; hoehe: number }) {
  return (
    <div className="buch-text" style={{ left: `${(text.x / SEITE_BREITE) * 100}%`, top: `${(text.y / hoehe) * 100}%`, width: `${(text.b / SEITE_BREITE) * 100}%` }}>
      <div className="buch-text-inhalt">
        <Inhalt text={text.text} abrufeZeigen={false} />
      </div>
    </div>
  )
}
