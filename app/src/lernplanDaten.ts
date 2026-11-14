// Was Modulseite, Sammeln und der Hinweis „Übung?“ zum Lernplan brauchen: Plan, Tempo, Umfang, gemessene Zeit.
// Gerechnet wird rein in `kern` (lernplan.ts, lernzeit.ts); hier nur Daten zusammentragen und Seitenzahlen laden.
import { useEffect, useMemo, useState } from 'react'
import {
  START_MINUTEN_JE_SEITE,
  alleLernzeiten,
  gehoertZu,
  inhaltVon,
  lesestand,
  liesStundenJeEcts,
  pfade,
  rechnePlan,
  tempo,
  umfangStunden,
  zeitIn,
  type Bestand,
  type Eintrag,
  type Lesestand,
  type Modul,
  type PlanAbschnitt,
  type Tempo
} from '@rl/kern'
import { seitenzahl, useDaten, type Speicher } from '@rl/oberflaeche'
import { pomodoroEinstellungen } from './pomodoroStand'

const seitenCache = new Map<string, number>()

/** Seitenzahlen der PDFs (pdf.js), einmal je Datei und Sitzung geladen */
export function useSeitenzahlen(quellen: Eintrag[]): Record<string, number> {
  const { speicher } = useDaten()
  const dateien = quellen.map((q) => String(q.felder.datei ?? '')).filter(Boolean)
  const [, neu] = useState(0)
  const schluessel = dateien.join('|')
  useEffect(() => {
    let aus = false
    for (const d of schluessel ? schluessel.split('|') : []) {
      if (seitenCache.has(d)) continue
      void ladeSeitenzahl(speicher, d).then(() => !aus && neu((n) => n + 1))
    }
    return () => {
      aus = true
    }
  }, [speicher, schluessel])
  const out: Record<string, number> = {}
  for (const q of quellen) out[q.id] = seitenCache.get(String(q.felder.datei ?? '')) ?? 0
  return out
}

async function ladeSeitenzahl(speicher: Speicher, datei: string) {
  seitenCache.set(datei, await seitenzahl(speicher, datei).catch(() => 0))
}

export interface ModulPlan {
  plan: PlanAbschnitt[]
  stand: Lesestand
  /** Minuten je Seite, mit denen gerechnet wird */
  minutenJeSeite: number
  /** eigenes Tempo, wenn genug gemessen ist */
  tempo: Tempo | null
  /** gemessene Lernzeit am Modul in ms */
  zeit: number
  /** Umfang in Stunden (ECTS oder eigene Stunden) */
  umfang: number | null
  stundenJeEcts: number
}

/** Das eigene Tempo: erst aus diesem Modul, sonst aus allem Gelesenen, sonst der Startwert */
export function modulTempo(b: Bestand, m: Pick<Modul, 'id' | 'quellen'>): Tempo | null {
  const alle = alleLernzeiten(b)
  return tempo(alle.filter((a) => gehoertZu(a, m))) ?? tempo(alle)
}

export function useModulPlan(m: Modul, quellen: Eintrag[]): ModulPlan {
  const { bestand } = useDaten()
  const seiten = useSeitenzahlen(quellen)
  const paketMinuten = pomodoroEinstellungen().lernen
  const seitenSchluessel = quellen.map((q) => seiten[q.id]).join(',')
  return useMemo(() => {
    const t = modulTempo(bestand, m)
    const minutenJeSeite = t?.minutenJeSeite ?? START_MINUTEN_JE_SEITE
    const teile = quellen.map((q) => ({ anhang: q.id, titel: q.titel, seiten: seiten[q.id] ?? 0, kapitel: inhaltVon(bestand, q.id)?.kapitel ?? [] }))
    const stundenJeEcts = liesStundenJeEcts(bestand.texte.get(pfade.lernzeitEinstellung()))
    return {
      plan: rechnePlan({ teile, minutenJeSeite, paketMinuten, schwer: m.schwer }),
      stand: lesestand(bestand),
      minutenJeSeite,
      tempo: t,
      zeit: zeitIn(alleLernzeiten(bestand), m),
      umfang: umfangStunden(m, stundenJeEcts),
      stundenJeEcts
    }
  }, [bestand, m.id, paketMinuten, seitenSchluessel])
}

/** „S. 7–11“ */
export const seitenText = (von: number, bis: number) => (von === bis ? `S. ${von}` : `S. ${von}–${bis}`)

/** „19.12.“ aus JJJJ-MM-TT */
export const tagKurz = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`
