import { useEffect, useRef, useState, type ReactNode } from 'react'
import { pfade, type App, type Bereich, type Farbe, type Marke } from '@rvx/kern'
import { useDaten } from '../daten/DatenKontext'
import { bildStufe, ladeBild, ladePdf, seitenFormat, zeichneSeite, type PdfDokument } from './pdf'
import { TintenEbene, type Werkzeug } from './Tinte'
import { useZweiFingerZoom } from './zoomGeste'

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
  /** höchstens so hoch (px), damit die Seite ganz sichtbar ist (Vollbild) */
  maxHoehe?: number
  onRechteck?: (seite: number, b: Bereich, punkt: { x: number; y: number }) => void
  onMarke?: (m: Marke) => void
  onSeiten?: (n: number) => void
  /** zusätzlicher Inhalt pro Seite (z. B. Schwebe-Dialog an der Auswahl) */
  zusatz?: (seite: number) => ReactNode
  /** springt zu dieser Seite, sobald sie gezeichnet ist */
  springeZu?: number
  /** Zoomen mit zwei Fingern (Faktor gegenüber dem bisherigen Zoom) */
  onZoom?: (faktor: number) => void
  /** Seiten als Bilder vom Server statt mit pdf.js im Gerät (große Pläne); offline wie bisher mit pdf.js */
  serverBilder?: boolean
  /** Das PDF im Hintergrund aufs Gerät holen, damit es offline geht (Standard); false = nur online ansehen */
  vorhalten?: boolean
  /** Text, wenn das PDF offline nicht auf dem Gerät liegt */
  ohnePdf?: string
  /** zusätzlicher Inhalt an jeder Marke (z. B. ihr Kurztext auf dem Plan) */
  markenInhalt?: (m: Marke) => ReactNode
}

/** Woher die Seiten kommen: Bilder vom Server oder das PDF selbst (pdf.js) */
type Quelle = { art: 'bild' } | { art: 'pdf'; doc: PdfDokument }

export function PdfAnsicht(p: PdfAnsichtProps) {
  const { speicher } = useDaten()
  const [quelle, setQuelle] = useState<Quelle | null | undefined>(undefined)
  const [ohneBilder, setOhneBilder] = useState(false)
  const [formate, setFormate] = useState<number[]>([])
  const [breite, setBreite] = useState(0)
  const huelle = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let weg = false
    let spaeter: ReturnType<typeof setTimeout> | undefined
    setQuelle(undefined)
    void (async () => {
      const info = p.serverBilder && !ohneBilder ? await speicher.pdfInfo(p.pfad) : null
      if (weg) return
      if (info) {
        setFormate(info.formate)
        setQuelle({ art: 'bild' })
        p.onSeiten?.(info.seiten)
        // Das PDF selbst später im Hintergrund holen, damit der Plan auch offline geht
        if (p.vorhalten !== false) spaeter = setTimeout(() => void speicher.binaer(p.pfad), 5000)
        return
      }
      const d = await ladePdf(speicher, p.pfad).catch(() => null)
      if (weg) return
      setQuelle(d ? { art: 'pdf', doc: d } : null)
      if (!d) return
      p.onSeiten?.(d.numPages)
      // Format der ersten Seite für alle annehmen, dann genau nachladen (Pläne haben oft gemischte Formate)
      const erstes = await seitenFormat(d, 1)
      if (weg) return
      setFormate(Array.from({ length: d.numPages }, () => erstes))
      const alle = await Promise.all(Array.from({ length: d.numPages }, (_, i) => seitenFormat(d, i + 1)))
      if (!weg) setFormate(alle)
    })()
    return () => {
      weg = true
      clearTimeout(spaeter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speicher, p.pfad, p.serverBilder, p.vorhalten, ohneBilder])

  useEffect(() => {
    const el = huelle.current
    if (!el) return
    const ro = new ResizeObserver(() => setBreite(el.clientWidth))
    ro.observe(el)
    setBreite(el.clientWidth)
    return () => ro.disconnect()
  }, [quelle])

  useZweiFingerZoom(huelle, p.onZoom, quelle)

  if (quelle === undefined) return <div className="leer">PDF wird geladen …</div>
  if (quelle === null) return <div className="leer">{p.ohnePdf ?? 'Das PDF ist auf diesem Gerät noch nicht verfügbar. Sobald der Server erreichbar ist, wird es geladen.'}</div>

  const eingepasst = p.maxHoehe && p.nurSeite ? p.maxHoehe / (formate[p.nurSeite - 1] ?? 1.414) : Infinity
  const seitenBreite = Math.max(200, Math.round(Math.min(breite * (p.zoom ?? 1), eingepasst)))
  const nummern = p.nurSeite ? [p.nurSeite] : formate.map((_, i) => i + 1)
  return (
    <div ref={huelle} className={p.onZoom ? 'pdf-zoombar' : undefined} style={{ width: '100%', overflowX: (p.zoom ?? 1) > 1 ? 'auto' : undefined }}>
      <div className="pdf-seiten" data-zoomflaeche style={p.nurSeite ? { padding: 0 } : undefined}>
        {breite > 0 &&
          nummern.map((nr) => (
            <Seite key={nr} {...p} quelle={quelle} aufPdf={() => setOhneBilder(true)} nr={nr} format={formate[nr - 1] ?? 1.414} breite={seitenBreite} />
          ))}
      </div>
    </div>
  )
}

