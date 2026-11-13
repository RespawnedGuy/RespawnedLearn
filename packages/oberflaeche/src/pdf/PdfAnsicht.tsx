import { useEffect, useRef, useState, type ReactNode } from 'react'
import { pfade, sichtbareSeite, type App, type Bereich, type Farbe, type Marke } from '@rl/kern'
import { useDaten } from '../daten/DatenKontext'
import { ladePdf, seitenFormat, zeichneSeite, zeichneText, type PdfDokument } from './pdf'
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
  /** springt zu dieser Seite, sobald die Seitenformate bekannt sind; `mal` zählt hoch, damit derselbe Sprung wiederholbar ist */
  springeZu?: { seite: number; mal: number; sanft?: boolean }
  /** meldet beim Scrollen die Seite mit dem größten sichtbaren Anteil (alle Seiten untereinander) */
  onSeite?: (nr: number) => void
  /** das Element, das scrollt; ohne Angabe das Fenster. Danach richten sich Vorzeichnen und Freigeben der Seiten. */
  scrollFlaeche?: HTMLElement | null
  /** Zoomen mit zwei Fingern (Faktor gegenüber dem bisherigen Zoom) */
  onZoom?: (faktor: number) => void
  /** Text, wenn das PDF nicht im Ordner liegt */
  ohnePdf?: string
  /** zusätzlicher Inhalt an jeder Marke (z. B. ihr Kurztext auf dem Plan) */
  markenInhalt?: (m: Marke) => ReactNode
}

