// KI-Hilfen beim Lernen: Frage vorschlagen, Rechtschreibung, Rückmeldung, Erklären. Gefragt wird die KI, die in den
// Einstellungen gewählt ist (eigener Schlüssel, siehe kianbieter/). Ohne KI oder Netz kommt bei den stillen Hilfen
// einfach nichts zurück, die Karte entsteht trotzdem; wo jemand wartet, sagt die App, woran es liegt.
import { erklaerAuftrag, korrekturAnnehmen, korrekturAuftrag, rueckmeldungAuftrag, SCHEMAS, vorschlagAuftrag, type Bereich, type Eintrag } from '@rl/kern'
import { ausschnitt, stellenText, type Speicher } from '@rl/oberflaeche'
import type { ChatZeile } from './kiBlock'
import { bildAus, kiFrage } from './kianbieter/frage'
import { KiFehler } from './kianbieter/typen'

/** Fehler als Satz für die Oberfläche; abgebrochen = leer */
export const fehlerText = (e: unknown) => (e instanceof KiFehler ? e.message : 'Die KI hat gerade nicht geantwortet. Später noch einmal versuchen.')

/** Frage zur markierten Stelle; ohne Text im PDF (Scan, Formel als Bild) geht ein Bild der Stelle mit */
export async function frageVorschlagen(speicher: Speicher, quelle: Eintrag, seite: number, bereich: Bereich, signal?: AbortSignal): Promise<string | null> {
  const datei = String(quelle.felder.datei ?? '')
  const stelle = await stellenText(speicher, datei, seite, bereich).catch(() => '')
  const bild = stelle.length < 40 ? bildAus(await ausschnitt(speicher, datei, seite, bereich, 900).catch(() => null)) : null
  if (!stelle && !bild) return null
  const r = await kiFrage<{ frage: string }>(speicher, 'vorschlag', {
    text: vorschlagAuftrag({ buch: quelle.titel, seite, stelle }),
    bilder: bild ? [bild] : [],
    schema: SCHEMAS.frage,
    name: 'frage',
    aufwand: 'niedrig',
    signal
  }).catch(() => null)
  return r?.frage?.trim() || null
}

/** Frage zu einer Stelle der eigenen Mitschrift (die Stelle ist die Antwort) */
export async function frageZurMitschrift(speicher: Speicher, titel: string, abschnitt: string[], stelle: string, signal?: AbortSignal): Promise<string | null> {
  const r = await kiFrage<{ frage: string }>(speicher, 'vorschlag', {
    text: vorschlagAuftrag({ art: 'mitschrift', buch: titel, abschnitt: abschnitt.join(' › '), stelle }),
    schema: SCHEMAS.frage,
    name: 'frage',
    aufwand: 'niedrig',
    signal
  }).catch(() => null)
  return r?.frage?.trim() || null
}

/** Nur Rechtschreibung und Tippfehler; null, wenn nichts zu ändern ist oder die KI nicht erreichbar ist */
export async function korrigiere(speicher: Speicher, text: string): Promise<string | null> {
  if (!text.trim()) return null
  const r = await kiFrage<{ text: string }>(speicher, 'korrektur', { text: korrekturAuftrag(text), schema: SCHEMAS.text, name: 'text', aufwand: 'niedrig' }).catch(() => null)
  return r ? korrekturAnnehmen(text, r.text) : null
}

export interface Rueckmeldung {
  urteil: 'richtig' | 'teilweise' | 'falsch' | 'leer'
  gelesen: string
  richtig: string[]
  fehlt: string[]
  fehler: string[]
  tipp: string
}

