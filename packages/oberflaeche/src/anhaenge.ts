// Originaldateien (PDF, Foto) ablegen: Original nach anhaenge/JJJJ/MM/, Sidecar nach gemeinsam/anhaenge/ (Vertrag 5.1).
// Andere Dateien verweisen nur auf die ID des Sidecars, nie auf den Pfad.
import { neuesDokument, pfade, tag, ulid, zeitstempel, type Bestand, type Wert } from '@rvx/kern'
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
    p = speicher.binaer(pfad).then((b) => (b ? URL.createObjectURL(b) : null))
    urls.set(pfad, p)
  }
  return p
}
