// Fragen zum Kapitel (Vertrag 5.7): Die Pipeline schreibt pro Kapitel `lernen/fragen/<anhang-id>/S<seite>.json`,
// die Lern-App zeigt sie im Bereich Lernen. Was erledigt ist, merkt sich jedes Gerät in seiner eigenen Datei
// `lernen/fragen-stand/<geraet>.json`, damit offline nie zwei Geräte dieselbe Datei ändern.
import type { Bestand } from './bestand'
import type { Lesestand } from './module'

export type FragenArt = 'verstaendnis' | 'sokratisch'

export interface KapitelFrage {
  /** eindeutig innerhalb des Kapitels, z. B. `12-1` oder `kapitel-1` */
  id: string
  art: FragenArt
  frage: string
  /** erwartete Antwort; bei sokratischen Fragen Denkanstöße */
  antwort: string
  /** PDF-Seite, auf der der Stoff steht */
  seite: number
}

export interface KapitelFragen {
  pfad: string
  anhang: string
  kapitel: string
  von: number
  bis: number
  status: 'laeuft' | 'fertig' | 'kein_text' | 'fehler'
  fehler?: string
  fragen: KapitelFrage[]
}

/** Eine Frage samt Kapitel; `schluessel` ist über alle Kapitel eindeutig */
export interface OffeneFrage extends KapitelFrage {
  schluessel: string
  anhang: string
  kapitel: string
}

export type FragenStand = Record<string, { am: string; wie: 'erledigt' | 'karte'; karte?: string }>

export const fragenSchluessel = (anhang: string, von: number, id: string) => `${anhang}/${von}/${id}`

export function liesKapitelFragen(pfad: string, text: string): KapitelFragen | null {
  try {
    const j = JSON.parse(text) as Partial<KapitelFragen>
    if (typeof j.anhang !== 'string' || typeof j.von !== 'number') return null
    const fragen = (Array.isArray(j.fragen) ? j.fragen : []).filter(
      (q): q is KapitelFrage => !!q && typeof q.id === 'string' && typeof q.frage === 'string' && (q.art === 'verstaendnis' || q.art === 'sokratisch')
    )
    return { pfad, anhang: j.anhang, kapitel: String(j.kapitel ?? ''), von: j.von, bis: typeof j.bis === 'number' ? j.bis : j.von, status: j.status ?? 'laeuft', fehler: j.fehler, fragen }
  } catch {
    return null
  }
}

export function alleKapitelFragen(b: Bestand): KapitelFragen[] {
  const out: KapitelFragen[] = []
  for (const [pfad, text] of b.texte) {
    if (!pfad.startsWith('lernen/fragen/') || !pfad.endsWith('.json') || pfad.includes('sync-conflict')) continue
    const k = liesKapitelFragen(pfad, text)
    if (k) out.push(k)
  }
  return out
}

/** Was auf allen Geräten schon erledigt ist (zusammengeführt) */
export function fragenStand(b: Bestand): FragenStand {
  const out: FragenStand = {}
  for (const [pfad, text] of b.texte) {
    if (!pfad.startsWith('lernen/fragen-stand/') || !pfad.endsWith('.json')) continue
    try {
      for (const [k, w] of Object.entries(JSON.parse(text) as FragenStand)) if (w && typeof w.am === 'string' && (!out[k] || w.am > out[k].am)) out[k] = w
    } catch {
      // kaputte Datei überspringen, nie löschen
    }
  }
  return out
}

export function merkeFrage(alt: string, schluessel: string, w: FragenStand[string]): string {
  let s: FragenStand = {}
  try {
    s = alt.trim() ? (JSON.parse(alt) as FragenStand) : {}
  } catch {
    s = {}
  }
  s[schluessel] = w
  return JSON.stringify(s, null, 1) + '\n'
}

/**
 * Offene Fragen: nur zu Stoff, der schon gelesen ist. Im Kapitel, in dem gerade gelesen wird, also bis zur
 * aktuellen Seite; ist man weiter, zum ganzen Kapitel. Das jüngst gelesene Buch zuerst, darin nach Seite.
 */
export function offeneFragen(b: Bestand, stand: Lesestand, erledigt: FragenStand = fragenStand(b)): OffeneFrage[] {
  const out: (OffeneFrage & { am: string })[] = []
  for (const k of alleKapitelFragen(b)) {
    const s = stand[k.anhang]
    const bis = s ? (s.seite > k.bis ? k.bis : s.seite) : k.bis
    for (const q of k.fragen) {
      const schluessel = fragenSchluessel(k.anhang, k.von, q.id)
      if (erledigt[schluessel] || q.seite > bis) continue
      out.push({ ...q, schluessel, anhang: k.anhang, kapitel: k.kapitel, am: s?.am ?? '' })
    }
  }
  out.sort((x, y) => y.am.localeCompare(x.am) || x.anhang.localeCompare(y.anhang) || x.seite - y.seite || x.id.localeCompare(y.id))
  return out.map(({ am: _am, ...q }) => q)
}
