// Ein Index über alle Textdateien, jederzeit neu aufbaubar (Vertrag 1.1). Rein funktional, damit die Tests
// ohne Browser laufen. Die Apps bauen ihn nach jeder Änderung neu; bei einigen tausend Dateien reicht das.
import { felder, linkZiel, zerlege, type Wert } from './frontmatter'
import { gliedere, blockText, berichtStellen, type BerichtStelle, type Gliederung, type Aufgabe, type Blockade, type ProjektBlock, type Abschnitt, type Teil } from './journal'
import { liesMarken, type Marke } from './marken'
import { findeLinks } from './links'
import { blockiertDurch, istAbgeschlossen, zustandAus, type Zustand } from './aufgaben'

export interface Eintrag {
  id: string
  typ: string
  titel: string
  pfad: string
  felder: Record<string, Wert>
  rumpf: string
}

export interface Projekt {
  id: string
  kuerzel: string
  titel: string
  /** Rohwert aus der Datei oder aus NocoDB (`entwurf`, `offen` … `archiviert`); für die Apps zählt nur `archiviert` */
  status: string
  /** `archiviert` (oder alt `abgeschlossen`): aus Listen und Vorschlägen ausgeblendet */
  archiviert: boolean
  /** Tag `privat` (alt: `bereich: privat`) */
  privat: boolean
  /** Adresse des Objekts als Text (eigene, sonst aus einer Quelle wie NocoDB) */
  adresse?: string
  /** Woher die Adresse kommt, wenn sie nicht im Projekt selbst steht (z. B. `nocodb`) */
  adresseAus?: string
  /** Tag der Anlage (JJJJ-MM-TT), falls bekannt */
  erstellt?: string
  /** Projektstart (JJJJ-MM-TT), aus NocoDB oder dem Feld `start` */
  start?: string
  /** Projektdatei; leer bei einem Projekt, das es nur in NocoDB gibt (`nurNocodb`) */
  pfad: string
  /** Vaultwarden-Eintrag mit den Zugangsdaten (nur die ID) */
  zugang?: string
  /** oben in der Projektliste */
  favorit: boolean
  /** Absender, deren Mails zu diesem Projekt gehören: Adressen (max@firma.de) oder Domains (@firma.de), klein */
  absender?: string[]
  /**
   * Zeile in NocoDB, aus der Titel, Adresse, Start, Status und Zugang kommen (Vertrag 5.2 „Stammdaten aus NocoDB“).
   * Diese Felder pflegt dann die Projektzentrale; die gleichnamigen Felder der Datei bleiben stehen, gelten aber nicht.
   */
  nocodb?: { id: string; geaendert?: string }
  /** Nur in NocoDB, noch ohne Projektdatei: `id` und `pfad` sind leer, angelegt wird die Datei beim ersten Gebrauch */
  nurNocodb?: true
}

/** Eine Zeile aus `gemeinsam/kontakte/nocodb-projekte.json` (Vertrag 5.2 „Abbild“); alte Abbilder haben nur kuerzel/titel/adresse */
interface AbbildZeile {
  id?: unknown
  rn_id?: unknown
  kuerzel?: unknown
  titel?: unknown
  adresse?: unknown
  start?: unknown
  status?: unknown
  archiviert?: unknown
  zugang?: unknown
  geaendert?: unknown
}

export interface Journal {
  datum: string
  pfad: string
  text: string
  gliederung: Gliederung
}

export interface ChronikEintrag {
  datum: string
  pfad: string
  block: ProjektBlock
  text: string
}

/** Ein Eintrag aus einem Tagesjournal, wie ihn der Review zeigt */
export interface JournalEintrag {
  datum: string
  pfad: string
  teil: Teil
  /** Text ohne die H1 */
  rumpf: string
}

export interface Bericht {
  id: string
  titel: string
  pfad: string
  kuerzel: string | null
  von: string
  bis: string
  status: string
}

/** Ein Tag eines Berichts aus dem Journal: die Stelle und der Text unter der `##` */
export interface BerichtTag extends BerichtStelle {
  datum: string
  pfad: string
  rumpf: string
}

