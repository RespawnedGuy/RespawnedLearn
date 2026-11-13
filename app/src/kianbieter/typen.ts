// Gemeinsame Begriffe der KI-Anbieter. Jeder Anbieter ist ein kleiner Adapter mit zwei Aufgaben: Modelle auflisten
// und eine Frage mit Antwortformat stellen. Ein späterer eigener Dienst (Abo) wird einfach ein weiterer Adapter.
import type { Schema } from '@rl/kern'

export type AnbieterId = 'anthropic' | 'openai' | 'gemini' | 'perplexity' | 'ollama'

/** Was ein Gerät pro Anbieter weiß; liegt im Konfigurationsordner der App, nie im Datenordner */
export interface AnbieterZugang {
  schluessel?: string
  /** nur Ollama: Adresse des Rechners, z. B. http://192.168.1.20:11434 */
  adresse?: string
  modell?: string
}

export interface Bild {
  mime: 'image/png' | 'image/jpeg'
  /** base64 ohne „data:“-Vorspann */
  daten: string
}

export interface Anfrage {
  system: string
  text: string
  bilder: Bild[]
  schema: Schema
  /** Name des Formats (manche Anbieter verlangen einen) */
  name: string
  /** wie gründlich das Modell nachdenken soll, wo der Anbieter das kennt */
  aufwand: 'niedrig' | 'mittel'
  signal?: AbortSignal
}

export interface ModellInfo {
  id: string
  name: string
  /** false, wenn bekannt ist, dass das Modell keine Bilder liest */
  bilder?: boolean
  /** z. B. Preis je Million Tokens, wenn der Anbieter ihn nennt */
  hinweis?: string
}

export type Abruf = (url: string, init?: RequestInit) => Promise<Response>

export interface Adapter {
  modelle(z: AnbieterZugang, abruf: Abruf, signal?: AbortSignal): Promise<ModellInfo[]>
  /** liefert das gelesene JSON; die Prüfung gegen das Schema macht frage.ts */
  frage(z: AnbieterZugang, a: Anfrage, abruf: Abruf): Promise<unknown>
}

export type FehlerArt = 'einrichten' | 'zugang' | 'guthaben' | 'limit' | 'modell' | 'dienst' | 'anfrage' | 'netz' | 'antwort' | 'abgelehnt' | 'bilder' | 'abgebrochen'

const TEXTE: Record<FehlerArt, string> = {
  einrichten: 'Noch keine KI eingerichtet. Unter Einstellungen › KI einen Anbieter wählen.',
  zugang: 'Der Anbieter hat den Schlüssel nicht angenommen. Unter Einstellungen › KI prüfen.',
  guthaben: 'Beim Anbieter ist kein Guthaben oder Kontingent mehr frei.',
  limit: 'Zu viele Anfragen in kurzer Zeit. In einer Minute noch einmal versuchen.',
  modell: 'Das gewählte Modell gibt es beim Anbieter nicht (mehr). Unter Einstellungen › KI ein anderes wählen.',
  dienst: 'Der KI-Dienst ist gerade gestört. Später noch einmal versuchen.',
  anfrage: 'Der Anbieter hat die Anfrage abgelehnt.',
  netz: 'Keine Verbindung zum KI-Dienst. Ohne Netz geht das nicht.',
  antwort: 'Die KI hat nicht im verlangten Format geantwortet. Noch einmal versuchen oder ein anderes Modell wählen.',
  abgelehnt: 'Die KI hat die Anfrage aus Sicherheitsgründen abgelehnt.',
  bilder: 'Das gewählte Modell kann keine Bilder lesen. Ein Modell mit Bildverständnis wählen oder die Antwort tippen.',
  abgebrochen: ''
}

/** Ein Fehler, den die Oberfläche in einem Satz erklären kann */
export class KiFehler extends Error {
  constructor(
    readonly art: FehlerArt,
    readonly detail = ''
  ) {
    super(detail ? `${TEXTE[art]} (${detail})` : TEXTE[art])
    this.name = 'KiFehler'
  }
}
