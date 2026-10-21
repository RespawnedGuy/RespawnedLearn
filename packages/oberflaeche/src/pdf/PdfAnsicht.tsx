import { useEffect, useRef, useState, type ReactNode } from 'react'
import { pfade, type App, type Bereich, type Farbe, type Marke } from '@rvx/kern'
import { useDaten } from '../daten/DatenKontext'
import { ladePdf, seitenFormat, zeichneSeite, type PdfDokument } from './pdf'
import { TintenEbene, type Werkzeug } from './Tinte'

export interface PdfAnsichtProps {
  app: App
  anhangId: string
  /** Pfad der Originaldatei */
  pfad: string
  marken: Marke[]
  gewaehlt?: string | null
  werkzeug: Werkzeug
  farbe: Farbe
  /** nur diese Seite zeigen (Übungsplatz), sonst alle untereinander */
  nurSeite?: number
  /** Breite relativ zum Platz (1 = ganze Breite) */
  zoom?: number
  onRechteck?: (seite: number, b: Bereich, punkt: { x: number; y: number }) => void
  onMarke?: (m: Marke) => void
  onSeiten?: (n: number) => void
  /** zusätzlicher Inhalt pro Seite (z. B. Schwebe-Dialog an der Auswahl) */
  zusatz?: (seite: number) => ReactNode
  /** springt zu dieser Seite, sobald sie gezeichnet ist */
  springeZu?: number
  /** Zoomen mit zwei Fingern (Faktor gegenüber dem bisherigen Zoom) */
  onZoom?: (faktor: number) => void
}

export function PdfAnsicht(p: PdfAnsichtProps) {
  const { speicher } = useDaten()
  const [doc, setDoc] = useState<PdfDokument | null | undefined>(undefined)
  const [formate, setFormate] = useState<number[]>([])
  const [breite, setBreite] = useState(0)
  const huelle = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let weg = false
    setDoc(undefined)
    ladePdf(speicher, p.pfad).then(async (d) => {
      if (weg) return
      setDoc(d)
      if (!d) return
      p.onSeiten?.(d.numPages)
      // Format der ersten Seite für alle annehmen, dann genau nachladen (Pläne haben oft gemischte Formate)
      const erstes = await seitenFormat(d, 1)
      if (weg) return
      setFormate(Array.from({ length: d.numPages }, () => erstes))
      const alle = await Promise.all(Array.from({ length: d.numPages }, (_, i) => seitenFormat(d, i + 1)))
      if (!weg) setFormate(alle)
    }, () => !weg && setDoc(null))
    return () => {
      weg = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speicher, p.pfad])

  useEffect(() => {
    const el = huelle.current
    if (!el) return
    const ro = new ResizeObserver(() => setBreite(el.clientWidth))
    ro.observe(el)
    setBreite(el.clientWidth)
    return () => ro.disconnect()
  }, [doc])

  if (doc === undefined) return <div className="leer">PDF wird geladen …</div>
  if (doc === null) return <div className="leer">Das PDF ist auf diesem Gerät noch nicht verfügbar. Sobald der Server erreichbar ist, wird es geladen.</div>

  const seitenBreite = Math.max(200, Math.round(breite * (p.zoom ?? 1)))
  const nummern = p.nurSeite ? [p.nurSeite] : formate.map((_, i) => i + 1)
  return (
    <div ref={huelle} style={{ width: '100%', overflowX: (p.zoom ?? 1) > 1 ? 'auto' : undefined }}>
      <div className="pdf-seiten" data-zoomflaeche style={p.nurSeite ? { padding: 0 } : undefined}>
        {breite > 0 &&
          nummern.map((nr) => (
            <Seite key={nr} {...p} doc={doc} nr={nr} format={formate[nr - 1] ?? 1.414} breite={seitenBreite} />
          ))}
      </div>
    </div>
  )
}

function Seite(p: PdfAnsichtProps & { doc: PdfDokument; nr: number; format: number; breite: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const el = useRef<HTMLDivElement>(null)
  const [sichtbar, setSichtbar] = useState(false)

  useEffect(() => {
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setSichtbar(true), { rootMargin: '600px' })
    if (el.current) io.observe(el.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!sichtbar || !canvas.current) return
    void zeichneSeite(p.doc, p.nr, canvas.current, p.breite)
  }, [sichtbar, p.doc, p.nr, p.breite])

  useEffect(() => {
    if (p.springeZu === p.nr) el.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [p.springeZu, p.nr])

  const marken = p.marken.filter((m) => m.seite === p.nr)
  const alleNummern = new Map(p.marken.map((m, i) => [m.id, i + 1]))
  return (
    <div ref={el} className={`pdf-seite${p.werkzeug !== 'lesen' ? ' zeichnen' : ''}`} style={{ width: p.breite, height: p.breite * p.format }}>
      <canvas ref={canvas} className="bild" />
      <TintenEbene
        pfad={pfade.tinte(p.app, p.anhangId, p.nr)}
        format={p.format}
        werkzeug={p.werkzeug}
        farbe={p.farbe}
        onRechteck={(b, pt) => p.onRechteck?.(p.nr, b, pt)}
        onZoom={p.onZoom}
      />
      {marken.map((m) => (
        <button
          type="button"
          key={m.id}
          className={`marke ${m.farbe ?? ''}${p.gewaehlt === m.id ? ' gewaehlt' : ''}`}
          title={m.text}
          style={{ left: `${m.bereich.x * 100}%`, top: `${m.bereich.y * 100}%`, width: `${m.bereich.b * 100}%`, height: `${m.bereich.h * 100}%`, pointerEvents: p.werkzeug === 'stift' ? 'none' : 'auto' }}
          onClick={() => p.onMarke?.(m)}
        >
          {p.app === 'arbeit' && <span className="nummer">{alleNummern.get(m.id)}</span>}
        </button>
      ))}
      {p.zusatz?.(p.nr)}
    </div>
  )
}
