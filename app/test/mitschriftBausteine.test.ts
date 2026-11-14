// @vitest-environment happy-dom
// Bausteine aus der Mitschrift gegen den echten Speicher (Vertrag Lernen 1.10, 5.4)
import { afterEach, describe, expect, it } from 'vitest'
import { Bestand, alleBausteine, liesMarken, offeneBausteine, pfade, sucheBausteine } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { bausteinAusMitschrift, benenneBaustein, legeBausteinWeg } from '../src/wissen'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const N = '01JBEXAMP000000000NOTIZ001'

async function geraet() {
  const p = new Platte()
  p.schreibe(pfade.karte(N), `---\nid: ${N}\ntyp: notiz\nerstellt: 2026-11-14T10:00:00+01:00\ngeaendert: 2026-11-14T10:00:00+01:00\ntitel: Vorlesung 3\n---\nUmlauf ist null ^k3m9\n`)
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return s
}
const marken = (s: Speicher) => liesMarken(s.text(pfade.marken('lernen', N)) ?? '')

describe('Bausteine aus der Mitschrift', () => {
  it('legt die Zeile mit der Kennung an, Kopf `notiz`, auffindbar wie jede Markierung', async () => {
    const s = await geraet()
    const notiz = new Bestand(s.alleTexte()).dokumente.get(N)!
    expect(notiz.typ).toBe('notiz')
    await bausteinAusMitschrift(s, { mitschrift: notiz, anker: 'k3m9', name: 'Maschenregel #kirchhoff' })
    expect(s.text(pfade.marken('lernen', N))).toContain(`notiz: "[[${N}]]"`)
    expect(marken(s)).toMatchObject([{ anker: 'k3m9', text: 'Maschenregel #kirchhoff' }])
    expect(sucheBausteine(alleBausteine(s.alleTexte()), 'kirchhoff').map((b) => b.anhang)).toEqual([N])
  })

  it('je Kennung ein Baustein: Lernkarte hängt den Verweis an, ohne Namen bleibt der alte Name', async () => {
    const s = await geraet()
    const notiz = new Bestand(s.alleTexte()).dokumente.get(N)!
    const id = await bausteinAusMitschrift(s, { mitschrift: notiz, anker: 'k3m9', name: 'Maschenregel' })
    const wieder = await bausteinAusMitschrift(s, { mitschrift: notiz, anker: 'k3m9', name: '', karte: { id: '01KARTE', titel: 'Was sagt die Maschenregel?' } })
    expect(wieder).toBe(id)
    expect(marken(s)).toHaveLength(1)
    expect(marken(s)[0].text).toBe('Maschenregel [[01KARTE|Was sagt die Maschenregel?]]')
  })

  it('ohne Namen offen; benennen und weglegen gehen über dieselben Wege wie im Skript', async () => {
    const s = await geraet()
    const notiz = new Bestand(s.alleTexte()).dokumente.get(N)!
    const id = await bausteinAusMitschrift(s, { mitschrift: notiz, anker: 'k3m9', name: '' })
    expect(offeneBausteine(alleBausteine(s.alleTexte())).map((b) => b.marke.id)).toEqual([id])
    await benenneBaustein(s, N, id, 'Umlauf #et')
    await legeBausteinWeg(s, N, id, true)
    expect(marken(s)[0]).toMatchObject({ anker: 'k3m9', text: 'Umlauf #et #archiv' })
  })
})
