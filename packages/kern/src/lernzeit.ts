// Lernzeit (Vertrag Lernen 1.7, 5.3): wie lange an einem Lernziel gelernt wurde. Jedes Gerät hängt nur an seine
// eigene Datei `lernen/zeit/JJJJ-MM.<geraet>.jsonl` an. Gemessen wird nur, solange die App sichtbar ist und in den
// letzten 5 Minuten etwas getan wurde. Rein: die Uhr und die Eingaben kommen von außen.
import type { Bestand } from './bestand'
import type { Modul } from './module'

export type LernArt = 'sammeln' | 'mitschrift' | 'lernen'

export interface LernAbschnitt {
  /** Modul-ID, bei einem losen PDF die Anhang-ID */
  ziel: string
  art: LernArt
  /** Beginn, ISO */
  am: string
  /** Ende, ISO */
  bis: string
  /** offenes Skript */
  quelle?: string
  /** erste und letzte Skriptseite im Abschnitt */
  seiten?: [number, number]
}

/** Nach so langer Zeit ohne Eingabe endet ein Abschnitt; was danach kommt, zählt nicht */
export const LEERLAUF_MS = 5 * 60_000
/** Spätestens so oft wird geschrieben, damit ein Absturz wenig kostet */
export const SCHREIBEN_MS = 5 * 60_000
/** Kürzere Abschnitte (ein Blick in die App) werden nicht gespeichert */
export const MIN_ABSCHNITT_MS = 30_000
/** Ab so vielen gelesenen Seiten gilt das eigene Tempo */
export const MIN_TEMPO_SEITEN = 20
/** Ein Abschnitt, der mehr Seiten überspannt, war Blättern oder ein Sprung, kein Lesen */
const MAX_SEITEN_JE_ABSCHNITT = 30
const ARTEN: LernArt[] = ['sammeln', 'mitschrift', 'lernen']

export function liesLernzeit(text: string): LernAbschnitt[] {
  const out: LernAbschnitt[] = []
  for (const z of text.split('\n')) {
    if (!z.trim()) continue
    let w: Record<string, unknown>
    try {
      w = JSON.parse(z) as Record<string, unknown>
    } catch {
      continue
    }
    if (!w || typeof w.ziel !== 'string' || !w.ziel || !ARTEN.includes(w.art as LernArt)) continue
    if (typeof w.am !== 'string' || typeof w.bis !== 'string') continue
    const von = Date.parse(w.am)
    const bis = Date.parse(w.bis)
    if (!Number.isFinite(von) || !Number.isFinite(bis) || bis < von) continue
    const a: LernAbschnitt = { ziel: w.ziel, art: w.art as LernArt, am: w.am, bis: w.bis }
    if (typeof w.quelle === 'string' && w.quelle) a.quelle = w.quelle
    const s = w.seiten
    if (Array.isArray(s) && s.length === 2 && s.every((n) => Number.isInteger(n) && n >= 1)) a.seiten = [s[0], s[1]]
    out.push(a)
  }
  return out
}

export function lernzeitZeile(a: LernAbschnitt): string {
  const o: LernAbschnitt = { ziel: a.ziel, art: a.art, am: a.am, bis: a.bis }
  if (a.quelle) o.quelle = a.quelle
  if (a.seiten) o.seiten = a.seiten
  return JSON.stringify(o) + '\n'
}

/** Alle Abschnitte aller Geräte; dieselbe Zeile in zwei Dateien (nach einem Konflikt) zählt einmal */
export function alleLernzeiten(b: Bestand): LernAbschnitt[] {
  const gesehen = new Set<string>()
  const out: LernAbschnitt[] = []
  for (const [pfad, text] of b.texte) {
    if (!/^lernen\/zeit\/[^/]+\.jsonl$/.test(pfad)) continue
    for (const a of liesLernzeit(text)) {
      const k = lernzeitZeile(a)
      if (gesehen.has(k)) continue
      gesehen.add(k)
      out.push(a)
    }
  }
  return out
}

export const dauer = (a: LernAbschnitt) => Date.parse(a.bis) - Date.parse(a.am)

// ── Messen ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was gerade offen ist; null = nichts, das zählt */
export interface LernKontext {
  ziel: string
  art: LernArt
  quelle?: string
  seite?: number
}

export interface Messung {
  ziel: string
  art: LernArt
  quelle?: string
  von: number
  zuletzt: number
  seiteVon?: number
  seiteBis?: number
}

export interface Messschritt {
  messung: Messung | null
  /** fertige Abschnitte, die geschrieben werden sollen */
  fertig: LernAbschnitt[]
}

function abschnittAus(m: Messung, bis: number): LernAbschnitt | null {
  if (bis - m.von < MIN_ABSCHNITT_MS) return null
  const a: LernAbschnitt = { ziel: m.ziel, art: m.art, am: new Date(m.von).toISOString(), bis: new Date(bis).toISOString() }
  if (m.quelle) a.quelle = m.quelle
  if (m.quelle && m.seiteVon && m.seiteBis) a.seiten = [m.seiteVon, m.seiteBis]
  return a
}

function neu(k: LernKontext, jetzt: number): Messung {
  const m: Messung = { ziel: k.ziel, art: k.art, von: jetzt, zuletzt: jetzt }
  if (k.quelle) m.quelle = k.quelle
  if (k.quelle && k.seite) m.seiteVon = m.seiteBis = k.seite
  return m
}

