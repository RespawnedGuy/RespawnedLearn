import { useEffect, useMemo, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import { FARBEN, SEITE_BREITE, getroffen, liesTinte, tinteSvg, type Bereich, type Farbe, type Strich } from '@rvx/kern'
import { useDaten } from '../daten/DatenKontext'
import { beachteHandballen, hatStift, istHandballen } from './handballen'

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

/** Zeiger an die Fläche binden; geht nicht, wenn er schon wieder weg ist */
function fange(e: React.PointerEvent<SVGSVGElement>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    /* dann eben ohne */
  }
}

type Punkt = { x: number; y: number }
const mitteVon = (p: Punkt[]): Punkt => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 })
const abstandVon = (p: Punkt[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)

/** Scrollbare Vorfahren je Richtung, sonst die Seite selbst */
function scroller(el: Element | null, achse: 'x' | 'y'): Element {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p)[achse === 'x' ? 'overflowX' : 'overflowY']
    const passt = achse === 'x' ? p.scrollWidth > p.clientWidth : p.scrollHeight > p.clientHeight
    if ((o === 'auto' || o === 'scroll') && passt) return p
  }
  return document.scrollingElement ?? document.documentElement
}

/**
 * Zeichenebene über einer Seite (PDF, Foto oder leeres Blatt). Stift und Maus schreiben. Der Finger scrollt, wenn das
 * Gerät einen Stift hat, sonst schreibt er auch. Zwei Finger verschieben und zoomen (onZoom).
 * Radieren mit der Stiftrückseite (Radierer-Taste) oder dem Radierer-Werkzeug. Markieren zieht ein Rechteck auf.
 * Schreibt der Stift, wird die aufliegende Hand übergangen (handballen.ts).
 */
