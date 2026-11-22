// Platz einfügen (Vertrag Lernen 1.14): alles ab einer Höhe rückt nach unten, darüber bleibt byte-gleich
import { describe, expect, it } from 'vitest'
import { A4, blattFormat, buchSeiteJson, fuegePlatzEin, liesBuchSeite, liesMarken, liesTinte, markenZeile, tinteSvg, verschiebePfad, type BuchSeite, type Strich } from '../src'

const strich = (y: number, farbe: Strich['farbe'] = 'alltag'): Strich => ({
  farbe,
  breite: 3,
  punkte: [
    [100, y, 0.5],
    [200, y + 10, 0.5]
  ],
  d: `M100.0 ${y.toFixed(1)}L200.0 ${(y + 10).toFixed(1)}L200.0 ${(y + 12).toFixed(1)}Z`
})

const HOEHE = 1000 * A4
const tinte = tinteSvg([strich(100), strich(600, 'wichtig')], HOEHE)
const seite: BuchSeite = {
  bilder: [
    { id: 'oben', anhang: 'A', x: 48, y: 50, b: 400, h: 100 },
    { id: 'unten', anhang: 'A', x: 48, y: 700, b: 400, h: 100 }
  ],
  verweise: [
    { id: 'ganz', y: 0, anhang: 'S', seite: 3 },
    { id: 'v1', y: 120, anhang: 'S', seite: 4 },
    { id: 'v2', y: 700, anhang: 'S', seite: 5, marke: 'm1', bild: 'unten' }
  ],
  texte: [
    { id: 't1', x: 80, y: 200, b: 500, text: 'oben' },
    { id: 't2', x: 80, y: 650, b: 500, text: 'Gilt nur für $I$ konstant' }
  ],
  rest: {}
}
const marken = [
  markenZeile({ id: 'mo', seite: 1, text: 'Oben', bereich: { x: 0.1, y: 0.1, b: 0.3, h: 0.05 }, datum: '2026-11-22', farbe: null }),
  markenZeile({ id: 'mu', seite: 1, text: 'Unten', bereich: { x: 0.1, y: 0.62, b: 0.3, h: 0.05 }, datum: '2026-11-22', farbe: null }),
  markenZeile({ id: 'andere', seite: 2, text: 'Andere Seite', bereich: { x: 0.1, y: 0.9, b: 0.3, h: 0.05 }, datum: '2026-11-22', farbe: null })
].join('\n') + '\n'
const vorher = { tinte, seite: buchSeiteJson(seite), marken, nr: 1 }

describe('Platz einfügen', () => {
  const n = fuegePlatzEin(vorher, 500, 200)

  it('Striche ab der Höhe rücken samt Umriss, die darüber bleiben byte-gleich', () => {
    const alt = liesTinte(tinte)
    const neu = liesTinte(n.tinte!)
    expect(neu[0]).toEqual(alt[0])
    expect(neu[1].punkte.map((p) => p[1])).toEqual([800, 810])
    expect(neu[1].d).toBe('M100.0 800.0L200.0 810.0L200.0 812.0Z')
    // die Zeile des oberen Strichs steht unverändert in der neuen Datei
    expect(n.tinte!).toContain(tinte.split('\n')[1])
  })

  it('Bilder, Textfelder und Verweise darunter rücken, darüber und ganz oben nicht', () => {
    const s = liesBuchSeite(n.seite!)
    expect(s.bilder.map((b) => [b.id, b.y])).toEqual([['oben', 50], ['unten', 900]])
    expect(s.texte!.map((t) => [t.id, t.y])).toEqual([['t1', 200], ['t2', 850]])
    expect(s.verweise.map((v) => [v.id, v.y])).toEqual([['ganz', 0], ['v1', 120], ['v2', 900]])
    // Strich, Bild, Textfeld, Verweis, Markierung
    expect(n.gerueckt).toBe(5)
  })

  it('Markierungen dieser Seite rücken in Seitenbreiten, andere Zeilen bleiben byte-gleich', () => {
    const m = liesMarken(n.marken!)
    expect(m.find((x) => x.id === 'mu')!.bereich.y).toBeCloseTo(0.82, 5)
    const zeilen = n.marken!.split('\n')
    const alt = marken.split('\n')
    expect(zeilen[0]).toBe(alt[0])
    expect(zeilen[2]).toBe(alt[2])
  })

  it('die Seite wird nur so lang wie nötig, kürzer nie', () => {
    // vorher reichte A4 (1414); unten liegt jetzt das Bild bis 1000, also bleibt A4
    expect(n.format).toBeCloseTo(A4, 5)
    const weit = fuegePlatzEin(vorher, 500, 900)
    // Bild unten: 700 + 900 + 100 = 1700, dazu 24 Rand
    expect(blattFormat(weit.tinte)).toBeCloseTo(1724 / 1000, 5)
    expect(weit.format).toBeCloseTo(1.724, 5)
  })

  it('nichts darunter: nichts zu schreiben', () => {
    const n2 = fuegePlatzEin(vorher, 1300, 200)
    expect(n2).toEqual({ tinte: null, seite: null, marken: null, format: A4, gerueckt: 0 })
    expect(fuegePlatzEin(vorher, 500, 0).gerueckt).toBe(0)
  })

  it('nur Bilder darunter: die Tinte bleibt unberührt, solange die Seite reicht', () => {
    const t = tinteSvg([strich(100)], HOEHE)
    const n3 = fuegePlatzEin({ ...vorher, tinte: t, marken: null }, 500, 100)
    expect(n3.tinte).toBeNull()
    expect(n3.marken).toBeNull()
    expect(liesBuchSeite(n3.seite!).bilder[1].y).toBe(800)
  })

  it('Seite ohne Tinte, die wachsen muss, bekommt eine leere Tinte mit neuer Höhe', () => {
    const n4 = fuegePlatzEin({ tinte: null, seite: buchSeiteJson(seite), marken: null, nr: 1 }, 600, 1000)
    expect(liesTinte(n4.tinte!)).toEqual([])
    expect(blattFormat(n4.tinte)).toBeGreaterThan(A4)
  })

  it('Rückgängig: die alten Texte sind unverändert geblieben (die App schreibt sie zurück)', () => {
    // fuegePlatzEin ist rein: die Eingabe bleibt, wie sie war, und ist damit der byte-gleiche alte Stand
    expect(vorher.tinte).toBe(tinte)
    expect(vorher.seite).toBe(buchSeiteJson(seite))
    expect(vorher.marken).toBe(marken)
  })
})

describe('Pfad verschieben', () => {
  it('absolute Paare rücken, x und Schreibweise bleiben', () => {
    expect(verschiebePfad('M10.0 20.0L30.5 40.5Z', 5)).toBe('M10.0 25.0L30.5 45.5Z')
    expect(verschiebePfad('M10,20 C1,2 3,4 5,6', 1)).toBe('M10,21 C1,3 3,5 5,7')
    expect(verschiebePfad('M0 0H50V10', 2)).toBe('M0 2H50V12')
    // relative Befehle rücken nicht, ein relatives m am Anfang schon (nur sein erstes Paar)
    expect(verschiebePfad('m10 20 5 5l3 3z', 4)).toBe('m10 24 5 5l3 3z')
  })
})
