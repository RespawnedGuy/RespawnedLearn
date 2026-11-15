// Bausteine des Übungsplatzes (Vertrag Lernen 1.3, 5.3): Anordnung der Ansichten (Skript, Notizbücher), Lineatur,
// Bilder auf Seiten, Kopf je Ansicht, Trenner zum Ziehen der Breite. Die Lineatur zeichnet die App in
// Seitenkoordinaten, damit Tinte und Linien auf jedem Gerät übereinanderliegen.
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  LINEATUREN,
  anordnungJson,
  liesAnordnung,
  lineaturSchichten,
  oeffneAnsicht,
  pfade,
  rueckeBild,
  schliesseAnsicht,
  setzeBreiten,
  verschiebeAnsicht,
  zeigeBuch,
  SEITE_BREITE,
  ANHEBEN_MS,
  type Anordnung,
  type Ansicht,
  type BlattBild,
  type Lineatur
} from '@rl/kern'
import { ausschnitt, bildUrl, useDaten, useHalten } from '@rl/oberflaeche'
import type { Uebernahme } from './MarkeRahmen'
import { BuchFenster } from './BuchAusschnitt'

/** Strichstärke der Lineatur in Bildschirmpixeln, unabhängig von der Größe des Blatts */
const STAERKE = { fein: 0.5, mittel: 0.8, kraeftig: 1.1, punkt: 2.4 } as const
const TON = { fein: '#e1dbef', mittel: '#cdc3e5', kraeftig: '#b6a9d8', punkt: '#b9aed6' } as const