export function PdfAnsicht(p: PdfAnsichtProps) {
  const { speicher } = useDaten()
  // pdf.js zeichnet die Seiten im Gerät; undefined = lädt noch, null = PDF fehlt
  const [quelle, setQuelle] = useState<PdfDokument | null | undefined>(undefined)
  const [formate, setFormate] = useState<number[]>([])
  // erst wenn alle Formate gelesen sind, stehen die Seiten an ihrer endgültigen Stelle (wichtig für Sprünge)
  const [formateFertig, setFormateFertig] = useState(false)
  const [breite, setBreite] = useState(0)
  const huelle = useRef<HTMLDivElement>(null)
  const seitenEl = useRef(new Map<number, HTMLDivElement>())

  useEffect(() => {
    let weg = false
    setQuelle(undefined)
    setFormateFertig(false)
    void (async () => {
      const d = await ladePdf(speicher, p.pfad).catch(() => null)
      if (weg) return
      setQuelle(d)
      if (!d) return
      p.onSeiten?.(d.numPages)
      // Format der ersten Seite für alle annehmen, dann genau nachladen (Pläne haben oft gemischte Formate)
      const erstes = await seitenFormat(d, 1)
      if (weg) return
      setFormate(Array.from({ length: d.numPages }, () => erstes))
      const alle = await Promise.all(Array.from({ length: d.numPages }, (_, i) => seitenFormat(d, i + 1)))
      if (weg) return
      setFormate(alle)
      setFormateFertig(true)
    })()
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
  }, [quelle])

  useZweiFingerZoom(huelle, p.onZoom, quelle)

  // Sichtbare Seite melden (gedrosselt auf ein Bild pro Frame)
  const onSeite = useRef(p.onSeite)
  onSeite.current = p.onSeite
  const melden = !!p.onSeite && !p.nurSeite
  // Erst melden, wenn der erste Sprung (z. B. zum Lesestand) erledigt ist; sonst gewinnt kurz Seite 1
  const gesprungen = useRef(false)
  useEffect(() => {
    if (!melden || !quelle || !breite) return
    const flaeche = p.scrollFlaeche ?? null
    let frame = 0
    let zuletzt = 0
    const pruefen = () => {
      frame = 0
      if (!gesprungen.current) return
      const r = flaeche?.getBoundingClientRect()
      const oben = r ? Math.max(0, r.top) : 0
      const unten = r ? Math.min(innerHeight, r.bottom) : innerHeight
      const lagen = [...seitenEl.current].map(([nr, el]) => {
        const b = el.getBoundingClientRect()
        return { nr, oben: b.top, unten: b.bottom }
      })
      const nr = sichtbareSeite(lagen, oben, unten)
      if (nr && nr !== zuletzt) {
        zuletzt = nr
        onSeite.current?.(nr)
      }
    }
    const planen = () => {
      if (!frame) frame = requestAnimationFrame(pruefen)
    }
    const ziel: HTMLElement | Window = flaeche ?? window
    ziel.addEventListener('scroll', planen, { passive: true })
    addEventListener('resize', planen)
    planen()
    return () => {
      ziel.removeEventListener('scroll', planen)
      removeEventListener('resize', planen)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [melden, quelle, breite, formate, p.scrollFlaeche])

  // Sprung zu einer Seite (Lesestand, Inhaltsverzeichnis, Tasten)
  const sprung = p.springeZu
  useEffect(() => {
    if (!formateFertig || !breite) return
    if (sprung) seitenEl.current.get(sprung.seite)?.scrollIntoView({ block: 'start', behavior: sprung.sanft ? 'smooth' : 'auto' })
    if (!gesprungen.current) {
      // nach dem ersten Sprung einmal nachmessen
      gesprungen.current = true
      ;(p.scrollFlaeche ?? window).dispatchEvent(new Event('scroll'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprung?.seite, sprung?.mal, formateFertig, breite > 0])

  if (quelle === undefined) return <div className="leer">PDF wird geladen …</div>
  if (quelle === null) return <div className="leer">{p.ohnePdf ?? 'Das PDF liegt (noch) nicht im Datenordner. Bringt Syncthing es gerade, erscheint es gleich.'}</div>

  const eingepasst = p.maxHoehe && p.nurSeite ? p.maxHoehe / (formate[p.nurSeite - 1] ?? 1.414) : Infinity
  const seitenBreite = Math.max(200, Math.round(Math.min(breite * (p.zoom ?? 1), eingepasst)))
  const nummern = p.nurSeite ? [p.nurSeite] : formate.map((_, i) => i + 1)
  return (
    <div ref={huelle} className={p.onZoom ? 'pdf-zoombar' : undefined} style={{ width: '100%', overflowX: (p.zoom ?? 1) > 1 ? 'auto' : undefined }}>
      <div className="pdf-seiten" data-zoomflaeche style={p.nurSeite ? { padding: 0 } : undefined}>
        {breite > 0 &&
          nummern.map((nr) => (
            <Seite
              key={nr}
              {...p}
              doc={quelle}
              nr={nr}
              format={formate[nr - 1] ?? 1.414}
              breite={seitenBreite}
              anmelden={(el) => (el ? seitenEl.current.set(nr, el) : seitenEl.current.delete(nr))}
            />
          ))}
      </div>
    </div>
  )
}

/** Bildpunkte weit außerhalb der Sicht freigeben (lange Skripte, Speicher am Handy); weit = so viel über und unter der Sicht */
const FREIGEBEN_AB = '4000px'

function Seite(p: PdfAnsichtProps & { doc: PdfDokument; nr: number; format: number; breite: number; anmelden: (el: HTMLDivElement | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const doc = p.doc
  const el = useRef<HTMLDivElement>(null)
  const [sichtbar, setSichtbar] = useState(false)

  useEffect(() => {
    // In beide Richtungen: Weggescrollte Seiten werden nach einem Zoom erst neu gezeichnet, wenn sie wieder auftauchen
    // Die Wurzel muss das scrollende Element sein, sonst schneidet es die Seiten ab und der Vorlauf greift nicht
    const root = p.scrollFlaeche ?? null
    const io = new IntersectionObserver((e) => setSichtbar(e[e.length - 1].isIntersecting), { root, rootMargin: '600px' })
    // Weit weg: Leinwand leeren, beim Wiederkommen zeichnet die Seite neu
    const weit = new IntersectionObserver(
      (e) => {
        const c = canvas.current
        if (e[e.length - 1].isIntersecting || !c || !gezeichnet.current) return
        c.width = 0
        c.height = 0
        gezeichnet.current = null
      },
      { root, rootMargin: FREIGEBEN_AB }
    )
    if (el.current) {
      io.observe(el.current)
      weit.observe(el.current)
    }
    p.anmelden(el.current)
    return () => {
      io.disconnect()
      weit.disconnect()
      p.anmelden(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.scrollFlaeche])

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

  // Textebene: erst wenn die Seite sichtbar ist und das Zoomen ruht (sie ist für Bildschirmleser und Markieren da)
  useEffect(() => {
    const e = text.current
    if (!sichtbar || !e || !doc) return
    let z: ReturnType<typeof zeichneText> | null = null
    const t = setTimeout(() => (z = zeichneText(doc, p.nr, e, p.breite)), 300)
    return () => {
      clearTimeout(t)
      z?.abbrechen()
    }
  }, [sichtbar, doc, p.nr, p.breite])

  const marken = p.marken.filter((m) => m.seite === p.nr)
  const alleNummern = new Map(p.marken.map((m, i) => [m.id, i + 1]))
  return (
    <div ref={el} className={`pdf-seite${p.werkzeug !== 'lesen' ? ' zeichnen' : ''}`} style={{ width: p.breite, height: p.breite * p.format }} role="group" aria-label={`Seite ${p.nr}`}>
      <canvas ref={canvas} className="bild" aria-hidden="true" />
      <div ref={text} className="textLayer" style={{ pointerEvents: p.werkzeug === 'lesen' ? 'auto' : 'none' }} />
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