/** Bericht aus dem Journal: alle `##` mit gleichem Titel unter einem Projekt, ältester Tag zuerst */
export interface JournalBericht {
  schluessel: string
  /** Titel der jüngsten Stelle */
  titel: string
  kuerzel: string
  von: string
  bis: string
  tage: BerichtTag[]
}

export interface Offen {
  art: 'aufgabe' | 'blockade' | 'abschnitt'
  datum: string
  pfad: string
  zeile: number
  text: string
  projekt: string | null
  pfad_: string[]
  pruefen?: string | null
  /** Zeile `- [ ] …` im Journal (Checkliste) */
  aufgabe?: Aufgabe
  /** eigene Aufgabe (Datei `arbeit/aufgaben/<id>.md`); pfad zeigt dann auf die Aufgabe, datum/zeile auf die erste Fundstelle */
  aufgabeId?: string
  zustand?: Zustand
  /** woran eine blockierte Aufgabe hängt (`blockiert_weil`) */
  grund?: string
  blockade?: Blockade
  abschnitt?: Abschnitt
}

/** Wo ein Link auf eine ID steht (Zeilennummer in der ganzen Datei) */
export interface Fundstelle {
  pfad: string
  /** gesetzt, wenn die Fundstelle in einem Tagesjournal liegt */
  datum: string | null
  zeile: number
  text: string
  /** Projekt der umgebenden H1 im Journal */
  projekt: string | null
}

export class Bestand {
  readonly dokumente = new Map<string, Eintrag>()
  readonly nachPfad = new Map<string, Eintrag>()
  readonly projekte: Projekt[] = []
  /** Projekte, die es nur in NocoDB gibt (Vertrag 5.2 „Nur in NocoDB“): für Projektliste und #-Vorschläge, nie in `projekte` */
  readonly nurNocodb: Projekt[] = []
  readonly journale: Journal[] = []
  readonly texte: Map<string, string>
  private eingehend: Map<string, Fundstelle[]> | null = null

  constructor(texte: Map<string, string>) {
    this.texte = texte
    for (const [pfad, text] of texte) {
      if (!pfad.endsWith('.md')) continue
      const d = zerlege(text)
      const f = felder(d.kopf)
      const id = typeof f.id === 'string' ? f.id : null
      if (!id) continue
      const e: Eintrag = {
        id,
        typ: String(f.typ ?? ''),
        titel: String(f.titel ?? pfad.split('/').pop()!.replace(/\.md$/, '')),
        pfad,
        felder: f,
        rumpf: d.rumpf
      }
      this.dokumente.set(id, e)
      this.nachPfad.set(pfad, e)
      if (e.typ === 'projekt' && typeof f.kuerzel === 'string') {
        const status = String(f.status ?? 'aktiv')
        this.projekte.push({
          id,
          kuerzel: f.kuerzel,
          titel: e.titel,
          status,
          archiviert: status === 'archiviert' || status === 'abgeschlossen',
          privat: f.bereich === 'privat' || (Array.isArray(f.tags) && f.tags.includes('privat')),
          // `standort` stammt aus dem Import der alten RespawnedNotes und gilt, solange `adresse` fehlt
          adresse: [f.adresse, f.standort].map((x) => (typeof x === 'string' ? x.trim() : '')).find(Boolean) || undefined,
          erstellt: typeof f.erstellt === 'string' ? f.erstellt.slice(0, 10) : undefined,
          start: typeof f.start === 'string' && f.start ? f.start.slice(0, 10) : undefined,
          pfad,
          zugang: typeof f.zugang === 'string' && f.zugang ? f.zugang : undefined,
          favorit: f.favorit === true,
          absender: Array.isArray(f.absender) ? f.absender.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : undefined
        })
      }
      if (e.typ === 'journal' && typeof f.datum === 'string') {
        this.journale.push({ datum: f.datum, pfad, text, gliederung: gliedere(text) })
      }
    }
    this.projekteAusQuellen()
    this.projekte.sort((a, b) => a.titel.localeCompare(b.titel, 'de'))
    this.nurNocodb.sort((a, b) => a.titel.localeCompare(b.titel, 'de'))
    this.journale.sort((a, b) => b.datum.localeCompare(a.datum))
  }

