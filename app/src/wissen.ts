// Daten der Lern-App: Karten anlegen, Lernstand aus dem Protokoll berechnen (FSRS), Spuren finden.
import { dateChrono, defineScheduler, Rating, type Grade } from 'ts-fsrs'
import {
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware
} from 'ts-fsrs/middlewares'
import { FSRS6Model, migrateFSRS6Parameters } from 'ts-fsrs/models/fsrs-6'
import {
  findeLinks,
  lernPdfs,
  merkeStelle,
  type Lernziel,
  type Modul,
  liesAbrufe,
  archiviere,
  benenne,
  liesMarken,
  mitVerweis,
  liesProtokoll,
  neuesDokument,
  pfade,
  protokollZeile,
  setzeFeld,
  setzeMarke,
  stellenLink,
  zerlege,
  zusammen,
  tag,
  ulid,
  zeitstempel,
  kurzId,
  type Bereich,
  type Bestand,
  type Eintrag,
  type Note,
  type Wert
} from '@rl/kern'
import { geraet, type Speicher } from '@rl/oberflaeche'

export const WISSEN = ['erklaerung', 'gleichung', 'thema', 'frage', 'uebung', 'notiz']

export const TYPNAME: Record<string, string> = {
  erklaerung: 'Erklärung',
  gleichung: 'Gleichung',
  thema: 'Thema',
  frage: 'Lernkarte',
  uebung: 'Übung',
  notiz: 'Notiz'
}

/** Alles Wissen, zuletzt geänderte zuerst */
export function alleEintraege(b: Bestand, typ?: string): Eintrag[] {
  const liste = typ ? b.nachTyp(typ) : b.nachTyp(...WISSEN)
  const zeit = (e: Eintrag) => String(e.felder.geaendert ?? e.felder.erstellt ?? '')
  return [...liste].sort((x, y) => zeit(y).localeCompare(zeit(x)) || x.titel.localeCompare(y.titel, 'de'))
}

/** Wissen wird nie gelöscht, nur aktualisiert: Titel und Text ersetzen, der Rest des Kopfs bleibt */
export function aendereEintrag(speicher: Speicher, e: Eintrag, neu: { titel?: string; rumpf?: string }) {
  return aendere(
    speicher,
    e.pfad,
    (t) => {
      let out = neu.rumpf === undefined ? t : zusammen({ kopf: zerlege(t).kopf, rumpf: neu.rumpf })
      if (neu.titel !== undefined && neu.titel.trim()) out = setzeFeld(out, 'titel', neu.titel.trim())
      return out
    },
    () => ''
  )
}

/** Thema oder Modul einer Notiz setzen (null nimmt es heraus) */
export function setzeThema(speicher: Speicher, e: Eintrag, thema: string | null) {
  return aendere(speicher, e.pfad, (t) => setzeFeld(t, 'thema', thema ? `[[${thema}]]` : undefined), () => '')
}

export function quellenPdfs(b: Bestand): Eintrag[] {
  return lernPdfs(b)
}

// ---------- Mitschriften (eine `notiz` mit dem Modul als Thema) ----------

/** Neue, leere Mitschrift zu einem Modul; der Titel ist das Datum, ändern geht jederzeit */
export async function neueMitschrift(speicher: Speicher, modulId: string): Promise<string> {
  const id = ulid()
  const jetzt = zeitstempel()
  const [j, m, d] = tag().split('-')
  await speicher.schreibe(
    pfade.karte(id),
    neuesDokument([
      ['id', id],
      ['typ', 'notiz'],
      ['erstellt', jetzt],
      ['geaendert', jetzt],
      ['titel', `Mitschrift ${d}.${m}.${j}`],
      ['thema', `[[${modulId}]]`]
    ])
  )
  return id
}

