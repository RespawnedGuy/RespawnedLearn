import { afterEach, describe, expect, it } from 'vitest'
import { Speicher } from '../src/daten/speicher'
import { Platte, ablageImSpeicher } from '../src/daten/ablageImSpeicher'
import type { Ablage } from '../src/daten/ordner'

// Zwei Geräte auf einem Ordner: Die Platte steht für den Datenordner, `platte.schreibe` von außen für Syncthing.
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Wartet, bis die Bedingung gilt (höchstens 2 s), statt fester Zeiten, die auf langsamen Rechnern kippen */
async function bis(f: () => boolean) {
  for (let i = 0; i < 200 && !f(); i++) await warte(10)
  expect(f()).toBe(true)
}

const offen: Speicher[] = []
async function geraet(platte: Platte, o: { stumm?: boolean; abfrageMs?: number; wartezeit?: number; ablage?: Ablage } = {}) {
  const s = new Speicher({ ablage: o.ablage ?? ablageImSpeicher(platte, o), wartezeit: o.wartezeit ?? 20 })
  await s.oeffne()
  offen.push(s)
  return s
}
const konflikte = (p: Platte) => [...p.dateien.keys()].filter((k) => k.includes('.sync-conflict-'))

afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

describe('Speicher auf dem Datenordner', () => {
  it('liest beim Start alle Texte, Binärdateien erst bei Bedarf', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/a.md', 'A')
    p.schreibe('anhaenge/s.pdf', '%PDF')
    const s = await geraet(p)
    expect(s.text('lernen/fragen/a.md')).toBe('A')
    expect(s.text('anhaenge/s.pdf')).toBeUndefined()
    expect(s.pfade()).toEqual(['anhaenge/s.pdf', 'lernen/fragen/a.md'])
    const b = await s.binaer('anhaenge/s.pdf')
    expect(b?.type).toBe('application/pdf')
    expect(await b?.text()).toBe('%PDF')
    expect(await s.binaer('fehlt.pdf')).toBeNull()
  })

  it('liest arbeit/ aus RespawnedNotes VX im selben Ordner nicht ein', async () => {
    const p = new Platte()
    p.schreibe('arbeit/journal/2026/2026-11-13.md', 'Journal')
    p.schreibe('lernen/fragen/a.md', 'A')
    const s = await geraet(p)
    p.schreibe('arbeit/journal/2026/2026-11-14.md', 'neu')
    await s.abfragen()
    expect([...s.alleTexte().keys()]).toEqual(['lernen/fragen/a.md'])
  })

  it('Gerät A schreibt nach kurzer Ruhe, Gerät B sieht es ohne Neustart', async () => {
    const p = new Platte()
    const a = await geraet(p)
    const b = await geraet(p)
    await a.schreibe('lernen/fragen/k.md', 'eins')
    await a.schreibe('lernen/fragen/k.md', 'zwei')
    expect(a.ungesichert()).toBe(1)
    expect(p.text('lernen/fragen/k.md')).toBeUndefined()
    await bis(() => b.text('lernen/fragen/k.md') === 'zwei')
    expect(a.ungesichert()).toBe(0)
    expect(p.dateien.get('lernen/fragen/k.md')!.nr).toBe(1) // ein Schreibvorgang für zwei Tastendrücke
  })

  it('Android: ohne Meldungen der Überwachung kommt die Änderung über die Abfrage der Dateiliste', async () => {
    const p = new Platte()
    const handy = await geraet(p, { stumm: true, abfrageMs: 30 })
    p.schreibe('lernen/fragen/k.md', 'vom PC')
    await bis(() => handy.text('lernen/fragen/k.md') === 'vom PC')
  })

  it('eigenes Schreiben löst kein Neulesen aus', async () => {
    const p = new Platte()
    const basis = ablageImSpeicher(p)
    const gelesen: string[] = []
    const a = await geraet(p, { ablage: { ...basis, texteLesen: (pf) => (gelesen.push(...pf), basis.texteLesen(pf)) } })
    await a.schreibe('lernen/fragen/k.md', 'eigen')
    await bis(() => p.text('lernen/fragen/k.md') === 'eigen')
    await a.abfragen()
    await warte(30)
    expect(gelesen).toEqual([])
  })

  it('gleichzeitige Änderung: Konfliktkopie, beide Texte bleiben erhalten', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/k.md', 'alt')
    const a = await geraet(p, { wartezeit: 5000 })
    const b = await geraet(p)
    await a.schreibe('lernen/fragen/k.md', 'Text von A')
    await b.schreibe('lernen/fragen/k.md', 'Text von B')
    await b.speichereJetzt('lernen/fragen/k.md')
    // A erfährt von der Änderung, während der eigene Text noch wartet
    await bis(() => konflikte(p).length === 1)
    expect(p.text('lernen/fragen/k.md')).toBe('Text von B')
    expect(p.text(konflikte(p)[0])).toBe('Text von A')
    expect(a.text('lernen/fragen/k.md')).toBe('Text von B')
    expect(a.konflikte()).toEqual(konflikte(p))
    await bis(() => b.konflikte().length === 1)
  })

  it('Syncthing ersetzt die Datei kurz vor dem Schreiben (ohne Meldung): kein stilles Überschreiben', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/k.md', 'alt')
    const a = await geraet(p, { stumm: true, wartezeit: 5000 })
    await a.schreibe('lernen/fragen/k.md', 'Text von A')
    p.schreibe('lernen/fragen/k.md', 'von Syncthing')
    await a.speichereJetzt('lernen/fragen/k.md')
    await bis(() => konflikte(p).length === 1)
    expect(p.text('lernen/fragen/k.md')).toBe('von Syncthing')
    expect(p.text(konflikte(p)[0])).toBe('Text von A')
  })

  it('kam dieselbe Fassung von außen, ist es kein Konflikt', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/k.md', 'alt')
    const a = await geraet(p, { stumm: true, wartezeit: 5000 })
    await a.schreibe('lernen/fragen/k.md', 'gleich')
    p.schreibe('lernen/fragen/k.md', 'gleich')
    await a.speichereJetzt('lernen/fragen/k.md')
    expect(konflikte(p)).toEqual([])
    expect(a.ungesichert()).toBe(0)
  })

  it('Löschung von außen kommt an; mit ungespeichertem Text entsteht die Datei neu', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/weg.md', 'w')
    p.schreibe('lernen/fragen/offen.md', 'o')
    const a = await geraet(p, { wartezeit: 50 })
    await a.schreibe('lernen/fragen/offen.md', 'noch nicht gespeichert')
    p.loesche('lernen/fragen/weg.md')
    p.loesche('lernen/fragen/offen.md')
    await bis(() => a.text('lernen/fragen/weg.md') === undefined)
    await bis(() => p.text('lernen/fragen/offen.md') === 'noch nicht gespeichert')
  })

  it('speichereAlles schreibt Wartendes sofort (App geht in den Hintergrund)', async () => {
    const p = new Platte()
    const a = await geraet(p, { wartezeit: 60_000 })
    await a.schreibe('lernen/fragen/k.md', 'schnell')
    await a.speichereAlles()
    expect(p.text('lernen/fragen/k.md')).toBe('schnell')
  })

  it('wer während des Schreibens weitertippt, verliert nichts', async () => {
    const p = new Platte()
    const basis = ablageImSpeicher(p)
    let a!: Speicher
    const ablage: Ablage = {
      ...basis,
      async schreibeWenn(pfad, inhalt, erwartet) {
        if (inhalt === 'eins') await a.schreibe(pfad, 'eins zwei') // tippt genau jetzt weiter
        return basis.schreibeWenn(pfad, inhalt, erwartet)
      }
    }
    a = await geraet(p, { ablage })
    await a.schreibe('lernen/fragen/k.md', 'eins')
    await bis(() => p.text('lernen/fragen/k.md') === 'eins zwei')
    expect(konflikte(p)).toEqual([])
  })

  it('Konflikt übernehmen: Kopie wird Datei und verschwindet', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/k.md', 'hier')
    p.schreibe('lernen/fragen/k.sync-conflict-20261113-101010-ABCDEFG.md', 'dort')
    const a = await geraet(p)
    await a.uebernehmeKonflikt('lernen/fragen/k.sync-conflict-20261113-101010-ABCDEFG.md')
    expect(p.text('lernen/fragen/k.md')).toBe('dort')
    expect(konflikte(p)).toEqual([])
    expect(a.konflikte()).toEqual([])
  })

  it('Konflikt verwerfen löscht nur die Kopie; andere Dateien löscht der Speicher nie', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/k.md', 'hier')
    p.schreibe('anhaenge/b.sync-conflict-20261113-101010-ABCDEFG.png', 'png')
    const a = await geraet(p)
    await a.verwerfeKonflikt('lernen/fragen/k.md')
    expect(p.text('lernen/fragen/k.md')).toBe('hier')
    await a.verwerfeKonflikt('anhaenge/b.sync-conflict-20261113-101010-ABCDEFG.png')
    expect([...p.dateien.keys()]).toEqual(['lernen/fragen/k.md'])
    await expect(ablageImSpeicher(p).konfliktLoeschen('lernen/fragen/k.md')).rejects.toThrow()
  })

  it('ein Original (PDF, Foto) ersetzt nie eine vorhandene Datei', async () => {
    const p = new Platte()
    p.schreibe('anhaenge/s.pdf', 'alt')
    const a = await geraet(p)
    await expect(a.hochladen('anhaenge/s.pdf', new Blob(['neu']))).rejects.toThrow()
    await a.hochladen('anhaenge/t.pdf', new Blob(['neu']))
    expect(p.text('anhaenge/s.pdf')).toBe('alt')
    expect(p.text('anhaenge/t.pdf')).toBe('neu')
  })
})
