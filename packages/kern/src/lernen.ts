// Lernkarten und Wiederholungsprotokoll der Lern-App.
// Abrufblöcke im Text: `?? Frage` und `:: Antwort` (Vertrag 4). Das Protokoll ist pro Gerät und Monat
// eine JSONL-Datei, an die nur angehängt wird (Vertrag 8), damit offline nie ein Konflikt entsteht.
import type { Bestand, Eintrag, JournalEintrag } from './bestand'
import { linkZiel, neuesDokument, type Wert } from './frontmatter'

export interface Abruf {
  frage: string
  antwort: string
}

/** Liest `?? Frage` / `:: Antwort` aus einem Rumpf. Die Antwort reicht bis zur nächsten Frage. */
export function liesAbrufe(rumpf: string): Abruf[] {
  const out: Abruf[] = []
  let akt: Abruf | null = null
  let inAntwort = false
  for (const z of rumpf.split('\n')) {
    if (z.startsWith('?? ')) {
      if (akt) out.push(akt)
      akt = { frage: z.slice(3).trim(), antwort: '' }
      inAntwort = false
    } else if (akt && z.startsWith(':: ')) {
      akt.antwort = z.slice(3).trim()
      inAntwort = true
    } else if (akt && inAntwort && z.trim() !== '') {
      akt.antwort += '\n' + z
    } else if (akt && inAntwort && z.trim() === '') {
      inAntwort = false
    }
  }
  if (akt) out.push(akt)
  return out
}

export type Note = 'nochmal' | 'schwer' | 'gut' | 'leicht'

export interface Wiederholung {
  karte: string
  am: string
  note: Note
  /** Einschätzung vor dem Aufdecken (Metakognition): unsicher | eher_sicher | sicher */
  sicher?: string
}

export function liesProtokoll(text: string): Wiederholung[] {
  const out: Wiederholung[] = []
  for (const z of text.split('\n')) {
    if (!z.trim()) continue
    try {
      const w = JSON.parse(z) as Wiederholung
      if (w.karte && w.am && w.note) out.push(w)
    } catch {
      // kaputte Zeile überspringen, nie löschen
    }
  }
  return out
}

export function protokollZeile(w: Wiederholung): string {
  return JSON.stringify(w) + '\n'
}

// ---------- Wissensnotizen aus dem Journal (einmalig aus dem Import, Vertrag 5.3) ----------

/** Titel einer Notiz: die Überschrift des Eintrags, sonst seine erste Textzeile ohne Markdown */
export function notizTitel(e: JournalEintrag): string {
  if (e.teil.zusatz.trim()) return e.teil.zusatz.trim()
  const zeile = e.rumpf.split('\n').find((z) => z.trim()) ?? ''
  const t = zeile
    .replace(/!?\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/!?\[\[[^\]]*\]\]/g, '')
    .replace(/^\s*(#+|[-*>]|\d+\.)\s*/, '')
    .replace(/[*_`]/g, '')
    .trim()
  return t.length > 80 ? `${t.slice(0, 79).trimEnd()}…` : t || `Notiz vom ${e.datum}`
}

/** Wohin eine Notiz gehören kann: Themen und Module */
export function notizZiele(b: Bestand): Eintrag[] {
  return b.nachTyp('thema', 'modul').sort((x, y) => x.titel.localeCompare(y.titel, 'de'))
}

/** Notiz ohne Thema, Modul oder Quelle: wartet in der Lern-App darauf, eingeordnet zu werden */
export function notizOhneZiel(e: Eintrag): boolean {
  return e.typ === 'notiz' && !linkZiel(e.felder.thema) && !linkZiel(e.felder.quelle)
}

/** Ein Journaleintrag als `notiz` der Lern-App. Text unverändert, erstellt = Tag des Eintrags. */
export function wissensNotiz(e: JournalEintrag, p: { id: string; jetzt: string; thema?: string | null }): string {
  const kopf: [string, Wert][] = [
    ['id', p.id],
    ['typ', 'notiz'],
    ['erstellt', `${e.datum}T00:00:00${p.jetzt.slice(19)}`],
    ['geaendert', p.jetzt],
    ['titel', notizTitel(e)]
  ]
  if (p.thema) kopf.push(['thema', `[[${p.thema}]]`])
  kopf.push(['aus', `Journal ${e.datum}`])
  return neuesDokument(kopf, e.rumpf.replace(/^\n+/, '').replace(/\s*$/, '\n'))
}
