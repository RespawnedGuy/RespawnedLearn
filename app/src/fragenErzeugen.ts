// Kapitelfragen und Vorfragen auf Knopfdruck erzeugen (Vertrag 5.7, 5.8). Früher lief das auf dem Server von
// RespawnedNotes VX; jetzt liest die App den Text mit pdf.js und fragt die eingerichtete KI. Nach jedem Schritt wird
// geschrieben, über `aendere` auf dem neuesten Stand der Datei: Bricht etwas ab oder war ein anderes Gerät
// schneller, geht es beim nächsten offenen Schritt weiter, ohne Erreichtes zu verlieren.
import {
  abschliessen,
  aktuelleLektuere,
  Bestand,
  fragenDateiText,
  genugText,
  inhaltVon,
  kapitelAuftrag,
  kapitelBereich,
  lesestand,
  liesFragenDatei,
  liesVorfragen,
  mitFehler,
  mitKapitelfragen,
  mitRechnen,
  mitStueck,
  naechsterSchritt,
  neueFragenDatei,
  neuVersuchen,
  pfade,
  rechnenAuftrag,
  SCHEMAS,
  seitenBlock,
  stueckAuftrag,
  vorfragenAuftrag,
  vorfragenDatei,
  vorfragenGleich,
  vorfragenSeiten,
  heute,
  VORFRAGEN_BUECHER,
  type FragenDatei,
  type KapitelAntwort,
  type PromptSchluessel,
  type RechnenAntwort,
  type Schema,
  type StueckAntwort,
  type Vorfragen,
  type VorfragenAntwort,
  type VorfragenTeil
} from '@rl/kern'

/** Was der Ablauf vom Datenordner braucht (der Speicher erfüllt das) */
export interface Ort {
  text(pfad: string): string | undefined
  alleTexte(): Map<string, string>
  aendere(pfad: string, f: (alt: string) => string): Promise<void>
}

/** PDF und KI, in Tests austauschbar */
export interface Werkzeug {
  seitenText(pfad: string, von: number, bis: number): Promise<{ seiten: number; texte: string[] }>
  seitenzahl(pfad: string): Promise<number>
  frage<T>(aufgabe: PromptSchluessel, a: { text: string; schema: Schema; name: string; aufwand?: 'mittel' | 'hoch'; signal?: AbortSignal }): Promise<T>
  modell(): Promise<string>
}

export interface Fortschritt {
  (text: string): void
}

const jetzt = () => new Date().toISOString()
const titelVon = (b: Bestand, anhang: string) => b.dokumente.get(anhang)?.titel || anhang
const pdfVon = (b: Bestand, anhang: string) => {
  const datei = String(b.dokumente.get(anhang)?.felder.datei ?? '')
  return /\.pdf$/i.test(datei) ? datei : null
}

/** Bearbeitet ein Kapitel bis zum Ende oder bis zum ersten Fehler; liefert die Zahl neuer Fragen */
async function bearbeiteKapitel(ort: Ort, w: Werkzeug, a: { anhang: string; buch: string; pdf: string; kap: { titel: string; von: number; bis: number } }, melde: Fortschritt, signal?: AbortSignal): Promise<number> {
  const pfad = pfade.fragen(a.anhang, a.kap.von)
  const vorhanden = ort.text(pfad)
  if (vorhanden !== undefined && !liesFragenDatei(vorhanden)) return 0 // unlesbare Datei: nie darüber schreiben
  const modell = await w.modell()
  const vorher = liesFragenDatei(vorhanden)?.fragen.length ?? 0
  // Knopfdruck heißt: auch ein Kapitel, das nach drei Fehlversuchen ruht, darf es noch einmal versuchen
  if (vorhanden !== undefined) await ort.aendere(pfad, (alt) => fragenDateiText(neuVersuchen(liesFragenDatei(alt)!)))
  const lies = (): FragenDatei => liesFragenDatei(ort.text(pfad)) ?? neueFragenDatei(a.anhang, a.kap, modell, jetzt())
  /** Schritt eintragen, auf dem neuesten Stand der Datei */
  const schreibe = (f: (alt: FragenDatei) => FragenDatei) => ort.aendere(pfad, (alt) => fragenDateiText(f(liesFragenDatei(alt) ?? neueFragenDatei(a.anhang, a.kap, modell, jetzt()))))
  let kapitelGefragt = false
  try {
    for (let runde = 0; runde < 200; runde++) {
      signal?.throwIfAborted()
      const f = lies()
      // die Datei nennt das Kapitel `kapitel`, die Aufträge brauchen `titel` (in VX stand hier „undefined“)
      const kap = { titel: f.kapitel, von: f.von, bis: f.bis }
      const s = naechsterSchritt(f, { kapitelGefragt })
      if (s.art === 'nichts') break
      if (s.art === 'abschluss') {
        await schreibe((x) => abschliessen(x, jetzt()))
        break
      }
      if (s.art === 'stueck') {
        melde(`${a.buch}: Seiten ${s.von} bis ${s.bis} von ${f.bis}`)
        const { texte } = await w.seitenText(a.pdf, s.von, s.bis)
        const text = seitenBlock(s.von, texte)
        const r: StueckAntwort = genugText(text, s.bis - s.von + 1)
          ? await w.frage<StueckAntwort>('kapitel_stueck', { text: stueckAuftrag(a.buch, kap, s, text), schema: SCHEMAS.stueck, name: 'kapitelfragen', signal })
          : { kern: '', fragen: [] }
        await schreibe((x) => mitStueck(x, s, r, jetzt()))
      } else if (s.art === 'kapitel') {
        melde(`${a.buch}: Fragen zum ganzen Kapitel`)
        const r = await w.frage<KapitelAntwort>('kapitel_ganz', { text: kapitelAuftrag(a.buch, kap, s.kerne), schema: SCHEMAS.kapitel, name: 'kapitelfragen', signal })
        kapitelGefragt = true
        await schreibe((x) => mitKapitelfragen(x, r, jetzt()))
      } else {
        melde(`${a.buch}: Rechenaufgaben zu Seite ${s.von} bis ${s.bis}`)
        const { texte } = await w.seitenText(a.pdf, s.von, s.bis)
        const r = await w.frage<RechnenAntwort>('kapitel_rechnen', { text: rechnenAuftrag(a.buch, kap, s, seitenBlock(s.von, texte)), schema: SCHEMAS.rechnen, name: 'rechenaufgaben', aufwand: 'hoch', signal })
        await schreibe((x) => mitRechnen(x, s, r, jetzt()))
      }
    }
  } catch (e) {
    // abgebrochen zählt nicht als Fehlversuch
    if (!signal?.aborted) await schreibe((x) => mitFehler(x, String((e as Error)?.message ?? e), jetzt())).catch(() => undefined)
    throw e
  }
  return Math.max(0, (liesFragenDatei(ort.text(pfad))?.fragen.length ?? 0) - vorher)
}

