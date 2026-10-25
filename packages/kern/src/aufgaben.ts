// Aufgaben als eigene Objekte (Vertrag 5.2 `aufgabe`): eine Datei pro Aufgabe in `arbeit/aufgaben/`.
// Im Journal steht nur ein Link mitten im Satz: „Wir müssen [[ID|am Dienstag Müll rausbringen]], wenn …“.
// Der Zustand (und damit die Linkfarbe) wird aus den Feldern abgeleitet und nirgends doppelt gespeichert.
import { tag } from './datum'
import { linkZiel, neuesDokument, setzeFeld, type Wert } from './frontmatter'
import { findeLinks } from './links'

export const AUFGABEN_STATUS = ['offen', 'naechste', 'wartet', 'blockiert', 'erledigt', 'verworfen'] as const
export type AufgabenStatus = (typeof AUFGABEN_STATUS)[number]

/** Was die Linkfarbe zeigt. `faellig` ist immer abgeleitet, `blockiert` gesetzt (`status`) oder abgeleitet (`blockiert_durch`). */
export type Zustand = 'offen' | 'wartet' | 'blockiert' | 'faellig' | 'erledigt' | 'verworfen'

export function istAbgeschlossen(status: unknown): boolean {
  return status === 'erledigt' || status === 'verworfen'
}

/** IDs aus `blockiert_durch: ["[[A]]", "[[B]]"]` */
export function blockiertDurch(f: Record<string, Wert>): string[] {
  const w = f.blockiert_durch
  const liste = Array.isArray(w) ? w : w ? [w] : []
  return liste.map((x) => linkZiel(x)).filter((x): x is string => !!x)
}

/**
 * Zustand einer Aufgabe. `status` der anderen Aufgaben kommt über `statusVon`, damit das hier ohne Index testbar bleibt.
 * Reihenfolge: abgeschlossen vor blockiert vor wartet vor überfällig vor offen.
 */
export function zustandAus(f: Record<string, Wert>, statusVon: (id: string) => unknown, heute = tag()): Zustand {
  const status = String(f.status ?? 'offen')
  if (status === 'erledigt') return 'erledigt'
  if (status === 'verworfen') return 'verworfen'
  if (status === 'blockiert') return 'blockiert'
  if (blockiertDurch(f).some((id) => {
    const s = statusVon(id)
    return s !== undefined && !istAbgeschlossen(s)
  })) return 'blockiert'
  if (status === 'wartet') return 'wartet'
  if (typeof f.faellig === 'string' && f.faellig <= heute) return 'faellig'
  return 'offen'
}

/** Neue Aufgabe als Datei. Der Rumpf ist die Notiz. */
export function aufgabeDokument(p: { id: string; titel: string; jetzt: string; projektId?: string | null; notiz?: string; blockiertDurch?: string[] }): string {
  const durch = p.blockiertDurch ?? []
  const kopf: [string, Wert][] = [
    ['id', p.id],
    ['typ', 'aufgabe'],
    ['erstellt', p.jetzt],
    ['geaendert', p.jetzt],
    ['titel', p.titel],
    ['status', durch.length ? 'blockiert' : 'offen']
  ]
  if (p.projektId) kopf.push(['projekt', `[[${p.projektId}]]`])
  if (durch.length) kopf.push(['blockiert_durch', durch.map((i) => `[[${i}]]`)])
  return neuesDokument(kopf, p.notiz ? p.notiz.replace(/\n*$/, '\n') : '')
}

/** Status setzen; `erledigt_am` folgt mit (gesetzt bei erledigt, sonst entfernt). */
export function setzeAufgabenStatus(text: string, status: AufgabenStatus, heute = tag()): string {
  const t = setzeFeld(text, 'status', status)
  return setzeFeld(t, 'erledigt_am', status === 'erledigt' ? heute : undefined)
}

/** Text, der als Anzeige in `[[ID|…]]` stehen darf */
export function linkText(titel: string): string {
  return titel.replace(/[\]|\n]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Schreibt alle Links (keine Einbettungen) auf `id` im Text um. `ersatz` bekommt den Anzeigetext
 * (oder null) und gibt den neuen Text für die ganze Fundstelle zurück.
 */
export function ersetzeLinksAuf(text: string, id: string, ersatz: (anzeige: string | null) => string): string {
  let out = ''
  let pos = 0
  for (const l of findeLinks(text)) {
    if (l.einbettung || l.ziel !== id) continue
    out += text.slice(pos, l.von) + ersatz(l.anzeige)
    pos = l.bis
  }
  return pos === 0 ? text : out + text.slice(pos)
}

/** Umbenennen: Links, die den alten Titel zeigen, zeigen danach den neuen. Eigene Anzeigetexte bleiben. */
export function benenneLinksUm(text: string, id: string, alt: string, neu: string): string {
  return ersetzeLinksAuf(text, id, (a) => (a === null || a === linkText(alt) ? `[[${id}|${linkText(neu)}]]` : `[[${id}|${a}]]`))
}

/** Löschen: aus dem Link wird wieder normaler Text, der Satz bleibt lesbar. */
export function loeseLinksAuf(text: string, id: string, titel: string): string {
  return ersetzeLinksAuf(text, id, (a) => a ?? linkText(titel))
}

/**
 * Fotos einer Aufgabe: Einbettungen in ihrer Notiz, deren Ziel ein Bild ist (`istBild` prüft die ID).
 * Sie gehören der Aufgabe, im Journal werden sie nur am Link gezeigt und nie dorthin kopiert.
 */
export function bilderIn(rumpf: string, istBild: (id: string) => boolean): string[] {
  const ids = findeLinks(rumpf)
    .filter((l) => l.einbettung && !l.anker && istBild(l.ziel))
    .map((l) => l.ziel)
  return [...new Set(ids)]
}

/** Hängt Fotos unten an die Notiz an (je eine Zeile `![[ID|Foto]]`) */
export function haengeBilderAn(rumpf: string, ids: string[], titel = 'Foto'): string {
  if (!ids.length) return rumpf
  const zeilen = ids.map((id) => `![[${id}|${titel}]]`).join('\n')
  const basis = rumpf.replace(/\n*$/, '')
  return basis ? `${basis}\n${zeilen}\n` : `${zeilen}\n`
}
