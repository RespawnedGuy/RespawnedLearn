// Kapitelfragen und Vorfragen erzeugen (Vertrag 5.7, 5.8), der reine Teil: welches Kapitel, welche Stücke, was als
// Nächstes zu tun ist und wie ein Ergebnis in die Datei kommt. Die App liest den Text aus dem PDF, fragt die KI und
// schreibt nach jedem Schritt; bricht etwas ab, geht es beim nächsten offenen Schritt weiter. Übernommen aus
// RespawnedNotes VX (server/fragen.mjs, server/vorfragen.mjs).
//
// Didaktik: Abrufen in eigenen Worten statt Wiedererkennen (Roediger & Karpicke 2006; Adesope et al. 2017),
// Warum- und Wie-Fragen (elaborative Befragung, Dunlosky et al. 2013), offene sokratische Fragen (Paul & Elder),
// Rechenaufgaben mit gestuften Hilfen (Koedinger & Aleven 2007; Catrambone 1998), Vorfragen vor dem Lesen
// (Pretesting: Richland, Kornell & Kao 2009; Pan & Carpenter 2023).
import { inhaltVon, type Kapitel } from './inhalt'
import { lesestand, type Lesestand } from './module'
import { pfade } from './pfade'
import type { Bestand } from './bestand'
import type { Schritt } from './fragen'

export const STUECK_SEITEN = 5
export const MAX_KAPITEL_SEITEN = 40
/** älterer Lesestand zählt nicht als „liest gerade“ */
export const LESESTAND_TAGE = 14
export const VERSUCHE = 3
/** weniger Zeichen pro Seite: Bild, Scan oder Leerseite, das geht nicht an die KI */
export const MIN_ZEICHEN = 50
export const VORFRAGEN_SEITEN = 6
export const VORFRAGEN_BUECHER = 2

export interface KapitelBereich {
  titel: string
  von: number
  bis: number
}

/**
 * Das Kapitel, in dem eine Seite liegt, mit seinem Ende. Gelernt wird in der Einheit, die auch die Modulübersicht
 * zeigt: oberste Ebene, bei Büchern mit nur ein bis zwei Teilen eine Ebene tiefer; höchstens 40 Seiten.
 */
export function kapitelBereich(kapitel: Kapitel[], seite: number, seiten: number): KapitelBereich | null {
  const oben = kapitel.filter((k) => (k.ebene || 1) === 1)
  const tiefe = oben.length < 3 ? 2 : 1
  const liste = kapitel.filter((k) => (k.ebene || 1) <= tiefe).sort((a, b) => a.seite - b.seite)
  let k: Kapitel | null = null
  for (const x of liste) if (x.seite <= seite) k = x
  if (!k) return null
  const naechstes = liste.find((x) => x.seite > k.seite)
  const ende = naechstes ? naechstes.seite - 1 : seiten || k.seite + MAX_KAPITEL_SEITEN - 1
  return { titel: k.titel, von: k.seite, bis: Math.max(k.seite, Math.min(ende, k.seite + MAX_KAPITEL_SEITEN - 1)) }
}

/** Seitenbereiche der Stücke eines Kapitels */
export function stuecke(von: number, bis: number, groesse = STUECK_SEITEN): { von: number; bis: number }[] {
  const out: { von: number; bis: number }[] = []
  for (let a = von; a <= bis; a += groesse) out.push({ von: a, bis: Math.min(bis, a + groesse - 1) })
  return out
}

/** Bücher, in denen gerade gelesen wird: jüngstes zuerst, höchstens 14 Tage alt */
export function aktuelleLektuere(stand: Lesestand, jetzt: number): { anhang: string; seite: number; am: string }[] {
  return Object.entries(stand)
    .filter(([, s]) => jetzt - Date.parse(s.am) <= LESESTAND_TAGE * 86_400_000)
    .sort((a, b) => b[1].am.localeCompare(a[1].am))
    .map(([anhang, s]) => ({ anhang, seite: s.seite, am: s.am }))
}

/** Text der Seiten mit Marken, damit die KI Seiten angeben kann; `texte[0]` ist Seite `von` */
export function seitenBlock(von: number, texte: string[]): string {
  return texte.map((t, i) => `--- Seite ${von + i} ---\n${t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()}`).join('\n\n')
}

/** Zeichen ohne Seitenmarken und Leerraum */
export const textMenge = (block: string) => block.replace(/--- Seite \d+ ---/g, '').replace(/\s+/g, '').length

