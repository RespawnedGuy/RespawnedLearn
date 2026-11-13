// Die wählbaren KI-Anbieter mit kurzer Anleitung für die Einstellungen. Ausführlicher: docs/ki-anbieter.md.
// Stand der Angaben: Doku der Anbieter, geprüft am 13.11.2026. Preise ändern sich, darum nur Verweise.
import { anthropic } from './anthropic'
import { gemini } from './gemini'
import { ollama } from './ollama'
import { openai, perplexity } from './openai'
import type { Adapter, AnbieterId } from './typen'

export interface AnbieterInfo {
  id: AnbieterId
  name: string
  /** eine Zeile: was das ist */
  kurz: string
  /** Schlüssel nötig (sonst Adresse, Ollama) */
  schluessel: boolean
  /** Anfang eines gültigen Schlüssels, nur als Hinweis beim Eintippen */
  schluesselBeginn?: string
  schritte: string[]
  links: { text: string; url: string }[]
  /** wohin die Daten gehen, nur was aus den Bedingungen des Anbieters belegt ist */
  daten: string
  adapter: Adapter
}

export const ANBIETER: AnbieterInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    kurz: 'Claude-Modelle, stark bei Erklärungen und Handschrift.',
    schluessel: true,
    schluesselBeginn: 'sk-ant-',
    schritte: [
      'In der Claude Console anmelden oder ein Konto anlegen.',
      'Unter „Billing“ Guthaben aufladen; ohne Guthaben antwortet die API nicht.',
      'Unter „API keys“ auf „Create key“ tippen, einen Namen vergeben und den Schlüssel (beginnt mit sk-ant-) kopieren. Er wird nur einmal angezeigt.',
      'Hier einfügen, „Verbinden“ tippen und ein Modell wählen.'
    ],
    links: [
      { text: 'Schlüssel anlegen', url: 'https://platform.claude.com/settings/keys' },
      { text: 'Anleitung von Anthropic', url: 'https://platform.claude.com/docs/en/get-api-key' }
    ],
    daten: 'Stellen, Antworten und Bilder gehen an Anthropic. Ein Claude-Abo (Pro, Max) gilt hier nicht, die API rechnet nach Verbrauch ab.',
    adapter: anthropic
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    kurz: 'Die Modelle hinter ChatGPT.',
    schluessel: true,
    schluesselBeginn: 'sk-',
    schritte: [
      'Auf der OpenAI-Plattform anmelden (nicht chatgpt.com).',
      'Unter „Billing“ Guthaben aufladen; ein ChatGPT-Abo gilt für die API nicht.',
      'Unter „API keys“ einen neuen Schlüssel anlegen und kopieren.',
      'Hier einfügen, „Verbinden“ tippen und ein Modell wählen.'
    ],
    links: [{ text: 'Schlüssel anlegen', url: 'https://platform.openai.com/api-keys' }],
    daten: 'Stellen, Antworten und Bilder gehen an OpenAI. Abgerechnet wird nach Verbrauch.',
    adapter: openai
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    kurz: 'Gemini-Modelle von Google, mit kostenlosem Kontingent.',
    schluessel: true,
    schritte: [
      'In Google AI Studio mit einem Google-Konto anmelden.',
      'Auf „Get API key“ bzw. „Create API key“ tippen und den Schlüssel kopieren.',
      'Hier einfügen, „Verbinden“ tippen und ein Modell wählen.'
    ],
    links: [
      { text: 'Schlüssel anlegen', url: 'https://aistudio.google.com/apikey' },
      { text: 'Bedingungen', url: 'https://ai.google.dev/gemini-api/terms' }
    ],
    daten:
      'Stellen, Antworten und Bilder gehen an Google. Laut Bedingungen (Stand 23.03.2026) nutzt Google Eingaben im kostenlosen Kontingent zur Verbesserung seiner Produkte, Menschen können sie lesen. In der EU, der Schweiz und Großbritannien gelten auch kostenlos die Regeln des bezahlten Dienstes: dann kein Training mit deinen Daten.',
    adapter: gemini
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    kurz: 'Modelle verschiedener Hersteller über einen Zugang.',
    schluessel: true,
    schluesselBeginn: 'pplx-',
    schritte: [
      'In der Perplexity-Konsole anmelden und zuerst ein Projekt anlegen.',
      'Im Projekt unter „API keys“ einen Schlüssel erzeugen und gleich kopieren, er wird nur einmal angezeigt.',
      'Guthaben aufladen, falls die Konsole danach fragt.',
      'Hier einfügen, „Verbinden“ tippen und ein Modell wählen. Die Liste nennt die Preise.'
    ],
    links: [
      { text: 'Projekt anlegen', url: 'https://console.perplexity.ai/project/settings' },
      { text: 'Schlüssel anlegen', url: 'https://console.perplexity.ai/project/keys' }
    ],
    daten: 'Stellen, Antworten und Bilder gehen an Perplexity und den Hersteller des gewählten Modells.',
    adapter: perplexity
  },
  {
    id: 'ollama',
    name: 'Ollama (eigener Rechner)',
    kurz: 'Ein Modell auf dem eigenen Rechner. Nichts verlässt dein Netz, kostet nichts, braucht aber einen kräftigen Rechner.',
    schluessel: false,
    schritte: [
      'Ollama von ollama.com installieren.',
      'Ein Modell laden, zum Beispiel im Terminal: ollama pull gemma3 (für Handschrift ein Modell mit Bildverständnis wählen).',
      'Läuft die App auf demselben Rechner, genügt die Adresse http://localhost:11434.',
      'Für das Handy: am Rechner die Umgebungsvariable OLLAMA_HOST auf 0.0.0.0:11434 setzen, Ollama neu starten und hier die Adresse des Rechners im Heimnetz eintragen, z. B. http://192.168.1.20:11434.',
      '„Verbinden“ tippen und ein Modell wählen.'
    ],
    links: [
      { text: 'Ollama herunterladen', url: 'https://ollama.com/download' },
      { text: 'Im Netz freigeben (FAQ)', url: 'https://docs.ollama.com/faq' }
    ],
    daten: 'Alles bleibt auf deinem Rechner bzw. in deinem Heimnetz. Die Verbindung im Heimnetz ist unverschlüsselt (http).',
    adapter: ollama
  }
]

export const anbieterInfo = (id: AnbieterId) => ANBIETER.find((a) => a.id === id)!