export interface Ergebnis {
  neu: number
  kapitel: number
  hinweis?: string
}

/**
 * Fragen zu den Kapiteln, in denen gerade gelesen wird (Lesestand höchstens 14 Tage alt), jüngstes Buch zuerst.
 * Ein Fehler bei einem Buch hält die anderen nicht auf; der erste Fehler kommt am Ende als Ausnahme zurück.
 */
export async function erzeugeKapitelfragen(ort: Ort, w: Werkzeug, melde: Fortschritt = () => undefined, signal?: AbortSignal): Promise<Ergebnis> {
  const b = new Bestand(ort.alleTexte())
  let neu = 0
  let kapitel = 0
  let ersterFehler: unknown = null
  const ohneInhalt: string[] = []
  for (const l of aktuelleLektuere(lesestand(b), Date.now())) {
    const pdf = pdfVon(b, l.anhang)
    if (!pdf) continue
    const buch = titelVon(b, l.anhang)
    const inhalt = inhaltVon(b, l.anhang)
    if (!inhalt?.kapitel.length) {
      ohneInhalt.push(buch)
      continue
    }
    const kap = kapitelBereich(inhalt.kapitel, l.seite, await w.seitenzahl(pdf))
    if (!kap) continue
    kapitel++
    try {
      neu += await bearbeiteKapitel(ort, w, { anhang: l.anhang, buch, pdf, kap }, melde, signal)
    } catch (e) {
      if (signal?.aborted) throw e
      ersterFehler ??= e
    }
  }
  if (ersterFehler && !neu) throw ersterFehler
  const hinweis = !kapitel
    ? ohneInhalt.length
      ? `Zu ${ohneInhalt.join(', ')} gibt es kein Inhaltsverzeichnis; ohne Kapitel weiß die App nicht, wozu sie fragen soll.`
      : 'Gerade liest du kein Buch (oder der Lesestand ist älter als zwei Wochen).'
    : undefined
  return { neu, kapitel, hinweis }
}

/**
 * Vorfragen zu den nächsten Seiten der höchstens zwei zuletzt gelesenen Bücher. Ist seit den heutigen Vorfragen
 * nicht weitergelesen, kommen dieselben zurück; `neu` ersetzt sie.
 */
export async function erzeugeVorfragen(ort: Ort, w: Werkzeug, o: { neu?: boolean; signal?: AbortSignal } = {}): Promise<Vorfragen | { hinweis: string }> {
  const b = new Bestand(ort.alleTexte())
  const datum = heute()
  const pfad = pfade.vorfragen(datum)
  const alt = liesVorfragen(ort.text(pfad))
  const teile: VorfragenTeil[] = []
  for (const l of aktuelleLektuere(lesestand(b), Date.now())) {
    if (teile.length >= VORFRAGEN_BUECHER) break
    const pdf = pdfVon(b, l.anhang)
    if (!pdf) continue
    const bereich = vorfragenSeiten(l.seite, await w.seitenzahl(pdf))
    if (!bereich) continue
    const { seiten, texte } = await w.seitenText(pdf, bereich.ab, bereich.bis)
    const text = seitenBlock(bereich.ab, texte)
    if (!genugText(text, bereich.bis - bereich.ab + 1)) continue
    const inhalt = inhaltVon(b, l.anhang)
    const kap = inhalt?.kapitel.length ? kapitelBereich(inhalt.kapitel, bereich.ab, seiten) : null
    teile.push({ anhang: l.anhang, titel: titelVon(b, l.anhang), ...bereich, kapitel: kap?.titel ?? '', text })
  }
  if (!teile.length) return alt ?? { hinweis: 'Gerade liest du kein Buch mit Text (oder der Lesestand ist älter als zwei Wochen).' }
  if (alt && !o.neu && vorfragenGleich(alt, teile)) return alt
  const r = await w.frage<VorfragenAntwort>('vorfragen', { text: vorfragenAuftrag(teile), schema: SCHEMAS.vorfragen, name: 'vorfragen', signal: o.signal })
  const wert = vorfragenDatei(teile, r, await w.modell(), new Date())
  // Vorfragen eines Tages sind abgeleitet: die neuen ersetzen die alten (Vertrag 5.8)
  await ort.aendere(pfad, () => JSON.stringify(wert, null, 1) + '\n')
  return liesVorfragen(ort.text(pfad)) ?? { hinweis: 'Die Vorfragen ließen sich nicht speichern.' }
}
