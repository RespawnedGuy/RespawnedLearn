// Ein Datenordner im Arbeitsspeicher: für Tests (mehrere Geräte auf einer Platte, Syncthing nachgestellt) und für
// `npm run dev` im Browser, wo es keinen echten Ordner gibt. Verhält sich wie die Rust-Befehle in ordner.rs.
import { loeschbareKopie } from '@rl/kern'
import type { Ablage, Geschrieben, OrdnerEintrag, TextDatei } from './ordner'

interface Datei {
  inhalt: Uint8Array
  geaendert: number
  /** zählt jede Änderung hoch; steht im Stempel wie in Rust die Prüfsumme */
  nr: number
}

/** Der gemeinsame Ordner. `schreibe` und `loesche` von außen entsprechen dem, was Syncthing tut. */
export class Platte {
  readonly dateien = new Map<string, Datei>()
  private hoerer = new Set<() => void>()
  private nr = 0

  stempel(pfad: string): string | null {
    const d = this.dateien.get(pfad)
    return d ? `${d.inhalt.length}:${d.nr}` : null
  }

  /** Von außen schreiben (Syncthing, anderer Editor) */
  schreibe(pfad: string, inhalt: Uint8Array | string) {
    const b = typeof inhalt === 'string' ? new TextEncoder().encode(inhalt) : inhalt
    this.dateien.set(pfad, { inhalt: b, geaendert: Date.now(), nr: ++this.nr })
    this.melde()
  }

  loesche(pfad: string) {
    if (this.dateien.delete(pfad)) this.melde()
  }

  text(pfad: string): string | undefined {
    const d = this.dateien.get(pfad)
    return d ? new TextDecoder().decode(d.inhalt) : undefined
  }

  hoere(f: () => void): () => void {
    this.hoerer.add(f)
    return () => this.hoerer.delete(f)
  }

  private melde() {
    // Wie die Dateiüberwachung: etwas später, nicht im selben Takt
    for (const f of [...this.hoerer]) setTimeout(f, 0)
  }
}

/** Sicht eines Geräts auf die Platte. `stumm` stellt Android nach, wo die Überwachung nichts meldet. */
export function ablageImSpeicher(platte = new Platte(), o: { stumm?: boolean; abfrageMs?: number; dauerhaft?: boolean } = {}): Ablage {
  const eintrag = (pfad: string, d: Datei): OrdnerEintrag => ({ pfad, groesse: d.inhalt.length, geaendert: d.geaendert })
  return {
    async dateien() {
      return [...platte.dateien].map(([p, d]) => eintrag(p, d)).sort((a, b) => a.pfad.localeCompare(b.pfad))
    },
    async texteLesen(pfade) {
      const out: TextDatei[] = []
      for (const p of pfade) {
        const d = platte.dateien.get(p)
        if (d) out.push({ ...eintrag(p, d), stempel: platte.stempel(p)!, text: new TextDecoder().decode(d.inhalt) })
      }
      return out
    },
    async leseDatei(pfad) {
      const d = platte.dateien.get(pfad)
      if (!d) throw new Error(`${pfad}: nicht gefunden`)
      return d.inhalt
    },
    async schreibeWenn(pfad, inhalt, erwartet): Promise<Geschrieben> {
      if (platte.stempel(pfad) !== erwartet) return { art: 'geaendert' }
      platte.schreibe(pfad, inhalt)
      const d = platte.dateien.get(pfad)!
      return { art: 'ok', groesse: d.inhalt.length, geaendert: d.geaendert, stempel: platte.stempel(pfad)! }
    },
    async konfliktLoeschen(pfad, original) {
      if (!loeschbareKopie(pfad, original, (p) => platte.text(p))) throw new Error(`${pfad} ist keine Konfliktkopie, die App löscht nur Konfliktkopien`)
      platte.loesche(pfad)
    },
    async beobachte(rueckruf) {
      return o.stumm ? () => {} : platte.hoere(rueckruf)
    },
    abfrageMs: o.abfrageMs ?? 0,
    dauerhaft: o.dauerhaft ?? true
  }
}