/** Genug Text, damit es sich lohnt, die KI zu fragen (Scans und Bildseiten nicht) */
export const genugText = (block: string, seiten: number) => textMenge(block) >= MIN_ZEICHEN * seiten

/**
 * Bücher, in denen gerade gelesen wird und deren aktuelles Kapitel noch keine fertigen Fragen hat. Danach richtet
 * sich, ob die App „Fragen erzeugen“ anbietet. Ohne Inhaltsverzeichnis gibt es kein Kapitel, also kein Angebot.
 */
export function kapitelOhneFragen(b: Bestand, jetzt: number): { anhang: string; kapitel: string }[] {
  const out: { anhang: string; kapitel: string }[] = []
  for (const l of aktuelleLektuere(lesestand(b), jetzt)) {
    const k = inhaltVon(b, l.anhang)?.kapitel
    const kap = k?.length ? kapitelBereich(k, l.seite, 0) : null
    if (!kap) continue
    const f = liesFragenDatei(b.texte.get(pfade.fragen(l.anhang, kap.von)))
    if (!f || f.status === 'laeuft' || (f.status === 'fehler' && !f.fragen.length) || naechsterSchritt(f).art !== 'nichts') out.push({ anhang: l.anhang, kapitel: kap.titel })
  }
  return out
}

// ---------- Aufträge (neben der Anweisung aus den Einstellungen) ----------

export function stueckAuftrag(buch: string, kap: KapitelBereich, st: { von: number; bis: number }, text: string): string {
  return `Buch: ${buch}
Kapitel: ${kap.titel} (PDF-Seiten ${kap.von} bis ${kap.bis})
Dieser Abschnitt: PDF-Seiten ${st.von} bis ${st.bis}

Erzeuge zu diesem Abschnitt bis zu 3 Fragen der Art "verstaendnis" und genau 1 Frage der Art "sokratisch" (falls der Abschnitt Lernstoff hat), dazu "kern".

<kapiteltext>
${text}
</kapiteltext>`
}

export function kapitelAuftrag(buch: string, kap: KapitelBereich, abschnitte: { von: number; bis: number; kern: string }[]): string {
  return `Buch: ${buch}
Kapitel: ${kap.titel} (PDF-Seiten ${kap.von} bis ${kap.bis})

Hier ist, worum es in den Abschnitten des Kapitels geht:
<kapiteltext>
${abschnitte.map((a) => `S. ${a.von}–${a.bis}: ${a.kern}`).join('\n')}
</kapiteltext>

Erzeuge 2 Fragen der Art "sokratisch" zum Kapitel als Ganzem: Zusammenhänge zwischen den Abschnitten, Übertragung auf neue Situationen, Grenzen der Modelle. "seite": ${kap.bis}.`
}

export function rechnenAuftrag(buch: string, kap: KapitelBereich, st: { von: number; bis: number }, text: string): string {
  return `Buch: ${buch}
Kapitel: ${kap.titel}
Dieser Abschnitt: PDF-Seiten ${st.von} bis ${st.bis}

Erzeuge zu diesem Abschnitt höchstens 2 Rechenaufgaben, nur wenn es hier etwas zu rechnen gibt.

<kapiteltext>
${text}
</kapiteltext>`
}

export interface VorfragenTeil {
  anhang: string
  titel: string
  ab: number
  bis: number
  kapitel: string
  text: string
}

export function vorfragenAuftrag(teile: VorfragenTeil[]): string {
  const n = teile.length > 1 ? '4 bis 6 Fragen, auf die Bücher verteilt' : '3 bis 5 Fragen'
  return `Erzeuge ${n}.

${teile
  .map(
    (t) => `Buch: ${t.titel} (Kennung ${t.anhang})${t.kapitel ? `, Kapitel ${t.kapitel}` : ''}, PDF-Seiten ${t.ab} bis ${t.bis}
<kapiteltext>
${t.text}
</kapiteltext>`
  )
  .join('\n\n')}`
}

// ---------- Antworten der KI (Form wie in kiSchemas) ----------

export interface StueckAntwort {
  kern: string
  fragen: { art: 'verstaendnis' | 'sokratisch'; frage: string; antwort: string; seite: number }[]
}
export interface KapitelAntwort {
  fragen: StueckAntwort['fragen']
}
export interface RechnenAntwort {
  aufgaben: { frage: string; ergebnis: string; seite: number; tipps: string[]; schritte: Schritt[]; wege: string }[]
}
export interface VorfragenAntwort {
  fragen: { anhang: string; frage: string; antwort: string; seite: number }[]
}

// ---------- Die Fragendatei eines Kapitels ----------

