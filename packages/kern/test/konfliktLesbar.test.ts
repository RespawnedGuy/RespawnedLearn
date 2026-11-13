import { describe, expect, it } from 'vitest'
import { konfliktBeschreibung, konfliktHerkunft, lesbareZeilen, zeilenVergleich, zeitLesbar } from '../src'

const karte = (antwort: string) =>
  `---\nid: 01K\ntyp: frage\ntitel: Was muss eine Rufanlage tun?\nthema: "[[01M]]"\n---\n?? Was muss eine Rufanlage tun?\n:: ${antwort}\n`

describe('Konfliktansicht lesbar (Design-Prüfung W1)', () => {
  it('liest Gerät und Zeit aus dem Namen, auch Gerätenamen mit Bindestrich', () => {
    expect(konfliktHerkunft('lernen/karten/a.sync-conflict-20261112-183012-KMQQN77.md')).toEqual({ programm: 'Syncthing', geraet: 'KMQQN77', zeit: '2026-11-12T18:30' })
    expect(konfliktHerkunft('reviews/2026-11.pc.sync-conflict-20261113-070102-android-x1y2.jsonl')?.geraet).toBe('android-x1y2')
    expect(konfliktHerkunft('lernen/karten/a.md')).toBeNull()
    expect(zeitLesbar('2026-11-12T18:30')).toBe('12.11.2026, 18:30')
  })

  it('nennt Art und Titel statt Pfad mit Kennung', () => {
    expect(konfliktBeschreibung('lernen/karten/01K.md', karte('x'))).toEqual({ art: 'Lernkarte', titel: 'Was muss eine Rufanlage tun?' })
    expect(konfliktBeschreibung('lernen/karten/01N.md', '---\ntyp: notiz\ntitel: Tag 1\nthema: "[[01M]]"\n---\n').art).toBe('Mitschrift')
    expect(konfliktBeschreibung('lernen/karten/01N.md', '---\ntyp: notiz\ntitel: Lose\n---\n').art).toBe('Notiz')
    expect(konfliktBeschreibung('lernen/blaetter/01A/S001.svg', '<svg/>')).toEqual({ art: 'Zeichenblatt', titel: 'S001.svg' })
    expect(konfliktBeschreibung('lernen/einstellungen/ki-prompts.json', '{}').art).toBe('Anweisungen an die KI')
    expect(konfliktBeschreibung('etwas/anderes.bin').art).toBe('Datei')
  })

  it('schreibt die Kurzschrift der Lernkarte in Worten', () => {
    expect(lesbareZeilen('?? Frage hier\n:: Antwort da\nfrei\n')).toEqual(['Frage: Frage hier', 'Antwort: Antwort da', 'frei'])
  })

  it('vergleicht Zeilen wie diff: geändert, verschoben, doppelt', () => {
    expect(zeilenVergleich(['a', 'b', 'c'], ['a', 'B', 'c'])).toEqual([
      { art: 'gleich', text: 'a' },
      { art: 'weg', text: 'b' },
      { art: 'neu', text: 'B' },
      { art: 'gleich', text: 'c' }
    ])
    // Doppelte Zeile: ein Mengenvergleich hielte die zweite „x“ für gleich
    expect(zeilenVergleich(['x'], ['x', 'x']).map((z) => z.art)).toEqual(['gleich', 'neu'])
    // Verschoben: eine Zeile wandert ans Ende
    const v = zeilenVergleich(['1', '2', '3'], ['2', '3', '1'])
    expect(v.filter((z) => z.art !== 'gleich')).toEqual([
      { art: 'weg', text: '1' },
      { art: 'neu', text: '1' }
    ])
    expect(zeilenVergleich([], [])).toEqual([])
    expect(zeilenVergleich(['a'], []).map((z) => z.art)).toEqual(['weg'])
  })

  it('bleibt bei großen Dateien schnell', () => {
    const a = Array.from({ length: 1500 }, (_, i) => `z${i}`)
    const b = a.map((z, i) => (i % 2 ? z + '!' : z))
    const t = performance.now()
    const v = zeilenVergleich(a, b)
    expect(performance.now() - t).toBeLessThan(2000)
    expect(v.filter((z) => z.art === 'gleich').length).toBe(750)
    // Sehr groß: Rückfall, aber keine Zeile geht verloren
    const g = Array.from({ length: 3000 }, (_, i) => `z${i}`)
    const h = g.map((z, i) => (i === 1500 ? 'anders' : z))
    const w = zeilenVergleich(g, h)
    expect(w.filter((z) => z.art !== 'neu').map((z) => z.text)).toEqual(g)
    expect(w.filter((z) => z.art !== 'weg').map((z) => z.text)).toEqual(h)
  })
})