const gleich = (m: Messung, k: LernKontext) => m.ziel === k.ziel && m.art === k.art && (m.quelle ?? '') === (k.quelle ?? '')

/**
 * Eine Eingabe (oder ein Seitenwechsel) im Kontext `k`. Nach Leerlauf oder bei anderem Kontext endet der alte Abschnitt
 * bei seiner letzten Eingabe; die Zeit dazwischen zählt nicht. `k = null` beendet die Messung (App verdeckt, Ansicht zu).
 */
export function eingabe(m: Messung | null, k: LernKontext | null, jetzt: number): Messschritt {
  if (m && (!k || !gleich(m, k) || jetzt - m.zuletzt > LEERLAUF_MS)) {
    const a = abschnittAus(m, m.zuletzt)
    return { messung: k ? neu(k, jetzt) : null, fertig: a ? [a] : [] }
  }
  if (!k) return { messung: null, fertig: [] }
  if (!m) return { messung: neu(k, jetzt), fertig: [] }
  const n: Messung = { ...m, zuletzt: jetzt }
  if (n.quelle && k.seite) {
    n.seiteVon = Math.min(n.seiteVon ?? k.seite, k.seite)
    n.seiteBis = Math.max(n.seiteBis ?? k.seite, k.seite)
  }
  return { messung: n, fertig: [] }
}

/**
 * Regelmäßiger Blick auf die Uhr: nach Leerlauf endet der Abschnitt; läuft er länger als `SCHREIBEN_MS`, wird das
 * Bisherige geschrieben und ab der letzten Eingabe weitergemessen.
 */
export function uhr(m: Messung | null, jetzt: number): Messschritt {
  if (!m) return { messung: null, fertig: [] }
  if (jetzt - m.zuletzt > LEERLAUF_MS) {
    const a = abschnittAus(m, m.zuletzt)
    return { messung: null, fertig: a ? [a] : [] }
  }
  if (m.zuletzt - m.von >= SCHREIBEN_MS) {
    const a = abschnittAus(m, m.zuletzt)
    const weiter: Messung = { ...m, von: m.zuletzt }
    if (weiter.quelle && m.seiteBis) weiter.seiteVon = weiter.seiteBis = m.seiteBis
    return { messung: weiter, fertig: a ? [a] : [] }
  }
  return { messung: m, fertig: [] }
}

// ── Auswerten ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Gehört der Abschnitt zum Modul? Auch Zeit an einem seiner PDFs, bevor es zum Modul wurde. */
export function gehoertZu(a: LernAbschnitt, m: Pick<Modul, 'id' | 'quellen'>): boolean {
  return a.ziel === m.id || m.quellen.includes(a.ziel) || (!!a.quelle && m.quellen.includes(a.quelle))
}

export function zeitIn(abschnitte: LernAbschnitt[], m: Pick<Modul, 'id' | 'quellen'>): number {
  return abschnitte.filter((a) => gehoertZu(a, m)).reduce((s, a) => s + dauer(a), 0)
}

/** Gelesene Seiten eines Abschnitts; Sprünge und Blättern über viele Seiten zählen nicht */
function seitenVon(a: LernAbschnitt): number {
  if (!a.seiten) return 0
  const n = a.seiten[1] - a.seiten[0] + 1
  return n > MAX_SEITEN_JE_ABSCHNITT ? 0 : n
}

export interface Tempo {
  minutenJeSeite: number
  seiten: number
}

/** Eigenes Tempo im Skript (Minuten je Seite), erst ab `MIN_TEMPO_SEITEN` Seiten, sonst null */
export function tempo(abschnitte: LernAbschnitt[]): Tempo | null {
  let ms = 0
  let seiten = 0
  for (const a of abschnitte) {
    if (a.art !== 'sammeln') continue
    const n = seitenVon(a)
    if (!n) continue
    ms += dauer(a)
    seiten += n
  }
  if (seiten < MIN_TEMPO_SEITEN) return null
  return { minutenJeSeite: ms / 60_000 / seiten, seiten }
}

export interface Schnitt {
  module: number
  /** Stunden je abgeschlossenem Modul */
  stundenJeModul: number
  /** Stunden je ECTS, nur aus Modulen mit ECTS; null bei weniger als zwei solchen */
  stundenJeEcts: number | null
}

/** Schnitt aus abgeschlossenen Modulen mit gemessener Zeit, erst ab zwei Modulen */
export function schnitt(abschnitte: LernAbschnitt[], module: Modul[]): Schnitt | null {
  const fertig = module.filter((m) => m.abgeschlossen).map((m) => ({ m, h: zeitIn(abschnitte, m) / 3_600_000 })).filter((x) => x.h > 0)
  if (fertig.length < 2) return null
  const mitEcts = fertig.filter((x) => x.m.ects)
  return {
    module: fertig.length,
    stundenJeModul: fertig.reduce((s, x) => s + x.h, 0) / fertig.length,
    stundenJeEcts: mitEcts.length >= 2 ? mitEcts.reduce((s, x) => s + x.h, 0) / mitEcts.reduce((s, x) => s + x.m.ects!, 0) : null
  }
}

/** „12,5 h“, unter einer Stunde in Minuten */
export function stundenText(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.round(min / 6) / 10
  return `${String(h).replace('.', ',')} h`
}
