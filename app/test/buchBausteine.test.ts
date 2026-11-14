// @vitest-environment happy-dom
// Markieren im eigenen Notizbuch gegen den echten Speicher (Vertrag Lernen 1.9, 5.4): gleicher Ablauf wie im Skript
import { afterEach, describe, expect, it } from 'vitest'
import { Bestand, alleBausteine, buchDokument, inSeitenbreiten, liesMarken, offeneBausteine, pfade, sucheBausteine } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { benenneBaustein, karteAusStelle, setzeBereich, spuren } from '../src/wissen'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const B = '01JBEXAMP000000000BUCH0001'

async function geraet() {
  const p = new Platte()
  p.schreibe(pfade.buch(B), buchDokument({ id: B, titel: 'Mitschrift ET2', lineatur: 'kariert', erstellt: '2026-11-14T10:00:00+01:00' }))
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return s
}

const A4 = 1414 / 1000
// unten auf der Seite gezogen: relativ zur Höhe 0.8, in Seitenbreiten also über 1
const bereich = inSeitenbreiten({ x: 0.1, y: 0.8, b: 0.6, h: 0.1 }, A4)
const marken = (s: Speicher) => liesMarken(s.text(pfade.marken('lernen', B)) ?? '')

describe('Bausteine im Notizbuch', () => {
  it('„Baustein“ legt die Markierungsdatei des Buchs an, mit Kopf `buch` und Maßen über 1', async () => {
    const s = await geraet()
    const buch = new Bestand(s.alleTexte()).dokumente.get(B)!
    await karteAusStelle(s, { quelle: buch, seite: 3, bereich, art: 'nur', titel: 'Stelle', farbe: null, markeId: 'bu0001', name: 'Eigene Herleitung #integral' })
    const text = s.text(pfade.marken('lernen', B))!
    expect(text).toContain(`buch: "[[${B}]]"`)
    expect(text).not.toContain('anhang:')
    expect(marken(s)[0]).toMatchObject({ seite: 3, text: 'Eigene Herleitung #integral' })
    expect(marken(s)[0].bereich.y).toBeCloseTo(1.131, 3)
    expect(sucheBausteine(alleBausteine(s.alleTexte()), 'herleitung').map((b) => b.anhang)).toEqual([B])
  })

  it('ohne Namen ist er offen, benennen geht wie im Skript', async () => {
    const s = await geraet()
    const buch = new Bestand(s.alleTexte()).dokumente.get(B)!
    await karteAusStelle(s, { quelle: buch, seite: 1, bereich, art: 'nur', titel: 'Stelle', farbe: null, markeId: 'bu0002', name: '' })
    expect(offeneBausteine(alleBausteine(s.alleTexte())).map((b) => b.marke.id)).toEqual(['bu0002'])
    await benenneBaustein(s, B, 'bu0002', 'Kettenregel')
    expect(marken(s)[0].text).toBe('Kettenregel')
    expect(marken(s)[0].bereich.y).toBeCloseTo(1.131, 3)
  })

  it('Lernkarte aus einer schon gesetzten Markierung: Lage, Datum und Name bleiben, der Verweis kommt dazu', async () => {
    const s = await geraet()
    const buch = new Bestand(s.alleTexte()).dokumente.get(B)!
    await karteAusStelle(s, { quelle: buch, seite: 2, bereich, art: 'nur', titel: 'Stelle', farbe: 'wichtig', markeId: 'bu0003', name: 'Potenzregel #integral' })
    const vorher = marken(s)[0]
    // wieder angetippt, Name unverändert übernommen, Bereich egal (die alte Lage gilt)
    const karte = await karteAusStelle(s, { quelle: buch, seite: 2, bereich: { x: 0, y: 0, b: 1, h: 1 }, art: 'frage', titel: 'Wie lautet die Potenzregel?', farbe: null, markeId: 'bu0003', name: 'Potenzregel #integral' })
    const m = marken(s)
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ bereich: vorher.bereich, datum: vorher.datum, farbe: 'wichtig', text: `Potenzregel #integral [[${karte}|Wie lautet die Potenzregel?]]` })
    // die Karte zeigt als Antwort den Ausschnitt aus dem Buch, „Nutzen“ findet die Spur zurück ins Buch
    expect(s.text(pfade.karte(karte))).toContain(`:: ![[${B}#seite=2&marke=bu0003|Mitschrift ET2, S. 2]]`)
    expect(spuren(new Bestand(s.alleTexte()), karte).map((x) => x.quelle.id)).toEqual([B])
  })

  it('eine zweite Karte zur selben Markierung hängt einen zweiten Verweis an, der erste bleibt', async () => {
    const s = await geraet()
    const buch = new Bestand(s.alleTexte()).dokumente.get(B)!
    const k1 = await karteAusStelle(s, { quelle: buch, seite: 2, bereich, art: 'frage', titel: 'F1', farbe: null, markeId: 'bu0004', name: 'Satz' })
    const k2 = await karteAusStelle(s, { quelle: buch, seite: 2, bereich, art: 'wissen', titel: 'W2', farbe: null, markeId: 'bu0004', name: 'Satz' })
    expect(marken(s)[0].text).toBe(`Satz [[${k1}|F1]] [[${k2}|W2]]`)
  })
})

describe('Markierung verschieben (Lernen 1.10)', () => {
  it('setzeBereich ändert nur die Maße dieser Zeile, alles andere bleibt byte-gleich', async () => {
    const s = await geraet()
    const buch = new Bestand(s.alleTexte()).dokumente.get(B)!
    await karteAusStelle(s, { quelle: buch, seite: 2, bereich, art: 'nur', titel: 'Stelle', farbe: 'wichtig', markeId: 'bu0009', name: 'Potenzregel #integral' })
    await karteAusStelle(s, { quelle: buch, seite: 3, bereich, art: 'nur', titel: 'Stelle', farbe: null, markeId: 'bu0010', name: 'Andere' })
    const vorher = s.text(pfade.marken('lernen', B))!
    await setzeBereich(s, B, 'bu0009', { x: 0.3, y: 1.25, b: 0.2, h: 0.05 })
    const nachher = s.text(pfade.marken('lernen', B))!
    const m = liesMarken(nachher)
    expect(m[0]).toMatchObject({ id: 'bu0009', text: 'Potenzregel #integral', farbe: 'wichtig', datum: liesMarken(vorher)[0].datum, bereich: { x: 0.3, y: 1.25, b: 0.2, h: 0.05 } })
    // die andere Zeile und der Kopf bis auf `geaendert` bleiben
    expect(nachher.split('\n').filter((z) => z.includes('bu0010'))).toEqual(vorher.split('\n').filter((z) => z.includes('bu0010')))
    // unbekannte Marke: nichts
    await setzeBereich(s, B, 'gibtsnicht', { x: 0, y: 0, b: 1, h: 1 })
    expect(s.text(pfade.marken('lernen', B))).toBe(nachher)
  })
})
