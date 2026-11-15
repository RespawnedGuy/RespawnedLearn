import { describe, expect, it } from 'vitest'
import {
  ANHEBEN_MS,
  LOESCHEN_MS,
  RING_AB_MS,
  VERTRAG,
  bildAn,
  buchSeiteJson,
  haltenStand,
  legeZurueck,
  liesBuchSeite,
  liesMarken,
  loescheMarke,
  loeschwirkung,
  markeImBuch,
  ohneBild,
  ohneMarke,
  ohneVerweis,
  sichtbareMarken,
  starteHalten,
  stelleMarkeWieder,
  vergleicheVersionen
} from '../src'

// Halten packt an (Nils 2026-11-15): 0,4 s hebt an, 1,0 s löscht, wer sich bewegt, radiert oder zieht auf
describe('Halten', () => {
  const h = starteHalten(1000, 50, 50, LOESCHEN_MS)
  it('zeigt den Kreis erst nach 150 ms', () => {
    expect(haltenStand(h, 1000 + RING_AB_MS - 1, 50, 50)).toMatchObject({ art: 'laeuft', ring: false })
    expect(haltenStand(h, 1000 + RING_AB_MS, 50, 50)).toMatchObject({ art: 'laeuft', ring: true })
  })
  it('der Kreis leert sich von 1 auf 0', () => {
    expect(haltenStand(h, 1000, 50, 50)).toMatchObject({ rest: 1 })
    expect(haltenStand(h, 1500, 50, 50)).toMatchObject({ rest: 0.5 })
  })
  it('löscht genau nach 1000 ms, nicht bei 999', () => {
    expect(haltenStand(h, 1999, 50, 50).art).toBe('laeuft')
    expect(haltenStand(h, 2000, 50, 50).art).toBe('fertig')
  })
  it('hebt nach 400 ms an', () => {
    const a = starteHalten(0, 0, 0, ANHEBEN_MS)
    expect(haltenStand(a, 399, 0, 0).art).toBe('laeuft')
    expect(haltenStand(a, 400, 0, 0).art).toBe('fertig')
  })
  it('Zittern bis 8 px zählt noch als Halten, 9 px nicht mehr, auch nicht nach Ablauf der Zeit', () => {
    expect(haltenStand(h, 1500, 58, 50).art).toBe('laeuft')
    expect(haltenStand(h, 1500, 59, 50).art).toBe('bewegt')
    expect(haltenStand(h, 5000, 50, 60).art).toBe('bewegt')
  })
})

const A = '01JBEXAMP000000000SKRPT001'
const datei = [
  '---',
  'typ: markierungen',
  '---',
  '- S. 1 %%rn 0.100 0.100 0.200 0.100 2026-11-14%% ^offen1',
  '- S. 1 · Potenzregel #integral %%rn 0.300 0.300 0.200 0.100 2026-11-14 wichtig%% ^benann',
  '- S. 2 · [[01JBKARTE|Was ist x?]] %%rn 0.100 0.500 0.200 0.100 2026-11-14%% ^karte1',
  '- S. 2 · Alt #archiv %%rn 0.100 0.700 0.200 0.100 2026-11-14%% ^weg001',
  ''
].join('\n')
const marken = liesMarken(datei)
const m = (id: string) => marken.find((x) => x.id === id)!