/** Lernkarte zu einer Stelle der Mitschrift: eigene Datei, zeigt mit `stelle` auf den Absatz (Blockkennung) */
export async function karteAusMitschrift(speicher: Speicher, p: { mitschrift: Eintrag; anker: string; frage: string; antwort: string }): Promise<string> {
  const id = ulid()
  const jetzt = zeitstempel()
  const kopf: [string, Wert][] = [
    ['id', id],
    ['typ', 'frage'],
    ['erstellt', jetzt],
    ['geaendert', jetzt],
    ['titel', p.frage],
    ['stelle', `[[${p.mitschrift.id}#^${p.anker}]]`]
  ]
  const modul = p.mitschrift.felder.thema
  if (typeof modul === 'string') kopf.push(['thema', modul])
  // Mehrzeilige Antworten bleiben zusammen: keine Leerzeile darin, sonst endet der Abrufblock
  const antwort = p.antwort.split('\n').filter((z) => z.trim()).join('\n')
  await speicher.schreibe(pfade.karte(id), neuesDokument(kopf, `?? ${p.frage}\n:: ${antwort}\n`))
  return id
}

// ---------- Module (ein Buch ist ein Modul mit einem PDF) ----------

export async function neuesModul(speicher: Speicher, p: { titel: string; ziel?: string; quellen: string[]; favorit?: boolean }): Promise<string> {
  const id = ulid()
  const jetzt = zeitstempel()
  const kopf: [string, Wert][] = [
    ['id', id],
    ['typ', 'modul'],
    ['erstellt', jetzt],
    ['geaendert', jetzt],
    ['titel', p.titel],
    ['quellen', p.quellen.map((q) => `[[${q}]]`)]
  ]
  if (p.ziel?.trim()) kopf.push(['ziel', p.ziel.trim()])
  if (p.favorit) kopf.push(['favorit', true])
  await speicher.schreibe(pfade.modul(id), neuesDokument(kopf))
  return id
}

export function setzeModulFeld(speicher: Speicher, m: Modul, feld: string, wert: Wert | undefined) {
  return aendere(speicher, m.pfad, (t) => setzeFeld(t, feld, wert), () => '')
}

export function setzeQuellen(speicher: Speicher, m: Modul, quellen: string[]) {
  return setzeModulFeld(speicher, m, 'quellen', quellen.map((q) => `[[${q}]]`))
}

/** Stern: steht im Modul selbst, damit er auf allen Geräten gilt. Ein loses PDF wird dabei zum Buch (Modul mit einem PDF). */
export async function schalteFavorit(speicher: Speicher, z: Lernziel) {
  if (z.modul) return setzeModulFeld(speicher, z.modul, 'favorit', z.favorit ? undefined : true)
  await neuesModul(speicher, { titel: z.titel, quellen: z.quellen.map((q) => q.id), favorit: true })
}

/** Merkt sich auf diesem Gerät, wo gerade gelesen wird (Grundlage für „Zuletzt bearbeitet“) */
export function merkeLesestelle(speicher: Speicher, anhang: string, seite: number) {
  return speicher.aendere(pfade.stand(geraet()), (alt) => merkeStelle(alt, anhang, seite, new Date().toISOString()))
}

async function aendere(speicher: Speicher, pfad: string, f: (t: string) => string, neu: () => string) {
  await speicher.aendere(pfad, (alt) => setzeFeld(f(alt || neu()), 'geaendert', zeitstempel()))
}

