// Name und Beschreibung eines Fotos (Vertrag 5.1, `anhang`). Beides vergibt der Nutzer; ohne Namen bleibt es bei „Foto“.
import type { Eintrag } from './bestand'
import { setzeFeld } from './frontmatter'

export interface FotoInfo {
  name: string
  beschreibung: string
}

/** Name und Beschreibung eines Anhangs, null wenn beides fehlt */
export function fotoInfo(e: Eintrag | undefined): FotoInfo | null {
  if (e?.typ !== 'anhang') return null
  const name = typeof e.felder.name === 'string' ? e.felder.name.trim() : ''
  const beschreibung = typeof e.felder.beschreibung === 'string' ? e.felder.beschreibung.trim() : ''
  return name || beschreibung ? { name, beschreibung } : null
}

/** Setzt Name und Beschreibung im Sidecar; Leeres fällt als Feld weg, alles andere bleibt byte-genau */
export function setzeFotoInfo(text: string, info: FotoInfo): string {
  const name = info.name.replace(/\s+/g, ' ').trim()
  // Zeilenumbrüche bleiben, nur Leerzeilen am Rand und Leerzeichen am Zeilenende fallen weg
  const beschreibung = info.beschreibung.replace(/[ \t]+$/gm, '').trim()
  return setzeFeld(setzeFeld(text, 'name', name || undefined), 'beschreibung', beschreibung || undefined)
}
