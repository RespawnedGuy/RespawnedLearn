// Der Datenordner ist die einzige Wahrheit (Vertrag Lernen, Grundlagen 1 und 8). Der Speicher hält alle Textdateien im
// Arbeitsspeicher, damit die Ansichten sofort reagieren, und schreibt Änderungen nach kurzer Ruhe atomar in den Ordner.
// Ein Sync-Programm (Syncthing, Dropbox, OneDrive …) gleicht den Ordner zwischen den Geräten ab. Hat es eine Datei ersetzt,
// während hier noch etwas ungespeichert war, entsteht eine Konfliktkopie `*.sync-conflict-*`. Kopien der Sync-Programme
// erkennt `syncKopien()`; was sich ohne Verlust lösen lässt, löst der Speicher selbst, sonst entscheidet ein Mensch.
import { automatisch, inAppOrdner, istText, loeschbareKopie, syncKopien, unlesbar, type SyncKopie } from '@rl/kern'
import { ablageImSpeicher } from './ablageImSpeicher'
import { inTauri, tauriAblage, type Ablage, type OrdnerEintrag, type TextDatei } from './ordner'

interface TextEintrag {
  text: string
  /** Stempel des Stands auf der Platte, auf dem der Text beruht; null = dort noch nicht vorhanden */
  stempel: string | null
  /** Text weicht vom Stand auf der Platte ab und wartet aufs Schreiben */
  offen: boolean
}

export type SyncZustand = 'bereit' | 'fehler'

/** Hinweis auf ein Problem mit dem Sync-Programm: Ordner plötzlich leer (die App schreibt dann nicht) oder viele Dateien weg */
export type SyncHinweis = { art: 'leer' } | { art: 'schwund'; anzahl: number }

export interface SyncProblem {
  pfad: string
  grund: string
}

/** Ab so vielen Dateien gilt eine leere Liste oder ein großer Schwund als verdächtig */
const VIELE = 10
const ANTEIL = 0.2
const BINAER_VERGLEICH_BIS = 20_000_000

function gemerkteZahl(): number {
  try {
    return Number(localStorage.getItem('rl-dateizahl')) || 0
  } catch {
    return 0
  }
}

function merkeZahl(n: number) {
  try {
    localStorage.setItem('rl-dateizahl', String(n))
  } catch {
    // nur eine Bequemlichkeit
  }
}

export interface SpeicherOptionen {
  /** Fehlt: im Tauri-Fenster der echte Ordner, sonst eine Ablage im Arbeitsspeicher */
  ablage?: Ablage | (() => Promise<Ablage>)
  /** Ruhezeit vor dem Schreiben in ms (so wird nicht jeder Tastendruck eine Dateiänderung, die Syncthing verteilt) */
  wartezeit?: number
}

export function geraet(): string {
  try {
    let g = localStorage.getItem('rvx-geraet')
    if (!g) {
      const art = /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : 'pc'
      g = `${art}-${Math.random().toString(36).slice(2, 6)}`
      localStorage.setItem('rvx-geraet', g)
    }
    return g
  } catch {
    return 'unbekannt'
  }
}

