// @vitest-environment happy-dom
// Tafelwerk gegen den echten Speicher (Vertrag Lernen 1.13): Tab anlegen und weglegen, Baustein hineinlegen,
// „Nein“ nur in die Datei des eigenen Geräts, Einfügen ans Ende eines Tabs
import { afterEach, describe, expect, it } from 'vitest'
import { Bestand, alleBausteine, buchDokument, imTafelwerk, liesBuchSeite, liesNein, markenZeile, neuFuerTafelwerk, pfade, tafeln, type Kopie } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { insTafelwerk, legeTabWeg, neuerTab, nichtInsTafelwerk } from '../src/tafelwerkDaten'
import { fuegeAnsEnde, fuegeEinPerKnopf } from '../src/kopieren'
import { merkeOrt } from '../src/ablage'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const BUCH = '01JBEXAMP000000000BVCH0001'
const MARKEN = [
  '---',
  `buch: "[[${BUCH}]]"`,
  '---',
  markenZeile({ id: 'a7k2c9', seite: 1, text: 'Potenzregel #integral', bereich: { x: 0.1, y: 0.2, b: 0.5, h: 0.25 }, datum: '2026-11-21', farbe: null }),
  markenZeile({ id: 'b8m3d0', seite: 1, text: 'Kettenregel', bereich: { x: 0.1, y: 0.6, b: 0.4, h: 0.1 }, datum: '2026-11-20', farbe: null }),
  ''
].join('\n')

async function geraet(vorher: Record<string, string> = {}) {
  const p = new Platte()
  for (const [pfad, text] of Object.entries(vorher)) p.schreibe(pfad, text)
  p.schreibe(pfade.buch(BUCH), buchDokument({ id: BUCH, titel: 'Mitschrift Analysis', lineatur: 'kariert', erstellt: '2026-11-20T10:00:00Z' }))
  p.schreibe(pfade.marken('lernen', BUCH), MARKEN)
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return { p, s }
}
const bestandVon = (s: Speicher) => new Bestand(new Map(s.pfade().map((x) => [x, s.text(x) ?? ''])))

describe('Tafelwerk im Datenordner', () => {
  it('ein neuer Tab ist ein Notizbuch mit art: tafelwerk; weglegen und zurückholen ändern nur den Status', async () => {
    const { p, s } = await geraet()
    const tab = await neuerTab(s, '  Analysis ')
    await s.speichereAlles()
    const text = p.text(pfade.buch(tab))
    expect(text).toContain('typ: notizbuch')
    expect(text).toContain('art: tafelwerk')
    expect(text).toContain('titel: Analysis')
    expect(tafeln(bestandVon(s).dokumente.values()).map((t) => t.id)).toEqual([tab])
    await legeTabWeg(s, tab, true)
    expect(tafeln(bestandVon(s).dokumente.values())).toEqual([])
    await legeTabWeg(s, tab, false)
    await s.speichereAlles()
    expect(p.text(pfade.buch(tab))).not.toContain('status:')
    expect(tafeln(bestandVon(s).dokumente.values()).map((t) => t.id)).toEqual([tab])
  })

  it('Tab antippen legt den Baustein mit ✦ aufs Original in den Tab; danach wird er nicht mehr angeboten', async () => {
    const { p, s } = await geraet()
    const tab = await neuerTab(s, 'Analysis')
    const b = alleBausteine(bestandVon(s).texte).find((x) => x.marke.id === 'a7k2c9')!
    await insTafelwerk(s, bestandVon(s), b, tab)
    await s.speichereAlles()
    const seite = liesBuchSeite(p.text(pfade.buchSeite(tab, 1)))
    expect(seite.bilder).toEqual([expect.objectContaining({ anhang: BUCH, seite: 1, bereich: { x: 0.1, y: 0.2, b: 0.5, h: 0.25 }, b: 500, h: 250 })])
    expect(seite.verweise).toEqual([expect.objectContaining({ anhang: BUCH, seite: 1, marke: 'a7k2c9', bild: seite.bilder[0].id })])
    const be = bestandVon(s)
    const tabs = new Set([tab])
    const drin = imTafelwerk(be.texte, tabs)
    expect(neuFuerTafelwerk(alleBausteine(be.texte), drin, liesNein(be.texte), tabs).map((x) => x.marke.id)).toEqual(['b8m3d0'])
    // das Original bleibt, wie es war
    expect(p.text(pfade.marken('lernen', BUCH))).toBe(MARKEN)
  })

  it('„Nein“ hängt nur an die Datei dieses Geräts an und gilt danach überall', async () => {
    const { p, s } = await geraet({ [pfade.tafelNein('android-x1')]: '{"am":"2026-11-21T09:00:00Z","anhang":"01JANDERS","marke":"zz9999"}' })
    const [a, b] = alleBausteine(bestandVon(s).texte)
    await nichtInsTafelwerk(s, a, 'pc-test')
    await nichtInsTafelwerk(s, b, 'pc-test')
    await s.speichereAlles()
    const zeilen = p.text(pfade.tafelNein('pc-test')).trim().split('\n').map((z) => JSON.parse(z))
    expect(zeilen.map((z) => z.marke)).toEqual([a.marke.id, b.marke.id])
    expect(p.text(pfade.tafelNein('android-x1'))).toBe('{"am":"2026-11-21T09:00:00Z","anhang":"01JANDERS","marke":"zz9999"}')
    expect(liesNein(bestandVon(s).texte).size).toBe(3)
  })
})

describe('Einfügen ans Ende und per Knopf', () => {
  const K: Kopie = { anhang: BUCH, seite: 1, bereich: { x: 0, y: 0, b: 0.5, h: 0.5 }, marke: 'a7k2c9', verhaeltnis: 1 }

  it('zweites Einfügen liegt unter dem ersten; passt nichts mehr, beginnt die nächste Seite', async () => {
    const { p, s } = await geraet()
    const tab = await neuerTab(s, 'Analysis')
    const erst = await fuegeAnsEnde(s, tab, K)
    const zweit = await fuegeAnsEnde(s, tab, K)
    const dritt = await fuegeAnsEnde(s, tab, K)
    await s.speichereAlles()
    expect([erst.nr, zweit.nr, dritt.nr]).toEqual([1, 1, 2])
    const [x, y] = liesBuchSeite(p.text(pfade.buchSeite(tab, 1))).bilder
    expect(y.y).toBeGreaterThan(x.y + x.h)
    await dritt.zurueck()
    await s.speichereAlles()
    expect(liesBuchSeite(p.text(pfade.buchSeite(tab, 2))).bilder).toEqual([])
  })

  it('der Knopf nimmt die zuletzt angetippte Stelle, wenn sie in diesem Buch liegt', async () => {
    const { p, s } = await geraet()
    const tab = await neuerTab(s, 'Analysis')
    merkeOrt({ buch: tab, nr: 3, x: 200, y: 400 })
    await fuegeEinPerKnopf(s, [tab], K)
    merkeOrt({ buch: 'anderesBuch', nr: 1, x: 10, y: 10 })
    await fuegeEinPerKnopf(s, [tab], K)
    await s.speichereAlles()
    expect(liesBuchSeite(p.text(pfade.buchSeite(tab, 3))).bilder).toEqual([expect.objectContaining({ x: 200, y: 400 })])
    // andere Stelle gemerkt: ans Ende (letzte Seite ist 3)
    expect(liesBuchSeite(p.text(pfade.buchSeite(tab, 3))).bilder).toHaveLength(1)
    expect(liesBuchSeite(p.text(pfade.buchSeite(tab, 4))).bilder).toHaveLength(1)
  })
})