export interface FragenDatei {
  anhang: string
  kapitel: string
  von: number
  bis: number
  status: 'laeuft' | 'fertig' | 'kein_text' | 'fehler'
  modell: string
  erstellt: string
  geaendert?: string
  versuche?: number
  fehler?: string
  abschnitte: { von: number; bis: number; kern: string; rechnen?: boolean }[]
  fragen: { id: string; art: 'verstaendnis' | 'sokratisch' | 'rechnen'; frage: string; antwort: string; seite: number; tipps?: string[]; schritte?: Schritt[]; wege?: string }[]
  [weitere: string]: unknown
}

/** Datei lesen; null, wenn sie fehlt oder unlesbar ist (dann schreibt die App nicht darüber) */
export function liesFragenDatei(text: string | undefined): FragenDatei | null {
  if (!text?.trim()) return null
  try {
    const j = JSON.parse(text) as FragenDatei
    if (typeof j.anhang !== 'string' || typeof j.von !== 'number') return null
    return { ...j, abschnitte: Array.isArray(j.abschnitte) ? j.abschnitte : [], fragen: Array.isArray(j.fragen) ? j.fragen : [] }
  } catch {
    return null
  }
}

export const fragenDateiText = (f: FragenDatei) => JSON.stringify(f, null, 1) + '\n'

export function neueFragenDatei(anhang: string, kap: KapitelBereich, modell: string, jetzt: string): FragenDatei {
  return { anhang, kapitel: kap.titel, von: kap.von, bis: kap.bis, status: 'laeuft', modell, erstellt: jetzt, abschnitte: [], fragen: [] }
}

export type NaechsterSchritt =
  | { art: 'stueck'; von: number; bis: number }
  | { art: 'kapitel'; kerne: { von: number; bis: number; kern: string }[] }
  | { art: 'rechnen'; von: number; bis: number }
  | { art: 'abschluss' }
  | { art: 'nichts' }

/** Abschnitte mit Lernstoff, zu denen noch keine Rechenaufgaben gesucht wurden */
export const rechnenOffen = (f: FragenDatei) => f.abschnitte.filter((a) => a.kern && !a.rechnen)

/**
 * Was als Nächstes zu tun ist: erst alle Stücke, dann die Fragen zum ganzen Kapitel, dann Rechenaufgaben je
 * Abschnitt mit Lernstoff (auch in schon fertigen Kapiteln), dann abschließen.
 */
export function naechsterSchritt(f: FragenDatei, o: { kapitelGefragt?: boolean } = {}): NaechsterSchritt {
  if (f.status === 'kein_text' || (f.status === 'fehler' && (f.versuche ?? 0) >= VERSUCHE)) return { art: 'nichts' }
  for (const st of stuecke(f.von, f.bis)) if (!f.abschnitte.some((a) => a.von === st.von)) return { art: 'stueck', ...st }
  const kerne = f.abschnitte.filter((a) => a.kern)
  // kam auf die Frage nach dem ganzen Kapitel nichts zurück, fragt erst der nächste Durchgang wieder
  if (kerne.length && !o.kapitelGefragt && !f.fragen.some((q) => q.id.startsWith('kapitel-'))) return { art: 'kapitel', kerne }
  const r = rechnenOffen(f)[0]
  if (r) return { art: 'rechnen', von: r.von, bis: r.bis }
  return f.status === 'fertig' ? { art: 'nichts' } : { art: 'abschluss' }
}

const inSeiten = (seite: number, von: number, bis: number) => Math.min(bis, Math.max(von, Math.round(seite) || von))

/** Ergebnis eines Stücks eintragen; war das Stück inzwischen schon da (anderes Gerät), bleibt alles, wie es ist */
export function mitStueck(f: FragenDatei, st: { von: number; bis: number }, r: StueckAntwort, jetzt: string): FragenDatei {
  if (f.abschnitte.some((a) => a.von === st.von)) return f
  const fragen = [...f.fragen]
  for (const q of r.fragen) {
    const n = fragen.filter((x) => x.id.startsWith(`${st.von}-`) && !x.id.includes('-r')).length + 1
    fragen.push({ id: `${st.von}-${n}`, art: q.art, frage: q.frage.trim(), antwort: q.antwort.trim(), seite: inSeiten(q.seite, st.von, st.bis) })
  }
  return { ...f, abschnitte: [...f.abschnitte, { von: st.von, bis: st.bis, kern: r.kern.trim() }].sort((a, b) => a.von - b.von), fragen, geaendert: jetzt }
}

