import { describe, expect, it } from 'vitest'
import { Bestand } from '../src/bestand'
import { lernziele, lesestand, liesStundenJeEcts, merkeStelle, module, ordneLernziele, stundenJeEctsText, umfangStunden } from '../src/module'

const pdf = (id: string, titel: string) => `---\nid: ${id}\ntyp: anhang\ntitel: ${titel}\ndatei: anhaenge/2026/10/${id}.pdf\nart: skript\n---\n`
const modul = (id: string, titel: string, quellen: string[], extra = '') =>
  `---\nid: ${id}\ntyp: modul\ntitel: ${titel}\nquellen: [${quellen.map((q) => `"[[${q}]]"`).join(', ')}]\n${extra}---\n`

describe('module', () => {
  const texte = new Map([
    ['gemeinsam/anhaenge/P1.md', pdf('P1', 'Skript Kapitel 1')],
    ['gemeinsam/anhaenge/P2.md', pdf('P2', 'Skript Kapitel 2')],
    ['gemeinsam/anhaenge/P3.md', pdf('P3', 'Tietze Schenk')],
    ['gemeinsam/anhaenge/P4.md', pdf('P4', 'Datenblatt')],
    ['gemeinsam/anhaenge/P5.md', pdf('P5', 'Altes Skript')],
    ['lernen/module/M1.md', modul('M1', 'Elektrotechnik 2', ['P1', 'P2'], 'ziel: Klausur bestehen\n')],
    ['lernen/module/M2.md', modul('M2', 'Tietze', ['P3'], 'favorit: true\n')],
    ['lernen/module/M3.md', modul('M3', 'Mathe 1', [], 'status: abgeschlossen\n')],
    ['lernen/markierungen/P5.md', '---\nid: MK\ntyp: markierungen\n---\n- S. 7 · Stelle %%rn 0.1 0.1 0.2 0.2 2026-10-01%% ^aaaaaa\n'],
    ['lernen/stand/pc-a.json', JSON.stringify({ P1: { seite: 3, am: '2026-10-20T10:00:00Z' }, P2: { seite: 9, am: '2026-10-19T10:00:00Z' } })],
    ['lernen/stand/android-b.json', JSON.stringify({ P1: { seite: 12, am: '2026-10-20T18:00:00Z' }, P4: { seite: 2, am: '2026-10-18T08:00:00Z' } })]
  ])
  const b = new Bestand(texte)

  it('führt den Lesestand aller Geräte zusammen, der jüngste gewinnt', () => {
    expect(lesestand(b).P1).toEqual({ seite: 12, am: '2026-10-20T18:00:00Z' })
  })

  it('macht aus Modulen und losen PDFs Lernziele', () => {
    const z = lernziele(b)
    expect(z.map((x) => x.id)).toEqual(['P5', 'P4', 'M1', 'M3', 'M2'])
    const et = z.find((x) => x.id === 'M1')!
    expect(et.quellen.map((q) => q.id)).toEqual(['P1', 'P2'])
    expect(et.zuletzt).toEqual({ anhang: 'P1', seite: 12, am: '2026-10-20T18:00:00Z' })
    expect(et.modul?.ziel).toBe('Klausur bestehen')
    // ohne Lesestand zählt die jüngste Markierung
    expect(z.find((x) => x.id === 'P5')!.zuletzt).toEqual({ anhang: 'P5', seite: 7, am: '2026-10-01' })
  })

  it('ordnet: Favoriten, zuletzt bearbeitet, Rest, Abgeschlossen', () => {
    const l = ordneLernziele(lernziele(b))
    expect(l.favoriten.map((x) => x.id)).toEqual(['M2'])
    expect(l.kuerzlich.map((x) => x.id)).toEqual(['M1', 'P4', 'P5'])
    expect(l.weitere.map((x) => x.id)).toEqual([])
    expect(l.abgeschlossen.map((x) => x.id)).toEqual(['M3'])
  })

  it('merkt sich eine Stelle, ohne andere zu verlieren', () => {
    const neu = merkeStelle(JSON.stringify({ P2: { seite: 1, am: 'x' } }), 'P1', 5, '2026-10-21T08:00:00Z')
    expect(JSON.parse(neu)).toEqual({ P2: { seite: 1, am: 'x' }, P1: { seite: 5, am: '2026-10-21T08:00:00Z' } })
    expect(JSON.parse(merkeStelle('kaputt', 'P1', 2, 'y'))).toEqual({ P1: { seite: 2, am: 'y' } })
  })
})

describe('Umfang (Vertrag Lernen 1.7)', () => {
  it('liest ECTS, Stunden, Termin und Plan-Felder; Unsinn wird übergangen', () => {
    const b = new Bestand(
      new Map([
        ['lernen/module/M1.md', modul('M1', 'ET', [], 'ects: 2.5\ntermin: 2027-02-10\nstundenProWoche: 12\nschwer: ["3 Wechselstrom"]\nuebungen: false\n')],
        ['lernen/module/M2.md', modul('M2', 'Kurs', [], 'ects: -1\nstunden: abc\ntermin: Februar\n')]
      ])
    )
    const [m1, m2] = module(b)
    expect(m1).toMatchObject({ ects: 2.5, stunden: null, termin: '2027-02-10', stundenProWoche: 12, schwer: ['3 Wechselstrom'], uebungen: false })
    expect(m2).toMatchObject({ ects: null, stunden: null, termin: null, stundenProWoche: null, schwer: [], uebungen: true })
  })
  it('Stunden haben Vorrang, sonst ECTS mal Stunden je ECTS', () => {
    expect(umfangStunden({ ects: 5, stunden: null })).toBe(150)
    expect(umfangStunden({ ects: 5, stunden: null }, 25)).toBe(125)
    expect(umfangStunden({ ects: 5, stunden: 40 })).toBe(40)
    expect(umfangStunden({ ects: null, stunden: null })).toBeNull()
  })
  it('Stunden je ECTS aus der Einstellung, Standard 30, nur 10 bis 60', () => {
    expect(liesStundenJeEcts(undefined)).toBe(30)
    expect(liesStundenJeEcts('{"stundenJeEcts": 25}')).toBe(25)
    expect(liesStundenJeEcts('{"stundenJeEcts": 500}')).toBe(30)
    expect(liesStundenJeEcts('kaputt')).toBe(30)
    expect(stundenJeEctsText('{"anderes": 1}', 25)).toBe('{"anderes":1,"stundenJeEcts":25}\n')
    expect(stundenJeEctsText('{"stundenJeEcts": 25}', 30)).toBe('{}\n')
  })
})