function Seite(p: PdfAnsichtProps & { quelle: Quelle; aufPdf: () => void; nr: number; format: number; breite: number }) {
  const { speicher } = useDaten()
  const canvas = useRef<HTMLCanvasElement>(null)
  const doc = p.quelle.art === 'pdf' ? p.quelle.doc : null
  const el = useRef<HTMLDivElement>(null)
  const [sichtbar, setSichtbar] = useState(false)

  useEffect(() => {
    // In beide Richtungen: Weggescrollte Seiten werden nach einem Zoom erst neu gezeichnet, wenn sie wieder auftauchen
    const io = new IntersectionObserver((e) => setSichtbar(e[e.length - 1].isIntersecting), { rootMargin: '600px' })
    if (el.current) io.observe(el.current)
    return () => io.disconnect()
  }, [])

  // Gezeichnet wird für die Breite, auf die schon einmal gezeichnet wurde, nicht noch einmal (z. B. beim Zurückscrollen)
  const gezeichnet = useRef<{ doc: PdfDokument; breite: number } | null>(null)
  useEffect(() => {
    const c = canvas.current
    if (!sichtbar || !c || !doc) return
    const g = gezeichnet.current
    if (g && g.doc === doc && g.breite === p.breite) return
    // Beim Zoomen mit + / − kurz abwarten, ob noch ein Schritt kommt; bis dahin wird das alte Bild gestreckt
    let z: ReturnType<typeof zeichneSeite> | null = null
    const t = setTimeout(
      () => {
        z = zeichneSeite(doc, p.nr, c, p.breite)
        void z.fertig.then((ok) => ok && (gezeichnet.current = { doc, breite: p.breite }))
      },
      g ? 250 : 0
    )
    return () => {
      clearTimeout(t)
      z?.abbrechen()
    }
  }, [sichtbar, doc, p.nr, p.breite])

  // Bilder vom Server: das passende erst laden, dann tauschen; bis dahin bleibt das alte (gestreckt) stehen
  const [bild, setBild] = useState<string | null>(null)
  useEffect(() => {
    if (!sichtbar || doc) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const src = speicher.seitenbild(p.pfad, p.nr, bildStufe(p.breite * dpr))
    if (!src || src === bild) return
    let weg = false
    const t = setTimeout(
      () =>
        void ladeBild(src).then(
          () => !weg && setBild(src),
          // Server kann die Seite nicht liefern: dann doch selbst zeichnen
          () => !weg && !bild && p.aufPdf()
        ),
      bild ? 250 : 0
    )
    return () => {
      weg = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sichtbar, doc, p.pfad, p.nr, p.breite, bild])

  useEffect(() => {
    if (p.springeZu === p.nr) el.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [p.springeZu, p.nr])

  const marken = p.marken.filter((m) => m.seite === p.nr)
  const alleNummern = new Map(p.marken.map((m, i) => [m.id, i + 1]))
  return (
    <div ref={el} className={`pdf-seite${p.werkzeug !== 'lesen' ? ' zeichnen' : ''}`} style={{ width: p.breite, height: p.breite * p.format }}>
      {doc ? <canvas ref={canvas} className="bild" /> : bild ? <img src={bild} className="bild" alt="" draggable={false} /> : null}
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
          {p.markenInhalt?.(m)}
        </button>
      ))}
      {p.zusatz?.(p.nr)}
    </div>
  )
}
