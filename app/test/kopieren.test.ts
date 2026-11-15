// @vitest-environment happy-dom
// Einfügen gegen den echten Speicher (Vertrag Lernen 1.12): an die Stelle, Rückgängig byte-genau, nie über einen
// fremden Stand hinweg (dann Konfliktkopie)
import { afterEach, describe, expect, it } from 'vitest'
import { buchSeiteJson, liesBuchSeite, pfade, type Kopie } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { fuegeEin } from '../src/kopieren'
import { ausAblage, legeInAblage } from '../src/ablage'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const B = '01JBEXAMP000000000BUCH0001'
const SPFAD = pfade.buchSeite(B, 1)
const SEITE = buchSeiteJson(liesBuchSeite(JSON.stringify({ bilder: [{ id: 'f1', anhang: 'FOTO', x: 0, y: 0, b: 200, h: 100 }], verweise: [] })))
const AUS_SKRIPT: Kopie = { anhang: '01JBEXAMP000000000SKRPT001', seite: 3, bereich: { x: 0.1, y: 0.2, b: 0.5, h: 0.1 }, marke: 'a7k2c9', verhaeltnis: 0.3 }
const AUS_BUCH: Kopie = { anhang: B, seite: 1, bereich: { x: 0, y: 0, b: 0.2, h: 0.1 }, marke: 'b7x2q1', verhaeltnis: 0.5 }

async function geraet(seite: string | null = SEITE) {
  const p = new Platte()
  if (seite !== null) p.schreibe(SPFAD, seite)
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return { p, s }
}
const konflikte = (p: Platte) => [...p.dateien.keys()].filter((k) => k.includes('.sync-conflict-'))

describe('Einfügen ins Buch', () => {
  it('legt Ausschnitt und ✦-Marke an die Stelle; Rückgängig ergibt die Datei byte-gleich', async () => {
    const { p, s } = await geraet()
    const zurueck = await fuegeEin(s, B, 1, AUS_SKRIPT, { x: 100, y: 300 })
    await s.speichereAlles()
    const j = liesBuchSeite(p.text(SPFAD))
    const bild = j.bilder.find((b) => b.id !== 'f1')!
    expect(bild).toMatchObject({ anhang: AUS_SKRIPT.anhang, seite: 3, x: 100, y: 300, b: 500, h: 150 })
    expect(j.verweise).toEqual([expect.objectContaining({ y: 300, marke: 'a7k2c9', bild: bild.id })])
    await zurueck()
    await s.speichereAlles()
    expect(p.text(SPFAD)).toBe(SEITE)
  })
  it('aus demselben Buch auf eine noch leere Seite', async () => {
    const { p, s } = await geraet(null)
    await fuegeEin(s, B, 1, AUS_BUCH, { x: 0, y: 0, b: 400 })
    await s.speichereAlles()
    const j = liesBuchSeite(p.text(SPFAD))
    expect(j.bilder[0]).toMatchObject({ anhang: B, seite: 1, b: 400, h: 200 })
    expect(j.verweise[0]).toMatchObject({ anhang: B, marke: 'b7x2q1' })
  })
  it('hat ein anderes Gerät die Seite inzwischen geändert, entsteht eine Konfliktkopie statt Überschreiben', async () => {
    const { p, s } = await geraet()
    const fremd = buchSeiteJson(liesBuchSeite(JSON.stringify({ bilder: [], verweise: [{ id: 'h1', y: 5, anhang: 'X', seite: 1 }] })))
    p.schreibe(SPFAD, fremd)
    await fuegeEin(s, B, 1, AUS_SKRIPT, { x: 0, y: 0 })
    await s.speichereAlles()
    await new Promise((r) => setTimeout(r, 30))
    await s.speichereAlles()
    expect(p.text(SPFAD)).toBe(fremd)
    expect(konflikte(p)).toHaveLength(1)
  })
})

describe('Ablage', () => {
  it('hält genau eine Kopie, die letzte gewinnt', () => {
    legeInAblage(AUS_SKRIPT)
    legeInAblage(AUS_BUCH)
    expect(ausAblage()).toEqual(AUS_BUCH)
  })
})
