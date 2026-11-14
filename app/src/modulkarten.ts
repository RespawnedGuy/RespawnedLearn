// Wohin Wissen gehört: jedes Modul lernt man für sich, in der Reihenfolge seiner Mitschriften und PDFs.
// Die allgemeine Runde mischt dagegen bewusst über alle Module (verschachteltes Üben, spaced repetition).
import { abschnittAn, linkZiel, mitschriftenVon, modulVon, module, stelleVon, zeileVonAnker, type Bestand, type Eintrag } from '@rl/kern'
import { lernkarten, lernstaende, type Lernkarte } from './wissen'

/** Modul eines Eintrags: direkt (`thema`), über die Mitschrift (`stelle`), das PDF (`quelle`) oder eine Stufe über `thema` */
export function modulVonEintrag(b: Bestand, e: Eintrag, tiefe = 0): string | null {
  const s = stelleVon(e)
  if (s) {
    const m = b.dokumente.get(s.notiz)
    const id = m ? linkZiel(m.felder.thema) : null
    if (id && b.dokumente.get(id)?.typ === 'modul') return id
  }
  const thema = linkZiel(e.felder.thema)
  const t = thema ? b.dokumente.get(thema) : undefined
  if (t?.typ === 'modul') return t.id
  const quelle = linkZiel(e.felder.quelle)
  if (quelle) {
    const m = modulVon(b, quelle)
    if (m) return m.id
  }
  return t && tiefe < 2 ? modulVonEintrag(b, t, tiefe + 1) : null
}

export interface Einordnung {
  modul: string | null
  /** Überschriften über der Stelle in der Mitschrift */
  abschnitt: string[]
  /** Mitschrift und Zeile, wenn die Karte auf eine Stelle zeigt */
  mitschrift: string | null
  zeile: number
  /** Sortierschlüssel: Reihenfolge im Modul (Mitschriften, dann PDFs, dann der Rest nach Anlage) */
  reihe: string
}

export function einordnen(b: Bestand, e: Eintrag): Einordnung {
  const modul = modulVonEintrag(b, e)
  const s = stelleVon(e)
  const m = s ? b.dokumente.get(s.notiz) : undefined
  const erstellt = String(e.felder.erstellt ?? '')
  if (s && m) {
    const zeile = zeileVonAnker(m.rumpf, s.anker)
    const nr = modul ? mitschriftenVon(b, modul).findIndex((x) => x.id === m.id) : 0
    return { modul, abschnitt: zeile >= 0 ? abschnittAn(m.rumpf, zeile) : [], mitschrift: m.id, zeile, reihe: `1-${pad(nr)}-${pad(Math.max(zeile, 0))}-${erstellt}` }
  }
  const quelle = linkZiel(e.felder.quelle)
  const mod = modul ? module(b).find((x) => x.id === modul) : undefined
  const nr = quelle && mod ? mod.quellen.indexOf(quelle) : -1
  return { modul, abschnitt: [], mitschrift: null, zeile: -1, reihe: nr >= 0 ? `2-${pad(nr)}-${erstellt}` : `3-${erstellt}` }
}

const pad = (n: number) => String(n).padStart(6, '0')

/** Alle Lernkarten eines Moduls in seiner Reihenfolge */
export function kartenImModul(b: Bestand, modul: string): (Lernkarte & { ort: Einordnung })[] {
  return lernkarten(b)
    .map((k) => ({ ...k, ort: einordnen(b, k.e) }))
    .filter((k) => k.ort.modul === modul)
    .sort((x, y) => x.ort.reihe.localeCompare(y.ort.reihe))
}

/** Teil einer Mitschrift: von der Überschrift in `zeile` bis vor die nächste gleicher oder höherer Ebene */
export function teilVon(rumpf: string, zeile: number): [number, number] {
  const zeilen = rumpf.split('\n')
  const ebene = /^(#{1,6})\s/.exec(zeilen[zeile] ?? '')?.[1].length ?? 0
  if (!ebene) return [zeile, zeilen.length]
  for (let n = zeile + 1; n < zeilen.length; n++) {
    const e = /^(#{1,6})\s/.exec(zeilen[n])?.[1].length
    if (e && e <= ebene) return [zeile, n]
  }
  return [zeile, zeilen.length]
}

export interface Auswahl {
  modul: string
  /** nur ein Teil einer Mitschrift: [Mitschrift, Zeile der Überschrift] */
  teil?: [string, number]
}

/** Karten eines Moduls (oder eines Teils davon) */
export function kartenFuer(b: Bestand, a: Auswahl) {
  const alle = kartenImModul(b, a.modul)
  if (!a.teil) return alle
  const m = b.dokumente.get(a.teil[0])
  if (!m) return []
  const [von, bis] = teilVon(m.rumpf, a.teil[1])
  return alle.filter((k) => k.ort.mitschrift === m.id && k.ort.zeile >= von && k.ort.zeile < bis)
}

function mische<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/**
 * Runde für ein Modul: erst die fälligen Wiederholungen (gemischt, aber nur innerhalb des Moduls),
 * dann neue Karten in der Reihenfolge der Mitschrift.
 */
export function modulRunde(b: Bestand, a: Auswahl, neu = 15): Lernkarte[] {
  const st = lernstaende(b)
  const jetzt = Date.now()
  const karten = kartenFuer(b, a)
  const faellig = karten.filter((k) => st.has(k.e.id) && st.get(k.e.id)!.karte.dueAt.getTime() <= jetzt)
  const frisch = karten.filter((k) => !st.has(k.e.id)).slice(0, neu)
  return [...mische(faellig), ...frisch]
}

/** Wie viele Karten eines Moduls (oder Teils) heute dran sind */
export function faelligZahl(b: Bestand, a: Auswahl): number {
  const st = lernstaende(b)
  const jetzt = Date.now()
  return kartenFuer(b, a).filter((k) => !st.has(k.e.id) || st.get(k.e.id)!.karte.dueAt.getTime() <= jetzt).length
}

/**
 * Allgemeine Runde: alles Fällige aus allen Modulen bunt gemischt (verschachteltes Üben hilft beim
 * Unterscheiden und Behalten). Neue Karten kommen reihum aus den Modulen, innerhalb eines Moduls aber
 * in seiner Reihenfolge, damit kein Lehrgang mitten im Stoff beginnt.
 */
export function allgemeineRunde(b: Bestand, neu = 10): Lernkarte[] {
  const st = lernstaende(b)
  const jetzt = Date.now()
  const karten = lernkarten(b).map((k) => ({ ...k, ort: einordnen(b, k.e) }))
  const faellig = karten.filter((k) => st.has(k.e.id) && st.get(k.e.id)!.karte.dueAt.getTime() <= jetzt)
  const stapel = new Map<string, typeof karten>()
  for (const k of karten.filter((x) => !st.has(x.e.id)).sort((x, y) => x.ort.reihe.localeCompare(y.ort.reihe))) {
    const s = k.ort.modul ?? ''
    stapel.set(s, [...(stapel.get(s) ?? []), k])
  }
  const frisch: Lernkarte[] = []
  const reihen = mische([...stapel.values()])
  while (frisch.length < neu && reihen.some((r) => r.length)) for (const r of reihen) if (r.length && frisch.length < neu) frisch.push(r.shift()!)
  return mische([...faellig, ...frisch])
}