/** KI-Rückmeldung auf die eigene Antwort (Handschrift als Bild und/oder getippt); sonst ein Satz, woran es lag */
export async function rueckmeldung(
  speicher: Speicher,
  daten: { art: string; frage: string; muster: string; antwort: string; bild: string | null },
  signal?: AbortSignal
): Promise<Rueckmeldung | { problem: string }> {
  const bild = bildAus(daten.bild)
  if (!bild && !daten.antwort.trim()) return { urteil: 'leer', gelesen: '', richtig: [], fehlt: [], fehler: [], tipp: 'Schreib erst deine Antwort auf.' }
  try {
    const r = await kiFrage<Rueckmeldung>(speicher, 'rueckmeldung', {
      text: rueckmeldungAuftrag({ ...daten, mitBild: !!bild }),
      bilder: bild ? [bild] : [],
      schema: SCHEMAS.urteil,
      name: 'rueckmeldung',
      signal
    })
    const sauber = (l: string[]) => l.map((x) => String(x).trim()).filter(Boolean)
    return { urteil: r.urteil, gelesen: r.gelesen.trim(), richtig: sauber(r.richtig), fehlt: sauber(r.fehlt), fehler: sauber(r.fehler), tipp: r.tipp.trim() }
  } catch (e) {
    return { problem: signal?.aborted ? '' : fehlerText(e) }
  }
}

/** Handschrift der Schreibfläche als PNG (weißer Grund); null, wenn nichts geschrieben ist */
export async function schriftBild(huelle: HTMLElement | null): Promise<string | null> {
  const svg = huelle?.querySelector('svg')
  if (!svg || !svg.querySelector('path')) return null
  const [, , b, h] = (svg.getAttribute('viewBox') ?? '0 0 1000 320').split(' ').map(Number)
  const kopie = svg.cloneNode(true) as SVGSVGElement
  kopie.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  kopie.setAttribute('width', String(b))
  kopie.setAttribute('height', String(h))
  kopie.removeAttribute('style')
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(kopie)], { type: 'image/svg+xml' }))
  try {
    const bild = new Image()
    bild.src = url
    await bild.decode()
    const c = document.createElement('canvas')
    c.width = b
    c.height = h
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, b, h)
    g.drawImage(bild, 0, 0, b, h)
    return c.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Was zur Erklärung einer Stelle an die KI geht: der markierte Text, der Text der ganzen Seite, bei Scans ein Bild */
export interface StelleZumErklaeren {
  buch: string
  seite: number
  stelle: string
  kontext: string
  bild: string | null
}

export async function stelleLesen(speicher: Speicher, quelle: Eintrag, seite: number, bereich: Bereich): Promise<StelleZumErklaeren> {
  const datei = String(quelle.felder.datei ?? '')
  const stelle = await stellenText(speicher, datei, seite, bereich).catch(() => '')
  const kontext = await stellenText(speicher, datei, seite, { x: 0, y: 0, b: 1, h: 1 }).catch(() => '')
  const bild = stelle.length < 40 ? await ausschnitt(speicher, datei, seite, bereich, 900).catch(() => null) : null
  return { buch: quelle.titel, seite, stelle, kontext, bild }
}

/**
 * Erklärung der Stelle oder, mit Verlauf, Antwort auf die letzte Rückfrage. Statt null kommt ein `fehler` zurück,
 * damit das Chatfenster sagen kann, woran es liegt (kein Netz, keine KI eingerichtet, Schlüssel abgelehnt).
 */
export async function erklaere(speicher: Speicher, s: StelleZumErklaeren, verlauf: ChatZeile[], signal?: AbortSignal): Promise<{ antwort: string; begriff: string } | { fehler: string }> {
  const bild = bildAus(s.bild)
  if (!s.stelle.trim() && !bild) return { antwort: 'In der Markierung ist kein Text zu finden. Markiere die Stelle etwas großzügiger.', begriff: '' }
  try {
    const r = await kiFrage<{ antwort: string; begriff: string }>(speicher, 'erklaeren', {
      text: erklaerAuftrag({ ...s, verlauf }),
      bilder: bild ? [bild] : [],
      schema: SCHEMAS.erklaerung,
      name: 'erklaerung',
      aufwand: 'niedrig',
      signal
    })
    if (!r.antwort.trim()) return { fehler: 'Die KI hat eine leere Antwort geschickt. Noch einmal versuchen.' }
    return { antwort: r.antwort.trim(), begriff: r.begriff.trim().slice(0, 80) }
  } catch (e) {
    return { fehler: signal?.aborted ? '' : fehlerText(e) }
  }
}
