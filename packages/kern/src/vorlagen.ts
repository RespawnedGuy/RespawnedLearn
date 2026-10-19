// Was das „/“-Menü einfügt. Feste Einträge plus eigene Vorlagen, die Nils in den Einstellungen anlegt
// (Dateien `arbeit/vorlagen/*.md`, `typ: vorlage`). Alles landet als normales Markdown im Journal.
import { plusTage, tag } from './datum'

export interface Einfuegen {
  id: string
  titel: string
  /** text: wird eingesetzt; aktion: die App macht etwas (Plan öffnen, Foto aufnehmen, Status setzen) */
  art: 'text' | 'aktion'
  text?: string
  hinweis?: string
}

export const FEST: Einfuegen[] = [
  { id: 'aufgabe', titel: 'Aufgabe', art: 'text', text: '- [ ] ', hinweis: 'Etwas, das zu tun ist' },
  {
    id: 'blockade',
    titel: 'Blockade',
    art: 'text',
    text: '> [!blockade] {{cursor}}\n> Wenn: \n> Dann: \n> Prüfen: {{heute+7}}',
    hinweis: 'Woran es hängt, mit Wenn-dann und Prüftermin'
  },
  { id: 'checkliste', titel: 'Checkliste', art: 'text', text: '- [ ] {{cursor}}\n- [ ] \n- [ ] ', hinweis: 'Mehrere Punkte' },
  { id: 'plan', titel: 'Stelle im Plan', art: 'aktion', hinweis: 'Markierung auf einem Plan des Projekts' },
  { id: 'foto', titel: 'Foto', art: 'aktion', hinweis: 'Bild oder Screenshot einfügen' },
  { id: 'projekt', titel: 'Projekt', art: 'aktion', hinweis: 'Ab hier gehört alles zu einem Projekt' },
  { id: 'blockiert', titel: 'Status: blockiert', art: 'aktion', hinweis: 'An der Überschrift' },
  { id: 'erledigt', titel: 'Status: erledigt', art: 'aktion', hinweis: 'An der Überschrift' }
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
