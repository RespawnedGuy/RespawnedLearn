// @vitest-environment happy-dom
// Platz einfügen und Textfelder gegen den echten Speicher (Vertrag Lernen 1.14): schreibt nur, was sich ändert;
// Rückgängig stellt die Dateien byte-gleich wieder her
import { afterEach, describe, expect, it } from 'vitest'
import { A4, buchDokument, buchSeiteJson, liesBuchSeite, liesMarken, liesTinte, markenZeile, pfade, tinteSvg, type Strich } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { fuegePlatzEinMitMeldung } from '../src/BuchPlatz'
import { nimmTextMitMeldung, setzeText } from '../src/BuchText'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const BUCH = '01JBEXAMP000000000BVCH0002'
const strich = (y: number): Strich => ({ farbe: 'alltag', breite: 3, punkte: [[100, y, 0.5], [300, y + 20, 0.5]], d: `M100.0 ${y.toFixed(1)}L300.0 ${(y + 20).toFixed(1)}Z` })
const TINTE = tinteSvg([strich(100), strich(700)], 1000 * A4)
const SEITE = buchSeiteJson({ bilder: [{ id: 'b1', anhang: 'FOTO', x: 48, y: 800, b: 400, h: 200 }], verweise: [], texte: [{ id: 't1', x: 80, y: 300, b: 500, text: 'oben bleibt' }], rest: {} })
const MARKEN = ['---', `buch: "[[${BUCH}]]"`, '---', markenZeile({ id: 'mu', seite: 1, text: 'Formel', bereich: { x: 0.1, y: 0.75, b: 0.3, h: 0.05 }, datum: '2026-11-22', farbe: null }), ''].join('\n')

async function geraet() {
  const p = new Platte()
  p.schreibe(pfade.buch(BUCH), buchDokument({ id: BUCH, titel: 'Formeln', lineatur: 'leer', art: 'tafelwerk', erstellt: '2026-11-22T10:00:00Z' }))
  p.schreibe(pfade.buchTinte(BUCH, 1), TINTE)
  p.schreibe(pfade.buchSeite(BUCH, 1), SEITE)
  p.schreibe(pfade.marken('lernen', BUCH), MARKEN)
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return { p, s }
}

/** fängt die nächste Meldung samt Rückgängig ab */
function naechsteMeldung() {
  let m: { text: string; rueckgaengig?: () => void } | null = null
  const f = (e: Event) => (m = (e as CustomEvent).detail)
  addEventListener('rvx:meldung', f)
  return () => {
    removeEventListener('rvx:meldung', f)
    return m as { text: string; rueckgaengig?: () => void } | null
  }
}

describe('Platz einfügen im Datenordner', () => {
  it('rückt Strich, Bild und Markierung darunter, verlängert die Seite; Rückgängig ergibt dieselben Bytes', async () => {
    const { p, s } = await geraet()
    const meldung = naechsteMeldung()
    const n = await fuegePlatzEinMitMeldung(s, BUCH, 1, 600, 500)
    const m = meldung()
    expect(n).toBe(3)
    await s.speichereAlles()
    expect(liesTinte(p.text(pfade.buchTinte(BUCH, 1))!).map((x) => x.punkte[0][1])).toEqual([100, 1200])
    const seite = liesBuchSeite(p.text(pfade.buchSeite(BUCH, 1)))
    expect(seite.bilder[0].y).toBe(1300)
    expect(seite.texte![0].y).toBe(300)
    expect(liesMarken(p.text(pfade.marken('lernen', BUCH))!)[0].bereich.y).toBeCloseTo(1.25, 5)
    // Bild bis 1500 + Rand: die Seite ist länger als A4
    expect(p.text(pfade.buchTinte(BUCH, 1))).toContain('viewBox="0 0 1000 1524"')
    expect(m?.text).toContain('mm Platz eingefügt')
    m!.rueckgaengig!()
    await s.speichereAlles()
    expect(p.text(pfade.buchTinte(BUCH, 1))).toBe(TINTE)
    expect(p.text(pfade.buchSeite(BUCH, 1))).toBe(SEITE)
    expect(p.text(pfade.marken('lernen', BUCH))).toBe(MARKEN)
  })

  it('darunter nichts: keine Datei wird angefasst', async () => {
    const { p, s } = await geraet()
    expect(await fuegePlatzEinMitMeldung(s, BUCH, 1, 1300, 200)).toBe(0)
    await s.speichereAlles()
    expect(p.text(pfade.buchTinte(BUCH, 1))).toBe(TINTE)
    expect(p.text(pfade.buchSeite(BUCH, 1))).toBe(SEITE)
  })

  it('Rückgängig nach weiterer Arbeit auf der Seite: nichts wird halb zurückgerückt, nichts geht verloren', async () => {
    const { p, s } = await geraet()
    const meldung = naechsteMeldung()
    await fuegePlatzEinMitMeldung(s, BUCH, 1, 600, 100)
    const m = meldung()
    await setzeText(s, BUCH, 1, { id: 't2', x: 80, y: 1000, b: 400, text: 'danach geschrieben' })
    const tinteNachher = s.text(pfade.buchTinte(BUCH, 1))
    const hinweis = naechsteMeldung()
    m!.rueckgaengig!()
    expect(hinweis()?.text).toContain('Rückgängig geht nicht mehr')
    await s.speichereAlles()
    expect(p.text(pfade.buchTinte(BUCH, 1))).toBe(tinteNachher)
    expect(liesBuchSeite(p.text(pfade.buchSeite(BUCH, 1))).texte!.map((t) => t.id)).toEqual(['t1', 't2'])
  })
})

describe('Textfelder im Datenordner', () => {
  it('anlegen, ändern, leerer Text entfernt; Entfernen lässt sich rückgängig machen', async () => {
    const { p, s } = await geraet()
    await setzeText(s, BUCH, 1, { id: 't2', x: 80, y: 500, b: 400, text: 'Gilt nur für $I$ konstant' })
    await s.speichereAlles()
    const t2 = liesBuchSeite(p.text(pfade.buchSeite(BUCH, 1))).texte!.find((t) => t.id === 't2')!
    expect(t2.text).toBe('Gilt nur für $I$ konstant')
    expect(t2.am).toBeTruthy()
    await setzeText(s, BUCH, 1, { ...t2, text: 'geändert' })
    expect(liesBuchSeite(s.text(pfade.buchSeite(BUCH, 1))).texte!.find((t) => t.id === 't2')!.text).toBe('geändert')
    const meldung = naechsteMeldung()
    await nimmTextMitMeldung(s, BUCH, 1, 't2')
    expect(liesBuchSeite(s.text(pfade.buchSeite(BUCH, 1))).texte!.map((t) => t.id)).toEqual(['t1'])
    meldung()!.rueckgaengig!()
    await s.speichereAlles()
    expect(liesBuchSeite(p.text(pfade.buchSeite(BUCH, 1))).texte!.map((t) => t.id)).toEqual(['t1', 't2'])
    // leerer Text: das Feld verschwindet; ohne Textfelder steht kein `texte` mehr in der Datei
    await setzeText(s, BUCH, 1, { id: 't2', x: 0, y: 0, b: 300, text: ' ' })
    await setzeText(s, BUCH, 1, { id: 't1', x: 0, y: 0, b: 300, text: '' })
    await s.speichereAlles()
    expect(p.text(pfade.buchSeite(BUCH, 1))).not.toContain('texte')
  })
})
