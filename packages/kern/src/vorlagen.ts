// Was das „/“-Menü einfügt. Feste Einträge plus eigene Vorlagen, die Nils in den Einstellungen anlegt
// (Dateien `arbeit/vorlagen/*.md`, `typ: vorlage`). Alles landet als normales Markdown im Journal.
import { plusTage, tag } from './datum'

export interface Einfuegen {
  id: string
  titel: string
  /** text: wird eingesetzt; aktion: die App macht etwas (Plan öffnen, Foto aufnehmen, Sprachaufnahme) */
  art: 'text' | 'aktion'
  text?: string
  hinweis?: string
}

export const FEST: Einfuegen[] = [
  { id: 'aufgabe', titel: 'Aufgabe', art: 'text', text: '- [ ] ', hinweis: 'Eigene Aufgabe, im Satz verlinkt' },
  { id: 'plan', titel: 'Stelle im Plan', art: 'aktion', hinweis: 'Markierung auf einem Plan des Projekts' },
  { id: 'aufnahme', titel: 'Sprachaufnahme', art: 'aktion', hinweis: 'Wird abgeschrieben und landet im Journal' },
  { id: 'kamera', titel: 'Kamera', art: 'aktion', hinweis: 'Foto aufnehmen' },
  { id: 'foto', titel: 'Foto', art: 'aktion', hinweis: 'Bild aus der Galerie oder Screenshot' },
  { id: 'projekt', titel: 'Projekt', art: 'aktion', hinweis: 'Ab hier gehört alles zu einem Projekt' }
]

/**
 * Setzt Platzhalter ein: {{datum}}, {{heute+N}}, {{cursor}}.
 * Gibt den Text und die Cursorposition darin zurück (Ende, wenn kein {{cursor}} vorkommt).
 */
export function fuelle(vorlage: string, heute = tag()): { text: string; cursor: number } {
  let text = vorlage
    .replace(/\{\{datum\}\}/g, heute)
    .replace(/\{\{heute([+-]\d+)\}\}/g, (_, n: string) => plusTage(heute, Number(n)))
  const c = text.indexOf('{{cursor}}')
  if (c >= 0) text = text.slice(0, c) + text.slice(c + '{{cursor}}'.length)
  return { text, cursor: c >= 0 ? c : text.length }
}
