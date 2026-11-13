import { afterEach, describe, expect, it } from 'vitest'
import { merkeStelle } from '@rl/kern'
import { Speicher } from '../src/daten/speicher'
import { Platte, ablageImSpeicher } from '../src/daten/ablageImSpeicher'

// Fremde Sync-Programme und Sync-Fehler (Vertrag Lernen, Grundlagen 8) gegen den echten Speicher. `platte.schreibe` und
// `platte.loesche` von außen stehen für Dropbox, OneDrive, Nextcloud, FolderSync …
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function bis(f: () => boolean) {
  for (let i = 0; i < 200 && !f(); i++) await warte(10)
  expect(f()).toBe(true)
}

const offen: Speicher[] = []
async function geraet(platte: Platte) {
  const s = new Speicher({ ablage: ablageImSpeicher(platte), wartezeit: 20 })
  await s.oeffne()
  offen.push(s)
  return s
}
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const svg = (n: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">\n${'<path d="M0 0L1 1"/>\n'.repeat(n)}</svg>\n`
const karte = (id: string, text: string) => `---\nid: ${id}\ntyp: frage\n---\n?? ${text}\n`

describe('Konfliktkopien fremder Sync-Programme', () => {
  it('Kopie eines unbekannten Programms mit anderem Inhalt: steht in der Konfliktansicht, Verwerfen löscht nur sie', async () => {
    const p = new Platte()
    p.schreibe('lernen/tinte/A1/S001.svg', svg(1))
    p.schreibe('lernen/tinte/A1/S001 (1).svg', svg(2))
    const s = await geraet(p)
    expect(s.konflikte()).toEqual(['lernen/tinte/A1/S001 (1).svg'])
    expect(s.kopien().get('lernen/tinte/A1/S001 (1).svg')?.original).toBe('lernen/tinte/A1/S001.svg')
    await s.verwerfeKonflikt('lernen/tinte/A1/S001 (1).svg')
    expect([...p.dateien.keys()]).toEqual(['lernen/tinte/A1/S001.svg'])
    expect(p.text('lernen/tinte/A1/S001.svg')).toBe(svg(1))
  })

  it('gleicher Inhalt (Dropbox, nur andere Zeilenenden) erledigt sich beim Start ohne Menschen', async () => {
    const p = new Platte()
    p.schreibe('lernen/karten/k.md', karte('k', 'Frage'))
    p.schreibe("lernen/karten/k (Nils's conflicted copy 2024-01-31).md", karte('k', 'Frage').replace(/\n/g, '\r\n'))
    const s = await geraet(p)
    await bis(() => s.automatischErledigt === 1)
    expect([...p.dateien.keys()]).toEqual(['lernen/karten/k.md'])
    expect(s.konflikte()).toEqual([])
  })

  it('identische Kopie, die während der Arbeit ankommt (OneDrive hängt den Rechnernamen an), verschwindet von selbst', async () => {
    const p = new Platte()
    p.schreibe('lernen/einstellungen/ki-prompts.json', '{"erklaeren":"x"}\n')
    const s = await geraet(p)
    p.schreibe('lernen/einstellungen/ki-prompts-LAPTOP.json', '{"erklaeren":"x"}\n')
    await bis(() => s.automatischErledigt === 1)
    expect([...p.dateien.keys()]).toEqual(['lernen/einstellungen/ki-prompts.json'])
  })

  it('Protokoll: Kopie und Datei werden zeilenweise vereinigt, keine Wiederholung geht verloren', async () => {
    const p = new Platte()
    const z = (k: string, am: string) => JSON.stringify({ karte: k, am, note: 'gut' })
    p.schreibe('reviews/2026-11.pc-ab12.jsonl', `${z('a', '2026-11-13T08:00:00Z')}\n${z('b', '2026-11-13T10:00:00Z')}\n`)
    p.schreibe('reviews/2026-11.pc-ab12 (conflicted copy 2026-11-13 093000).jsonl', `${z('a', '2026-11-13T08:00:00Z')}\n${z('c', '2026-11-13T09:00:00Z')}\n`)
    const s = await geraet(p)
    await bis(() => s.automatischErledigt === 1)
    expect([...p.dateien.keys()]).toEqual(['reviews/2026-11.pc-ab12.jsonl'])
    expect(p.text('reviews/2026-11.pc-ab12.jsonl')).toBe(`${z('a', '2026-11-13T08:00:00Z')}\n${z('c', '2026-11-13T09:00:00Z')}\n${z('b', '2026-11-13T10:00:00Z')}\n`)
  })

  it('Binärdateien: leere Kopie und Byte für Byte gleiche Kopie verschwinden, andere bleiben', async () => {
    const p = new Platte()
    p.schreibe('anhaenge/2026/11/abc123-skript.pdf', '%PDF-1.7 a')
    p.schreibe('anhaenge/2026/11/abc123-skript (1).pdf', '')
    p.schreibe('anhaenge/2026/11/abc123-skript 2.pdf', '%PDF-1.7 a')
    p.schreibe('anhaenge/2026/11/abc123-skript-LAPTOP.pdf', '%PDF-1.7 b')
    const s = await geraet(p)
    await bis(() => s.automatischErledigt === 2)
    expect([...p.dateien.keys()].sort()).toEqual(['anhaenge/2026/11/abc123-skript-LAPTOP.pdf', 'anhaenge/2026/11/abc123-skript.pdf'])
    expect(s.konflikte()).toEqual(['anhaenge/2026/11/abc123-skript-LAPTOP.pdf'])
  })

  it('echte inhaltliche Konflikte bleiben für den Menschen stehen', async () => {
    const p = new Platte()
    p.schreibe('lernen/karten/k.md', karte('k', 'Fassung PC'))
    p.schreibe('lernen/karten/k.sync-conflict-20261113-101010-ABCDEFG.md', karte('k', 'Fassung Handy'))
    p.schreibe('lernen/karten/Kopie von k.md', karte('k', 'Fassung Tablet'))
    const s = await geraet(p)
    await warte(50)
    expect(s.automatischErledigt).toBe(0)
    expect(s.konflikte()).toEqual(['lernen/karten/Kopie von k.md', 'lernen/karten/k.sync-conflict-20261113-101010-ABCDEFG.md'])
  })
})

describe('Rückfallebene für unbekannte Sync-Fehler', () => {
  it('halb übertragener Lesestand: als Sync-Problem sichtbar, und „Stelle merken“ sichert den alten Inhalt vorher', async () => {
    const p = new Platte()
    const kaputt = '{"A1": {"seite": 3, "am": "2026-11-12T10:00:00Z"}, "A2": {"sei'
    p.schreibe('lernen/stand/pc-ab12.json', kaputt)
    const s = await geraet(p)
    expect(s.syncProbleme()).toEqual([{ pfad: 'lernen/stand/pc-ab12.json', grund: 'Die Datei ist unvollständig oder beschädigt' }])
    // vorher: merkeStelle ersetzte den Inhalt still durch {} plus einen Eintrag
    await s.aendere('lernen/stand/pc-ab12.json', (alt) => merkeStelle(alt, 'B1', 7, '2026-11-13T10:00:00Z'))
    await s.speichereAlles()
    await bis(() => konfliktKopien(p).length === 1)
    expect(p.text(konfliktKopien(p)[0])).toBe(kaputt)
    expect(JSON.parse(p.text('lernen/stand/pc-ab12.json')!)).toEqual({ B1: { seite: 7, am: '2026-11-13T10:00:00Z' } })
    expect(s.syncProbleme()).toEqual([])
    await warte(50)
    expect(s.konflikte()).toHaveLength(1)
  })

  it('Ordner plötzlich leer (Laufwerk weg): Hinweis, Texte bleiben sichtbar, nichts wird geschrieben, bis Dateien zurück sind', async () => {
    const p = new Platte()
    for (let i = 0; i < 12; i++) p.schreibe(`lernen/karten/k${i}.md`, karte(`k${i}`, `F${i}`))
    const s = await geraet(p)
    const sicherung = new Map(p.dateien)
    for (const k of [...p.dateien.keys()]) p.loesche(k)
    await bis(() => s.hinweis?.art === 'leer')
    expect(s.text('lernen/karten/k3.md')).toBe(karte('k3', 'F3'))
    await s.schreibe('lernen/karten/neu.md', karte('neu', 'N'))
    await s.speichereAlles()
    expect(p.dateien.size).toBe(0)
    // Laufwerk wieder da
    for (const [k, d] of sicherung) p.schreibe(k, d.inhalt)
    await bis(() => s.hinweis === null)
    await s.speichereJetzt('lernen/karten/neu.md')
    expect(p.text('lernen/karten/neu.md')).toBe(karte('neu', 'N'))
  })

  it('leerer Ordner ist gewollt: nach Bestätigung schreibt die App wieder', async () => {
    const p = new Platte()
    for (let i = 0; i < 12; i++) p.schreibe(`lernen/karten/k${i}.md`, karte(`k${i}`, `F${i}`))
    const s = await geraet(p)
    for (const k of [...p.dateien.keys()]) p.loesche(k)
    await bis(() => s.hinweis?.art === 'leer')
    s.weiterTrotzLeer()
    await bis(() => s.text('lernen/karten/k0.md') === undefined)
    await s.schreibe('lernen/karten/neu.md', karte('neu', 'N'))
    await s.speichereAlles()
    expect([...p.dateien.keys()]).toEqual(['lernen/karten/neu.md'])
  })

  it('viele Dateien verschwinden auf einmal: Hinweis mit Anzahl, die App legt sie nicht selbst neu an', async () => {
    const p = new Platte()
    for (let i = 0; i < 40; i++) p.schreibe(`lernen/karten/k${i}.md`, karte(`k${i}`, `F${i}`))
    const s = await geraet(p)
    for (let i = 0; i < 10; i++) p.loesche(`lernen/karten/k${i}.md`)
    await bis(() => s.hinweis?.art === 'schwund')
    expect(s.hinweis).toEqual({ art: 'schwund', anzahl: 10 })
    await warte(50)
    expect(p.dateien.size).toBe(30)
    s.hinweisWeg()
    expect(s.hinweis).toBeNull()
  })

  it('einzelne Löschungen sind kein Schwund', async () => {
    const p = new Platte()
    for (let i = 0; i < 40; i++) p.schreibe(`lernen/karten/k${i}.md`, karte(`k${i}`, `F${i}`))
    const s = await geraet(p)
    p.loesche('lernen/karten/k1.md')
    await bis(() => s.text('lernen/karten/k1.md') === undefined)
    expect(s.hinweis).toBeNull()
  })
})

const konfliktKopien = (p: Platte) => [...p.dateien.keys()].filter((k) => k.includes('.sync-conflict-'))
