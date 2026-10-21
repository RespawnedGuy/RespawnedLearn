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

/** Nur Rechtschreibung und Tippfehler; null, wenn nichts zu ändern ist oder die KI nicht erreichbar ist */
export async function korrigiere(text: string): Promise<string | null> {
  const r = await frageServer<{ text: string }>('korrektur', { text })
  const neu = r?.text?.trim()
  return neu && neu !== text.trim() ? neu : null
}
