// Anheben der Zeichenblätter gegen den echten Speicher, auch auf zwei Geräten gleichzeitig (Vertrag Lernen 1.3)
import { afterEach, describe, expect, it } from 'vitest'
import { Bestand, buchSeitenNummern, liesAnordnung, liesTinte, pfade, tinteSvg, type Strich } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { hebeAn } from '../src/anheben'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const A = '01JBEXAMP000000000SKRPT001'
const strich: Strich = { farbe: 'alltag', breite: 2.5, punkte: [[10, 10, 0.5], [40, 50, 0.5]], d: 'M10 10L40 50Z' }
const TINTE = tinteSvg([strich], 1414)

function ordner() {
  const p = new Platte()
  p.schreibe(`gemeinsam/anhaenge/${A}.md`, `---\nid: ${A}\ntyp: anhang\nerstellt: 2026-10-01T10:00:00+02:00\ngeaendert: 2026-10-01T10:00:00+02:00\ntitel: Skript ET1\ndatei: anhaenge/a.pdf\nart: skript\n---\n`)
  p.schreibe(`lernen/blaetter/${A}/S003.svg`, TINTE)
  p.schreibe(`lernen/blaetter/${A}/S009-k7.svg`, TINTE)
  p.schreibe(`lernen/blaetter/${A}/anordnung.json`, JSON.stringify({ ansichten: [{ art: 'pdf', id: 'pdf', breite: 3 }, { art: 'blatt', id: '1', lineatur: 'kariert', breite: 2 }, { art: 'blatt', id: 'k7', lineatur: 'millimeter', breite: 1 }] }))
  return p
}

async function geraet(p: Platte) {
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return s
}

const quelleVon = (s: Speicher) => new Bestand(s.alleTexte()).dokumente.get(A)!

describe('Anheben im Speicher', () => {
  it('schreibt Bücher und Anordnung, alte Dateien bleiben byte-gleich', async () => {
    const p = ordner()
    const vorher = new Map([...p.dateien].map(([k, v]) => [k, Buffer.from(v.inhalt).toString('base64')]))
    const s = await geraet(p)
    expect(await hebeAn(s, new Bestand(s.alleTexte()), quelleVon(s))).toBe(2)
    for (const [k, v] of vorher) if (!k.endsWith('anordnung.json')) expect(Buffer.from(p.dateien.get(k)!.inhalt).toString('base64')).toBe(v)
    const a = liesAnordnung(p.text(`lernen/blaetter/${A}/anordnung.json`))
    expect(a.schema).toBe(2)
    const buecher = a.ansichten.filter((v) => v.art === 'buch').map((v) => v.id)
    expect(buecher).toHaveLength(2)
    for (const id of buecher) {
      expect(p.text(pfade.buch(id))).toContain('typ: notizbuch')
      expect(buchSeitenNummern(p.dateien.keys(), id)).toEqual([1])
      expect(liesTinte(p.text(pfade.buchTinte(id, 1))!)).toHaveLength(1)
    }
    // zweites Mal: nichts mehr zu tun
    expect(await hebeAn(s, new Bestand(s.alleTexte()), quelleVon(s))).toBe(0)
  })

  it('zwei Geräte heben gleichzeitig an: dieselben Dateien, keine Konfliktkopie', async () => {
    const p = ordner()
    const pc = await geraet(p)
    const handy = await geraet(p)
    const [x, y] = await Promise.all([hebeAn(pc, new Bestand(pc.alleTexte()), quelleVon(pc)), hebeAn(handy, new Bestand(handy.alleTexte()), quelleVon(handy))])
    expect([x, y]).toEqual([2, 2])
    await pc.abfragen()
    await handy.abfragen()
    expect([...p.dateien.keys()].filter((k) => k.includes('sync-conflict'))).toEqual([])
    expect(pc.konflikte()).toEqual([])
    expect(handy.konflikte()).toEqual([])
    expect([...p.dateien.keys()].filter((k) => k.startsWith('lernen/buecher/')).length).toBe(6)
  })
})