/** Linien, Kästchen, Punkte … als SVG unter der Tinte */
export const LineaturBild = memo(function LineaturBild({ art, format, breite = SEITE_BREITE }: { art: Lineatur; format: number; breite?: number }) {
  const schichten = lineaturSchichten(art, format)
  if (!schichten.length) return null
  // breite < 1000 zeigt nur die linke obere Ecke, in Originalgröße erkennbar (Vorschau im Menü)
  return (
    <svg className="lineatur" viewBox={`0 0 ${breite} ${Math.round(breite * format)}`} preserveAspectRatio={breite < SEITE_BREITE ? 'xMinYMin slice' : 'none'} aria-hidden="true">
      {schichten.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={TON[s.staerke]} strokeWidth={STAERKE[s.staerke]} strokeLinecap={s.staerke === 'punkt' ? 'round' : 'butt'} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
})

/** Anordnung der Ansichten lesen und ändern; gespeichert wird im Datenordner, damit sie auf allen Geräten gilt */
export function useAnordnung(anhangId: string) {
  const { speicher } = useDaten()
  const pfad = pfade.blattAnordnung(anhangId)
  const anordnung = liesAnordnung(speicher.text(pfad))
  const sichere = (neu: Anordnung) => void speicher.schreibe(pfad, anordnungJson(neu))
  return {
    anordnung,
    zeigeBuch: (id: string) => sichere(zeigeBuch(anordnung, id)),
    verschiebe: (id: string, r: -1 | 1) => sichere(verschiebeAnsicht(anordnung, id, r)),
    breiten: (b: Record<string, number>) => sichere(setzeBreiten(anordnung, b)),
    schliesse: (id: string) => sichere(schliesseAnsicht(anordnung, id, true)),
    oeffne: (id: string) => sichere(oeffneAnsicht(anordnung, id)),
    /** Ziel für ein Bild: das erste offene Notizbuch, sonst ein ausgeblendetes wieder zeigen; null = keins da */
    zielBuch: (): string | null => {
      const offen = anordnung.ansichten.find((v) => v.art === 'buch' && !v.zu)
      if (offen) return offen.id
      const zu = anordnung.ansichten.find((v) => v.art === 'buch')
      if (zu) sichere(oeffneAnsicht(anordnung, zu.id))
      return zu?.id ?? null
    }
  }
}

/**
 * Ein Bild auf dem Blatt. Gewählt wird es im Werkzeug Markieren (über die Tinte, Buch.tsx); gewählt verschiebt Klicken
 * und Halten (0,4 s) mit Ziehen, die Ecke vergrößert sofort, × nimmt es vom Blatt (Nils 2026-11-15).
 */
export function BildAufBlatt({
  bild,
  format,
  aktiv,
  gewaehlt,
  loeschtGleich = false,
  uebernimm,
  tiefe = 0,
  onWahl,
  onAendern,
  onEntfernen
}: {
  bild: BlattBild
  /** wie tief in einem Ausschnitt aus einem Buch (Lernen 1.12): ab 1 wird ein Ausschnitt aus einem Buch nur ein Rahmen */
  tiefe?: number
  format: number
  aktiv: boolean
  gewaehlt: boolean
  loeschtGleich?: boolean
  /** in der Tinte 0,4 s gehalten: dieser Zeiger verschiebt das Bild gleich weiter */
  uebernimm?: Uebernahme | null
  onWahl: () => void
  onAendern: (b: BlattBild) => void
  onEntfernen: () => void
}) {
  const { speicher, bestand } = useDaten()
  const [src, setSrc] = useState<string | null>(null)
  const [lage, setLage] = useState<BlattBild | null>(null)
  const zug = useRef<{ art: 'ziehen' | 'groesse'; x: number; y: number; proPx: number; start: BlattBild } | null>(null)
  const quelle = bestand.dokumente.get(bild.anhang)
  const datei = typeof quelle?.felder.datei === 'string' ? quelle.felder.datei : ''
  const { seite, bereich } = bild
  const ausBuch = quelle?.typ === 'notizbuch' && seite !== undefined && bereich !== undefined
  useEffect(() => {
    let weg = false
    if (ausBuch) return
    const p = seite && bereich ? (datei ? ausschnitt(speicher, datei, seite, bereich, 1400) : Promise.resolve(null)) : bildUrl(speicher, bestand, bild.anhang)
    void p.then((s) => !weg && setSrc(s))
    return () => {
      weg = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speicher, bild.anhang, datei, seite, bereich?.x, bereich?.y, bereich?.b, bereich?.h, !!quelle])
  const b = lage ?? bild
  const hoehe = SEITE_BREITE * format
  const el = useRef<HTMLDivElement>(null)
  const starte = (art: 'ziehen' | 'groesse', ziel: HTMLElement, pointerId: number, x: number, y: number) => {
    const flaeche = ziel.closest('.blatt-flaeche')?.getBoundingClientRect()
    if (!flaeche) return
    try {
      ziel.setPointerCapture(pointerId)
    } catch {
      return
    }
    zug.current = { art, x, y, proPx: SEITE_BREITE / flaeche.width, start: bild }
  }
  useEffect(() => {
    if (uebernimm && el.current) starte('ziehen', el.current, uebernimm.pointerId, uebernimm.clientX, uebernimm.clientY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uebernimm])
  const halten = useHalten({ dauer: ANHEBEN_MS, art: 'anheben', aktiv: aktiv && gewaehlt, onFertig: (z) => starte('ziehen', z.el, z.pointerId, z.clientX, z.clientY) })
  const runter = (art: 'ziehen' | 'groesse') => (e: React.PointerEvent<HTMLElement>) => {
    if (!aktiv || e.pointerType === 'pen') return
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
    setLage(z.art === 'ziehen' ? rueckeBild(z.start, z.start.x + dx, z.start.y + dy, z.start.b, format) : rueckeBild(z.start, z.start.x, z.start.y, z.start.b + dx, format))
  }
  const hoch = (e: React.PointerEvent<HTMLElement>) => {
    halten.griffe.onPointerUp(e)
    if (zug.current && lage) onAendern(lage)
    zug.current = null
    setLage(null)
  }
  return (
    <div
      ref={el}
      className={`blatt-bild${aktiv && gewaehlt ? ' beweglich' : ''}${gewaehlt ? ' gewaehlt' : ''}${loeschtGleich ? ' loescht-gleich' : ''}`}
      style={{ left: `${(b.x / SEITE_BREITE) * 100}%`, top: `${(b.y / hoehe) * 100}%`, width: `${(b.b / SEITE_BREITE) * 100}%`, height: `${(b.h / hoehe) * 100}%` }}
      onPointerDown={runter('ziehen')}
      onPointerMove={(e) => {
        halten.griffe.onPointerMove(e)
        bewegen(e)
      }}
      onPointerUp={hoch}
      onPointerCancel={hoch}
    >
      {ausBuch ? (
        tiefe < 1 ? (
          <BuchFenster buchId={bild.anhang} seite={seite!} bereich={bereich!} tiefe={tiefe + 1} />
        ) : (
          <span className="buch-rahmen" title={`Ausschnitt aus ${quelle.titel}, S. ${seite}`} />
        )
      ) : src ? (
        <img src={src} alt={quelle?.titel ?? 'Bild'} draggable={false} />
      ) : (
        <span className="klein-leise">{quelle ? 'lädt …' : 'Bild fehlt noch'}</span>
      )}
      {gewaehlt && aktiv && (
        <>
          <button type="button" className="blatt-bild-weg" onPointerDown={(e) => e.stopPropagation()} onClick={onEntfernen} aria-label="Bild vom Blatt nehmen" title="Vom Blatt nehmen (das Bild selbst bleibt erhalten)">
            ×
          </button>
          <span className="blatt-bild-ecke" onPointerDown={runter('groesse')} aria-hidden="true" />
        </>
      )}
      {halten.ring}
    </div>
  )
}

/** Kopf einer Ansicht: Name (beim Notizbuch mit Lineatur), verschieben, schließen */
export function AnsichtKopf({
  ansicht,
  name,
  lineatur,
  erste,
  letzte,
  allein,
  onLineatur,
  onVerschiebe,
  onSchliesse
}: {
  ansicht: Ansicht
  name?: ReactNode
  lineatur?: Lineatur
  erste: boolean
  letzte: boolean
  allein: boolean
  onLineatur?: (l: Lineatur) => void
  onVerschiebe: (r: -1 | 1) => void
  onSchliesse: () => void
}) {
  return (
    <div className="ansicht-kopf">
      <span className="ansicht-name">{name}</span>
      {lineatur && onLineatur && (
        <select className="lineatur-wahl" value={lineatur} onChange={(e) => onLineatur(e.target.value as Lineatur)} aria-label="Lineatur">
          {LINEATUREN.map((l) => (
            <option key={l.art} value={l.art}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      <span style={{ flex: 1 }} />
      {!allein && (
        <>
          <button type="button" className="knopf still klein symbol" disabled={erste} onClick={() => onVerschiebe(-1)} aria-label="Nach vorn">
            <span className="nur-breit">‹</span>
            <span className="nur-schmal">↑</span>
          </button>
          <button type="button" className="knopf still klein symbol" disabled={letzte} onClick={() => onVerschiebe(1)} aria-label="Nach hinten">
            <span className="nur-breit">›</span>
            <span className="nur-schmal">↓</span>
          </button>
          <button type="button" className="knopf still klein symbol" onClick={onSchliesse} aria-label={ansicht.art === 'pdf' ? 'Skript ausblenden' : 'Buch schließen'} title={ansicht.art === 'pdf' ? 'Skript ausblenden' : 'Buch schließen (es bleibt erhalten, „+ Buch“ holt es zurück)'}>
            ×
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Griff zwischen zwei Ansichten: ziehen verteilt die Breite der beiden Nachbarn neu (Maus, Stift, Finger).
 * Während des Ziehens zeigt onZiehen die neuen Breiten, gespeichert wird beim Loslassen.
 */
export function Trenner({ links, rechts, onZiehen, onFertig }: { links: Ansicht; rechts: Ansicht; onZiehen: (b: Record<string, number>) => void; onFertig: (b: Record<string, number>) => void }) {
  const start = useRef<{ x: number; proPx: number; l: number; r: number } | null>(null)
  const letzte = useRef<Record<string, number> | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const berechne = (x: number) => {
    const s = start.current!
    const summe = s.l + s.r
    const min = Math.min(summe / 2, 220 * s.proPx)
    const l = Math.min(summe - min, Math.max(min, s.l + (x - s.x) * s.proPx))
    return { [links.id]: l, [rechts.id]: summe - l }
  }
  return (
    <div
      ref={ref}
      className="ansicht-trenner"
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite ändern"
      onPointerDown={(e) => {
        const a = ref.current?.previousElementSibling?.getBoundingClientRect()
        const b = ref.current?.nextElementSibling?.getBoundingClientRect()
        if (!a || !b) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, proPx: (links.breite + rechts.breite) / (a.width + b.width), l: links.breite, r: rechts.breite }
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        letzte.current = berechne(e.clientX)
        onZiehen(letzte.current)
      }}
      onPointerUp={() => {
        if (start.current && letzte.current) onFertig(letzte.current)
        start.current = null
        letzte.current = null
      }}
      onPointerCancel={() => {
        start.current = null
        letzte.current = null
        onZiehen({})
      }}
    />
  )
}

