// Ein Index über alle Textdateien, jederzeit neu aufbaubar (Vertrag 1.1). Rein funktional, damit die Tests
// ohne Browser laufen. Die Apps bauen ihn nach jeder Änderung neu; bei einigen tausend Dateien reicht das.
import { felder, linkZiel, zerlege, type Wert } from './frontmatter'
import { gliedere, blockText, type Gliederung, type Aufgabe, type Blockade, type ProjektBlock, type Abschnitt } from './journal'
import { liesMarken, type Marke } from './marken'
import { findeLinks } from './links'

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
  status: string
  bereich: string
  pfad: string
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

export interface Offen {
  art: 'aufgabe' | 'blockade' | 'abschnitt'
  datum: string
  pfad: string
  zeile: number
  text: string
  projekt: string | null
  pfad_: string[]
  pruefen?: string | null
  aufgabe?: Aufgabe
  blockade?: Blockade
  abschnitt?: Abschnitt
}

export class Bestand {
  readonly dokumente = new Map<string, Eintrag>()
  readonly nachPfad = new Map<string, Eintrag>()
  readonly projekte: Projekt[] = []
  readonly journale: Journal[] = []
  readonly texte: Map<string, string>

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
        this.projekte.push({
          id,
          kuerzel: f.kuerzel,
          titel: e.titel,
          status: String(f.status ?? 'aktiv'),
          bereich: String(f.bereich ?? 'beruf'),
          pfad
        })
      }
      if (e.typ === 'journal' && typeof f.datum === 'string') {
        this.journale.push({ datum: f.datum, pfad, text, gliederung: gliedere(text) })
      }
    }
    this.projekte.sort((a, b) => a.titel.localeCompare(b.titel, 'de'))
    this.journale.sort((a, b) => b.datum.localeCompare(a.datum))
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