  /**
   * Projekt-Stammdaten aus `gemeinsam/kontakte/<quelle>-projekte.json`.
   * - Abbild aus NocoDB (Zeilen mit `id`, Vertrag 5.2 „Stammdaten aus NocoDB“): Die Zeile gewinnt für Titel, Adresse,
   *   Start, Status und Zugang. Zuordnung zuerst über `rn_id` = `id` der Projektdatei, dann über das Kürzel ohne
   *   Groß/klein; bei doppeltem Projekttag gilt die erste Zeile. Private Projekte lesen ihre Zeile nicht. Zeilen ohne
   *   Projektdatei landen in `nurNocodb`. Favorit, Absender, Tags und Rumpf bleiben aus der Datei.
   * - Alte Abbilder ohne `id` (Vertrag 5.1): nur die Adresse, und nur für Projekte ohne eigene.
   * Alles über Nachschlagetabellen, damit der Index mit vielen Projekten nicht langsamer wird (Vertrag 5.2 „Tempo“).
   */
  private projekteAusQuellen() {
    const klein = (s: string) => s.normalize('NFC').toLowerCase().trim()
    const text = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
    const nachId = new Map<string, Projekt>()
    const nachKuerzel = new Map<string, Projekt>()
    let nachTitel: Map<string, Projekt> | null = null
    for (const p of this.projekte) {
      nachId.set(p.id, p)
      if (!nachKuerzel.has(klein(p.kuerzel))) nachKuerzel.set(klein(p.kuerzel), p)
    }
    const vergeben = new Set<Projekt>()
    const nurKuerzel = new Set<string>()
    const uebernimm = (p: Projekt, x: AbbildZeile) => {
      vergeben.add(p)
      if (p.privat) return
      p.titel = text(x.titel) || p.kuerzel
      p.adresse = text(x.adresse) || undefined
      p.adresseAus = p.adresse ? 'nocodb' : undefined
      p.start = text(x.start).slice(0, 10) || undefined
      p.status = text(x.status) || 'entwurf'
      p.archiviert = x.archiviert === true
      p.zugang = text(x.zugang) || undefined
      p.nocodb = { id: text(x.id), geaendert: text(x.geaendert) || undefined }
    }
    for (const [pfad, inhalt] of this.texte) {
      const m = /^gemeinsam\/kontakte\/([^/]+)-projekte\.json$/.exec(pfad)
      if (!m) continue
      let liste: unknown
      try {
        liste = JSON.parse(inhalt)
      } catch {
        continue
      }
      if (!Array.isArray(liste)) continue
      const zeilen = (liste as AbbildZeile[]).filter((x) => x && typeof x === 'object')
      const kuerzelVon = (x: AbbildZeile) => klein(text(x.kuerzel).replace(/^#/, ''))
      const stammdaten = m[1] === 'nocodb' ? zeilen.filter((x) => text(x.id)) : []
      const uebrig: AbbildZeile[] = []
      // Erst der feste Anker RN-ID, damit ein in NocoDB umbenannter Projekttag die Zuordnung übersteht
      for (const x of stammdaten) {
        const p = nachId.get(text(x.rn_id))
        if (p && !vergeben.has(p)) uebernimm(p, x)
        else uebrig.push(x)
      }
      for (const x of uebrig) {
        const k = kuerzelVon(x)
        if (!k) continue
        const p = nachKuerzel.get(k)
        if (p) {
          if (!vergeben.has(p)) uebernimm(p, x)
          continue
        }
        if (nurKuerzel.has(k)) continue
        nurKuerzel.add(k)
        const titel = text(x.titel) || k
        this.nurNocodb.push({
          id: '',
          kuerzel: k,
          titel,
          status: text(x.status) || 'entwurf',
          archiviert: x.archiviert === true,
          privat: false,
          adresse: text(x.adresse) || undefined,
          adresseAus: text(x.adresse) ? 'nocodb' : undefined,
          start: text(x.start).slice(0, 10) || undefined,
          pfad: '',
          zugang: text(x.zugang) || undefined,
          favorit: false,
          nocodb: { id: text(x.id), geaendert: text(x.geaendert) || undefined },
          nurNocodb: true
        })
      }
      for (const x of zeilen) {
        if (stammdaten.includes(x)) continue
        const adresse = text(x.adresse)
        if (!adresse) continue
        const k = kuerzelVon(x)
        const t = klein(text(x.titel))
        if (t && !nachTitel) {
          nachTitel = new Map()
          for (const p of this.projekte) if (!nachTitel.has(klein(p.titel))) nachTitel.set(klein(p.titel), p)
        }
        const p = (k && nachKuerzel.get(k)) || (t && nachTitel?.get(t)) || undefined
        if (p && !p.adresse && !p.nocodb) {
          p.adresse = adresse
          p.adresseAus = m[1]
        }
      }
    }
  }

  /** Projekt, das es nur in NocoDB gibt (Kürzel ohne Groß/klein); undefined, sobald eine Projektdatei dazu existiert */
  nurInNocodb(kuerzel: string): Projekt | undefined {
    const k = kuerzel.normalize('NFC').toLowerCase().trim()
    return this.nurNocodb.find((p) => p.kuerzel === k)
  }

  projekt(kuerzelOderId: string): Projekt | undefined {
    return this.projekte.find((p) => p.kuerzel === kuerzelOderId || p.id === kuerzelOderId)
  }

  journal(datum: string): Journal | undefined {
    return this.journale.find((j) => j.datum === datum)
  }

  /** Alle Abschnitte eines Projekts aus allen Tagen, neueste zuerst. Keine Kopien, nur Verweise. */
  chronik(kuerzel: string): ChronikEintrag[] {
    const out: ChronikEintrag[] = []
    for (const j of this.journale) {
      for (const b of j.gliederung.bloecke.filter((x) => x.kuerzel === kuerzel).reverse()) {
        out.push({ datum: j.datum, pfad: j.pfad, block: b, text: blockText(j.text, b) })
      }
    }
    return out
  }

  /** Alle Stellen, an denen auf die ID verlinkt wird (Journal zuerst, neueste zuerst) */
  fundstellen(id: string): Fundstelle[] {
    if (!this.eingehend) {
      const idx = new Map<string, Fundstelle[]>()
      const journale = new Map(this.journale.map((j) => [j.pfad, j]))
      for (const e of this.dokumente.values()) {
        const text = this.texte.get(e.pfad) ?? ''
        if (!text.includes('[[')) continue
        const j = journale.get(e.pfad)
        text.split('\n').forEach((z, zeile) => {
          if (!z.includes('[[')) return
          for (const l of findeLinks(z)) {
            if (l.ziel === e.id) continue
            const projekt = j?.gliederung.bloecke.find((b) => b.von <= zeile && b.bis > zeile)?.kuerzel ?? null
            const liste = idx.get(l.ziel) ?? []
            if (!liste.some((f) => f.pfad === e.pfad && f.zeile === zeile)) liste.push({ pfad: e.pfad, datum: j?.datum ?? null, zeile, text: z, projekt })
            idx.set(l.ziel, liste)
          }
        })
      }
      for (const liste of idx.values()) liste.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? '') || a.zeile - b.zeile)
      this.eingehend = idx
    }
    return this.eingehend.get(id) ?? []
  }

