// Wo was im Datenordner liegt (Vertrag Abschnitt 2). Dateinamen sind frei, Links laufen über IDs.

export type App = 'arbeit' | 'lernen'

const drei = (n: number) => String(n).padStart(3, '0')

export const pfade = {
  journal: (datum: string) => `arbeit/journal/${datum.slice(0, 4)}/${datum}.md`,
  projekt: (kuerzel: string) => `arbeit/projekte/${kuerzel}.md`,
  vorlage: (id: string) => `arbeit/vorlagen/${id}.md`,
  anhang: (id: string) => `gemeinsam/anhaenge/${id}.md`,
  original: (datum: string, id: string, name: string) =>
    `anhaenge/${datum.slice(0, 4)}/${datum.slice(5, 7)}/${id.slice(-6).toLowerCase()}-${dateiname(name)}`,
  quelle: (id: string) => `gemeinsam/quellen/${id}.md`,
  marken: (app: App, anhangId: string) => `${app}/markierungen/${anhangId}.md`,
  tinte: (app: App, anhangId: string, seite: number) => `${app}/tinte/${anhangId}/S${drei(seite)}.svg`,
  blatt: (anhangId: string, seite: number) => `lernen/blaetter/${anhangId}/S${drei(seite)}.svg`,
  karte: (id: string) => `lernen/karten/${id}.md`,
  reviews: (monat: string, geraet: string) => `reviews/${monat}.${geraet}.jsonl`
}

/** Sicherer Dateiname: keine Pfadteile, keine Steuerzeichen */
export function dateiname(name: string): string {
  const s = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return s.replace(/^\.+/, '') || 'datei'
}

/** Textdateien werden vollständig synchronisiert, Binärdateien erst beim Öffnen geladen */
export function istText(pfad: string): boolean {
  return /\.(md|svg|json|jsonl|txt)$/i.test(pfad)
}
