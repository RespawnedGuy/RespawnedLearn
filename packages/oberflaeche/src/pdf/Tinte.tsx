import { useEffect, useMemo, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import { FARBEN, SEITE_BREITE, getroffen, liesTinte, tinteSvg, type Bereich, type Farbe, type Strich } from '@rvx/kern'
import { useDaten } from '../daten/DatenKontext'

export type Werkzeug = 'stift' | 'markieren' | 'radierer' | 'lesen'

function umriss(punkte: [number, number, number][], breite: number, druck: boolean): string {
  const o = getStroke(punkte, { size: breite, thinning: druck ? 0.55 : 0.35, smoothing: 0.5, streamline: 0.45, simulatePressure: !druck })
  if (!o.length) return ''
  let d = `M${o[0][0].toFixed(1)} ${o[0][1].toFixed(1)}`
  for (let i = 1; i < o.length; i++) d += `L${o[i][0].toFixed(1)} ${o[i][1].toFixed(1)}`
  return d + 'Z'
}

function scrollbar(el: Element | null): { scrollBy: (x: number, y: number) => void } {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return window
}

/**
 * Zeichenebene über einer Seite (PDF oder leeres Blatt). Stift und Maus schreiben, der Finger scrollt.
 * Radieren mit der Stiftrückseite (Radierer-Taste) oder dem Radierer-Werkzeug. Markieren zieht ein Rechteck auf.
 */
export function TintenEbene({
  pfad,
  format,
  werkzeug,
  farbe,
  onRechteck,
  fluechtig
}: {
  /** SVG-Datei dieser Seite im Datenordner */
  pfad: string
  /** Höhe/Breite der Seite */
  format: number
  werkzeug: Werkzeug
  farbe: Farbe
  onRechteck?: (b: Bereich, punkt: { x: number; y: number }) => void
  /** nur zum Schreiben im Moment, nichts wird gespeichert (z. B. Rechenweg beim Abrufen) */
  fluechtig?: boolean
}) {
  const { speicher, version } = useDaten()
  const hoehe = SEITE_BREITE * format
  const gespeichert = useMemo(() => liesTinte(speicher.text(pfad) ?? ''), [speicher, pfad, version])
  const [striche, setStriche] = useState<Strich[]>(gespeichert)
  const [aktiv, setAktiv] = useState<Strich | null>(null)
  const [rechteck, setRechteck] = useState<Bereich | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const geaendert = useRef(false)
  const modus = useRef<'zeichnen' | 'radieren' | 'rechteck' | 'scrollen' | null>(null)
  const letzter = useRef({ x: 0, y: 0 })

  // Änderungen von anderen Geräten übernehmen, solange hier nicht gerade gezeichnet wird
  useEffect(() => {
    if (!modus.current && !fluechtig) setStriche(gespeichert)
  }, [gespeichert, fluechtig])

  const punkt = (e: React.PointerEvent): [number, number, number] => {
    const r = ref.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * SEITE_BREITE, ((e.clientY - r.top) / r.height) * hoehe, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5]
  }

  const sichern = (neu: Strich[]) => {
    if (fluechtig) return
    void speicher.schreibe(pfad, tinteSvg(neu, hoehe))
  }

  const radiere = (x: number, y: number) => {
    setStriche((alt) => {
      const weg = new Set(getroffen(alt, x, y, 12))
      if (!weg.size) return alt
      geaendert.current = true
      return alt.filter((_, i) => !weg.has(i))
    })
  }

  const runter = (e: React.PointerEvent<SVGSVGElement>) => {
    if (werkzeug === 'lesen') return
    if (e.pointerType === 'touch' && werkzeug !== 'markieren') {
      // Finger scrollt. touch-action bleibt aus, sonst würde auch der Stift scrollen statt schreiben.
      modus.current = 'scrollen'
      letzter.current = { x: e.clientX, y: e.clientY }
      return
    }
    const radierer = (e.buttons & 32) !== 0 || werkzeug === 'radierer'
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
    const p = punkt(e)
    if (radierer) {
      modus.current = 'radieren'
      radiere(p[0], p[1])
    } else if (werkzeug === 'markieren') {
      modus.current = 'rechteck'
      start.current = { x: p[0], y: p[1] }
      setRechteck({ x: p[0] / SEITE_BREITE, y: p[1] / hoehe, b: 0, h: 0 })
    } else {
      modus.current = 'zeichnen'
      const breite = farbe === 'wichtig' ? 4 : 3
      setAktiv({ farbe, breite, punkte: [p], d: umriss([p], breite, e.pointerType === 'pen') })
    }
  }

  const bewegen = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!modus.current) return
    if (modus.current === 'scrollen') {
      scrollbar(ref.current).scrollBy(letzter.current.x - e.clientX, letzter.current.y - e.clientY)
      letzter.current = { x: e.clientX, y: e.clientY }
      return
    }
    const p = punkt(e)
    if (modus.current === 'radieren') radiere(p[0], p[1])
    else if (modus.current === 'rechteck' && start.current) {
      const s = start.current
      setRechteck({ x: Math.min(s.x, p[0]) / SEITE_BREITE, y: Math.min(s.y, p[1]) / hoehe, b: Math.abs(p[0] - s.x) / SEITE_BREITE, h: Math.abs(p[1] - s.y) / hoehe })
    } else if (modus.current === 'zeichnen') {
      const ereignisse = 'getCoalescedEvents' in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : []
      setAktiv((a) => {
        if (!a) return a
        const neu = ereignisse.length
          ? ereignisse.map((c) => punkt({ ...e, clientX: c.clientX, clientY: c.clientY, pressure: c.pressure } as React.PointerEvent))
          : [p]
        const punkte = [...a.punkte, ...neu]
        return { ...a, punkte, d: umriss(punkte, a.breite, e.pointerType === 'pen') }
      })
    }
  }

  const hoch = (e: React.PointerEvent<SVGSVGElement>) => {
    const m = modus.current
    modus.current = null
    if (m === 'zeichnen' && aktiv) {
      const neu = [...striche, aktiv]
      setStriche(neu)
      setAktiv(null)
      sichern(neu)
    } else if (m === 'radieren' && geaendert.current) {
      geaendert.current = false
      setStriche((s) => {
        sichern(s)
        return s
      })
    } else if (m === 'rechteck' && rechteck) {
      setRechteck(null)
      if (rechteck.b > 0.01 && rechteck.h > 0.005) {
        const r = ref.current!.getBoundingClientRect()
        onRechteck?.(rechteck, { x: e.clientX - r.left, y: e.clientY - r.top })
      }
    }
  }

  return (
    <svg
      ref={ref}
      className="ebene"
      viewBox={`0 0 ${SEITE_BREITE} ${hoehe}`}
      preserveAspectRatio="none"
      onPointerDown={runter}
      onPointerMove={bewegen}
      onPointerUp={hoch}
      onPointerCancel={hoch}
      style={{ pointerEvents: werkzeug === 'lesen' ? 'none' : 'auto' }}
    >
      {striche.map((s, i) => (
        <path key={i} d={s.d} fill={FARBEN[s.farbe]} />
      ))}
      {aktiv && <path d={aktiv.d} fill={FARBEN[aktiv.farbe]} />}
      {rechteck && (
        <rect x={rechteck.x * SEITE_BREITE} y={rechteck.y * hoehe} width={rechteck.b * SEITE_BREITE} height={rechteck.h * hoehe} fill="rgba(106,79,196,0.06)" stroke="currentColor" strokeDasharray="8 6" strokeWidth={2} style={{ color: 'var(--akzent)' }} />
      )}
    </svg>
  )
}
