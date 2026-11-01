// Zeichenblätter im Übungsplatz (Vertrag 5.3, „Blätter“): beliebig viele Blätter mit eigener Lineatur neben dem
// Skript, frei sortierbar, in der Breite ziehbar, nach unten verlängerbar. Die Lineatur zeichnet die App in
// Seitenkoordinaten, damit Tinte und Linien auf jedem Gerät übereinanderliegen.
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  A4,
  LINEATUREN,
  anordnungJson,
  blattFormat,
  liesAnordnung,
  liesTinte,
  lineaturName,
  lineaturSchichten,
  neueBlattId,
  neuesBlatt,
  oeffneAnsicht,
  pfade,
  schliesseAnsicht,
  setzeBreiten,
  setzeLineatur,
  tinteSvg,
  ulid,
  verschiebeAnsicht,
  SEITE_BREITE,
  type Anordnung,
  type Ansicht,
  type Farbe,
  type Lineatur
} from '@rvx/kern'
import { TintenEbene, useDaten, type Werkzeug } from '@rvx/oberflaeche'

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

/** Hat dieses Blatt auf irgendeiner Seite Tinte? Dann wird es beim Schließen nur ausgeblendet. */
function blattHatTinte(alle: string[], text: (p: string) => string | undefined, anhangId: string, blatt: string): boolean {
  const muster = new RegExp(`^lernen/blaetter/${anhangId}/S\\d{3}${blatt === '1' ? '' : `-${blatt}`}\\.svg$`)
  return alle.some((p) => muster.test(p) && liesTinte(text(p) ?? '').length > 0)
}

/** Anordnung der Ansichten lesen und ändern; gespeichert wird im Datenordner, damit sie auf allen Geräten gilt */
export function useAnordnung(anhangId: string) {
  const { speicher } = useDaten()
  const pfad = pfade.blattAnordnung(anhangId)
  const anordnung = liesAnordnung(speicher.text(pfad))
  const sichere = (neu: Anordnung) => void speicher.schreibe(pfad, anordnungJson(neu))
  return {
    anordnung,
    neuesBlatt: (l: Lineatur) => sichere(neuesBlatt(anordnung, neueBlattId(anordnung, ulid()), l)),
    verschiebe: (id: string, r: -1 | 1) => sichere(verschiebeAnsicht(anordnung, id, r)),
    breiten: (b: Record<string, number>) => sichere(setzeBreiten(anordnung, b)),
    lineatur: (id: string, l: Lineatur) => sichere(setzeLineatur(anordnung, id, l)),
    schliesse: (id: string) => sichere(schliesseAnsicht(anordnung, id, id !== 'pdf' && blattHatTinte(speicher.pfade(), (p) => speicher.text(p), anhangId, id))),
    oeffne: (id: string) => sichere(oeffneAnsicht(anordnung, id))
  }
}

/** Ein Zeichenblatt zur Skriptseite: Lineatur, Tinte, unten „Verlängern“ */
export function Blatt({ anhangId, seite, ansicht, werkzeug, farbe }: { anhangId: string; seite: number; ansicht: Ansicht; werkzeug: Werkzeug; farbe: Farbe }) {
  const { speicher } = useDaten()
  const pfad = pfade.blatt(anhangId, seite, ansicht.id)
  const format = blattFormat(speicher.text(pfad))
  const verlaengern = () => {
    // Die Striche bleiben, wo sie sind; nur die Seite wird eine A4-Höhe länger
    void speicher.schreibe(pfad, tinteSvg(liesTinte(speicher.text(pfad) ?? ''), SEITE_BREITE * (format + A4)))
  }
  return (
    <>
      <div className="blatt-flaeche pdf-seite zeichnen" style={{ aspectRatio: `1 / ${format}` }}>
        <LineaturBild art={ansicht.lineatur ?? 'kariert'} format={format} />
        <TintenEbene pfad={pfad} format={format} werkzeug={werkzeug === 'markieren' ? 'stift' : werkzeug} farbe={farbe} />
      </div>
      <button type="button" className="knopf still klein blatt-verlaengern" onClick={verlaengern} title="Das Blatt um eine Seite nach unten verlängern">
        + Platz nach unten
      </button>
    </>
  )
}

/** Kopf einer Ansicht: Name oder Lineatur, verschieben, schließen */
export function AnsichtKopf({
  ansicht,
  name,
  erste,
  letzte,
  allein,
  onLineatur,
  onVerschiebe,
  onSchliesse
}: {
  ansicht: Ansicht
  name?: ReactNode
  erste: boolean
  letzte: boolean
  allein: boolean
  onLineatur: (l: Lineatur) => void
  onVerschiebe: (r: -1 | 1) => void
  onSchliesse: () => void
}) {
  return (
    <div className="ansicht-kopf">
      {ansicht.art === 'blatt' ? (
        <select className="lineatur-wahl" value={ansicht.lineatur ?? 'kariert'} onChange={(e) => onLineatur(e.target.value as Lineatur)} aria-label="Lineatur">
          {LINEATUREN.map((l) => (
            <option key={l.art} value={l.art}>
              {l.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="ansicht-name">{name}</span>
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
          <button type="button" className="knopf still klein symbol" onClick={onSchliesse} aria-label={ansicht.art === 'pdf' ? 'Skript ausblenden' : 'Blatt schließen'} title={ansicht.art === 'pdf' ? 'Skript ausblenden' : 'Blatt schließen (Geschriebenes bleibt)'}>
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

/** „+ Blatt“: neues Blatt mit Lineatur oder Ausgeblendetes wieder zeigen */
export function BlattMenue({ anordnung, onNeu, onOeffne }: { anordnung: Anordnung; onNeu: (l: Lineatur) => void; onOeffne: (id: string) => void }) {
  const [offen, setOffen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!offen) return
    const weg = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOffen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    addEventListener('pointerdown', weg, true)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', weg, true)
      removeEventListener('keydown', esc)
    }
  }, [offen])
  const zu = anordnung.ansichten.filter((v) => v.zu)
  let nr = 0
  const nummer = new Map(anordnung.ansichten.filter((v) => v.art === 'blatt').map((v) => [v.id, ++nr]))
  return (
    <div className="blatt-menue-huelle" ref={ref}>
      <button type="button" className="knopf klein" aria-expanded={offen} onClick={() => setOffen(!offen)}>
        + Blatt
      </button>
      {offen && (
        <div className="blatt-menue" role="menu">
          <div className="klein-leise">Neues Blatt</div>
          <div className="lineatur-knoepfe">
            {LINEATUREN.map((l) => (
              <button
                key={l.art}
                type="button"
                role="menuitem"
                className="lineatur-knopf"
                onClick={() => {
                  onNeu(l.art)
                  setOffen(false)
                }}
              >
                <span className="lineatur-probe">
                  <LineaturBild art={l.art} format={0.5} breite={300} />
                </span>
                {l.name}
              </button>
            ))}
          </div>
          {zu.length > 0 && (
            <>
              <div className="klein-leise">Wieder zeigen</div>
              {zu.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="menuitem"
                  className="knopf still klein"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => {
                    onOeffne(v.id)
                    setOffen(false)
                  }}
                >
                  {v.art === 'pdf' ? 'Skript' : `Blatt ${nummer.get(v.id)} · ${lineaturName(v.lineatur ?? 'kariert')}`}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
