// Offline-Kopie des Datenordners im Browser (IndexedDB) und Abgleich mit dem Server.
// Jede Änderung wird zuerst lokal gespeichert und später mit dem Stand (Hash) hochgeladen, auf dem sie beruht.
// Lehnt der Server ab (409), weil ein anderes Gerät inzwischen geändert hat, entsteht eine Konfliktkopie
// `*.sync-conflict-*` (Vertrag 8), und die Fassung des Servers wird übernommen. Es geht nie etwas verloren.
import { istText, zerlege } from '@rvx/kern'

interface TextEintrag {
  pfad: string
  text: string
  /** Hash des Server-Stands, auf dem der Text beruht; null = auf dem Server noch nicht vorhanden */
  basis: string | null
  lokal: boolean
  geloescht?: boolean
}

interface BinaerEintrag {
  pfad: string
  blob: Blob
  basis: string | null
  lokal: boolean
}

export type SyncZustand = 'bereit' | 'laeuft' | 'offline' | 'fehler'

export interface SpeicherOptionen {
  app: string
  /** Welche Textdateien diese App abgleicht (die Lern-App braucht z. B. `arbeit/` nicht) */
  filter: (pfad: string) => boolean
  api?: string
}

function anfrage<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fehler) => {
    r.onsuccess = () => ok(r.result)
    r.onerror = () => fehler(r.error)
  })
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

export function konfliktPfad(pfad: string, g: string, d = new Date()): string {
  const st = d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const punkt = pfad.lastIndexOf('.')
  return punkt > pfad.lastIndexOf('/') ? `${pfad.slice(0, punkt)}.sync-conflict-${st}-${g}${pfad.slice(punkt)}` : `${pfad}.sync-conflict-${st}-${g}`
}

let hochladenLaeuft = 0

/** Lädt gerade ein Original (PDF, Foto) hoch? Dann wartet das automatische Neuladen (aktualisierung.ts). */
export const laedtHoch = () => hochladenLaeuft > 0

export class Speicher {
  private db!: IDBDatabase
  private texte = new Map<string, TextEintrag>()
  private fern = new Map<string, string>()
  private hoerer = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private laeuft: Promise<void> | null = null
  private nochmal = false
  zustand: SyncZustand = 'bereit'
  letzterFehler = ''
  version = 0
  /** Zeit des letzten vollständigen Abgleichs (0 = seit dem Start noch keiner): erst dann ist der Stand des Servers bekannt */
  abgeglichen = 0

  constructor(private o: SpeicherOptionen) {}

  async oeffne(): Promise<void> {
    const r = indexedDB.open(`rvx-${this.o.app}`, 1)
    r.onupgradeneeded = () => {
      r.result.createObjectStore('texte', { keyPath: 'pfad' })
      r.result.createObjectStore('binaer', { keyPath: 'pfad' })
      r.result.createObjectStore('meta')
    }
    this.db = await anfrage(r)
    const alle = await anfrage(this.db.transaction('texte').objectStore('texte').getAll() as IDBRequest<TextEintrag[]>)
    for (const e of alle) this.texte.set(e.pfad, e)
    const f = (await anfrage(this.db.transaction('meta').objectStore('meta').get('fern'))) as [string, string][] | undefined
    if (f) this.fern = new Map(f)
    this.melde()
    addEventListener('online', () => this.planen(0))
    setInterval(() => this.planen(0), 30_000)
    this.planen(0)
  }

  abonniere(f: () => void): () => void {
    this.hoerer.add(f)
    return () => this.hoerer.delete(f)
  }

  private melde() {
    this.version++
    for (const f of this.hoerer) f()
  }

  /** Alle sichtbaren Textdateien (ohne gelöschte) */
  alleTexte(): Map<string, string> {
    const m = new Map<string, string>()
    for (const e of this.texte.values()) if (!e.geloescht) m.set(e.pfad, e.text)
    return m
  }

  text(pfad: string): string | undefined {
    const e = this.texte.get(pfad)
    return e && !e.geloescht ? e.text : undefined
  }

  /** Pfade aller Dateien, die der Server kennt oder die lokal neu sind (auch Binärdateien) */
  pfade(): string[] {
    const s = new Set(this.fern.keys())
    for (const e of this.texte.values()) if (!e.geloescht) s.add(e.pfad)
    return [...s].sort()
  }

  ungesichert(): number {
    let n = 0
    for (const e of this.texte.values()) if (e.lokal) n++
    return n
  }

