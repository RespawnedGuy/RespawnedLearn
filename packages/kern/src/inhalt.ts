// Inhaltsverzeichnis eines PDFs (Vertrag 5.3): einmal aus dem PDF gelesen und in `lernen/inhalt/<anhang-id>.json`
// abgelegt, damit Startseite und Modulübersicht es ohne das PDF kennen. Was Nils selbst ändert, gewinnt immer.
import { pfade } from './pfade'
import type { Bestand } from './bestand'

export interface Kapitel {
  titel: string
  /** PDF-Seite (ab 1), nicht die gedruckte Seitenzahl */
  seite: number
  /** 1 = Kapitel, 2 = Abschnitt … */
  ebene: number
}

/** pdf = eingebettete Gliederung, gedruckt = aus den Seiten des Inhaltsverzeichnisses gelesen, keins = nichts gefunden */
export type InhaltHerkunft = 'pdf' | 'gedruckt' | 'keins'

export interface Inhalt {
  herkunft: InhaltHerkunft
  /** Version des Auslesens: neuere Versionen dürfen ein automatisch gelesenes Verzeichnis ersetzen */
  version: number
  /** true, sobald Nils etwas geändert hat; dann wird nie mehr automatisch überschrieben */
  eigen?: boolean
  kapitel: Kapitel[]
}

export const INHALT_VERSION = 1

export function liesInhalt(text: string | undefined): Inhalt | null {
  if (!text?.trim()) return null
  try {
    const j = JSON.parse(text) as Partial<Inhalt>
    const kapitel = (Array.isArray(j.kapitel) ? j.kapitel : []).filter(
      (k): k is Kapitel => !!k && typeof k.titel === 'string' && typeof k.seite === 'number' && k.seite >= 1
    )
    return { herkunft: j.herkunft ?? 'keins', version: typeof j.version === 'number' ? j.version : 0, eigen: j.eigen === true || undefined, kapitel: kapitel.map((k) => ({ ...k, ebene: k.ebene || 1 })) }
  } catch {
    return null
  }
}

export function inhaltText(i: Inhalt): string {
  const kopf: Inhalt = { herkunft: i.herkunft, version: i.version, ...(i.eigen ? { eigen: true } : {}), kapitel: [] }
  // eine Zeile pro Kapitel: kleine Diffs in der Git-Historie des Datenordners
  const zeilen = i.kapitel.map((k) => '  ' + JSON.stringify({ titel: k.titel, seite: k.seite, ebene: k.ebene }))
  return JSON.stringify(kopf, null, 1).replace('"kapitel": []', zeilen.length ? `"kapitel": [\n${zeilen.join(',\n')}\n ]` : '"kapitel": []') + '\n'
}

export function inhaltVon(b: Bestand, anhang: string): Inhalt | null {
  return liesInhalt(b.texte.get(pfade.inhalt(anhang)))
}

/** Muss das Verzeichnis (neu) aus dem PDF gelesen werden? */
export function inhaltVeraltet(i: Inhalt | null): boolean {
  return !i || (!i.eigen && i.version < INHALT_VERSION)
}

/** Das Kapitel, in dem eine Seite liegt (der tiefste Eintrag, der auf oder vor der Seite beginnt) */
export function kapitelBei(kapitel: Kapitel[], seite: number): Kapitel | null {
  let treffer: Kapitel | null = null
  for (const k of kapitel) if (k.seite <= seite && (!treffer || k.seite >= treffer.seite)) treffer = k
  return treffer
}

/** Kapitel hinzufügen oder entfernen: sortiert nach Seite, von da an gehört das Verzeichnis Nils */
export function setzeKapitel(i: Inhalt | null, f: (k: Kapitel[]) => Kapitel[]): Inhalt {
  const kapitel = f(i?.kapitel ?? []).slice()
  // stabil nach Seite sortieren, damit Unterkapitel derselben Seite hinter ihrem Kapitel bleiben
  const sortiert = kapitel.map((k, n) => ({ k, n })).sort((a, c) => a.k.seite - c.k.seite || a.n - c.n).map((x) => x.k)
  return { herkunft: i?.herkunft ?? 'keins', version: i?.version ?? INHALT_VERSION, eigen: true, kapitel: sortiert }
}

