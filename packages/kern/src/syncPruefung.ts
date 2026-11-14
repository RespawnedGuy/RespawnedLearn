// Rückfallebene für Sync-Fehler (Vertrag Lernen, Grundlagen 8): Ist eine Datei lesbar, und lässt sich eine Konfliktkopie
// ohne Menschen auflösen, weil dabei nichts verloren gehen kann? Rein, ohne Oberfläche und ohne Ordner.

import { VERTRAG_PFAD, liesVertrag, vergleicheVersionen } from './aktualisierung'

/** Byte-Order-Mark und Zeilenenden sind kein inhaltlicher Unterschied (Editoren und Sync-Programme ändern sie) */
function eben(t: string): string {
  return t.replace(/^﻿/, '').replace(/\r\n/g, '\n')
}

const leer = (t: string) => eben(t).trim() === ''

function jsonOk(t: string): boolean {
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

/**
 * Warum eine Datei unlesbar ist, oder null, wenn sie in Ordnung ist. Typisch nach einem Sync-Fehler: leer, mittendrin
 * abgebrochen (halb übertragen), kaputtes JSON. Unbekannte Endungen gelten als lesbar.
 */
export function unlesbar(pfad: string, text: string): string | null {
  const t = eben(text)
  const endung = pfad.slice(pfad.lastIndexOf('.') + 1).toLowerCase()
  if (endung === 'jsonl') {
    const zeilen = t.split('\n')
    for (let i = 0; i < zeilen.length; i++) if (zeilen[i].trim() && !jsonOk(zeilen[i])) return `Zeile ${i + 1} ist beschädigt`
    return null
  }
  if (!['json', 'svg', 'md'].includes(endung)) return null
  if (!t.trim()) return 'Die Datei ist leer'
  if (endung === 'json') return jsonOk(t) ? null : 'Die Datei ist unvollständig oder beschädigt'
  if (endung === 'svg') return /<svg[\s>]/.test(t) && t.trimEnd().endsWith('</svg>') ? null : 'Die Zeichnung bricht mittendrin ab'
  if (t.startsWith('---\n') && !/\n---[ \t]*(\n|$)/.test(t.slice(3))) return 'Der Kopfbereich bricht mittendrin ab'
  return null
}

export type Automatik =
  /** Die Kopie enthält nichts, was nicht schon in der Datei steht: Kopie löschen */
  | { art: 'weg' }
  /** Die Datei enthält nichts, was nicht auch in der Kopie steht: Kopie ersetzt die Datei */
  | { art: 'uebernehmen' }
  /** Beide Fassungen zusammenführen (nur Protokolle, an die nur angehängt wird) */
  | { art: 'zusammen'; text: string }

function protokollZusammen(a: string, b: string): string | null {
  const zeilen = (t: string) => eben(t).split('\n').filter((z) => z.trim())
  const alle = [...zeilen(a)]
  const da = new Set(alle)
  for (const z of zeilen(b)) if (!da.has(z)) (da.add(z), alle.push(z))
  const am: string[] = []
  for (const z of alle) {
    try {
      const w = JSON.parse(z) as { am?: unknown }
      am.push(typeof w?.am === 'string' ? w.am : '')
    } catch {
      return null
    }
  }
  // Nach Zeit, bei gleicher Zeit in der bisherigen Reihenfolge
  const reihe = alle.map((z, i) => ({ z, i, am: am[i] })).sort((x, y) => (x.am < y.am ? -1 : x.am > y.am ? 1 : x.i - y.i))
  return reihe.map((r) => r.z).join('\n') + '\n'
}

/**
 * Lässt sich der Konflikt ohne Menschen lösen, ohne dass Inhalt verloren geht? null = nein, die Konfliktansicht zeigt ihn.
 * Regeln: gleicher Inhalt; eine Seite leer; eine Seite halb übertragen (unlesbar und Anfang der anderen);
 * Protokolle `reviews/*.jsonl` und Lernzeit `lernen/zeit/*.jsonl` (Lernen 1.7) werden zeilenweise vereinigt; bei der Vertragsmarke gilt die höhere Version (Lernen 1.6).
 */
export function automatisch(pfad: string, original: string | undefined, kopie: string): Automatik | null {
  if (original === undefined) return null
  if (pfad === VERTRAG_PFAD) {
    const o = liesVertrag(original)
    const k = liesVertrag(kopie)
    if (o && k) return vergleicheVersionen(k, o) > 0 ? { art: 'uebernehmen' } : { art: 'weg' }
  }
  const o = eben(original)
  const k = eben(kopie)
  if (o === k || leer(kopie)) return { art: 'weg' }
  if (leer(original)) return { art: 'uebernehmen' }
  const uo = unlesbar(pfad, original)
  const uk = unlesbar(pfad, kopie)
  if (uk && !uo && o.startsWith(k)) return { art: 'weg' }
  if (uo && !uk && k.startsWith(o)) return { art: 'uebernehmen' }
  if (/^(reviews|lernen\/zeit)\/[^/]+\.jsonl$/.test(pfad) && !uo && !uk) {
    const text = protokollZusammen(original, kopie)
    if (text !== null) return eben(text) === o ? { art: 'weg' } : { art: 'zusammen', text }
  }
  return null
}
