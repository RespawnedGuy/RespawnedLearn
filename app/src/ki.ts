// KI-Hilfen beim Anlegen von Lernkarten. Läuft über den Server (Claude über das Abo); ohne Netz oder ohne
// eingerichtete KI kommt einfach nichts zurück, die Karte entsteht trotzdem.
import type { Bereich, Eintrag } from '@rl/kern'
import { ausschnitt, stellenText, type Speicher } from '@rl/oberflaeche'
import type { ChatZeile } from './kiBlock'

async function frageServer<T>(aktion: string, daten: unknown, signal?: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(`/api/ki/${aktion}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten), signal })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

/** Frage zur markierten Stelle; ohne Text im PDF (Scan, Formel als Bild) geht ein Bild der Stelle mit */
export async function frageVorschlagen(speicher: Speicher, quelle: Eintrag, seite: number, bereich: Bereich, signal?: AbortSignal): Promise<string | null> {
  const datei = String(quelle.felder.datei ?? '')
  const stelle = await stellenText(speicher, datei, seite, bereich).catch(() => '')
  const bild = stelle.length < 40 ? await ausschnitt(speicher, datei, seite, bereich, 900).catch(() => null) : null
  if (!stelle && !bild) return null
  const r = await frageServer<{ frage: string }>('vorschlag', { buch: quelle.titel, seite, stelle, bild }, signal)
  return r?.frage?.trim() || null
}

/** Frage zu einer Stelle der eigenen Mitschrift (die Stelle ist die Antwort) */
export async function frageZurMitschrift(titel: string, abschnitt: string[], stelle: string, signal?: AbortSignal): Promise<string | null> {
  const r = await frageServer<{ frage: string }>('vorschlag', { art: 'mitschrift', buch: titel, abschnitt: abschnitt.join(' › '), stelle }, signal)
  return r?.frage?.trim() || null
}

/** Nur Rechtschreibung und Tippfehler; null, wenn nichts zu ändern ist oder die KI nicht erreichbar ist */
export async function korrigiere(text: string): Promise<string | null> {
  const r = await frageServer<{ text: string }>('korrektur', { text })
  const neu = r?.text?.trim()
  return neu && neu !== text.trim() ? neu : null
}

export interface Rueckmeldung {
  urteil: 'richtig' | 'teilweise' | 'falsch' | 'leer'
  gelesen: string
  richtig: string[]
  fehlt: string[]
  fehler: string[]
  tipp: string
}

/** KI-Rückmeldung auf die eigene Antwort (Handschrift als Bild und/oder getippt); null ohne KI oder Netz */
export function rueckmeldung(daten: { art: string; frage: string; muster: string; antwort: string; bild: string | null }, signal?: AbortSignal): Promise<Rueckmeldung | null> {
  return frageServer<Rueckmeldung>('rueckmeldung', daten, signal)
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
 * damit das Chatfenster sagen kann, woran es liegt (kein Netz, KI auf dem Server nicht eingerichtet).
 */
export async function erklaere(s: StelleZumErklaeren, verlauf: ChatZeile[], signal?: AbortSignal): Promise<{ antwort: string; begriff: string } | { fehler: string }> {
  try {
    const r = await fetch('/api/ki/erklaeren', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...s, verlauf }), signal })
    const j = (await r.json().catch(() => ({}))) as { antwort?: string; begriff?: string; fehler?: string }
    if (!r.ok || !j.antwort) return { fehler: j.fehler || 'Die KI hat gerade nicht geantwortet. Später noch einmal versuchen.' }
    return { antwort: j.antwort, begriff: j.begriff ?? '' }
  } catch {
    if (signal?.aborted) return { fehler: '' }
    return { fehler: 'Keine Verbindung zum Server. Erklären geht nur online.' }
  }
}
