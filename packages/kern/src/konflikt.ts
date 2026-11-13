// Konfliktkopien für Menschen lesbar machen: woher die zweite Fassung kommt, was für eine Datei es ist und welche
// Zeilen sich unterscheiden. Rein, ohne Oberfläche; die Konfliktansicht der App baut darauf auf.
import { felder, linkZiel, zerlege } from './frontmatter'
import { bekannteKopie, type Programm, type SyncKopie } from './syncKopien'

export interface Herkunft {
  /** Programm, das die Kopie angelegt hat; null = unbekannt (Kopie nur am Namen oder an der ID erkannt) */
  programm: Programm | null
  /** Syncthing: siebenstellige Gerätekennung; diese App: Gerätename; Nextcloud/Dropbox: Nutzername; sonst leer */
  geraet: string
  /** Zeitpunkt aus dem Dateinamen als `JJJJ-MM-TTTHH:MM` oder `JJJJ-MM-TT` (Ortszeit des Geräts), sonst leer */
  zeit: string
}

/** Programm, Gerät und Zeit einer Konfliktkopie; null, wenn der Name keine bekannte Konfliktkopie ist */
export function konfliktHerkunft(kopie: string | SyncKopie): Herkunft | null {
  const k = typeof kopie === 'string' ? bekannteKopie(kopie) : kopie
  if (!k) return null
  return { programm: k.programm, geraet: k.geraet ?? '', zeit: k.zeit ?? '' }
}

/** `2026-11-12T18:30` → `12.11.2026, 18:30` */
export function zeitLesbar(zeit: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(zeit)
  return !m ? zeit : m[4] ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}` : `${m[3]}.${m[2]}.${m[1]}`
}

const ARTEN: Record<string, string> = { frage: 'Lernkarte', notiz: 'Mitschrift', modul: 'Modul', erklaerung: 'Erklärung' }

export interface Beschreibung {
  /** Was für eine Datei, in Worten („Lernkarte“, „Mitschrift“, „Blatt“ …) */
  art: string
  /** Titel aus dem Frontmatter, sonst Dateiname ohne Kennung */
  titel: string
}

/** Überschrift für einen Konflikt: Art und Titel statt Pfad mit ULID */
export function konfliktBeschreibung(pfad: string, text?: string): Beschreibung {
  const name = pfad.slice(pfad.lastIndexOf('/') + 1)
  const f = text === undefined ? {} : felder(zerlege(text).kopf)
  const typ = typeof f.typ === 'string' ? f.typ : ''
  let art = ARTEN[typ] ?? ''
  if (typ === 'notiz' && !linkZiel(f.thema)) art = 'Notiz'
  if (!art) {
    if (pfad.startsWith('lernen/blaetter/')) art = 'Zeichenblatt'
    else if (pfad.startsWith('lernen/tinte/')) art = 'Handschrift im Skript'
    else if (pfad.startsWith('lernen/markierungen/')) art = 'Markierungen im Skript'
    else if (pfad.startsWith('lernen/einstellungen/ki-prompts')) art = 'Anweisungen an die KI'
    else if (pfad.startsWith('lernen/einstellungen/')) art = 'Einstellung'
    else if (pfad.startsWith('lernen/fragen/') || pfad.startsWith('lernen/vorfragen/')) art = 'Erzeugte Fragen'
    else if (pfad.startsWith('lernen/stand/') || pfad.startsWith('lernen/fragen-stand/')) art = 'Lernstand'
    else if (pfad.startsWith('reviews/')) art = 'Lernprotokoll'
    else art = 'Datei'
  }
  const t = typeof f.titel === 'string' && f.titel.trim() ? f.titel.trim() : name
  return { art, titel: t }
}

/** Markdown-Kurzschrift einer Lernkarte in Worte: `?? …` = Frage, `:: …` = Antwort */
export function lesbareZeilen(rumpf: string): string[] {
  const z = rumpf.replace(/\n+$/, '').split('\n')
  return z.map((s) => (s.startsWith('?? ') ? `Frage: ${s.slice(3)}` : s.startsWith(':: ') ? `Antwort: ${s.slice(3)}` : s))
}

export interface VergleichsZeile {
  /** gleich = in beiden Fassungen; weg = nur in der ersten; neu = nur in der zweiten */
  art: 'gleich' | 'weg' | 'neu'
  text: string
}

/**
 * Zeilenvergleich über die längste gemeinsame Teilfolge (wie `diff`). Anders als ein Mengenvergleich erkennt er auch
 * verschobene oder doppelte Zeilen richtig. Große Dateien (über 4 Mio. Zellen) fallen auf Anfang/Ende-Abgleich zurück.
 */
export function zeilenVergleich(a: string[], b: string[]): VergleichsZeile[] {
  let anf = 0
  while (anf < a.length && anf < b.length && a[anf] === b[anf]) anf++
  let ende = 0
  while (ende < a.length - anf && ende < b.length - anf && a[a.length - 1 - ende] === b[b.length - 1 - ende]) ende++
  const ma = a.slice(anf, a.length - ende)
  const mb = b.slice(anf, b.length - ende)
  const mitte: VergleichsZeile[] = []
  if (ma.length * mb.length > 4_000_000) {
    for (const t of ma) mitte.push({ art: 'weg', text: t })
    for (const t of mb) mitte.push({ art: 'neu', text: t })
  } else {
    const n = ma.length
    const m = mb.length
    const l: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) l[i][j] = ma[i] === mb[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1])
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (ma[i] === mb[j]) {
        mitte.push({ art: 'gleich', text: ma[i] })
        i++
        j++
      } else if (l[i + 1][j] >= l[i][j + 1]) mitte.push({ art: 'weg', text: ma[i++] })
      else mitte.push({ art: 'neu', text: mb[j++] })
    }
    while (i < n) mitte.push({ art: 'weg', text: ma[i++] })
    while (j < m) mitte.push({ art: 'neu', text: mb[j++] })
  }
  return [
    ...a.slice(0, anf).map((text) => ({ art: 'gleich' as const, text })),
    ...mitte,
    ...a.slice(a.length - ende).map((text) => ({ art: 'gleich' as const, text }))
  ]
}