  aufgabe(id: string): Eintrag | undefined {
    const e = this.dokumente.get(id)
    return e?.typ === 'aufgabe' ? e : undefined
  }

  /** Zustand einer eigenen Aufgabe für die Linkfarbe; null, wenn die ID keine Aufgabe ist */
  zustand(id: string, heute?: string): Zustand | null {
    const e = this.aufgabe(id)
    return e ? zustandAus(e.felder, (x) => this.aufgabe(x)?.felder.status ?? (this.aufgabe(x) ? 'offen' : undefined), heute) : null
  }

  /** Die erste noch offene Aufgabe, an der diese hängt (`blockiert_durch`); im Satz steht nur sie dabei */
  blockierer(id: string): Eintrag | undefined {
    const e = this.aufgabe(id)
    if (!e) return undefined
    return blockiertDurch(e.felder)
      .map((x) => this.aufgabe(x))
      .find((a): a is Eintrag => !!a && !istAbgeschlossen(a.felder.status))
  }

  /** Woran eine Aufgabe hängt: die offenen Aufgaben aus `blockiert_durch`, sonst ein alter Freitext */
  private grund(e: Eintrag): string | undefined {
    const offen = blockiertDurch(e.felder)
      .map((x) => this.aufgabe(x))
      .filter((a): a is Eintrag => !!a && !istAbgeschlossen(a.felder.status))
    if (offen.length) return `durch ${offen.map((a) => a.titel).join(', ')}`
    return typeof e.felder.blockiert_weil === 'string' ? e.felder.blockiert_weil : undefined
  }

