// Originaldateien (PDF, Foto) ablegen: Original nach anhaenge/JJJJ/MM/, Sidecar nach gemeinsam/anhaenge/ (Vertrag 5.1).
// Andere Dateien verweisen nur auf die ID des Sidecars, nie auf den Pfad.
import { FARBEN, liesTinte, neuesDokument, pfade, SEITE_BREITE, tag, ulid, zeitstempel, type App, type Bestand, type Wert } from '@rl/kern'
import type { Speicher } from './daten/speicher'
import { geraet } from './daten/speicher'

async function sha256(blob: Blob): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function neuerAnhang(speicher: Speicher, datei: File, zusatz: [string, Wert][] = [], titel?: string): Promise<string> {
  const id = ulid()
  const jetzt = zeitstempel()
  const pfad = pfade.original(tag(), id, datei.name)
  const veraenderlich = /pdf$/i.test(datei.type) || /\.pdf$/i.test(datei.name)
  await speicher.hochladen(pfad, datei)
  await speicher.schreibe(
    pfade.anhang(id),
    neuesDokument([
      ['id', id],
      ['typ', 'anhang'],
      ['erstellt', jetzt],
      ['geaendert', jetzt],
      ['titel', titel ?? datei.name.replace(/\.[^.]+$/, '')],
      ['datei', pfad],
      ['sha256', await sha256(datei)],
      // annotierte PDFs sind lebende Dokumente; die Tinte liegt trotzdem getrennt daneben
      ['veraenderlich', veraenderlich],
      ['mime', datei.type || 'application/octet-stream'],
      ['aufgenommen', zeitstempel(new Date(datei.lastModified || Date.now()))],
      ['geraet', geraet()],
      ...zusatz
    ])
  )
  return id
}

const urls = new Map<string, Promise<string | null>>()

/** Objekt-URL für ein Bild (über die Sidecar-ID) */
export function bildUrl(speicher: Speicher, bestand: Bestand, id: string): Promise<string | null> {
  const e = bestand.dokumente.get(id)
  const pfad = typeof e?.felder.datei === 'string' ? e.felder.datei : null
  if (!pfad || !/\.(png|jpe?g|webp|gif|heic)$/i.test(pfad)) return Promise.resolve(null)
  let p = urls.get(pfad)
  if (!p) {
    p = speicher.binaer(pfad).then((b) => {
      // Noch nicht da (das andere Gerät lädt das Foto erst nach dem Text hoch): später neu fragen
      if (!b) urls.delete(pfad)
      return b ? URL.createObjectURL(b) : null
    })
    urls.set(pfad, p)
  }
  return p
}

const toene = new Map<string, Promise<string | null>>()

/** Objekt-URL für eine Aufnahme (Sprachnotiz), erst beim Abspielen geladen und danach offline da */
export function tonUrl(speicher: Speicher, bestand: Bestand, id: string): Promise<string | null> {
  const pfad = bestand.dokumente.get(id)?.felder.datei
  if (typeof pfad !== 'string') return Promise.resolve(null)
  let p = toene.get(pfad)
  if (!p) {
    p = speicher.binaer(pfad).then((b) => {
      if (!b) toene.delete(pfad)
      return b ? URL.createObjectURL(b) : null
    })
    toene.set(pfad, p)
  }
  return p
}

/** Zeichnung auf einem Foto: eigene Ebene wie auf Plänen, das Foto ist eine Seite (Vertrag 5.4) */
export const bildTinte = (app: App, id: string) => pfade.tinte(app, id, 1)

/** Ändert sich, sobald auf dem Bild gezeichnet oder radiert wurde (für die Vorschau im Editor) */
export function tintenStand(speicher: Speicher, app: App, id: string): string {
  const t = speicher.text(bildTinte(app, id))
  return t ? `${t.length}:${t.slice(-48)}` : ''
}

const gemalt = new Map<string, Promise<string | null>>()
const zuletzt = new Map<string, string>()

/** Vorschau eines Fotos samt Zeichnung, als ein Bild zusammengesetzt. Das Original bleibt, wie es ist. */
export function bildMitTinte(speicher: Speicher, bestand: Bestand, app: App, id: string, breite = 480): Promise<string | null> {
  const svg = speicher.text(bildTinte(app, id)) ?? ''
  const striche = liesTinte(svg)
  if (!striche.length) return bildUrl(speicher, bestand, id)
  const schluessel = `${id}|${breite}|${tintenStand(speicher, app, id)}`
  let p = gemalt.get(schluessel)
  if (!p) {
    p = bildUrl(speicher, bestand, id).then(async (url) => {
      if (!url) {
        gemalt.delete(schluessel)
        return null
      }
      const img = new Image()
      img.src = url
      await img.decode()
      const b = Math.min(breite, img.naturalWidth)
      const h = Math.round((b * img.naturalHeight) / img.naturalWidth)
      const c = document.createElement('canvas')
      c.width = b
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, b, h)
      ctx.scale(b / SEITE_BREITE, b / SEITE_BREITE)
      for (const s of striche) {
        ctx.fillStyle = FARBEN[s.farbe]
        ctx.fill(new Path2D(s.d))
      }
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85))
      return blob ? URL.createObjectURL(blob) : null
    })
    gemalt.set(schluessel, p)
    // Nur die neueste Fassung pro Bild behalten, ältere Vorschauen freigeben
    const alt = zuletzt.get(`${id}|${breite}`)
    zuletzt.set(`${id}|${breite}`, schluessel)
    if (alt && alt !== schluessel) {
      const weg = gemalt.get(alt)
      gemalt.delete(alt)
      void weg?.then((u) => u && setTimeout(() => URL.revokeObjectURL(u), 5000))
    }
  }
  return p
}