  konflikte(): string[] {
    return [...this.texte.keys()].filter((p) => p.includes('.sync-conflict-') && !this.texte.get(p)!.geloescht)
  }

  private async speichereEintrag(e: TextEintrag) {
    this.texte.set(e.pfad, e)
    await anfrage(this.db.transaction('texte', 'readwrite').objectStore('texte').put(e))
  }

  private async entferneEintrag(pfad: string) {
    this.texte.delete(pfad)
    await anfrage(this.db.transaction('texte', 'readwrite').objectStore('texte').delete(pfad))
  }

  async schreibe(pfad: string, text: string): Promise<void> {
    const alt = this.texte.get(pfad)
    if (alt && !alt.geloescht && alt.text === text) return
    await this.speichereEintrag({ pfad, text, basis: alt?.basis ?? null, lokal: true })
    this.melde()
    this.planen(1500)
  }

  /** Ändert eine Datei anhand ihres aktuellen Stands (verhindert, dass zwei Änderungen sich überschreiben) */
  async aendere(pfad: string, f: (alt: string) => string): Promise<void> {
    const alt = this.text(pfad) ?? ''
    const neu = f(alt)
    if (neu !== alt) await this.schreibe(pfad, neu)
  }

  async loesche(pfad: string): Promise<void> {
    const alt = this.texte.get(pfad)
    if (!alt) return
    if (alt.basis === null) await this.entferneEintrag(pfad)
    else await this.speichereEintrag({ ...alt, geloescht: true, lokal: true })
    this.melde()
    this.planen(1500)
  }

  async hochladen(pfad: string, blob: Blob): Promise<void> {
    await anfrage(this.db.transaction('binaer', 'readwrite').objectStore('binaer').put({ pfad, blob, basis: null, lokal: true } satisfies BinaerEintrag))
    this.melde()
    this.planen(0)
  }

  /** Binärdatei (PDF, Foto): aus dem Cache oder vom Server, danach offline verfügbar */
  async binaer(pfad: string): Promise<Blob | null> {
    const e = (await anfrage(this.db.transaction('binaer').objectStore('binaer').get(pfad))) as BinaerEintrag | undefined
    const fernHash = this.fern.get(pfad)
    if (e && (e.lokal || !fernHash || e.basis === fernHash || !navigator.onLine)) return e.blob
    try {
      const r = await fetch(`${this.api}/datei?pfad=${encodeURIComponent(pfad)}`)
      if (!r.ok) return e?.blob ?? null
      const blob = await r.blob()
      await anfrage(this.db.transaction('binaer', 'readwrite').objectStore('binaer').put({ pfad, blob, basis: r.headers.get('x-hash'), lokal: false } satisfies BinaerEintrag))
      return blob
    } catch {
      return e?.blob ?? null
    }
  }

  private get api() {
    return this.o.api ?? '/api'
  }