/** Stelle im Skript markieren und daraus eine Karte machen */
export async function karteAusStelle(
  speicher: Speicher,
  p: { quelle: Eintrag; seite: number; bereich: Bereich; art: 'wissen' | 'frage' | 'link' | 'nur'; titel: string; ziel?: Eintrag; farbe: string | null; ki?: string; markeId?: string; name?: string }
): Promise<string> {
  // „nur“: nur der Baustein, ohne Karte (Vertrag Lernen 1.8, 5.4); die Markierung kann ins Notizbuch gehen.
  // `name`: Name und Schlagworte des Bausteins, wie getippt („Potenzregel #integral“)
  const markeId = p.markeId ?? kurzId()
  const ausschnitt = stellenLink(p.quelle.id, p.seite, markeId, `${p.quelle.titel}, S. ${p.seite}`)
  const jetzt = zeitstempel()
  let karteId = p.ziel?.id ?? ''
  let anzeige = p.ziel?.titel ?? p.titel
  if (p.art === 'wissen' || p.art === 'frage') {
    karteId = ulid()
    const kopf: [string, Wert][] = [
      ['id', karteId],
      ['typ', p.art === 'wissen' ? 'erklaerung' : 'frage'],
      ['erstellt', jetzt],
      ['geaendert', jetzt],
      ['titel', p.titel],
      ['quelle', `[[${p.quelle.id}]]`]
    ]
    // Eine Erklärung der KI steht eingeklappt darunter, getrennt vom Text in eigenen Worten (Vertrag 5.5)
    const rumpf = p.art === 'wissen' ? `${ausschnitt}\n\nIn eigenen Worten: \n${p.ki ? `\n${p.ki}\n` : ''}` : `?? ${p.titel}\n:: ${ausschnitt}\n`
    await speicher.schreibe(pfade.karte(karteId), neuesDokument(kopf, rumpf))
    anzeige = p.titel
  }
  // Die Markierung verweist auf die Karte, damit „Nutzen“ die Spur zurück ins Skript zeigt
  await aendere(
    speicher,
    pfade.marken('lernen', p.quelle.id),
    (t) => setzeMarke(t, { id: markeId, seite: p.seite, text: markenText(p.name ?? '', karteId, anzeige), bereich: p.bereich, datum: tag(), farbe: p.farbe }),
    () =>
      neuesDokument([
        ['id', ulid()],
        ['typ', 'markierungen'],
        ['erstellt', jetzt],
        ['geaendert', jetzt],
        ['titel', `Stellen in ${p.quelle.titel}`],
        ['anhang', `[[${p.quelle.id}]]`]
      ])
  )
  return karteId
}

/** Text der Markierung: Name und Schlagworte des Bausteins, dahinter der Verweis auf die Karte, falls es eine gibt */
export function markenText(name: string, karteId: string, anzeige: string): string {
  const baustein = benenne('', name)
  return karteId ? mitVerweis(baustein, karteId, anzeige) : baustein
}

/** Baustein benennen: nur Name und Schlagworte ändern sich, Verweise und Weggelegt bleiben (Vertrag Lernen 1.8) */
export function benenneBaustein(speicher: Speicher, anhang: string, markeId: string, eingabe: string) {
  return aendereMarke(speicher, anhang, markeId, (text) => benenne(text, eingabe))
}

/** Baustein weglegen oder zurückholen (`#archiv`); gelöscht wird nichts */
export function legeBausteinWeg(speicher: Speicher, anhang: string, markeId: string, weg: boolean) {
  return aendereMarke(speicher, anhang, markeId, (text) => archiviere(text, weg))
}

function aendereMarke(speicher: Speicher, anhang: string, markeId: string, neu: (text: string) => string) {
  return speicher.aendere(pfade.marken('lernen', anhang), (t) => {
    const m = liesMarken(t).find((x) => x.id === markeId)
    if (!m) return t
    const text = neu(m.text)
    return text === m.text ? t : setzeMarke(t, { ...m, text })
  })
}

/**
 * Schreibfehler in der Frage einer gerade angelegten Lernkarte korrigieren. Nur wenn die Frage noch genau so
 * dasteht, wie sie angelegt wurde; hat Nils sie inzwischen geändert, gewinnt seine Fassung.
 */
export function korrigiereFrage(speicher: Speicher, karteId: string, alt: string, neu: string) {
  return speicher.aendere(pfade.karte(karteId), (t) => {
    const { kopf, rumpf } = zerlege(t)
    const zeilen = rumpf.split('\n')
    const i = zeilen.indexOf(`?? ${alt}`)
    if (i < 0) return t
    zeilen[i] = `?? ${neu}`
    let out = zusammen({ kopf, rumpf: zeilen.join('\n') })
    if (kopf && /^titel: /m.test(kopf)) out = setzeFeld(out, 'titel', neu)
    return setzeFeld(out, 'geaendert', zeitstempel())
  })
}

// ---------- Lernstand (FSRS aus dem Protokoll aller Geräte) ----------

