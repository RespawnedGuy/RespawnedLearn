import { useEffect, useMemo, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import { FARBEN, SEITE_BREITE, getroffen, liesTinte, tinteSvg, type Bereich, type Farbe, type Strich } from '@rl/kern'
import { useDaten } from '../daten/DatenKontext'
import { beachteHandballen, hatStift, istHandballen } from './handballen'
import { abstandVon, mitteVon, scroller, zoomeUm, type Punkt } from './zoomGeste'

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
  onZoom,
  onStrich
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
  /** Strichbreite in Seitenkoordinaten, sonst 2,55 (Wichtig 3,4), 15 % dünner als bis v0.58.2 */
  breite?: number
  /** Zwei Finger auseinander/zusammen: Faktor gegenüber dem bisherigen Zoom. Ohne diese Angabe wird nicht gezoomt. */
  onZoom?: (faktor: number) => void
  /** Ein Strich ist abgesetzt (nach dem Sichern der Tinte); `alle` sind alle Striche der Seite, der neue eingeschlossen */
  onStrich?: (neu: Strich, alle: Strich[]) => void
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

  // Änderungen von anderen Geräten übernehmen, solange hier nicht gerade gezeichnet wird. Kommen sie mitten im
  // Strich an, werden sie beim Absetzen nachgeholt; sonst überschriebe der neue Strich die Tinte vom Server.
  const verpasst = useRef<Strich[] | null>(null)
  const radiert = useRef(new Set<string>())
  useEffect(() => {
    if (fluechtig) return
    if (modus.current) verpasst.current = gespeichert
    else setStriche(gespeichert)
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
      for (const i of weg) radiert.current.add(alt[i].d)
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
    zoomeUm(ref.current, g.faktor, g.letzte, onZoom)
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
      const breite = strichBreite ?? (farbe === 'wichtig' ? 3.4 : 2.55)
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
    const nachholen = verpasst.current
    verpasst.current = null
    if (m === 'zeichnen' && aktiv) {
      const neu = [...(nachholen ?? striche), aktiv]
      setStriche(neu)
      setAktiv(null)
      sichern(neu)
      if (!fluechtig) onStrich?.(aktiv, neu)
    } else if (m === 'radieren' && geaendert.current) {
      geaendert.current = false
      const weg = radiert.current
      radiert.current = new Set()
      setStriche((s) => {
        const neu = nachholen ? nachholen.filter((x) => !weg.has(x.d)) : s
        sichern(neu)
        return neu
      })
    } else {
      if (nachholen) setStriche(nachholen)
      if (m === 'rechteck' && rechteck) {
        setRechteck(null)
        if (rechteck.b > 0.01 && rechteck.h > 0.005) {
          const r = ref.current!.getBoundingClientRect()
          onRechteck?.(rechteck, { x: e.clientX - r.left, y: e.clientY - r.top })
        }
      }
    }
    if (m !== 'radieren') radiert.current = new Set()
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