/** Name der Konfliktkopie wie bei Syncthing: `<name>.sync-conflict-<JJJJMMTT>-<HHMMSS>-<gerät>.<endung>` (Ortszeit) */
export function konfliktPfad(pfad: string, g: string, d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0')
  const st = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`
  const name = pfad.lastIndexOf('/')
  const punkt = pfad.lastIndexOf('.')
  return punkt > name + 1 ? `${pfad.slice(0, punkt)}.sync-conflict-${st}-${g}${pfad.slice(punkt)}` : `${pfad}.sync-conflict-${st}-${g}`
}

/** Texte, die die App liest. `arbeit/` und Kontakte aus RespawnedNotes VX dürfen im selben Ordner liegen, gehören aber nicht dazu (Vertrag Lernen, Grundlagen 2). */
const liestText = (p: string) => istText(p) && !p.startsWith('arbeit/') && !p.startsWith('gemeinsam/kontakte/')

const TYPEN: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }

export class Speicher {
  private ablage!: Ablage
  private texte = new Map<string, TextEintrag>()
  /** Alle Dateien im Ordner mit Größe und Zeit (auch Binärdateien), für den Vergleich mit der nächsten Liste */
  private staende = new Map<string, OrdnerEintrag>()
  private hoerer = new Set<() => void>()
  private uhren = new Map<string, ReturnType<typeof setTimeout>>()
  /** Abfragen und Schreiben laufen nacheinander, damit ein eigener Schreibvorgang nie als fremde Änderung erscheint */
  private reihe: Promise<unknown> = Promise.resolve()
  private abfrageLaeuft = false
  private abfrageNochmal = false
  private aufraeumen: (() => void)[] = []
  zustand: SyncZustand = 'bereit'
  letzterFehler = ''
  hinweis: SyncHinweis | null = null
  /** Wie viele Konfliktkopien der Speicher seit dem Start ohne Menschen gelöst hat */
  automatischErledigt = 0
  /** Ordner plötzlich leer: nichts schreiben, bis Dateien zurück sind oder der Mensch bestätigt */
  private pause = false
  private leerBestaetigt = false
  private aufloesenLaeuft = false
  private kopienCache: { version: number; kopien: Map<string, SyncKopie> } | null = null
  private problemeCache: { version: number; probleme: SyncProblem[] } | null = null
  version = 0
  /** false in der Vorschau im Browser: nichts bleibt erhalten */
  dauerhaft = true

  constructor(private o: SpeicherOptionen = {}) {}

  async oeffne(): Promise<void> {
    const a = this.o.ablage
    this.ablage = typeof a === 'function' ? await a() : a ?? (inTauri() ? await tauriAblage() : ablageImSpeicher(undefined, { dauerhaft: false }))
    this.dauerhaft = this.ablage.dauerhaft
    const liste = await this.ablage.dateien()
    if (!liste.length && this.dauerhaft && gemerkteZahl() >= VIELE) {
      this.hinweis = { art: 'leer' }
      this.pause = true
    } else if (this.dauerhaft) merkeZahl(liste.length)
    for (const e of liste) this.staende.set(e.pfad, e)
    for (const d of await this.ablage.texteLesen(liste.filter((e) => liestText(e.pfad)).map((e) => e.pfad))) {
      this.texte.set(d.pfad, { text: d.text, stempel: d.stempel, offen: false })
      this.staende.set(d.pfad, d)
    }
    this.aufraeumen.push(await this.ablage.beobachte(() => void this.abfragen()))
    if (this.ablage.abfrageMs > 0) {
      const uhr = setInterval(() => void this.abfragen(), this.ablage.abfrageMs)
      this.aufraeumen.push(() => clearInterval(uhr))
    }
    void this.aufloesen()
    if (typeof document !== 'undefined') {
      // In den Hintergrund: sofort schreiben (Android beendet Apps dort ohne Vorwarnung). Zurück: nachsehen, was kam.
      const sichtbar = () => (document.visibilityState === 'hidden' ? void this.speichereAlles() : void this.abfragen())
      const weg = () => void this.speichereAlles()
      document.addEventListener('visibilitychange', sichtbar)
      addEventListener('pagehide', weg)
      this.aufraeumen.push(() => {
        document.removeEventListener('visibilitychange', sichtbar)
        removeEventListener('pagehide', weg)
      })
    }
    this.melde()
  }

  /** Beendet Überwachung und Uhren (Tests); Ungespeichertes wird vorher geschrieben */
  async schliesse(): Promise<void> {
    await this.speichereAlles()
    for (const f of this.aufraeumen) f()
    this.aufraeumen = []
  }

  abonniere(f: () => void): () => void {
    this.hoerer.add(f)
    return () => this.hoerer.delete(f)
  }

  private melde() {
    this.version++
    for (const f of this.hoerer) f()
  }

  /** Alle Textdateien, auch Konfliktkopien (der Bestand überspringt sie selbst) */
  alleTexte(): Map<string, string> {
    const m = new Map<string, string>()
    for (const [p, e] of this.texte) m.set(p, e.text)
    return m
  }

  text(pfad: string): string | undefined {
    return this.texte.get(pfad)?.text
  }

  /** Pfade aller Dateien im Ordner und der noch nicht geschriebenen (auch Binärdateien) */
  pfade(): string[] {
    const s = new Set(this.staende.keys())
    for (const p of this.texte.keys()) s.add(p)
    return [...s].sort()
  }

  ungesichert(): number {
    let n = 0
    for (const e of this.texte.values()) if (e.offen) n++
    return n
  }

  /** Konfliktkopien aller Sync-Programme mit ihrem Original */
  kopien(): Map<string, SyncKopie> {
    if (this.kopienCache?.version !== this.version) this.kopienCache = { version: this.version, kopien: this.kopienJetzt() }
    return this.kopienCache.kopien
  }

  private kopienJetzt(): Map<string, SyncKopie> {
    return syncKopien(this.pfade(), (p) => this.texte.get(p)?.text)
  }

  konflikte(): string[] {
    return [...this.kopien().keys()].sort()
  }

  /** Unlesbare Dateien (leer, halb übertragen, beschädigt). Sie bleiben, bis das Sync-Programm eine ganze Fassung bringt. */
  syncProbleme(): SyncProblem[] {
    if (this.problemeCache?.version === this.version) return this.problemeCache.probleme
    const kopien = this.kopien()
    const probleme: SyncProblem[] = []
    for (const [pfad, e] of this.texte) {
      if (e.offen || e.stempel === null || !inAppOrdner(pfad) || kopien.has(pfad)) continue
      const grund = unlesbar(pfad, e.text)
      if (grund) probleme.push({ pfad, grund })
    }
    this.problemeCache = { version: this.version, probleme }
    return probleme
  }

  /** Der leere Ordner ist richtig so (z. B. bewusst neu angefangen): wieder schreiben */
  weiterTrotzLeer(): void {
    this.leerBestaetigt = true
    this.pause = false
    this.hinweis = null
    this.melde()
    void this.abfragen()
  }

  /** Hinweis gelesen */
  hinweisWeg(): void {
    if (this.hinweis?.art === 'leer') return this.weiterTrotzLeer()
    this.hinweis = null
    this.melde()
  }

  async schreibe(pfad: string, text: string): Promise<void> {
    const alt = this.texte.get(pfad)
    if (alt?.text === text) return
    // Unlesbare Datei auf der Platte (meist halb übertragen): Ihr Inhalt bleibt als Konfliktkopie, bevor die App sie ersetzt
    const ohneCr = (t: string) => t.replace(/\r\n/g, '\n')
    if (alt && !alt.offen && alt.stempel !== null && alt.text.trim() && inAppOrdner(pfad) && unlesbar(pfad, alt.text) && !ohneCr(text).startsWith(ohneCr(alt.text))) {
      const kopie = konfliktPfad(pfad, geraet())
      this.texte.set(kopie, { text: alt.text, stempel: null, offen: true })
      this.planeSchreiben(kopie, 0)
    }
    this.texte.set(pfad, { text, stempel: alt?.stempel ?? null, offen: true })
    this.melde()
    this.planeSchreiben(pfad, this.o.wartezeit ?? 1000)
  }

  /** Ändert eine Datei anhand ihres aktuellen Stands (verhindert, dass zwei Änderungen sich überschreiben) */
  async aendere(pfad: string, f: (alt: string) => string): Promise<void> {
    const alt = this.text(pfad) ?? ''
    const neu = f(alt)
    if (neu !== alt) await this.schreibe(pfad, neu)
  }

  private planeSchreiben(pfad: string, ms: number) {
    clearTimeout(this.uhren.get(pfad))
    this.uhren.set(pfad, setTimeout(() => void this.speichereJetzt(pfad), ms))
  }

  /** Schreibt alles Ungespeicherte sofort (beim Wechsel in den Hintergrund) */
  async speichereAlles(): Promise<void> {
    const offen = [...this.texte].filter(([, e]) => e.offen).map(([p]) => p)
    await Promise.all(offen.map((p) => this.speichereJetzt(p)))
  }

  /** Schreibt eine Datei, falls sie wartet. Nur auf dem bekannten Stand, sonst Konfliktkopie. */
  speichereJetzt(pfad: string): Promise<void> {
    clearTimeout(this.uhren.get(pfad))
    this.uhren.delete(pfad)
    if (this.pause) {
      this.planeSchreiben(pfad, 5000)
      return Promise.resolve()
    }
    return this.inReihe(async () => {
      const e = this.texte.get(pfad)
      if (!e?.offen) return
      const text = e.text
      try {
        const r = await this.ablage.schreibeWenn(pfad, text, e.stempel)
        if (r.art === 'ok') {
          this.staende.set(pfad, { pfad, groesse: r.groesse, geaendert: r.geaendert })
          const jetzt = this.texte.get(pfad)!
          // Während des Schreibens kann weitergetippt worden sein; dann bleibt die Datei offen
          this.texte.set(pfad, { text: jetzt.text, stempel: r.stempel, offen: jetzt.text !== text })
          if (jetzt.text !== text) this.planeSchreiben(pfad, this.o.wartezeit ?? 1000)
        } else {
          const [d] = await this.ablage.texteLesen([pfad])
          if (d) await this.vergleiche(d)
          else this.texte.set(pfad, { ...this.texte.get(pfad)!, stempel: null }) // inzwischen gelöscht: neu anlegen
          if (this.texte.get(pfad)?.offen) this.planeSchreiben(pfad, 0)
        }
        this.fehlerWeg()
      } catch (x) {
        this.fehler(x)
        this.planeSchreiben(pfad, 5000)
      }
      this.melde()
    })
  }

  private inReihe<T>(f: () => Promise<T>): Promise<T> {
    const p = this.reihe.then(f, f)
    this.reihe = p.catch(() => undefined)
    return p
  }

  /**
   * Vergleicht die Dateiliste mit dem letzten Stand und liest geänderte Texte neu. Läuft nach jeder Meldung der
   * Dateiüberwachung, regelmäßig (Android alle 10 s) und wenn die App wieder in den Vordergrund kommt.
   */
  async abfragen(): Promise<void> {
    if (this.abfrageLaeuft) {
      this.abfrageNochmal = true
      return
    }
    this.abfrageLaeuft = true
    try {
      do {
        this.abfrageNochmal = false
        await this.inReihe(() => this.abfrageEinmal())
      } while (this.abfrageNochmal)
    } finally {
      this.abfrageLaeuft = false
    }
    await this.aufloesen()
  }

  private async abfrageEinmal(): Promise<void> {
    let liste: OrdnerEintrag[]
    try {
      liste = await this.ablage.dateien()
    } catch (x) {
      this.fehler(x)
      this.melde()
      return
    }
    const vorher = this.staende.size
    if (!liste.length && vorher >= VIELE && !this.leerBestaetigt) {
      // Laufwerk getrennt, Cloud offline, Ordner ersetzt: nicht als „alles gelöscht“ übernehmen und nichts schreiben
      if (this.hinweis?.art !== 'leer') {
        this.hinweis = { art: 'leer' }
        this.pause = true
        this.melde()
      }
      return
    }
    if (this.pause && liste.length) {
      this.pause = false
      this.hinweis = null
    }
    if (this.dauerhaft) merkeZahl(liste.length)
    let geaendert = false
    const neu = new Map(liste.map((e) => [e.pfad, e]))
    let weg = 0
    for (const p of this.staende.keys()) if (!neu.has(p)) weg++
    if (vorher >= VIELE && weg >= VIELE && weg >= vorher * ANTEIL) this.hinweis = { art: 'schwund', anzahl: weg }
    const lesen: string[] = []
    for (const e of liste) {
      const alt = this.staende.get(e.pfad)
      if (alt && alt.groesse === e.groesse && alt.geaendert === e.geaendert) continue
      if (liestText(e.pfad)) lesen.push(e.pfad)
      else geaendert = true
    }
    for (const p of this.staende.keys()) {
      if (neu.has(p)) continue
      geaendert = true
      const t = this.texte.get(p)
      // Von außen gelöscht. Ungespeicherter Text geht nicht verloren: Die Datei entsteht neu.
      if (t?.offen) {
        this.texte.set(p, { ...t, stempel: null })
        this.planeSchreiben(p, this.o.wartezeit ?? 1000)
      } else this.texte.delete(p)
    }
    this.staende = neu
    for (const d of await this.ablage.texteLesen(lesen)) if (await this.vergleiche(d)) geaendert = true
    this.fehlerWeg()
    if (geaendert) this.melde()
  }

  /** Übernimmt eine gelesene Datei. Liefert true, wenn sich etwas Sichtbares geändert hat. */
  private async vergleiche(d: TextDatei): Promise<boolean> {
    this.staende.set(d.pfad, { pfad: d.pfad, groesse: d.groesse, geaendert: d.geaendert })
    const e = this.texte.get(d.pfad)
    if (e?.stempel === d.stempel) return false
    if (!e || !e.offen || e.text === d.text) {
      this.texte.set(d.pfad, { text: d.text, stempel: d.stempel, offen: false })
      return e?.text !== d.text
    }
    // Hier ungespeichert, dort anders: der eigene Text wird Konfliktkopie, die Datei behält den fremden Stand
    const kopie = konfliktPfad(d.pfad, geraet())
    this.texte.set(kopie, { text: e.text, stempel: null, offen: true })
    this.texte.set(d.pfad, { text: d.text, stempel: d.stempel, offen: false })
    this.planeSchreiben(kopie, 0)
    return true
  }

  private fehler(x: unknown) {
    this.zustand = 'fehler'
    this.letzterFehler = String((x as Error)?.message ?? x)
  }

  private fehlerWeg() {
    this.zustand = 'bereit'
    this.letzterFehler = ''
  }

  /** Legt ein Original (PDF, Foto) im Ordner ab. Eine vorhandene Datei wird nie ersetzt. */
  async hochladen(pfad: string, blob: Blob): Promise<void> {
    const r = await this.inReihe(async () => this.ablage.schreibeWenn(pfad, new Uint8Array(await blob.arrayBuffer()), null))
    if (r.art !== 'ok') throw new Error(`${pfad} gibt es schon`)
    this.staende.set(pfad, { pfad, groesse: r.groesse, geaendert: r.geaendert })
    this.melde()
  }

  /** Binärdatei (PDF, Foto) aus dem Ordner; null, wenn sie fehlt (z. B. von Syncthing noch nicht gebracht) */
  async binaer(pfad: string): Promise<Blob | null> {
    try {
      const b = await this.ablage.leseDatei(pfad)
      const typ = TYPEN[pfad.slice(pfad.lastIndexOf('.') + 1).toLowerCase()] ?? ''
      return new Blob([b as Uint8Array<ArrayBuffer>], { type: typ })
    } catch {
      return null
    }
  }

  /** Die Kopie ersetzt das Original; danach verschwindet die Kopie */
  async uebernehmeKonflikt(kopie: string): Promise<void> {
    const original = (this.kopien().get(kopie) ?? this.kopienJetzt().get(kopie))?.original
    if (!original) return
    const text = this.text(kopie)
    if (text !== undefined) {
      await this.schreibe(original, text)
      await this.speichereJetzt(original)
      // Kam dabei selbst ein Konflikt heraus, bleibt die Kopie, damit nichts verloren geht
      if (this.text(original) !== text || this.texte.get(original)?.offen) return
    } else {
      const b = await this.ablage.leseDatei(kopie)
      const stempel = (await this.ablage.texteLesen([original]))[0]?.stempel ?? null
      const r = await this.inReihe(() => this.ablage.schreibeWenn(original, b, stempel))
      if (r.art !== 'ok') return
      this.staende.set(original, { pfad: original, groesse: r.groesse, geaendert: r.geaendert })
    }
    await this.verwerfeKonflikt(kopie)
  }

  /** Die Kopie wird gelöscht, das Original bleibt (Versionierung bzw. Papierkorb des Sync-Programms behält sie eine Weile) */
  async verwerfeKonflikt(kopie: string): Promise<void> {
    const k = this.kopien().get(kopie) ?? this.kopienJetzt().get(kopie)
    if (!k || !loeschbareKopie(kopie, k.original, (p) => this.text(p) ?? (this.staende.has(p) ? '' : undefined))) return
    clearTimeout(this.uhren.get(kopie))
    await this.inReihe(() => this.ablage.konfliktLoeschen(kopie, k.original))
    this.texte.delete(kopie)
    this.staende.delete(kopie)
    this.melde()
  }

  /**
   * Löst Konfliktkopien, bei denen nichts verloren gehen kann (gleicher Inhalt, eine Seite leer oder halb übertragen,
   * Protokolle zusammenführen; `automatisch()` in kern). Läuft nach dem Öffnen und nach jeder Abfrage. Fehler lassen den
   * Konflikt einfach stehen, dann entscheidet der Mensch.
   */
  private async aufloesen(): Promise<void> {
    if (this.aufloesenLaeuft || this.pause) return
    this.aufloesenLaeuft = true
    const vorher = this.automatischErledigt
    try {
      for (const k of this.kopienJetzt().values()) {
        try {
          if (await this.loeseAutomatisch(k)) this.automatischErledigt++
        } catch {
          // bleibt als Konflikt stehen
        }
      }
    } finally {
      this.aufloesenLaeuft = false
      if (this.automatischErledigt !== vorher) this.melde()
    }
  }

  private async loeseAutomatisch(k: SyncKopie): Promise<boolean> {
    const kt = this.texte.get(k.kopie)
    const ot = this.texte.get(k.original)
    if (kt?.offen || ot?.offen) return false
    if (liestText(k.kopie)) {
      if (!kt) return false
      const a = automatisch(k.original, ot?.text, kt.text)
      if (!a) return false
      if (a.art === 'weg') await this.verwerfeKonflikt(k.kopie)
      else if (a.art === 'uebernehmen') await this.uebernehmeKonflikt(k.kopie)
      else {
        await this.schreibe(k.original, a.text)
        await this.speichereJetzt(k.original)
        if (this.text(k.original) !== a.text || this.texte.get(k.original)?.offen) return false
        await this.verwerfeKonflikt(k.kopie)
      }
      return !this.staende.has(k.kopie) && !this.texte.has(k.kopie)
    }
    // Binärdateien (PDF, Foto): leere Seite oder Byte für Byte gleich
    const sk = this.staende.get(k.kopie)
    const so = this.staende.get(k.original)
    if (!sk || !so) return false
    if (sk.groesse === 0) await this.verwerfeKonflikt(k.kopie)
    else if (so.groesse === 0) await this.uebernehmeKonflikt(k.kopie)
    else if (sk.groesse === so.groesse && sk.groesse <= BINAER_VERGLEICH_BIS) {
      const [a, b] = await Promise.all([this.ablage.leseDatei(k.kopie), this.ablage.leseDatei(k.original)])
      if (a.length !== b.length || a.some((x, i) => x !== b[i])) return false
      await this.verwerfeKonflikt(k.kopie)
    } else return false
    return !this.staende.has(k.kopie)
  }
}
