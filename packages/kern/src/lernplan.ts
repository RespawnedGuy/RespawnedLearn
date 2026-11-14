// Lernplan (Vertrag Lernen 1.7, 5.3): wird nicht gespeichert, sondern jederzeit aus Inhaltsverzeichnis, Seitenzahl,
// Lesestand und Tempo gerechnet. Abschnitte sind die Kapitel-Einheit der Kapitelfragen, Pakete Seitenbereiche von
// etwa 25 Minuten (Pomodoro-Länge). Gezeigt werden nur das aktuelle Paket und die nächsten (Nils 2026-11-14).
import type { Kapitel } from './inhalt'
import type { Lesestand } from './module'

export const PAKET_MINUTEN = 25
/** Startwert, bis das eigene Tempo gemessen ist; geschätzt, keine belegte Zahl */
export const START_MINUTEN_JE_SEITE = 5
/** Ohne Inhaltsverzeichnis: so viele Seiten je Abschnitt */
export const SEITEN_OHNE_INHALT = 20
/** Die letzte Woche vor dem Termin bleibt für die Wiederholung */
export const WIEDERHOLUNG_TAGE = 7

export interface PlanTeil {
  anhang: string
  titel: string
  /** Seitenzahl des PDFs; 0 = unbekannt (noch nicht geladen) */
  seiten: number
  kapitel: Kapitel[]
}

export interface Paket {
  anhang: string
  von: number
  bis: number
  minuten: number
  abschnitt: string
}

export interface PlanAbschnitt {
  anhang: string
  titel: string
  von: number
  bis: number
  schwer: boolean
  pakete: Paket[]
}

/** Abschnitte eines PDFs: oberste Ebene, bei weniger als drei Teilen eine tiefer (wie `kapitelBereich`) */
export function abschnitteVon(kapitel: Kapitel[], seiten: number): { titel: string; von: number; bis: number }[] {
  const oben = kapitel.filter((k) => (k.ebene || 1) === 1)
  const tiefe = oben.length < 3 ? 2 : 1
  const liste = kapitel.filter((k) => (k.ebene || 1) <= tiefe && (!seiten || k.seite <= seiten)).sort((a, b) => a.seite - b.seite)
  const out: { titel: string; von: number; bis: number }[] = []
  liste.forEach((k, i) => {
    const naechste = liste.slice(i + 1).find((x) => x.seite > k.seite)
    const bis = naechste ? naechste.seite - 1 : seiten
    if (bis >= k.seite) out.push({ titel: k.titel, von: k.seite, bis })
  })
  if (out.length || !seiten) return out
  for (let a = 1; a <= seiten; a += SEITEN_OHNE_INHALT) {
    const b = Math.min(seiten, a + SEITEN_OHNE_INHALT - 1)
    out.push({ titel: `S. ${a}–${b}`, von: a, bis: b })
  }
  return out
}

/** Seiten gleichmäßig auf so viele Pakete verteilen, dass keins viel länger als `paketMinuten` dauert */
function teile(von: number, bis: number, minutenJeSeite: number, paketMinuten: number): { von: number; bis: number }[] {
  const n = bis - von + 1
  const jePaket = Math.max(1, Math.floor(paketMinuten / minutenJeSeite))
  const anzahl = Math.ceil(n / jePaket)
  const out: { von: number; bis: number }[] = []
  let a = von
  for (let i = 0; i < anzahl; i++) {
    const groesse = Math.floor(n / anzahl) + (i < n % anzahl ? 1 : 0)
    out.push({ von: a, bis: a + groesse - 1 })
    a += groesse
  }
  return out
}

export function rechnePlan(p: { teile: PlanTeil[]; minutenJeSeite: number; paketMinuten?: number; schwer?: string[] }): PlanAbschnitt[] {
  const paketMinuten = p.paketMinuten ?? PAKET_MINUTEN
  const schwer = new Set(p.schwer ?? [])
  const out: PlanAbschnitt[] = []
  for (const t of p.teile) {
    for (const a of abschnitteVon(t.kapitel, t.seiten)) {
      const s = schwer.has(a.titel)
      const mps = p.minutenJeSeite * (s ? 2 : 1)
      const pakete = teile(a.von, a.bis, mps, paketMinuten).map((x) => ({ anhang: t.anhang, von: x.von, bis: x.bis, minuten: Math.round((x.bis - x.von + 1) * mps), abschnitt: a.titel }))
      out.push({ anhang: t.anhang, titel: a.titel, von: a.von, bis: a.bis, schwer: s, pakete })
    }
  }
  return out
}