export function TintenEbene({
  pfad,
  format,
  werkzeug,
  farbe,
  onRechteck,
  fluechtig,
  finger,
  breite: strichBreite,
  onZoom
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
  /** auch der Finger zeichnet (Fotos am Handy), statt zu scrollen */
  finger?: boolean
  /** Strichbreite in Seitenkoordinaten, sonst 3 (Wichtig 4) */
  breite?: number
  /** Zwei Finger auseinander/zusammen: Faktor gegenüber dem bisherigen Zoom. Ohne diese Angabe wird nicht gezoomt. */
  onZoom?: (faktor: number) => void
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
  const modus = useRef<'zeichnen' | 'radieren' | 'rechteck' | 'scrollen' | 'geste' | 'warten' | null>(null)
  const letzter = useRef({ x: 0, y: 0 })
  const beruehrt = useRef(new Map<number, Punkt>())
  const geste = useRef<{ abstand: number; mitte: Punkt; letzte: Punkt; faktor: number; ziel: HTMLElement | null } | null>(null)
  /** Zeiger, der gerade schreibt, radiert oder aufzieht; alle anderen bewegen nichts */
  const zeiger = useRef<number | null>(null)

  useEffect(beachteHandballen, [])

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

  /** Zwei Finger: Was gerade entstand, verwerfen; ab jetzt verschieben und (mit onZoom) zoomen */
  const starteGeste = () => {
    const p = [...beruehrt.current.values()]
    setAktiv(null)
    setRechteck(null)
    start.current = null
    const ziel = onZoom ? ref.current?.closest<HTMLElement>('[data-zoomflaeche]') ?? null : null
    const mitte = mitteVon(p)
    if (ziel) {
      const r = ziel.getBoundingClientRect()
      ziel.style.transformOrigin = `${mitte.x - r.left}px ${mitte.y - r.top}px`
    }
    geste.current = { abstand: abstandVon(p), mitte, letzte: mitte, faktor: 1, ziel }
    modus.current = 'geste'
  }

  const beendeGeste = () => {
    const g = geste.current
    geste.current = null
    if (!g) return
    if (g.ziel) g.ziel.style.transform = ''
    if (!onZoom || Math.abs(g.faktor - 1) < 0.02) return
    // Die Stelle unter den Fingern soll nach dem Zoomen dort bleiben. Welcher Vorfahr danach scrollt,
    // steht erst nach dem Neuzeichnen fest, deshalb vorher alle Stände merken.
    const el = ref.current
    const vorher = new Map<Element, { x: number; y: number; l: number; t: number }>()
    const seite = document.scrollingElement ?? document.documentElement
    for (let p: Element | null = el?.parentElement ?? null; p; p = p.parentElement) {
      const r = p === seite ? { left: 0, top: 0 } : p.getBoundingClientRect()
      vorher.set(p, { x: p.scrollLeft, y: p.scrollTop, l: r.left, t: r.top })
    }
    const m = g.letzte
    const f = g.faktor
    onZoom(f)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const nx = scroller(el, 'x')
        const ny = scroller(el, 'y')
        const ax = vorher.get(nx)
        const ay = vorher.get(ny)
        if (ax) nx.scrollLeft = (ax.x + m.x - ax.l) * f - (m.x - ax.l)
        if (ay) ny.scrollTop = (ay.y + m.y - ay.t) * f - (m.y - ay.t)
      })
    )
  }

  const runter = (e: React.PointerEvent<SVGSVGElement>) => {
    if (werkzeug === 'lesen') return
    if (e.pointerType === 'touch' && istHandballen(e.pointerId)) {
      e.preventDefault()
      return
    }
    if (e.pointerType === 'pen' && (modus.current === 'scrollen' || modus.current === 'warten' || modus.current === 'geste')) {
      // Die Hand lag schon auf, bevor der Stift kam: Sie scrollt nicht weiter, der Stift übernimmt
      beruehrt.current.clear()
      geste.current = null
      modus.current = null
    }
    if (e.pointerType === 'touch') {
      beruehrt.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      fange(e)
      if (beruehrt.current.size === 2) {
        e.preventDefault()
        starteGeste()
        return
      }
      if (beruehrt.current.size > 2) return
      if (werkzeug !== 'markieren' && !finger && hatStift()) {
        // Finger scrollt. touch-action bleibt aus, sonst würde auch der Stift scrollen statt schreiben.
        modus.current = 'scrollen'
        zeiger.current = e.pointerId
        letzter.current = { x: e.clientX, y: e.clientY }
        return
      }
    }
    if (modus.current === 'zeichnen' || modus.current === 'radieren' || modus.current === 'rechteck') return
    const radierer = (e.buttons & 32) !== 0 || werkzeug === 'radierer'
    zeiger.current = e.pointerId
    fange(e)
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
      const breite = strichBreite ?? (farbe === 'wichtig' ? 4 : 3)
      setAktiv({ farbe, breite, punkte: [p], d: umriss([p], breite, e.pointerType === 'pen') })
    }
  }

  const bewegen = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch' && beruehrt.current.has(e.pointerId)) beruehrt.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (!modus.current) return
    if (modus.current === 'warten') return
    if (modus.current === 'geste') {
      const g = geste.current
      const p = [...beruehrt.current.values()]
      if (!g || p.length < 2) return
      const mitte = mitteVon(p)
      // Verschieben mit beiden Fingern
      scroller(ref.current, 'x').scrollLeft -= mitte.x - g.letzte.x
      scroller(ref.current, 'y').scrollTop -= mitte.y - g.letzte.y
      g.letzte = mitte
      if (g.ziel && g.abstand > 0) {
        g.faktor = abstandVon(p) / g.abstand
        g.ziel.style.transform = `scale(${g.faktor})`
      }
      return
    }
    if (e.pointerId !== zeiger.current) return
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
    if (e.pointerType === 'touch') {
      beruehrt.current.delete(e.pointerId)
      if (modus.current === 'geste' || modus.current === 'warten') {
        if (modus.current === 'geste') beendeGeste()
        // Der verbleibende Finger zeichnet nicht weiter, erst ein neuer Ansatz
        modus.current = beruehrt.current.size ? 'warten' : null
        return
      }
    }
    if (e.pointerId !== zeiger.current) return
    zeiger.current = null
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
      style={{ pointerEvents: werkzeug === 'lesen' ? 'none' : 'auto', touchAction: finger && werkzeug !== 'lesen' ? 'none' : undefined }}
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
