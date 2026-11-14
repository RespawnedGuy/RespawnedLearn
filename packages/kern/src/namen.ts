// Skripte und Notizbücher umbenennen (Vertrag 5.1 `anhang`, 5.3 `notizbuch`). Es ändert sich nur der angezeigte Name:
// Datei, ID und alle Verweise bleiben, weil Verweise im Datenordner nur über IDs laufen (Grundlagen 2).
// Beim Skript steht der Name im Feld `name` des Sidecars, `titel` bleibt der Dateiname.
import type { Eintrag } from './bestand'
import { setzeFeld } from './frontmatter'
import type { Modul } from './module'

/** Ein Name ohne Zeilenumbrüche und doppelte Leerzeichen */
export const saubererName = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Name, den der Nutzer einem Anhang gegeben hat, sonst leer */
export function eigenerName(felder: Record<string, unknown>): string {
  return typeof felder.name === 'string' ? saubererName(felder.name) : ''
}

/** Der Dateiname eines Anhangs (Feld `titel`), unabhängig vom eigenen Namen */
export function dateiTitel(e: Eintrag): string {
  return typeof e.felder.titel === 'string' && e.felder.titel.trim() ? e.felder.titel.trim() : e.titel
}

/** Setzt den eigenen Namen im Sidecar; leer nimmt das Feld heraus, dann gilt wieder der Dateiname. Der Rest bleibt byte-genau. */
export function benenneAnhang(text: string, name: string): string {
  return setzeFeld(text, 'name', saubererName(name) || undefined)
}

/** Setzt den Titel eines Notizbuchs; ein leerer Titel ändert nichts, weil `titel` Pflicht ist */
export function benenneBuch(text: string, titel: string, jetzt: string): string {
  const t = saubererName(titel)
  return t ? setzeFeld(setzeFeld(text, 'titel', t), 'geaendert', jetzt) : text
}

/**
 * Module, die beim Umbenennen eines PDFs denselben Namen bekommen: ein Buch (Modul mit genau diesem einen PDF),
 * das bisher so hieß wie das PDF. So zeigen Kachel und Übungsplatz nie verschiedene Namen. Module mit mehreren PDFs
 * oder einem eigenen Namen bleiben, wie sie sind.
 */
export function mitzubenennendeModule(module: Modul[], anhangId: string, alterName: string): Modul[] {
  return module.filter((m) => m.quellen.length === 1 && m.quellen[0] === anhangId && m.titel === alterName)
}

/**
 * Anzeige eines Verweises auf eine Skriptseite. Karten aus Vorfragen tragen den Namen des Skripts im Text
 * (`[[anhang#seite=12|Name, S. 12]]`); nach dem Umbenennen zeigt die App dort den aktuellen Namen, ohne die Karte
 * umzuschreiben. Andere Texte bleiben, wie sie dastehen.
 */
export function stellenAnzeige(anzeige: string | null, seite: string | undefined, aktuell: string | undefined): string | null {
  if (anzeige === null || !aktuell || !seite) return anzeige
  const m = /^.+, S\. (\d+)$/.exec(anzeige)
  return m && m[1] === seite ? `${aktuell}, S. ${seite}` : anzeige
}