export function mitKapitelfragen(f: FragenDatei, r: KapitelAntwort, jetzt: string): FragenDatei {
  if (f.fragen.some((q) => q.id.startsWith('kapitel-'))) return f
  const neu = r.fragen.map((q, i) => ({ id: `kapitel-${i + 1}`, art: 'sokratisch' as const, frage: q.frage.trim(), antwort: q.antwort.trim(), seite: f.bis }))
  return neu.length ? { ...f, fragen: [...f.fragen, ...neu], geaendert: jetzt } : f
}

export function mitRechnen(f: FragenDatei, st: { von: number; bis: number }, r: RechnenAntwort, jetzt: string): FragenDatei {
  const a = f.abschnitte.find((x) => x.von === st.von)
  if (!a || a.rechnen) return f
  const neu = r.aufgaben.map((q, i) => ({
    id: `${st.von}-r${i + 1}`,
    art: 'rechnen' as const,
    frage: q.frage.trim(),
    antwort: q.ergebnis.trim(),
    seite: inSeiten(q.seite, st.von, st.bis),
    tipps: q.tipps.map((t) => t.trim()).filter(Boolean),
    schritte: q.schritte.map((x) => ({ ziel: x.ziel.trim(), rechnung: x.rechnung.trim(), ergebnis: x.ergebnis.trim() })),
    ...(q.wege.trim() ? { wege: q.wege.trim() } : {})
  }))
  return { ...f, abschnitte: f.abschnitte.map((x) => (x === a ? { ...x, rechnen: true } : x)), fragen: [...f.fragen, ...neu], geaendert: jetzt }
}

/** Alles erledigt: `kein_text`, wenn im ganzen Kapitel nichts Lesbares war, sonst `fertig` */
export function abschliessen(f: FragenDatei, jetzt: string): FragenDatei {
  const { fehler: _f, versuche: _v, ...rest } = f
  return { ...rest, status: f.abschnitte.some((a) => a.kern) || f.fragen.length ? 'fertig' : 'kein_text', geaendert: jetzt }
}

/** Fehlversuch merken; nach drei Versuchen bleibt das Kapitel auf `fehler`, bis jemand neu anstößt */
export function mitFehler(f: FragenDatei, meldung: string, jetzt: string): FragenDatei {
  const versuche = (f.versuche ?? 0) + 1
  return { ...f, versuche, status: versuche >= VERSUCHE ? 'fehler' : 'laeuft', fehler: meldung.slice(0, 400), geaendert: jetzt }
}

/** „Nochmal versuchen“ nach drei Fehlversuchen: Zähler zurück, Erreichtes bleibt */
export function neuVersuchen(f: FragenDatei): FragenDatei {
  if (f.status !== 'fehler') return f
  const { fehler: _f, ...rest } = f
  return { ...rest, status: 'laeuft', versuche: 0 }
}

// ---------- Vorfragen ----------

/** Datum in der Zeitzone des Geräts, damit „heute“ nicht um 1 oder 2 Uhr nachts wechselt */
export const heute = (jetzt = new Date()) => `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`

/** Seitenbereich der Vorfragen: ab der aktuellen Seite (oft erst angelesen) sechs Seiten, nicht über das Ende */
export function vorfragenSeiten(seite: number, seiten: number): { ab: number; bis: number } | null {
  const bis = Math.min(seiten || seite + VORFRAGEN_SEITEN - 1, seite + VORFRAGEN_SEITEN - 1)
  return seite > bis ? null : { ab: seite, bis }
}

/** Seitdem nicht weitergelesen: dieselben Bücher ab denselben Seiten */
export function vorfragenGleich(alt: { buecher?: { anhang: string; ab: number }[] } | null, teile: { anhang: string; ab: number }[]): boolean {
  return !!alt?.buecher && alt.buecher.length === teile.length && teile.every((t) => alt.buecher!.some((b) => b.anhang === t.anhang && b.ab === t.ab))
}

export function vorfragenDatei(teile: VorfragenTeil[], r: VorfragenAntwort, modell: string, jetzt: Date) {
  const zuBuch = new Map(teile.map((t) => [t.anhang, t]))
  const fragen = r.fragen.map((q, i) => {
    const t = zuBuch.get(q.anhang) ?? teile[0]
    return { id: String(i + 1), anhang: t.anhang, seite: inSeiten(q.seite, t.ab, t.bis), frage: q.frage.trim(), antwort: q.antwort.trim() }
  })
  return { datum: heute(jetzt), erstellt: jetzt.toISOString(), modell, buecher: teile.map(({ text: _t, ...b }) => b), fragen }
}
