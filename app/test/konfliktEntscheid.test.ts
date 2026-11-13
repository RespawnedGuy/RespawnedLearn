// Design-Prüfung K2: Ein Fehltipp in der Konfliktansicht darf keine Fassung löschen. Geprüft gegen den echten Speicher
// auf einem Ordner im Arbeitsspeicher (Platte = Datenordner, den Syncthing verteilt).
import { afterEach, describe, expect, it } from 'vitest'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { Entscheidungen } from '../src/konfliktEntscheid'

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function bis(f: () => boolean) {
  for (let i = 0; i < 200 && !f(); i++) await warte(10)
  expect(f()).toBe(true)
}

const KOPIE = 'lernen/karten/k.sync-conflict-20261112-183012-HANDY01.md'
const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

async function aufbau(frist: number) {
  const p = new Platte()
  p.schreibe('lernen/karten/k.md', 'Fassung PC')
  p.schreibe(KOPIE, 'Fassung Handy')
  const s = new Speicher({ ablage: ablageImSpeicher(p), wartezeit: 20 })
  await s.oeffne()
  offen.push(s)
  return { p, s, e: new Entscheidungen(s, frist) }
}

describe('Konflikt entscheiden mit Frist (K2)', () => {
  it('löscht vor Ablauf der Frist nichts, danach nur die Kopie', async () => {
    const { p, s, e } = await aufbau(150)
    e.waehle(KOPIE, 'datei')
    expect(e.offen(KOPIE)?.wahl).toBe('datei')
    await warte(60)
    expect(p.text(KOPIE)).toBe('Fassung Handy')
    expect(s.konflikte()).toEqual([KOPIE])
    await bis(() => !p.dateien.has(KOPIE))
    expect(p.text('lernen/karten/k.md')).toBe('Fassung PC')
    expect(e.offen(KOPIE)).toBeUndefined()
  })

  it('Rückgängig hält beide Fassungen, auch lange nach der Frist', async () => {
    const { p, s, e } = await aufbau(80)
    e.waehle(KOPIE, 'datei')
    await warte(30)
    e.rueckgaengig(KOPIE)
    await warte(200)
    expect(p.text(KOPIE)).toBe('Fassung Handy')
    expect(p.text('lernen/karten/k.md')).toBe('Fassung PC')
    expect(s.konflikte()).toEqual([KOPIE])
  })

  it('„Fassung vom Handy behalten“ überschreibt die Datei erst nach der Frist', async () => {
    const { p, e } = await aufbau(150)
    e.waehle(KOPIE, 'kopie')
    await warte(60)
    expect(p.text('lernen/karten/k.md')).toBe('Fassung PC')
    await bis(() => !p.dateien.has(KOPIE))
    expect(p.text('lernen/karten/k.md')).toBe('Fassung Handy')
  })

  it('eine neue Wahl ersetzt die alte, es wird nur einmal ausgeführt', async () => {
    const { p, e } = await aufbau(100)
    let meldungen = 0
    e.abonniere(() => meldungen++)
    e.waehle(KOPIE, 'kopie')
    await warte(40)
    e.waehle(KOPIE, 'datei')
    await bis(() => !p.dateien.has(KOPIE))
    expect(p.text('lernen/karten/k.md')).toBe('Fassung PC')
    expect(meldungen).toBe(3)
  })

  it('ein Fehler beim Löschen wird angezeigt, die Kopie bleibt', async () => {
    const ziel = {
      verwerfeKonflikt: async () => {
        throw new Error('Ordner nicht beschreibbar')
      },
      uebernehmeKonflikt: async () => {}
    }
    const e = new Entscheidungen(ziel, 20)
    e.waehle(KOPIE, 'datei')
    await bis(() => e.fehler(KOPIE) !== undefined)
    expect(e.fehler(KOPIE)).toBe('Ordner nicht beschreibbar')
  })
})
