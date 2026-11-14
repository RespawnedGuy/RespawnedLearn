// Übersicht über alle Module (Nils 2026-11-14): was jetzt dran ist, wie viel diese Woche gelernt wurde und ob jedes
// Modul bis zum Termin reicht. Nichts davon wird gespeichert; gerechnet wird aus Plan, Lesestand und Lernzeit wie auf
// der Modulseite (lernplan.ts, lernzeit.ts), damit beide Stellen dieselben Zahlen zeigen.
import { aktuellePakete, planRestMinuten, seitenGesamt, zeitplan, type Paket, type PlanAbschnitt, type Zeitplan } from './lernplan'
import { dauer, gehoertZu, type LernAbschnitt } from './lernzeit'
import type { Lesestand, Modul } from './module'

/**
 * hinten: reicht bis zur Wiederholung nicht (oder es bleibt nur noch die Wiederholungswoche)
 * plan: Termin steht und es reicht · ohne: kein Termin · fertig: alles gelesen · vorbei: Termin liegt zurück
 */
export type ModulLage = 'hinten' | 'plan' | 'ohne' | 'fertig' | 'vorbei'

export interface ModulStand {
  id: string
  titel: string
  /** nächstes unerledigtes Paket; null ohne Plan oder wenn alles gelesen ist */
  naechstes: Paket | null
  gelesen: number
  seiten: number
  restMinuten: number
  termin: string | null
  zeitplan: Zeitplan | null
  lage: ModulLage
  /** ISO-Zeit der letzten Lesestelle, für die Reihenfolge ohne Termin */
  zuletzt: string | null
}

/** Gelesene Seiten im Plan: alles vor der aktuellen Seite des jeweiligen PDFs */
export function gelesenImPlan(plan: PlanAbschnitt[], stand: Lesestand): number {
  let n = 0
  for (const a of plan) {
    const s = stand[a.anhang]?.seite ?? 0
    n += Math.max(0, Math.min(a.bis, s - 1) - a.von + 1)
  }
  return n
}

export function modulStand(p: {
  modul: Pick<Modul, 'id' | 'titel' | 'termin' | 'stundenProWoche'>
  plan: PlanAbschnitt[]
  stand: Lesestand
  heute: string
  zuletzt?: string | null
}): ModulStand {
  const { modul: m, plan, stand, heute } = p
  const rest = planRestMinuten(plan, stand)
  const seiten = seitenGesamt(plan)
  const z = m.termin ? zeitplan({ restMinuten: rest, heute, termin: m.termin, stundenProWoche: m.stundenProWoche }) : null
  let lage: ModulLage
  if (m.termin && m.termin < heute) lage = 'vorbei'
  else if (seiten > 0 && rest === 0) lage = 'fertig'
  else if (!z) lage = 'ohne'
  else if (z.reicht === false || (z.noetigJeWoche === null && rest > 0)) lage = 'hinten'
  else lage = 'plan'
  return {
    id: m.id,
    titel: m.titel,
    naechstes: aktuellePakete(plan, stand, null, 1)[0] ?? null,
    gelesen: gelesenImPlan(plan, stand),
    seiten,
    restMinuten: rest,
    termin: m.termin,
    zeitplan: z,
    lage,
    zuletzt: p.zuletzt ?? null
  }
}

const RANG: Record<ModulLage, number> = { hinten: 0, plan: 1, ohne: 2, fertig: 3, vorbei: 4 }

/** Reihenfolge der Übersicht: wer hinten liegt, dann nächster Termin, dann zuletzt gelesen, Fertiges und Vergangenes unten */
export function ordneUebersicht(liste: ModulStand[]): ModulStand[] {
  return [...liste].sort((a, b) => {
    if (RANG[a.lage] !== RANG[b.lage]) return RANG[a.lage] - RANG[b.lage]
    if (a.termin && b.termin && a.termin !== b.termin) return a.termin < b.termin ? -1 : 1
    if ((a.zuletzt ?? '') !== (b.zuletzt ?? '')) return (b.zuletzt ?? '').localeCompare(a.zuletzt ?? '')
    return a.titel.localeCompare(b.titel, 'de')
  })
}

/** Montag der Woche zu einem Tag (JJJJ-MM-TT), Wochen nach ISO 8601 */
export function wochenAnfang(heute: string): string {
  const d = new Date(`${heute}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Gemessene Lernzeit in ms ab `abMs` (Beginn des Abschnitts zählt), optional nur für ein Modul */
export function zeitSeit(abschnitte: LernAbschnitt[], abMs: number, m?: Pick<Modul, 'id' | 'quellen'>): number {
  return abschnitte.filter((a) => Date.parse(a.am) >= abMs && (!m || gehoertZu(a, m))).reduce((s, a) => s + dauer(a), 0)
}

/** Eingeplante Stunden je Woche: Module mit eigener Angabe, die noch laufen (nicht fertig, Termin nicht vorbei) */
export function geplantJeWoche(module: Pick<Modul, 'stundenProWoche' | 'abgeschlossen' | 'termin'>[], heute: string): number {
  return module.filter((m) => !m.abgeschlossen && m.stundenProWoche && !(m.termin && m.termin < heute)).reduce((s, m) => s + m.stundenProWoche!, 0)
}