// Modell FSRS-6 mit den Einstellungen, die bis ts-fsrs 5 Standard waren (Leitfaden „Migrating to v6“): Middlewares in der
// Reihenfolge des Leitfadens, ohne Zufall, damit alle Geräte aus demselben Protokoll dieselben Termine berechnen.
// FSRS-7 wäre ein eigener Schritt; der Lernstand steht nirgends, er wird bei jedem Wechsel neu aus dem Protokoll gerechnet.
const planer = defineScheduler({ model: FSRS6Model, chrono: dateChrono })
  .use(
    schedulerDesiredRetentionMiddleware,
    schedulerFuzzingMiddleware,
    schedulerStatsMiddleware,
    schedulerScheduledDaysMiddleware,
    schedulerLearningStepsMiddleware,
    schedulerMaximumIntervalMiddleware,
    schedulerMonotonicIntervalMiddleware
  )
  .create({
    config: {
      weights: migrateFSRS6Parameters(),
      fractionalDays: false,
      enableShortTerm: true,
      desiredRetention: 0.9,
      learningSteps: ['1m', '10m'],
      relearningSteps: ['10m'],
      numRelearningSteps: 1,
      enableFuzz: false,
      maximumInterval: 36500,
      clearStatsOnForget: false
    }
  })
export type Karte = ReturnType<typeof planer.newCard>
const NOTE: Record<Note, Grade> = { nochmal: Rating.Again, schwer: Rating.Hard, gut: Rating.Good, leicht: Rating.Easy }

export interface Lernstand {
  karte: Karte
  zuletzt: string | null
  anzahl: number
}

export function lernstaende(b: Bestand): Map<string, Lernstand> {
  const alle = [...b.texte.entries()].filter(([p]) => p.startsWith('reviews/') && p.endsWith('.jsonl')).flatMap(([, t]) => liesProtokoll(t))
  alle.sort((x, y) => x.am.localeCompare(y.am))
  const out = new Map<string, Lernstand>()
  for (const w of alle) {
    const alt = out.get(w.karte) ?? { karte: planer.newCard({ now: new Date(w.am), cardId: w.karte }), zuletzt: null, anzahl: 0 }
    const r = planer.review({ card: alt.karte, now: new Date(w.am), grade: NOTE[w.note] ?? Rating.Good })
    out.set(w.karte, { karte: r.card, zuletzt: w.am, anzahl: alt.anzahl + 1 })
  }
  return out
}

/** Abstand bis zur nächsten Wiederholung in Worten: „in 10 Min.“, „in 1 Tag“, „in 3 Monaten“ */
export function abstandText(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `in ${min} Min.`
  const std = Math.round(min / 60)
  if (std < 24) return `in ${std} Std.`
  const tage = Math.round(std / 24)
  if (tage < 31) return `in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`
  const monate = Math.round(tage / 30.4)
  if (monate < 12) return `in ${monate} ${monate === 1 ? 'Monat' : 'Monaten'}`
  const jahre = Math.round(tage / 365)
  return `in ${jahre} ${jahre === 1 ? 'Jahr' : 'Jahren'}`
}

/** Wann die Karte je Bewertung wiederkommt (FSRS-Vorschau, wie unter den Knöpfen bei Anki üblich) */
export function naechsteAbstaende(b: Bestand, karteId: string, jetzt = new Date()): Record<Note, string> {
  const st = lernstaende(b).get(karteId)
  const karte = st ? st.karte : planer.newCard({ now: jetzt, cardId: karteId })
  const termin = new Map<Grade, Date>()
  for (const v of planer.preview({ card: karte, now: jetzt })) termin.set(v.grade, v.card.dueAt)
  const t = (n: Note) => abstandText(termin.get(NOTE[n])!.getTime() - jetzt.getTime())
  return { nochmal: t('nochmal'), schwer: t('schwer'), gut: t('gut'), leicht: t('leicht') }
}

export interface Lernkarte {
  e: Eintrag
  frage: string
  antwort: string
}

export function lernkarten(b: Bestand): Lernkarte[] {
  const out: Lernkarte[] = []
  for (const e of b.nachTyp(...WISSEN)) {
    const a = liesAbrufe(e.rumpf)[0]
    if (a) out.push({ e, frage: a.frage, antwort: a.antwort })
  }
  return out
}

