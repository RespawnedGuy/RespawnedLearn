// Entscheidungen in der Konfliktansicht mit Frist: Erst nach FRIST_MS wird die andere Fassung gelöscht, bis dahin
// lässt sich alles rückgängig machen. Löschen verteilt Syncthing auf alle Geräte, ein Fehltipp darf das nicht auslösen.
// Bewusst außerhalb der Ansicht: Wer die Konfliktseite verlässt, behält die Entscheidung; wer die App schließt, bevor die
// Frist abläuft, verliert nichts (beide Fassungen bleiben, der Konflikt erscheint beim nächsten Start wieder).

export const FRIST_MS = 10_000

/** Welche Fassung bleibt: die Datei selbst oder die Konfliktkopie */
export type Wahl = 'datei' | 'kopie'

export interface Offen {
  wahl: Wahl
  /** Zeitpunkt (ms), zu dem gelöscht wird */
  bis: number
}

interface Ziel {
  verwerfeKonflikt(kopie: string): Promise<void>
  uebernehmeKonflikt(kopie: string): Promise<void>
}

export class Entscheidungen {
  private offenListe = new Map<string, Offen & { uhr: ReturnType<typeof setTimeout> }>()
  private fehlerListe = new Map<string, string>()
  private hoerer = new Set<() => void>()
  /** Zählt jede Änderung hoch (für useSyncExternalStore) */
  stand = 0

  constructor(
    private ziel: Ziel,
    private frist = FRIST_MS
  ) {}

  /** Merkt die Wahl vor; ausgeführt wird sie erst nach der Frist */
  waehle(kopie: string, wahl: Wahl): void {
    this.rueckgaengig(kopie, false)
    this.fehlerListe.delete(kopie)
    const uhr = setTimeout(() => void this.fuehreAus(kopie), this.frist)
    this.offenListe.set(kopie, { wahl, bis: Date.now() + this.frist, uhr })
    this.melde()
  }

  rueckgaengig(kopie: string, melden = true): void {
    const o = this.offenListe.get(kopie)
    if (!o) return
    clearTimeout(o.uhr)
    this.offenListe.delete(kopie)
    if (melden) this.melde()
  }

  offen(kopie: string): Offen | undefined {
    const o = this.offenListe.get(kopie)
    return o && { wahl: o.wahl, bis: o.bis }
  }

  fehler(kopie: string): string | undefined {
    return this.fehlerListe.get(kopie)
  }

  abonniere(f: () => void): () => void {
    this.hoerer.add(f)
    return () => void this.hoerer.delete(f)
  }

  private async fuehreAus(kopie: string): Promise<void> {
    const o = this.offenListe.get(kopie)
    if (!o) return
    this.offenListe.delete(kopie)
    try {
      if (o.wahl === 'kopie') await this.ziel.uebernehmeKonflikt(kopie)
      else await this.ziel.verwerfeKonflikt(kopie)
    } catch (e) {
      this.fehlerListe.set(kopie, String((e as Error)?.message ?? e))
    }
    this.melde()
  }

  private melde() {
    this.stand++
    for (const f of this.hoerer) f()
  }
}

const jeSpeicher = new WeakMap<Ziel, Entscheidungen>()

/** Eine Liste offener Entscheidungen je Speicher, damit sie das Verlassen der Ansicht überlebt */
export function entscheidungenFuer(ziel: Ziel): Entscheidungen {
  let e = jeSpeicher.get(ziel)
  if (!e) jeSpeicher.set(ziel, (e = new Entscheidungen(ziel)))
  return e
}