// ---------- Gedrucktes Inhaltsverzeichnis (wenn das PDF keine Gliederung mitbringt) ----------

export interface GedruckterEintrag {
  titel: string
  /** gedruckte Seitenzahl */
  gedruckt: number
  ebene: number
}

const NUMMER = /^((?:\d{1,2}|[A-Z])(?:\.\d{1,2})*)\.?\s+(?=\S)/
const ZEILE = /^(.*?[\p{L})\]])[\s.·…_\-–]*?\s*(\d{1,4})$/u

/**
 * Liest Zeilen wie „2.3 Spannungsteiler ........ 45“ oder „Kapitel 4 Transistoren 112“.
 * Gibt nur etwas zurück, wenn genug Zeilen so aussehen (sonst ist es keine Inhaltsseite).
 */
export function gedruckteEintraege(zeilen: string[], mindestens = 4): GedruckterEintrag[] {
  const out: GedruckterEintrag[] = []
  for (const roh of zeilen) {
    const z = roh.replace(/\s+/g, ' ').trim()
    if (z.length < 4 || z.length > 160) continue
    const m = ZEILE.exec(z)
    if (!m) continue
    let titel = m[1].replace(/[\s.·…_]+$/, '').trim()
    const gedruckt = Number(m[2])
    if (!gedruckt || !/\p{L}{2}/u.test(titel)) continue
    // Seitenzahl am Ende einer Kopfzeile wie „Inhaltsverzeichnis 3“ nicht als Eintrag nehmen
    if (/^(inhalt|inhaltsverzeichnis|contents|table of contents)$/i.test(titel)) continue
    const nr = NUMMER.exec(titel)
    const ebene = nr ? Math.min(4, nr[1].split('.').length) : 1
    titel = titel.replace(/\s{2,}/g, ' ')
    out.push({ titel, gedruckt, ebene })
  }
  return out.length >= mindestens ? out : []
}

/**
 * Gedruckte Seitenzahl → PDF-Seite. Mit Seitenlabels aus dem PDF exakt, sonst über den Versatz,
 * der für die meisten geprüften Einträge stimmt (Titelei, Vorwort und Inhaltsseiten verschieben die Zählung).
 */
export function ordneSeitenZu(eintraege: GedruckterEintrag[], seiten: number, p: { labels?: (string | null)[] | null; versatz?: number }): Kapitel[] {
  const nachLabel = new Map<string, number>()
  p.labels?.forEach((l, i) => l && !nachLabel.has(l.trim()) && nachLabel.set(l.trim(), i + 1))
  const out: Kapitel[] = []
  for (const e of eintraege) {
    const seite = nachLabel.get(String(e.gedruckt)) ?? e.gedruckt + (p.versatz ?? 0)
    if (seite >= 1 && seite <= seiten) out.push({ titel: e.titel, seite, ebene: e.ebene })
  }
  return out
}

/** Häufigster Versatz aus Stichproben (gefundene PDF-Seite minus gedruckte Seite); null, wenn sich nichts bestätigt */
export function versatzAus(proben: number[]): number | null {
  const n = new Map<number, number>()
  for (const v of proben) n.set(v, (n.get(v) ?? 0) + 1)
  let best: [number, number] | null = null
  for (const [v, k] of n) if (!best || k > best[1] || (k === best[1] && Math.abs(v) < Math.abs(best[0]))) best = [v, k]
  return best && (best[1] >= 2 || proben.length === 1) ? best[0] : null
}

/** Für den Vergleich von Kapiteltiteln mit dem Seitentext: Kleinbuchstaben, nur Buchstaben und Ziffern */
export function vergleichsText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}
