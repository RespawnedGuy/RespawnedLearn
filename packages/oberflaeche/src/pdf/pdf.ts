// pdf.js laden und Seiten zeichnen. Dokumente und Ausschnitte bleiben im Speicher, damit Journal-Vorschauen
// (Stelle im Plan als Bild) beim Tippen nicht ständig neu gerechnet werden.
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Bereich } from '@rvx/kern'
import type { Speicher } from '../daten/speicher'

export type PdfDokument = PDFDocumentProxy

// Legacy-Build: pdf.js 6 nutzt sehr neue JS-Funktionen (Map.getOrInsertComputed), die viele Browser noch
// nicht haben. Der Legacy-Build bringt Ersatz mit. Geladen wird erst beim ersten PDF (eigener Bundle-Teil).
let lib: Promise<typeof import('pdfjs-dist')> | undefined
function pdfjs() {
  lib ??= Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([m, w]) => {
    m.GlobalWorkerOptions.workerSrc = w.default
    return m as unknown as typeof import('pdfjs-dist')
  })
  return lib
}

const dokumente = new Map<string, Promise<PdfDokument | null>>()

export function ladePdf(speicher: Speicher, pfad: string): Promise<PdfDokument | null> {
  let p = dokumente.get(pfad)
  if (!p) {
    p = speicher.binaer(pfad).then(async (blob) => {
      if (!blob) return null
      return (await pdfjs()).getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
    })
    p.catch(() => dokumente.delete(pfad))
    dokumente.set(pfad, p)
  }
  return p
}

/** Zeichnet eine Seite in ein Canvas mit der gewünschten CSS-Breite (scharf auf hochauflösenden Displays) */
export async function zeichneSeite(doc: PdfDokument, nr: number, canvas: HTMLCanvasElement, breite: number): Promise<{ breite: number; hoehe: number }> {
  const seite = await doc.getPage(nr)
  const v1 = seite.getViewport({ scale: 1 })
  const massstab = breite / v1.width
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
  const v = seite.getViewport({ scale: massstab * dpr })
  canvas.width = Math.floor(v.width)
  canvas.height = Math.floor(v.height)
  canvas.style.width = `${breite}px`
  canvas.style.height = `${v.height / dpr}px`
  await seite.render({ canvas, viewport: v }).promise
  return { breite, hoehe: v.height / dpr }
}

export async function seitenFormat(doc: PdfDokument, nr: number): Promise<number> {
  const v = (await doc.getPage(nr)).getViewport({ scale: 1 })
  return v.height / v.width
}

const ausschnitte = new Map<string, Promise<string | null>>()

/** Ausschnitt einer Seite als Bild (für die Vorschau im Journal und auf Lernkarten) */
export function ausschnitt(speicher: Speicher, pfad: string, nr: number, b: Bereich, breite = 360): Promise<string | null> {
  const k = `${pfad}|${nr}|${b.x}|${b.y}|${b.b}|${b.h}|${breite}`
  let p = ausschnitte.get(k)
  if (!p) {
    p = (async () => {
      const doc = await ladePdf(speicher, pfad)
      if (!doc || nr < 1 || nr > doc.numPages) return null
      const seite = await doc.getPage(nr)
      const v1 = seite.getViewport({ scale: 1 })
      // Ganze Seite zeichnen und den Ausschnitt herauskopieren; die Seite höchstens 4096 px breit
      const massstab = Math.min(breite / (Math.max(b.b, 0.02) * v1.width), 4096 / v1.width)
      const v = seite.getViewport({ scale: massstab })
      const ganz = document.createElement('canvas')
      ganz.width = Math.ceil(v.width)
      ganz.height = Math.ceil(v.height)
      const g = ganz.getContext('2d')!
      g.fillStyle = '#fff'
      g.fillRect(0, 0, ganz.width, ganz.height)
      await seite.render({ canvas: ganz, viewport: v }).promise
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(b.b * v.width))
      c.height = Math.max(1, Math.round(b.h * v.height))
      c.getContext('2d')!.drawImage(ganz, b.x * v.width, b.y * v.height, c.width, c.height, 0, 0, c.width, c.height)
      ganz.width = 0
      return c.toDataURL('image/jpeg', 0.85)
    })()
    p.catch(() => ausschnitte.delete(k))
    ausschnitte.set(k, p)
  }
  return p
}
