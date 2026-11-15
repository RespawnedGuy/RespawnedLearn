// @vitest-environment happy-dom
// Löschen gegen den echten Speicher (Vertrag Lernen 1.11, 5.4): entfernen oder weglegen, Rückgängig byte-genau,
// nie über einen fremden Stand hinweg (dann Konfliktkopie)
import { afterEach, describe, expect, it } from 'vitest'
import { buchSeiteJson, liesBuchSeite, liesMarken, pfade } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { loescheMarkierung, nimmVonDerSeite } from '../src/loeschen'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const A = '01JBEXAMP000000000SKRPT001'
const B = '01JBEXAMP000000000BUCH0001'
const K = '01JBEXAMP000000000KARTE001'
const MARKEN = [
  '---',
  'typ: markierungen',
  `anhang: "[[${A}]]"`,
  '---',
  '- S. 1 %%rn 0.100 0.100 0.200 0.100 2026-11-14%% ^offen1',
  `- S. 2 · [[${K}|Was ist x?]] %%rn 0.100 0.500 0.200 0.100 2026-11-14%% ^karte1`,
  '- S. 3 %%rn 0.300 0.300 0.200 0.100 2026-11-14%% ^imbuch',
  ''
].join('\n')
const KARTE = `---\nid: ${K}\ntyp: frage\ntitel: Was ist x?\n---\n?? Was ist x?\n:: ![[${A}#seite=2&marke=karte1|Skript, S. 2]]\n`
// so, wie die App eine Seite schreibt (Feldreihenfolge nach dem Lesen)
const SEITE_ROH = buchSeiteJson({
  bilder: [{ id: 'b1', anhang: A, seite: 3, bereich: { x: 0.3, y: 0.3, b: 0.2, h: 0.1 }, x: 10, y: 200, b: 400, h: 100 }],
  verweise: [
    { id: 'v1', y: 96, anhang: A, seite: 1 },
    { id: 'v2', y: 200, anhang: A, seite: 3, marke: 'imbuch', bild: 'b1' }
  ],
  rest: {}
})
const SEITE = buchSeiteJson(liesBuchSeite(SEITE_ROH))
const MPFAD = pfade.marken('lernen', A)
const SPFAD = pfade.buchSeite(B, 1)

async function geraet() {
  const p = new Platte()
  p.schreibe(MPFAD, MARKEN)
  p.schreibe(pfade.karte(K), KARTE)
  p.schreibe(SPFAD, SEITE)
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return { p, s }
}
const konflikte = (p: Platte) => [...p.dateien.keys()].filter((k) => k.includes('.sync-conflict-'))

describe('Markierungen löschen', () => {
  it('offen und ohne ✦: Zeile weg; Rückgängig ergibt die Datei byte-gleich', async () => {
    const { p, s } = await geraet()
    const r = await loescheMarkierung(s, s.alleTexte(), A, 'offen1')
    expect(r?.wirkung).toBe('entfernen')
    await s.speichereAlles()
    expect(liesMarken(p.text(MPFAD) as string).map((m) => m.id)).toEqual(['karte1', 'imbuch'])
    await r!.rueckgaengig()
    await s.speichereAlles()
    expect(p.text(MPFAD)).toBe(MARKEN)
  })
  it('mit Karte: weggelegt, die Karte bleibt unverändert; Rückgängig byte-gleich', async () => {
    const { p, s } = await geraet()
    const r = await loescheMarkierung(s, s.alleTexte(), A, 'karte1')
    expect(r?.wirkung).toBe('weglegen')
    await s.speichereAlles()
    expect(liesMarken(p.text(MPFAD) as string).find((m) => m.id === 'karte1')!.text).toContain('#archiv')
    expect(p.text(pfade.karte(K))).toBe(KARTE)
    await r!.rueckgaengig()
    await s.speichereAlles()
    expect(p.text(MPFAD)).toBe(MARKEN)
  })
  it('offen, aber mit ✦ in einem Buch: nur weggelegt', async () => {
    const { s } = await geraet()
    expect((await loescheMarkierung(s, s.alleTexte(), A, 'imbuch'))?.wirkung).toBe('weglegen')
  })
  it('gibt es die Markierung nicht mehr, passiert nichts', async () => {
    const { p, s } = await geraet()
    expect(await loescheMarkierung(s, s.alleTexte(), A, 'weg')).toBeNull()
    await s.speichereAlles()
    expect(p.text(MPFAD)).toBe(MARKEN)
  })
  it('hat ein anderes Gerät die Datei inzwischen geändert, entsteht eine Konfliktkopie statt Überschreiben', async () => {
    const { p, s } = await geraet()
    const fremd = MARKEN + '- S. 9 · vom Handy %%rn 0.100 0.100 0.200 0.100 2026-11-15%% ^handy1\n'
    p.schreibe(MPFAD, fremd)
    await loescheMarkierung(s, s.alleTexte(), A, 'offen1')
    await s.speichereAlles()
    // die Kopie schreibt der Speicher gleich danach
    await new Promise((r) => setTimeout(r, 30))
    await s.speichereAlles()
    expect(p.text(MPFAD)).toBe(fremd)
    expect(konflikte(p)).toHaveLength(1)
  })
})

describe('Von der Buchseite nehmen', () => {
  for (const was of [
    { art: 'marke', id: 'v2' },
    { art: 'verweis', id: 'v1' },
    { art: 'bild', id: 'b1' }
  ] as const) {
    it(`${was.art}: weg und mit Rückgängig byte-gleich zurück`, async () => {
      const { p, s } = await geraet()
      const zurueck = await nimmVonDerSeite(s, B, 1, was)
      await s.speichereAlles()
      expect(p.text(SPFAD)).not.toBe(SEITE)
      await zurueck!()
      await s.speichereAlles()
      expect(p.text(SPFAD)).toBe(SEITE)
    })
  }
  it('✦-Marke nimmt ihren Ausschnitt mit, die Markierung im Skript bleibt', async () => {
    const { p, s } = await geraet()
    await nimmVonDerSeite(s, B, 1, { art: 'marke', id: 'v2' })
    await s.speichereAlles()
    const j = JSON.parse(p.text(SPFAD) as string)
    expect(j.bilder).toEqual([])
    expect(j.verweise.map((v: { id: string }) => v.id)).toEqual(['v1'])
    expect(p.text(MPFAD)).toBe(MARKEN)
  })
})