describe('Löschen von Markierungen (Lernen 1.11)', () => {
  it('der Vertrag steht auf 1.11', () => {
    expect(vergleicheVersionen(VERTRAG, '1.11')).toBeGreaterThanOrEqual(0)
    expect(vergleicheVersionen('1.11', '1.10')).toBeGreaterThan(0)
  })
  it('entfernt nur eine offene Markierung ohne ✦ im Buch', () => {
    expect(loeschwirkung(m('offen1'), false)).toBe('entfernen')
    expect(loeschwirkung(m('offen1'), true)).toBe('weglegen')
    expect(loeschwirkung(m('benann'), false)).toBe('weglegen')
    expect(loeschwirkung(m('karte1'), false)).toBe('weglegen')
  })
  it('Entfernen nimmt genau die eine Zeile, Rückgängig ergibt die Datei byte-gleich', () => {
    const neu = loescheMarke(datei, 'offen1', 'entfernen')
    expect(liesMarken(neu).map((x) => x.id)).toEqual(['benann', 'karte1', 'weg001'])
    expect(stelleMarkeWieder(neu, m('offen1'))).toBe(datei)
  })
  it('Weglegen schreibt #archiv und lässt Verweise stehen; Rückgängig ergibt die Datei byte-gleich', () => {
    const neu = loescheMarke(datei, 'karte1', 'weglegen')
    const k = liesMarken(neu).find((x) => x.id === 'karte1')!
    expect(k.text).toContain('#archiv')
    expect(k.text).toContain('[[01JBKARTE|Was ist x?]]')
    expect(k.bereich).toEqual(m('karte1').bereich)
    expect(stelleMarkeWieder(neu, m('karte1'))).toBe(datei)
  })
  it('unbekannte oder schon weggelegte Markierung: Datei bleibt', () => {
    expect(loescheMarke(datei, 'gibtsnicht', 'entfernen')).toBe(datei)
    expect(loescheMarke(datei, 'weg001', 'weglegen')).toBe(datei)
  })
  it('weggelegte Markierungen werden nicht gezeichnet', () => {
    expect(sichtbareMarken(marken).map((x) => x.id)).toEqual(['offen1', 'benann', 'karte1'])
  })
  it('Zeilen aus Mitschriften bleiben beim Löschen anderer unberührt', () => {
    const mit = datei.replace('^weg001\n', '^weg001\n- ^abs-1 · Satz %%rt 2026-11-14%% ^text01\n')
    const neu = loescheMarke(mit, 'offen1', 'entfernen')
    expect(neu).toContain('- ^abs-1 · Satz %%rt 2026-11-14%% ^text01')
  })
  it('findet ✦-Marken in Buchseiten, nur mit passendem Skript', () => {
    const seite = buchSeiteJson({ bilder: [], verweise: [{ id: 'v1', y: 100, anhang: A, seite: 2, marke: 'karte1' }], rest: {} })
    const texte = new Map([
      ['lernen/buecher/01JBBUCH/S001.json', seite],
      ['lernen/markierungen/x.md', 'karte1']
    ])
    expect(markeImBuch(texte, A, 'karte1')).toBe(true)
    expect(markeImBuch(texte, 'ANDERES', 'karte1')).toBe(false)
    expect(markeImBuch(texte, A, 'offen1')).toBe(false)
  })
})

describe('Löschen auf der Buchseite (Rückgängig genau)', () => {
  const seite = liesBuchSeite(
    JSON.stringify({
      bilder: [
        { id: 'b1', anhang: 'F', x: 10, y: 10, b: 100, h: 50 },
        { id: 'b2', anhang: A, seite: 3, bereich: { x: 0.1, y: 0.1, b: 0.5, h: 0.2 }, x: 10, y: 300, b: 500, h: 120 },
        { id: 'b3', anhang: 'G', x: 50, y: 30, b: 100, h: 50 }
      ],
      verweise: [
        { id: 'v1', y: 96, anhang: A, seite: 12 },
        { id: 'v2', y: 300, anhang: A, seite: 3, marke: 'karte1', bild: 'b2' }
      ]
    })
  )
  const json = buchSeiteJson(seite)
  it('automatische Randmarke: nur der Verweis geht', () => {
    const r = ohneVerweis(seite, 'v1')!
    expect(r.seite.verweise.map((v) => v.id)).toEqual(['v2'])
    expect(r.seite.bilder).toHaveLength(3)
    expect(buchSeiteJson(legeZurueck(r.seite, r.weg))).toBe(json)
  })
  it('✦-Marke: Marke und ihr Ausschnitt gehen, Rückgängig legt beide an ihren Platz', () => {
    const r = ohneMarke(seite, 'v2')!
    expect(r.seite.bilder.map((b) => b.id)).toEqual(['b1', 'b3'])
    expect(buchSeiteJson(legeZurueck(r.seite, r.weg))).toBe(json)
  })
  it('Bild: vom Blatt, Rückgängig an dieselbe Stelle der Reihenfolge', () => {
    const r = ohneBild(seite, 'b1')!
    expect(r.seite.bilder.map((b) => b.id)).toEqual(['b2', 'b3'])
    expect(buchSeiteJson(legeZurueck(r.seite, r.weg))).toBe(json)
  })
  it('Rückgängig legt nichts doppelt hin, wenn es schon wieder da ist', () => {
    const r = ohneBild(seite, 'b1')!
    expect(legeZurueck(seite, r.weg).bilder).toHaveLength(3)
  })
  it('gibt es das Ziel nicht, kommt null', () => {
    expect(ohneVerweis(seite, 'x')).toBeNull()
    expect(ohneBild(seite, 'x')).toBeNull()
    expect(ohneMarke(seite, 'v1')).toBeNull()
  })
  it('bildAn trifft das oberste Bild', () => {
    expect(bildAn(seite.bilder, 60, 40)?.id).toBe('b3')
    expect(bildAn(seite.bilder, 20, 20)?.id).toBe('b1')
    expect(bildAn(seite.bilder, 900, 900)).toBeNull()
  })
})