  planen(ms: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), ms)
  }

  async sync(): Promise<void> {
    if (this.laeuft) {
      this.nochmal = true
      return this.laeuft
    }
    this.laeuft = this.abgleich().finally(() => {
      this.laeuft = null
      if (this.nochmal) {
        this.nochmal = false
        this.planen(0)
      }
    })
    return this.laeuft
  }

  private async put(pfad: string, inhalt: BodyInit, basis: string | null): Promise<{ ok: true; hash: string } | { ok: false }> {
    const r = await fetch(`${this.api}/datei?pfad=${encodeURIComponent(pfad)}`, { method: 'PUT', headers: { 'x-basis': basis ?? 'neu' }, body: inhalt })
    if (r.status === 409) return { ok: false }
    if (!r.ok) throw new Error(`Hochladen fehlgeschlagen (${r.status})`)
    return { ok: true, hash: ((await r.json()) as { hash: string }).hash }
  }

  private async originaleHochladen() {
    const binaer = (await anfrage(this.db.transaction('binaer').objectStore('binaer').getAll() as IDBRequest<BinaerEintrag[]>)).filter((b) => b.lokal)
    if (!binaer.length) return
    hochladenLaeuft++
    this.melde() // Tinte und Notizen der anderen Geräte sind jetzt schon da
    try {
      for (const b of binaer) {
        const r = await this.put(b.pfad, b.blob, b.basis)
        // Originale sind unveränderlich (Vertrag 1.5): ein Konflikt heißt, die Datei gibt es schon
        await anfrage(this.db.transaction('binaer', 'readwrite').objectStore('binaer').put({ ...b, lokal: false, basis: r.ok ? r.hash : null }))
      }
    } finally {
      hochladenLaeuft--
    }
  }

  private async holeText(pfad: string): Promise<{ text: string; hash: string } | null> {
    const r = await fetch(`${this.api}/datei?pfad=${encodeURIComponent(pfad)}`)
    if (r.status === 404) return null
    if (!r.ok) throw new Error(`Laden fehlgeschlagen (${r.status})`)
    return { text: await r.text(), hash: r.headers.get('x-hash') ?? '' }
  }

  private async abgleich(): Promise<void> {
    if (!navigator.onLine) {
      this.zustand = 'offline'
      this.melde()
      return
    }
    this.zustand = 'laeuft'
    this.melde()
    try {
      // 1. Eigene Änderungen hochladen
      for (const e of [...this.texte.values()].filter((x) => x.lokal)) {
        if (e.geloescht) {
          const r = await fetch(`${this.api}/datei?pfad=${encodeURIComponent(e.pfad)}`, { method: 'DELETE', headers: { 'x-basis': e.basis ?? '' } })
          if (r.ok || r.status === 409) await this.entferneEintrag(e.pfad) // bei 409 kommt die neuere Fassung gleich wieder
          continue
        }
        const r = await this.put(e.pfad, e.text, e.basis)
        if (r.ok) {
          // Inzwischen weitergeschrieben? Dann bleibt die Datei lokal geändert, nur der Stand rückt nach.
          const jetzt = this.texte.get(e.pfad)!
          await this.speichereEintrag({ ...jetzt, basis: r.hash, lokal: jetzt.text !== e.text })
        } else await this.konflikt(e)
      }
      // 2. Stand des Servers holen
      const r = await fetch(`${this.api}/liste`)
      if (!r.ok) throw new Error(`Server antwortet nicht (${r.status})`)
      const liste = (await r.json()) as { pfad: string; hash: string }[]
      this.fern = new Map(liste.map((x) => [x.pfad, x.hash]))
      await anfrage(this.db.transaction('meta', 'readwrite').objectStore('meta').put([...this.fern], 'fern'))
      let gemeldet = Date.now()
      for (const { pfad, hash } of liste) {
        if (!istText(pfad) || !this.o.filter(pfad)) continue
        const e = this.texte.get(pfad)
        if (e?.lokal || e?.basis === hash) continue
        const t = await this.holeText(pfad)
        if (t) await this.speichereEintrag({ pfad, text: t.text, basis: t.hash, lokal: false })
        // Beim ersten Abgleich sind es viele Dateien: Was schon da ist, gleich zeigen
        if (Date.now() - gemeldet > 1000) {
          gemeldet = Date.now()
          this.melde()
        }
      }
      // 3. Auf dem Server gelöschte Dateien auch hier entfernen (nur unveränderte)
      for (const e of [...this.texte.values()]) if (!e.lokal && e.basis !== null && !this.fern.has(e.pfad)) await this.entferneEintrag(e.pfad)
      // 4. Neue Originale (PDF, Foto) zuletzt hochladen: Ein großes PDF dauert, und bricht es ab (Netz weg,
      // Seite neu geladen), sollen Tinte und Notizen der anderen Geräte trotzdem schon angekommen sein.
      await this.originaleHochladen()

      this.zustand = 'bereit'
      this.letzterFehler = ''
      this.abgeglichen = Date.now()
    } catch (err) {
      this.zustand = navigator.onLine ? 'fehler' : 'offline'
      this.letzterFehler = String((err as Error)?.message ?? err)
    }
    this.melde()
  }

  /**
   * Ein anderes Gerät war schneller. Ein Tagesjournal, das auf zwei Geräten offline neu entstand, wird
   * zusammengeführt (der eigene Text kommt unten an). Alles andere bekommt eine Konfliktkopie.
   */
  private async konflikt(e: TextEintrag) {
    const server = await this.holeText(e.pfad)
    if (!server) return this.speichereEintrag({ ...e, basis: null })
    if (e.basis === null && e.pfad.startsWith('arbeit/journal/')) {
      const eigener = zerlege(e.text).rumpf.trim()
      const text = eigener ? `${server.text.replace(/\n*$/, '')}\n\n${eigener}\n` : server.text
      await this.speichereEintrag({ pfad: e.pfad, text, basis: server.hash, lokal: text !== server.text })
      return
    }
    const kopie = konfliktPfad(e.pfad, geraet())
    await this.speichereEintrag({ pfad: kopie, text: e.text, basis: null, lokal: true })
    await this.speichereEintrag({ pfad: e.pfad, text: server.text, basis: server.hash, lokal: false })
    this.nochmal = true
  }
}
