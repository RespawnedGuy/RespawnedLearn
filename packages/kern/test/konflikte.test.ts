import { describe, expect, it } from 'vitest'
import { Bestand, istKonfliktkopie, konfliktOriginal } from '../src'

describe('Konfliktkopien (Vertrag Lernen, Grundlagen 8)', () => {
  it('erkennt Syncthings Namen und die der App', () => {
    expect(konfliktOriginal('lernen/fragen/a.sync-conflict-20261113-101010-ABCDEFG.md')).toBe('lernen/fragen/a.md')
    expect(konfliktOriginal('reviews/2026-11.pc-ab12.sync-conflict-20261113-070102-android-x1y2.jsonl')).toBe('reviews/2026-11.pc-ab12.jsonl')
    expect(konfliktOriginal('lernen/ohne-endung.sync-conflict-20261113-101010-ABCDEFG')).toBe('lernen/ohne-endung')
    // Name, den echtes Syncthing 1.30.0 bei zwei getrennt geänderten Fassungen erzeugt hat (Probe 2026-11-13)
    expect(konfliktOriginal('lernen/fragen/k.sync-conflict-20261113-071134-KMQQN77.md')).toBe('lernen/fragen/k.md')
    expect(konfliktOriginal('lernen/a.md')).toBeNull()
    // Nur der Dateiname zählt, nicht ein Ordner, der zufällig so heißt
    expect(istKonfliktkopie('x.sync-conflict-20261113-101010-ABCDEFG/a.md')).toBe(false)
    expect(istKonfliktkopie('lernen/a.sync-conflict-kaputt.md')).toBe(false)
  })

  it('eine Konfliktkopie verdrängt im Bestand nicht das Original mit derselben ID', () => {
    const karte = (titel: string) => `---\nid: k1\ntyp: frage\ntitel: ${titel}\n---\nText`
    // Reihenfolge absichtlich: Kopie zuletzt, sie würde sonst gewinnen
    const b = new Bestand(new Map([
      ['lernen/fragen/k1.md', karte('Original')],
      ['lernen/fragen/k1.sync-conflict-20261113-101010-ABCDEFG.md', karte('Kopie')]
    ]))
    expect(b.dokumente.get('k1')?.titel).toBe('Original')
    expect(b.dokumente.get('k1')?.pfad).toBe('lernen/fragen/k1.md')
  })
})