/** Erledigt, sobald der Lesestand über die letzte Seite des Pakets hinaus ist */
export const erledigt = (p: Paket, stand: Lesestand) => (stand[p.anhang]?.seite ?? 0) > p.bis

export interface Stelle {
  anhang: string
  seite: number
}

/**
 * Das aktuelle Paket und die nächsten: Ist gerade eine Stelle offen, das Paket mit dieser Seite, sonst das erste
 * unerledigte. Mehr zeigt die App nicht, damit ein ganzes Buch nicht als Aufgabenberg dasteht.
 */
export function aktuellePakete(plan: PlanAbschnitt[], stand: Lesestand, jetzt: Stelle | null = null, anzahl = 4): Paket[] {
  const alle = plan.flatMap((a) => a.pakete)
  let i = jetzt ? alle.findIndex((p) => p.anhang === jetzt.anhang && p.von <= jetzt.seite && jetzt.seite <= p.bis) : -1
  if (i < 0) i = alle.findIndex((p) => !erledigt(p, stand))
  return i < 0 ? [] : alle.slice(i, i + anzahl)
}

export function planRestMinuten(plan: PlanAbschnitt[], stand: Lesestand): number {
  return plan.flatMap((a) => a.pakete).filter((p) => !erledigt(p, stand)).reduce((s, p) => s + p.minuten, 0)
}

export function seitenGesamt(plan: PlanAbschnitt[]): number {
  return plan.reduce((s, a) => s + a.bis - a.von + 1, 0)
}

const TAG = 86_400_000
const tagZahl = (d: string) => Date.parse(`${d}T00:00:00Z`) / TAG
const tagText = (n: number) => new Date(n * TAG).toISOString().slice(0, 10)

export interface Zeitplan {
  /** erster Tag der Wiederholungswoche */
  wiederholungAb: string
  /** Wochen bis dahin (mit Bruchteil), nie negativ */
  wochen: number
  /** so viele Stunden je Woche reichen genau; null, wenn keine Zeit mehr bleibt */
  noetigJeWoche: number | null
  /** reicht die eingeplante Zeit? null ohne `stundenProWoche` */
  reicht: boolean | null
  /** fehlende Stunden bei der eingeplanten Zeit */
  fehlen: number
}

/** Passt der Rest bis zum Termin, mit einer Woche Wiederholung davor? */
export function zeitplan(p: { restMinuten: number; heute: string; termin: string; stundenProWoche: number | null }): Zeitplan {
  const ab = tagZahl(p.termin) - WIEDERHOLUNG_TAGE
  const wochen = Math.max(0, (ab - tagZahl(p.heute)) / 7)
  const rest = p.restMinuten / 60
  const noetig = wochen > 0 ? rest / wochen : null
  const reicht = p.stundenProWoche ? (noetig !== null ? p.stundenProWoche >= noetig - 1e-9 : rest === 0) : null
  const fehlen = p.stundenProWoche ? Math.max(0, rest - p.stundenProWoche * wochen) : 0
  return { wiederholungAb: tagText(ab), wochen, noetigJeWoche: noetig, reicht, fehlen }
}

/** In welcher Woche (0 = diese) ein Paket dran ist, wenn je Woche `stundenProWoche` gelernt wird */
export function wochenVerteilen(pakete: Paket[], stundenProWoche: number): number[] {
  let summe = 0
  return pakete.map((p) => {
    const w = Math.floor(summe / (stundenProWoche * 60))
    summe += p.minuten
    return w
  })
}

/** Der Abschnitt, der zuletzt fertig gelesen wurde (für den Hinweis „Übung?“) */
export function abschnittFertig(plan: PlanAbschnitt[], jetzt: Stelle): PlanAbschnitt | null {
  let treffer: PlanAbschnitt | null = null
  for (const a of plan) if (a.anhang === jetzt.anhang && a.bis < jetzt.seite && (!treffer || a.bis > treffer.bis)) treffer = a
  return treffer
}
