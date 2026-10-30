import { describe, expect, it } from 'vitest'
import { Bestand, felder, fotoInfo, lesbar, setzeFotoInfo, suche, zerlege } from '../src'

const SIDECAR = `---
id: 01JTESTFOTO000000000000001
typ: anhang
titel: IMG_2041
datei: anhaenge/2026/10/IMG_2041.jpg
abgeleitet:
  ocr: x
---
`

describe('Fotos benennen (Vertrag 5.1)', () => {
  it('schreibt Name und mehrzeilige Beschreibung und liest sie zurück', () => {
    const t = setzeFotoInfo(SIDECAR, { name: '  Lichtschalter  Flur ', beschreibung: 'Zeile 1  \nZeile: 2 # mit Zeichen\n\n' })
    const f = felder(zerlege(t).kopf)
    expect(f.name).toBe('Lichtschalter Flur')
    expect(f.beschreibung).toBe('Zeile 1\nZeile: 2 # mit Zeichen')
    // Der übrige Kopf, auch der Block der Pipeline, bleibt unverändert
    expect(t).toContain('abgeleitet:\n  ocr: x')
    expect(zerlege(t).kopf!.split('\n')).toHaveLength(8)
  })

  it('leere Felder fallen weg, ohne Namen bleibt es bei „Foto“', () => {
    const mit = setzeFotoInfo(SIDECAR, { name: 'A', beschreibung: 'B' })
    expect(setzeFotoInfo(mit, { name: ' ', beschreibung: '' })).toBe(SIDECAR)
    const b = new Bestand(new Map([['gemeinsam/anhaenge/f.md', SIDECAR]]))
    expect(fotoInfo(b.dokumente.get('01JTESTFOTO000000000000001'))).toBeNull()
  })

  it('die Suche findet ein Foto über Name und Beschreibung', () => {
    const b = new Bestand(
      new Map([
        ['gemeinsam/anhaenge/f.md', setzeFotoInfo(SIDECAR, { name: 'Lichtschalter', beschreibung: 'Ausgang 9 invertiert' })],
        ['arbeit/journal/2026/2026-10-30.md', `---\nid: 01JTESTJ202610300000000000\ntyp: journal\ntitel: Journal\ndatum: 2026-10-30\n---\n# #dd_x\nText\n![[01JTESTFOTO000000000000001|Foto]]\n`]
      ])
    )
    const t = suche(b, 'invertiert')
    expect(t).toHaveLength(1)
    expect(t[0].text).toContain('Lichtschalter')
    expect(lesbar('a ![[X|Foto]] b')).toBe('a  b')
  })
})
