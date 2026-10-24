// KI-Hilfen beim Anlegen von Lernkarten. Läuft über den Server (Claude über das Abo); ohne Netz oder ohne
// eingerichtete KI kommt einfach nichts zurück, die Karte entsteht trotzdem.
import type { Bereich, Eintrag } from '@rvx/kern'
import { ausschnitt, stellenText, type Speicher } from '@rvx/oberflaeche'

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
