// pdf.js laden und Seiten zeichnen. Dokumente und Ausschnitte bleiben im Speicher, damit Journal-Vorschauen
// (Stelle im Plan als Bild) beim Tippen nicht ständig neu gerechnet werden.
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Bereich } from '@rl/kern'
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

/**
 * Unsichtbare Textebene von pdf.js über der Seite (Design-Prüfung W8): Bildschirmleser lesen das Skript vor, und im
 * Werkzeug „Lesen“ lässt sich Text markieren und kopieren. Die Schrift ist durchsichtig, zu sehen bleibt das Bild.
 * `--total-scale-factor` braucht die Ebene für Schriftgröße und Lage, berechnet aus der CSS-Breite der Seite.
 */
export function zeichneText(doc: PdfDokument, nr: number, ebene: HTMLElement, breite: number): { fertig: Promise<boolean>; abbrechen: () => void } {
  let weg = false
  let tl: { cancel: () => void } | null = null
  const fertig = (async () => {
    const [m, seite] = await Promise.all([pdfjs(), doc.getPage(nr)])
    if (weg) return false
    const v = seite.getViewport({ scale: breite / seite.getViewport({ scale: 1 }).width })
    const neu = document.createElement('div')
    neu.className = 'textLayer'
    neu.style.setProperty('--total-scale-factor', String(v.scale))
    neu.style.setProperty('--scale-factor', String(v.scale))
    const t = new m.TextLayer({ textContentSource: seite.streamTextContent(), container: neu, viewport: v })
    tl = t
    try {
      await t.render()
    } catch {
      return false
    }
    if (weg) return false
    ebene.replaceChildren(...neu.childNodes)
    ebene.style.setProperty('--total-scale-factor', String(v.scale))
    return true
  })()
  return {
    fertig,
    abbrechen: () => {
      weg = true
      tl?.cancel()
    }
  }
}

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

// Große Pläne bei starkem Zoom ergäben Leinwände mit zig Millionen Pixeln: am Handy sehr langsam oder gar nicht
// gezeichnet. Darüber hinaus wird nur noch gestreckt (minimal unschärfer, aber sofort da).
const MAX_PIXEL = 16_000_000
const MAX_SEITE = 8192

/**
 * Zeichnet eine Seite für die gewünschte CSS-Breite (scharf auf hochauflösenden Displays). Gezeichnet wird erst in
 * eine eigene Leinwand und dann in einem Rutsch übernommen, damit das alte Bild bis dahin (gestreckt) stehen bleibt
 * statt weiß zu werden. abbrechen() beendet eine Zeichnung, die niemand mehr braucht (schneller Zoom, weggescrollt).
 */
export function zeichneSeite(doc: PdfDokument, nr: number, canvas: HTMLCanvasElement, breite: number): { fertig: Promise<boolean>; abbrechen: () => void } {
  let weg = false
  let aufgabe: { cancel: () => void } | null = null
  const fertig = (async () => {
    const seite = await doc.getPage(nr)
    if (weg) return false
    const v1 = seite.getViewport({ scale: 1 })
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let massstab = (breite / v1.width) * dpr
    massstab = Math.min(massstab, Math.sqrt(MAX_PIXEL / (v1.width * v1.height)), MAX_SEITE / Math.max(v1.width, v1.height))
    const v = seite.getViewport({ scale: massstab })
    const neu = document.createElement('canvas')
    neu.width = Math.floor(v.width)
    neu.height = Math.floor(v.height)
    const r = seite.render({ canvas: neu, viewport: v })
    aufgabe = r
    try {
      await r.promise
    } catch {
      neu.width = 0
      return false
    }
    if (weg) return (neu.width = 0), false
    canvas.width = neu.width
    canvas.height = neu.height
    canvas.getContext('2d')!.drawImage(neu, 0, 0)
    neu.width = 0
    return true
  })()
  return {
    fertig,
    abbrechen: () => {
      weg = true
      aufgabe?.cancel()
    }
  }
}

export async function seitenFormat(doc: PdfDokument, nr: number): Promise<number> {
  const v = (await doc.getPage(nr)).getViewport({ scale: 1 })
  return v.height / v.width
}

const ausschnitte = new Map<string, Promise<string | null>>()
// Vorschauen eine nach der anderen: Die Planübersicht wollte sonst alle PDFs gleichzeitig laden und zeichnen,
// und der geöffnete Plan musste warten, bis das Handy damit durch war
let reihe: Promise<unknown> = Promise.resolve()

/** Ausschnitt einer Seite als Bild (für die Vorschau im Journal und auf Lernkarten) */
export function ausschnitt(speicher: Speicher, pfad: string, nr: number, b: Bereich, breite = 360): Promise<string | null> {
  const k = `${pfad}|${nr}|${b.x}|${b.y}|${b.b}|${b.h}|${breite}`
  let p = ausschnitte.get(k)
  if (!p) {
    p = reihe.then(async () => {
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
    })
    reihe = p.catch(() => null)
    p.catch(() => ausschnitte.delete(k))
    ausschnitte.set(k, p)
  }
  return p
}

/** Text in einem markierten Bereich einer Seite (leer bei Scans und Bildern) */
export async function stellenText(speicher: Speicher, pfad: string, nr: number, b: Bereich): Promise<string> {
  const doc = await ladePdf(speicher, pfad)
  if (!doc || nr < 1 || nr > doc.numPages) return ''
  const seite = await doc.getPage(nr)
  const v = seite.getViewport({ scale: 1 })
  const inhalt = await seite.getTextContent()
  const rand = 0.01
  const teile: { text: string; x: number; y: number }[] = []
  for (const i of inhalt.items) {
    if (!('str' in i) || !i.str.trim()) continue
    // Grundlinie des Textstücks, etwas angehoben, damit Zeilen am oberen Rand mitzählen
    const [vx, vy] = v.convertToViewportPoint(i.transform[4], i.transform[5] + Math.abs(i.height || 0) / 2)
    const x = vx / v.width
    const y = vy / v.height
    if (x >= b.x - rand && x <= b.x + b.b + rand && y >= b.y - rand && y <= b.y + b.h + rand) teile.push({ text: i.str, x, y })
  }
  teile.sort((p, q) => Math.abs(p.y - q.y) > 0.006 ? p.y - q.y : p.x - q.x)
  return teile
    .map((t) => t.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
