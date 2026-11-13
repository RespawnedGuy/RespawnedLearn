import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bestand, bekannteKopie, istKonfliktkopie, konfliktOriginal, kopieVon, loeschbareKopie, syncKopien } from '../src'

// Dieselbe Tabelle prüft `cargo test` in app/src-tauri/src/ordner.rs
const tabelle = JSON.parse(readFileSync(new URL('../../../testdaten/syncnamen.json', import.meta.url), 'utf8')) as {
  bekannt: { name: string; original: string; programm: string; geraet?: string; zeit?: string }[]
  keine: string[]
  kopieVon: { kopie: string; original: string; ja: boolean }[]
}

describe('Konfliktkopien bekannter Programme (Stufe A, testdaten/syncnamen.json)', () => {
  for (const f of tabelle.bekannt)
    it(`${f.programm}: ${f.name}`, () => {
      expect(bekannteKopie(f.name)).toEqual({ kopie: f.name, original: f.original, programm: f.programm, ...(f.geraet ? { geraet: f.geraet } : {}), ...(f.zeit ? { zeit: f.zeit } : {}) })
      expect(konfliktOriginal(f.name)).toBe(f.original)
    })
  for (const n of tabelle.keine) it(`keine Kopie: ${n}`, () => expect(istKonfliktkopie(n)).toBe(false))
})

describe('Kopie nach dem Namen (Stufe B)', () => {
  for (const f of tabelle.kopieVon) it(`${f.kopie} ← ${f.original}: ${f.ja}`, () => expect(kopieVon(f.kopie, f.original)).toBe(f.ja))
})

const karte = (id: string, titel = 't') => `---\nid: ${id}\ntyp: frage\ntitel: ${titel}\n---\n?? Frage\n`

describe('syncKopien über den ganzen Ordner', () => {
  it('erkennt Kopien unbekannter Programme an Namen, die die App so nie vergibt', () => {
    const k = syncKopien([
      'lernen/tinte/A1/S001.svg',
      'lernen/tinte/A1/S001 (1).svg',
      'lernen/tinte/A1/S002.svg',
      'lernen/einstellungen/ki-prompts.json',
      'lernen/einstellungen/ki-prompts-LAPTOP.json',
      'anhaenge/2026/11/abc123-skript.pdf',
      'anhaenge/2026/11/abc123-skript 2.pdf'
    ])
    expect([...k.values()].map((x) => [x.kopie, x.original, x.programm])).toEqual([
      ['lernen/tinte/A1/S001 (1).svg', 'lernen/tinte/A1/S001.svg', null],
      ['lernen/einstellungen/ki-prompts-LAPTOP.json', 'lernen/einstellungen/ki-prompts.json', null],
      ['anhaenge/2026/11/abc123-skript 2.pdf', 'anhaenge/2026/11/abc123-skript.pdf', null]
    ])
  })

  it('kein Fehlalarm bei Namen, die die App selbst vergibt, und außerhalb ihrer Ordner', () => {
    const k = syncKopien([
      'lernen/blaetter/A1/S001.svg',
      'lernen/blaetter/A1/S001-2.svg', // zweites Zeichenblatt
      'lernen/blaetter/A1/S001-bilder.json',
      'reviews/2026-11.pc-ab12.jsonl',
      'reviews/2026-11.pc-ab12-x.jsonl',
      'lernen/stand/pc-ab12.json',
      'lernen/stand/pc-ab12-neu.json',
      'arbeit/projekte/x.md',
      'arbeit/projekte/x (1).md',
      'eigenes/notiz.txt',
      'eigenes/notiz 2.txt'
    ])
    expect([...k.keys()]).toEqual([])
  })

  it('Markdown: gleiche ID im selben Ordner, egal wie die Kopie heißt; Original ist <id>.md', () => {
    const texte = new Map([
      ['lernen/karten/01ABC.md', karte('01ABC', 'Original')],
      ['lernen/karten/Kopie von Karte.md', karte('01ABC', 'Kopie')],
      ['lernen/karten/andere.md', karte('01XYZ')],
      ['lernen/karten/andere (1).md', karte('01QQQ')] // Name sieht nach Kopie aus, hat aber eigene ID: echte Karte
    ])
    const k = syncKopien(texte.keys(), (p) => texte.get(p))
    expect([...k.values()].map((x) => [x.kopie, x.original])).toEqual([['lernen/karten/Kopie von Karte.md', 'lernen/karten/01ABC.md']])
    // Im Bestand gewinnt das Original, die Kopie ist kein zweites Dokument
    const b = new Bestand(new Map([...texte].reverse()))
    expect(b.dokumente.get('01ABC')?.pfad).toBe('lernen/karten/01ABC.md')
    expect(b.nachPfad.has('lernen/karten/Kopie von Karte.md')).toBe(false)
  })

  it('bekannte Muster auch ohne Original (Syncthing: Ändern gegen Löschen)', () => {
    const k = syncKopien(['lernen/karten/k (Nils\'s conflicted copy 2024-01-31).md'])
    expect(k.get("lernen/karten/k (Nils's conflicted copy 2024-01-31).md")?.original).toBe('lernen/karten/k.md')
  })
})

describe('loeschbareKopie: Schutz vor dem Löschen echter Dateien', () => {
  const ordner = new Map([
    ['lernen/tinte/A1/S001.svg', '<svg></svg>'],
    ['lernen/karten/01ABC.md', karte('01ABC')],
    ['lernen/karten/neu.md', karte('01ABC')],
    ['lernen/karten/fremd.md', karte('01XYZ')]
  ])
  const lies = (p: string) => ordner.get(p)
  it('erlaubt bekannte Muster, Namenszusatz bei vorhandenem Original und gleiche ID', () => {
    expect(loeschbareKopie('lernen/karten/k.sync-conflict-20261113-101010-ABCDEFG.md', undefined, lies)).toBe(true)
    expect(loeschbareKopie('lernen/tinte/A1/S001 (1).svg', 'lernen/tinte/A1/S001.svg', lies)).toBe(true)
    expect(loeschbareKopie('lernen/karten/neu.md', 'lernen/karten/01ABC.md', lies)).toBe(true)
  })
  it('lehnt alles andere ab', () => {
    expect(loeschbareKopie('lernen/tinte/A1/S002.svg', 'lernen/tinte/A1/S001.svg', lies)).toBe(false)
    expect(loeschbareKopie('lernen/tinte/A1/S001 (1).svg', undefined, lies)).toBe(false)
    expect(loeschbareKopie('lernen/tinte/A9/S001 (1).svg', 'lernen/tinte/A9/S001.svg', lies)).toBe(false) // Original fehlt
    expect(loeschbareKopie('lernen/karten/fremd.md', 'lernen/karten/01ABC.md', lies)).toBe(false)
    expect(loeschbareKopie('lernen/karten/01ABC.md', 'lernen/karten/01ABC.md', lies)).toBe(false)
    expect(loeschbareKopie('arbeit/x (1).md', 'arbeit/x.md', () => 'x')).toBe(false)
  })
})
