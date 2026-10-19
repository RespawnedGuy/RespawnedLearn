// Daten der Lern-App: Karten anlegen, Lernstand aus dem Protokoll berechnen (FSRS), Spuren finden.
import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import {
  findeLinks,
  liesAbrufe,
  liesMarken,
  liesProtokoll,
  neuesDokument,
  pfade,
  protokollZeile,
  setzeFeld,
  setzeMarke,
  stellenLink,
  tag,
  ulid,
  zeitstempel,
  kurzId,
  type Bereich,
  type Bestand,
  type Eintrag,
  type Note,
  type Wert
} from '@rvx/kern'
import { geraet, type Speicher } from '@rvx/oberflaeche'

export const WISSEN = ['erklaerung', 'gleichung', 'thema', 'frage', 'uebung', 'notiz']

export function quellenPdfs(b: Bestand): Eintrag[] {
  // Alles, was kein Plan eines Projekts ist: Skripte, Bücher, Datenblätter
  return b.anhaenge().filter((a) => /\.pdf$/i.test(String(a.felder.datei ?? '')) && a.felder.art !== 'plan' && !a.felder.projekt)
}

async function aendere(speicher: Speicher, pfad: string, f: (t: string) => string, neu: () => string) {
  await speicher.aendere(pfad, (alt) => setzeFeld(f(alt || neu()), 'geaendert', zeitstempel()))
}

/** Stelle im Skript markieren und daraus eine Karte machen */
export async function karteAusStelle(
  speicher: Speicher,
  p: { quelle: Eintrag; seite: number; bereich: Bereich; art: 'wissen' | 'frage' | 'link'; titel: string; ziel?: Eintrag; farbe: string | null }
): Promise<string> {
  const markeId = kurzId()
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
    const rumpf = p.art === 'wissen' ? `${ausschnitt}\n\nIn eigenen Worten: \n` : `?? ${p.titel}\n:: ${ausschnitt}\n`
    await speicher.schreibe(pfade.karte(karteId), neuesDokument(kopf, rumpf))
    anzeige = p.titel
  }
  // Die Markierung verweist auf die Karte, damit „Nutzen“ die Spur zurück ins Skript zeigt
  await aendere(
    speicher,
    pfade.marken('lernen', p.quelle.id),
    (t) => setzeMarke(t, { id: markeId, seite: p.seite, text: karteId ? `[[${karteId}|${anzeige.replace(/[\]|]/g, '')}]]` : anzeige, bereich: p.bereich, datum: tag(), farbe: p.farbe }),
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

// ---------- Lernstand (FSRS aus dem Protokoll aller Geräte) ----------

const planer = fsrs({ enable_fuzz: false })
const NOTE: Record<Note, Grade> = { nochmal: Rating.Again, schwer: Rating.Hard, gut: Rating.Good, leicht: Rating.Easy }

export interface Lernstand {
  karte: Card
  zuletzt: string | null
  anzahl: number
}

export function lernstaende(b: Bestand): Map<string, Lernstand> {
  const alle = [...b.texte.entries()].filter(([p]) => p.startsWith('reviews/') && p.endsWith('.jsonl')).flatMap(([, t]) => liesProtokoll(t))
  alle.sort((x, y) => x.am.localeCompare(y.am))
  const out = new Map<string, Lernstand>()
  for (const w of alle) {
    const alt = out.get(w.karte) ?? { karte: createEmptyCard(new Date(w.am)), zuletzt: null, anzahl: 0 }
    const r = planer.next(alt.karte, new Date(w.am), NOTE[w.note] ?? Rating.Good)
    out.set(w.karte, { karte: r.card, zuletzt: w.am, anzahl: alt.anzahl + 1 })
  }
  return out
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
  const alt = karten.filter((k) => st.has(k.e.id) && st.get(k.e.id)!.karte.due.getTime() <= jetzt)
  alt.sort((x, y) => st.get(x.e.id)!.karte.due.getTime() - st.get(y.e.id)!.karte.due.getTime())
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
    if (z && b.dokumente.has(z) && WISSEN.includes(b.dokumente.get(z)!.typ)) raus.push({ e: b.dokumente.get(z)!, wie: f === 'thema' ? 'gehört zu' : 'aus' })
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
