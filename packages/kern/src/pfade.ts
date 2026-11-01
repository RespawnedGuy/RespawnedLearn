// Wo was im Datenordner liegt (Vertrag Abschnitt 2). Dateinamen sind frei, Links laufen über IDs.

export type App = 'arbeit' | 'lernen'

const drei = (n: number) => String(n).padStart(3, '0')

export const pfade = {
  journal: (datum: string) => `arbeit/journal/${datum.slice(0, 4)}/${datum}.md`,
  projekt: (kuerzel: string) => `arbeit/projekte/${kuerzel}.md`,
  vorlage: (id: string) => `arbeit/vorlagen/${id}.md`,
  aufgabe: (id: string) => `arbeit/aufgaben/${id}.md`,
  /** Termin aus einem Kalender, angelegt erst mit „Ins Journal“ (Bereich Organisation) */
  termin: (id: string) => `arbeit/termine/${id}.md`,
  /** Abbild eines Kalenders (schreibt der Server aus dem iCal-Link) */
  kalender: (id: string) => `gemeinsam/kalender/${id}.json`,
  bericht: (id: string) => `arbeit/berichte/${id}.md`,
  /** Eingang (`erfassung`): Sprachnotizen und anderes, was die Pipeline hereinholt */
  erfassung: (id: string) => `arbeit/eingang/${id}.md`,
  anhang: (id: string) => `gemeinsam/anhaenge/${id}.md`,
  original: (datum: string, id: string, name: string) =>
    `anhaenge/${datum.slice(0, 4)}/${datum.slice(5, 7)}/${id.slice(-6).toLowerCase()}-${dateiname(name)}`,
  quelle: (id: string) => `gemeinsam/quellen/${id}.md`,
  entitaet: (id: string) => `gemeinsam/entitaeten/${id}.md`,
  /** Abbild einer Kontaktquelle (Outlook, Google …) als vCard */
  kontakte: (quelle: string) => `gemeinsam/kontakte/${quelle}.vcf`,
  marken: (app: App, anhangId: string) => `${app}/markierungen/${anhangId}.md`,
  tinte: (app: App, anhangId: string, seite: number) => `${app}/tinte/${anhangId}/S${drei(seite)}.svg`,
  /** Tinte eines Zeichenblatts zur Skriptseite; das erste Blatt („1“) ohne Zusatz wie früher */
  blatt: (anhangId: string, seite: number, blatt = '1') => `lernen/blaetter/${anhangId}/S${drei(seite)}${blatt === '1' ? '' : `-${blatt}`}.svg`,
  /** Bilder (Fotos, PDF-Ausschnitte) auf den Blättern einer Skriptseite */
  blattBilder: (anhangId: string, seite: number) => `lernen/blaetter/${anhangId}/S${drei(seite)}-bilder.json`,
  /** Welche Ansichten (Skript, Blätter) im Übungsplatz nebeneinander stehen */
  blattAnordnung: (anhangId: string) => `lernen/blaetter/${anhangId}/anordnung.json`,
  karte: (id: string) => `lernen/karten/${id}.md`,
  modul: (id: string) => `lernen/module/${id}.md`,
  /** Lesestand eines Geräts: wo in welchem PDF zuletzt gelesen wurde */
  stand: (geraet: string) => `lernen/stand/${geraet}.json`,
  /** Inhaltsverzeichnis eines PDFs (aus dem PDF gelesen oder selbst gesetzt) */
  inhalt: (anhangId: string) => `lernen/inhalt/${anhangId}.json`,
  /** KI-Fragen zu einem Kapitel (schreibt die Pipeline) */
  fragen: (anhangId: string, seite: number) => `lernen/fragen/${anhangId}/S${drei(seite)}.json`,
  /** Welche Kapitelfragen ein Gerät erledigt hat */
  fragenStand: (geraet: string) => `lernen/fragen-stand/${geraet}.json`,
  /** Vorfragen eines Tages zu den nächsten Seiten (schreibt der Server auf Knopfdruck) */
  vorfragen: (datum: string) => `lernen/vorfragen/${datum}.json`,
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
  return /\.(md|svg|json|jsonl|txt|vcf)$/i.test(pfad)
}