  /** Projekt einer Aufgabe: aus dem Feld `projekt`, sonst aus dem Journalabschnitt, in dem sie verlinkt ist */
  projektVonAufgabe(id: string): string | null {
    const e = this.aufgabe(id)
    if (!e) return null
    const p = linkZiel(e.felder.projekt)
    if (p) return this.projekt(p)?.kuerzel ?? null
    return this.fundstellen(id).find((f) => f.projekt)?.projekt ?? null
  }

  /** Alle Journaleinträge, neueste Tage zuerst, innerhalb eines Tages in Schreibreihenfolge */
  eintraege(): JournalEintrag[] {
    const out: JournalEintrag[] = []
    for (const j of this.journale) {
      for (const t of j.gliederung.teile) {
        const text = blockText(j.text, t)
        out.push({ datum: j.datum, pfad: j.pfad, teil: t, rumpf: t.kopf ? text.split('\n').slice(1).join('\n') : text })
      }
    }
    return out
  }

  /** Berichte aus dem Journal (`##` unter `# #kuerzel`), zuletzt fortgeschriebene zuerst */
  journalBerichte(kuerzel: string): JournalBericht[] {
    const nach = new Map<string, JournalBericht>()
    // journale sind neueste zuerst, die Tage eines Berichts sollen ältester zuerst stehen
    for (const j of [...this.journale].reverse()) {
      const zeilen = j.text.split('\n')
      for (const s of berichtStellen(j.text, j.gliederung)) {
        if (s.kuerzel !== kuerzel) continue
        let b = nach.get(s.schluessel)
        if (!b) nach.set(s.schluessel, (b = { schluessel: s.schluessel, titel: s.titel, kuerzel, von: j.datum, bis: j.datum, tage: [] }))
        b.titel = s.titel
        b.bis = j.datum
        b.tage.push({ ...s, datum: j.datum, pfad: j.pfad, rumpf: zeilen.slice(s.von + 1, s.bis).join('\n') })
      }
    }
    return [...nach.values()].sort((a, b) => b.bis.localeCompare(a.bis) || a.titel.localeCompare(b.titel, 'de'))
  }

  /** Berichte, optional nur die eines Projekts; neueste zuerst */
  berichte(kuerzel?: string): Bericht[] {
    const out: Bericht[] = []
    for (const e of this.dokumente.values()) {
      if (e.typ !== 'bericht') continue
      const pid = linkZiel(e.felder.projekt)
      const k = (pid && this.projekte.find((p) => p.id === pid)?.kuerzel) || (typeof e.felder.kuerzel === 'string' ? e.felder.kuerzel : null)
      if (kuerzel !== undefined && k !== kuerzel) continue
      out.push({ id: e.id, titel: e.titel, pfad: e.pfad, kuerzel: k, von: String(e.felder.von ?? ''), bis: String(e.felder.bis ?? e.felder.von ?? ''), status: String(e.felder.status ?? '') })
    }
    return out.sort((a, b) => b.bis.localeCompare(a.bis) || a.titel.localeCompare(b.titel, 'de'))
  }