/** Heute fällig: zuerst überfällige, dann bis zu `neu` noch nie geübte Karten */
export function faellige(b: Bestand, neu = 10): Lernkarte[] {
  const st = lernstaende(b)
  const jetzt = Date.now()
  const karten = lernkarten(b)
  const alt = karten.filter((k) => st.has(k.e.id) && st.get(k.e.id)!.karte.dueAt.getTime() <= jetzt)
  alt.sort((x, y) => st.get(x.e.id)!.karte.dueAt.getTime() - st.get(y.e.id)!.karte.dueAt.getTime())
  const frisch = karten.filter((k) => !st.has(k.e.id)).slice(0, neu)
  return [...alt, ...frisch]
}

export async function bewerte(speicher: Speicher, karte: string, note: Note, sicher?: string) {
  const jetzt = new Date()
  const pfad = pfade.reviews(tag(jetzt).slice(0, 7), geraet())
  await speicher.aendere(pfad, (alt) => alt + protokollZeile({ karte, am: jetzt.toISOString(), note, sicher }))
}

// ---------- Nutzen: Spuren und Verknüpfungen ----------

export function spuren(b: Bestand, karteId: string) {
  const out: { quelle: Eintrag; seite: number; markeId: string; datum: string; farbe: string | null }[] = []
  for (const [pfad, text] of b.texte) {
    if (!pfad.startsWith('lernen/markierungen/')) continue
    const quelle = b.dokumente.get(pfad.split('/').pop()!.replace(/\.md$/, ''))
    if (!quelle) continue
    for (const m of liesMarken(text)) if (findeLinks(m.text).some((l) => l.ziel === karteId)) out.push({ quelle, seite: m.seite, markeId: m.id, datum: m.datum, farbe: m.farbe })
  }
  return out
}

export function verknuepft(b: Bestand, e: Eintrag) {
  const raus = findeLinks(e.rumpf)
    .filter((l) => !l.einbettung && b.dokumente.has(l.ziel))
    .map((l) => ({ e: b.dokumente.get(l.ziel)!, wie: 'verweist auf' }))
  for (const f of ['thema', 'quelle']) {
    const z = /^\[\[([^\]|#]+)/.exec(String(e.felder[f] ?? ''))?.[1]
    if (z && b.dokumente.has(z) && [...WISSEN, 'modul'].includes(b.dokumente.get(z)!.typ)) raus.push({ e: b.dokumente.get(z)!, wie: f === 'thema' ? 'gehört zu' : 'aus' })
  }
  const rein = b.rueckverweise(e.id).filter((x) => WISSEN.includes(x.typ)).map((x) => ({ e: x, wie: x.typ === 'frage' ? 'Lernkarte' : 'nutzt das' }))
  for (const x of b.nachTyp(...WISSEN)) if (x.id !== e.id && String(x.felder.thema ?? '').includes(e.id) && !rein.some((r) => r.e.id === x.id)) rein.push({ e: x, wie: x.typ === 'frage' ? 'Lernkarte' : 'gehört dazu' })
  const gesehen = new Set<string>()
  return [...raus, ...rein].filter((x) => !gesehen.has(x.e.id) && gesehen.add(x.e.id))
}

export function suche(b: Bestand, q: string): Eintrag[] {
  const w = q.toLowerCase().trim()
  if (!w) return []
  const treffer = b.nachTyp(...WISSEN).map((e) => {
    const titel = e.titel.toLowerCase()
    const aliase = Array.isArray(e.felder.aliase) ? e.felder.aliase.map((a) => String(a).toLowerCase()) : []
    const wert = titel === w || aliase.includes(w) ? 3 : titel.includes(w) ? 2 : aliase.some((a) => a.includes(w)) ? 1.5 : e.rumpf.toLowerCase().includes(w) ? 1 : 0
    return { e, wert: wert + (e.typ === 'frage' ? -0.5 : 0) }
  })
  return treffer.filter((t) => t.wert > 0).sort((a, c) => c.wert - a.wert).map((t) => t.e)
}
