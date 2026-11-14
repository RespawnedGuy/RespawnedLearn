// Skripte und Notizbücher umbenennen (Vertrag 5.1, 5.3): nur der angezeigte Name ändert sich
import { describe, expect, it } from 'vitest'
import { Bestand, benenneAnhang, benenneBuch, buchDokument, dateiTitel, felder, module, mitzubenennendeModule, stellenAnzeige, zerlege } from '../src'

const A = '01JTESTSKRIPT0000000000001'
const SIDECAR = `---
id: ${A}
typ: anhang
titel: ET2_Skript_WS26
datei: anhaenge/2026/11/ET2_Skript_WS26.pdf
sha256: abc
art: skript
---
`

const modul = (id: string, titel: string, quellen: string[]) => `---
id: ${id}
typ: modul
titel: ${titel}
quellen: [${quellen.map((q) => `"[[${q}]]"`).join(', ')}]
---
`

describe('Skript umbenennen', () => {
  it('setzt nur `name`; Dateiname, Datei und Prüfsumme bleiben', () => {
    const t = benenneAnhang(SIDECAR, '  Elektrotechnik\n 2 ')
    const f = felder(zerlege(t).kopf)
    expect(f.name).toBe('Elektrotechnik 2')
    expect(f.titel).toBe('ET2_Skript_WS26')
    expect(f.datei).toBe('anhaenge/2026/11/ET2_Skript_WS26.pdf')
    expect(f.sha256).toBe('abc')
    expect(t.replace(/^name: .*\n/m, '')).toBe(SIDECAR)
  })

  it('die Anzeige im Bestand nimmt den Namen, ein leerer Name bringt den Dateinamen zurück', () => {
    const t = benenneAnhang(SIDECAR, 'Elektrotechnik 2')
    const e = new Bestand(new Map([['gemeinsam/anhaenge/a.md', t]])).dokumente.get(A)!
    expect(e.titel).toBe('Elektrotechnik 2')
    expect(dateiTitel(e)).toBe('ET2_Skript_WS26')
    expect(benenneAnhang(t, '   ')).toBe(SIDECAR)
    expect(new Bestand(new Map([['gemeinsam/anhaenge/a.md', SIDECAR]])).dokumente.get(A)!.titel).toBe('ET2_Skript_WS26')
  })

  it('`name` an anderen Typen ändert deren Titel nicht', () => {
    const t = modul('01JTESTMODUL00000000000001', 'Modul', []).replace('typ: modul', 'typ: modul\nname: Anders')
    expect(new Bestand(new Map([['lernen/module/m.md', t]])).dokumente.get('01JTESTMODUL00000000000001')!.titel).toBe('Modul')
  })
})

describe('Buch (Modul mit einem PDF) wird mitbenannt', () => {
  const b = new Bestand(
    new Map([
      ['gemeinsam/anhaenge/a.md', SIDECAR],
      ['lernen/module/1.md', modul('01JTESTMODUL00000000000001', 'ET2_Skript_WS26', [A])],
      ['lernen/module/2.md', modul('01JTESTMODUL00000000000002', 'Eigener Name', [A])],
      ['lernen/module/3.md', modul('01JTESTMODUL00000000000003', 'ET2_Skript_WS26', [A, '01JTESTANDERES000000000001'])]
    ])
  )
  it('nur das Buch mit genau diesem PDF und bisher gleichem Namen', () => {
    expect(mitzubenennendeModule(module(b), A, 'ET2_Skript_WS26').map((m) => m.id)).toEqual(['01JTESTMODUL00000000000001'])
    expect(mitzubenennendeModule(module(b), A, 'Elektrotechnik 2')).toEqual([])
  })
})

describe('Notizbuch umbenennen', () => {
  const alt = buchDokument({ id: '01JTESTBUCH000000000000001', titel: 'Notizen ET2', lineatur: 'kariert', erstellt: '2026-11-14T10:00:00+01:00' })
  it('setzt `titel` und `geaendert`, der Rest bleibt', () => {
    const t = benenneBuch(alt, ' Übungen  Kapitel 3 ', '2026-11-14T18:00:00+01:00')
    const f = felder(zerlege(t).kopf)
    expect(f.titel).toBe('Übungen Kapitel 3')
    expect(f.geaendert).toBe('2026-11-14T18:00:00+01:00')
    expect(f.lineatur).toBe('kariert')
    expect(f.id).toBe('01JTESTBUCH000000000000001')
  })
  it('ein leerer Titel ändert nichts', () => {
    expect(benenneBuch(alt, '  ', '2026-11-14T18:00:00+01:00')).toBe(alt)
  })
})

describe('alte Kartentexte „Name, S. n“', () => {
  it('zeigen den aktuellen Namen, wenn die Seite passt', () => {
    expect(stellenAnzeige('ET2_Skript_WS26, S. 12', '12', 'Elektrotechnik 2')).toBe('Elektrotechnik 2, S. 12')
  })
  it('lassen andere Texte stehen', () => {
    expect(stellenAnzeige('Siehe Herleitung', '12', 'Elektrotechnik 2')).toBe('Siehe Herleitung')
    expect(stellenAnzeige('Skript, S. 13', '12', 'Elektrotechnik 2')).toBe('Skript, S. 13')
    expect(stellenAnzeige('Skript, S. 12', undefined, 'Elektrotechnik 2')).toBe('Skript, S. 12')
    expect(stellenAnzeige(null, '12', 'Elektrotechnik 2')).toBeNull()
  })
})