  /** Offene Aufgaben, Blockaden und Überschriften mit Status blockiert/offen/wartet */
  offen(kuerzel?: string | null): Offen[] {
    const out: Offen[] = []
    for (const j of this.journale) {
      const g = j.gliederung
      const passt = (p: string | null) => kuerzel === undefined || p === kuerzel
      for (const a of g.aufgaben) {
        if (a.erledigt || !passt(a.projekt)) continue
        out.push({ art: 'aufgabe', datum: j.datum, pfad: j.pfad, zeile: a.zeile, text: a.text, projekt: a.projekt, pfad_: a.pfad, aufgabe: a })
      }
      for (const b of g.blockaden) {
        if (!passt(b.projekt)) continue
        // Eine Blockade gilt als gelöst, wenn ihre Überschrift erledigt/gelöst ist
        const huelle = g.abschnitte.filter((x) => x.von < b.zeile && x.bis > b.zeile && x.ebene > 1).pop()
        if (huelle && (huelle.status === 'erledigt' || huelle.status === 'gelöst')) continue
        out.push({ art: 'blockade', datum: j.datum, pfad: j.pfad, zeile: b.zeile, text: b.titel || b.wenn, projekt: b.projekt, pfad_: b.pfad, pruefen: b.pruefen, blockade: b })
      }
      for (const a of g.abschnitte) {
        if (!a.status || a.status === 'erledigt' || a.status === 'gelöst' || !passt(a.projekt)) continue
        out.push({ art: 'abschnitt', datum: j.datum, pfad: j.pfad, zeile: a.von, text: a.titel, projekt: a.projekt, pfad_: [], abschnitt: a })
      }
    }
    for (const e of this.dokumente.values()) {
      if (e.typ !== 'aufgabe' || istAbgeschlossen(e.felder.status)) continue
      const projekt = this.projektVonAufgabe(e.id)
      if (kuerzel !== undefined && projekt !== kuerzel) continue
      const f = this.fundstellen(e.id).find((x) => x.datum)
      out.push({
        art: 'aufgabe',
        datum: f?.datum ?? String(e.felder.erstellt ?? '').slice(0, 10),
        pfad: e.pfad,
        zeile: f?.zeile ?? 0,
        text: e.titel,
        projekt,
        pfad_: [],
        aufgabeId: e.id,
        zustand: this.zustand(e.id) ?? 'offen',
        pruefen: typeof e.felder.pruefen === 'string' ? e.felder.pruefen : null,
        grund: this.grund(e)
      })
    }
    return out
  }

  /** Anhänge (Sidecars), optional nur die eines Projekts */
  anhaenge(projektId?: string): Eintrag[] {
    return [...this.dokumente.values()]
      .filter((e) => e.typ === 'anhang' && (!projektId || linkZiel(e.felder.projekt) === projektId))
      .sort((a, b) => a.titel.localeCompare(b.titel, 'de'))
  }

  plaene(projektId: string): Eintrag[] {
    return this.anhaenge(projektId).filter((e) => e.felder.art === 'plan' || /\.pdf$/i.test(String(e.felder.datei ?? '')))
  }

  marken(markenPfad: string): Marke[] {
    return liesMarken(this.texte.get(markenPfad) ?? '')
  }

  /** Wer verlinkt auf diese ID? (für „nie automatisch löschen“ und für Rückverweise) */
  rueckverweise(id: string): Eintrag[] {
    const out: Eintrag[] = []
    for (const e of this.dokumente.values()) if (e.id !== id && findeLinks(e.rumpf).some((l) => l.ziel === id)) out.push(e)
    return out
  }

  nachTyp(...typen: string[]): Eintrag[] {
    return [...this.dokumente.values()].filter((e) => typen.includes(e.typ))
  }
}
