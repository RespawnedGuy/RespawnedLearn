import { describe, expect, it } from 'vitest'
import {
  abschliessen,
  aktuelleLektuere,
  genugText,
  heute,
  kapitelOhneFragen,
  kapitelBereich,
  liesFragenDatei,
  mitFehler,
  mitKapitelfragen,
  mitRechnen,
  mitStueck,
  naechsterSchritt,
  neueFragenDatei,
  neuVersuchen,
  pruefeAntwort,
  SCHEMAS,
  seitenBlock,
  stuecke,
  vorfragenDatei,
  vorfragenGleich,
  vorfragenSeiten,
  type FragenDatei
} from '../src'

const J = '2026-11-13T08:00:00.000Z'
const kap = { titel: '2 Spannungsteiler', von: 12, bis: 19 }
const frage = (art: 'verstaendnis' | 'sokratisch', seite: number) => ({ art, frage: ` Warum ${seite}? `, antwort: 'Weil.', seite })

describe('Kapitel und Stücke (wie VX server/fragen.mjs)', () => {
  const kapitel = [
    { titel: '1 Grundlagen', seite: 3, ebene: 1 },
    { titel: '1.1 Strom', seite: 4, ebene: 2 },
    { titel: '2 Spannungsteiler', seite: 12, ebene: 1 },
    { titel: '3 Brücken', seite: 20, ebene: 1 }
  ]
  it('findet das Kapitel der Seite und endet vor dem nächsten', () => {
    expect(kapitelBereich(kapitel, 15, 200)).toEqual(kap)
    expect(kapitelBereich(kapitel, 2, 200)).toBeNull()
  })
  it('letztes Kapitel endet am Buchende, höchstens nach 40 Seiten', () => {
    expect(kapitelBereich(kapitel, 25, 30)).toEqual({ titel: '3 Brücken', von: 20, bis: 30 })
    expect(kapitelBereich(kapitel, 25, 500)?.bis).toBe(59)
  })
  it('bei weniger als drei Teilen eine Ebene tiefer', () => {
    const zwei = [
      { titel: 'Teil I', seite: 1, ebene: 1 },
      { titel: 'A', seite: 2, ebene: 2 },
      { titel: 'B', seite: 9, ebene: 2 },
      { titel: 'Teil II', seite: 30, ebene: 1 }
    ]
    expect(kapitelBereich(zwei, 5, 60)).toEqual({ titel: 'A', von: 2, bis: 8 })
  })
  it('teilt in Stücke zu fünf Seiten', () => {
    expect(stuecke(12, 23)).toEqual([
      { von: 12, bis: 16 },
      { von: 17, bis: 21 },
      { von: 22, bis: 23 }
    ])
  })
  it('liest nur Bücher mit frischem Lesestand, jüngstes zuerst', () => {
    const jetzt = Date.parse(J)
    const stand = { a: { seite: 3, am: '2026-11-12T10:00:00Z' }, b: { seite: 9, am: '2026-11-13T07:00:00Z' }, alt: { seite: 1, am: '2026-10-01T00:00:00Z' } }
    expect(aktuelleLektuere(stand, jetzt).map((x) => x.anhang)).toEqual(['b', 'a'])
  })
  it('markiert Seiten und erkennt Scans ohne Text', () => {
    const block = seitenBlock(12, ['Text  \n\n\n\nmehr', ''])
    expect(block).toBe('--- Seite 12 ---\nText\n\nmehr\n\n--- Seite 13 ---\n')
    expect(genugText(block, 2)).toBe(false)
    expect(genugText(seitenBlock(12, ['x'.repeat(120)]), 1)).toBe(true)
  })
})

describe('Fragendatei Schritt für Schritt', () => {
  const leer = () => neueFragenDatei('A1', kap, 'anthropic/claude-sonnet-5-5', J)

  it('geht Stücke, Kapitelfragen, Rechenaufgaben und Abschluss der Reihe nach durch', () => {
    let f = leer()
    expect(naechsterSchritt(f)).toEqual({ art: 'stueck', von: 12, bis: 16 })
    f = mitStueck(f, { von: 12, bis: 16 }, { kern: 'Teiler', fragen: [frage('verstaendnis', 13), frage('sokratisch', 99)] }, J)
    expect(f.fragen.map((q) => [q.id, q.seite, q.frage])).toEqual([
      ['12-1', 13, 'Warum 13?'],
      ['12-2', 16, 'Warum 99?']
    ])
    expect(naechsterSchritt(f)).toEqual({ art: 'stueck', von: 17, bis: 19 })
    f = mitStueck(f, { von: 17, bis: 19 }, { kern: '', fragen: [] }, J)
    const s = naechsterSchritt(f)
    expect(s.art).toBe('kapitel')
    f = mitKapitelfragen(f, { fragen: [frage('sokratisch', 3)] }, J)
    expect(f.fragen.at(-1)).toMatchObject({ id: 'kapitel-1', art: 'sokratisch', seite: 19 })
    // nur der Abschnitt mit Lernstoff bekommt einen Rechendurchgang
    expect(naechsterSchritt(f)).toEqual({ art: 'rechnen', von: 12, bis: 16 })
    f = mitRechnen(
      f,
      { von: 12, bis: 16 },
      { aufgaben: [{ frage: 'U2?', ergebnis: ' 3,8 V ', seite: 14, tipps: [' Ohm ', ''], schritte: [{ ziel: 'R', rechnung: '$R$', ergebnis: '6 k' }], wege: ' ' }] },
      J
    )
    expect(f.fragen.at(-1)).toEqual({ id: '12-r1', art: 'rechnen', frage: 'U2?', antwort: '3,8 V', seite: 14, tipps: ['Ohm'], schritte: [{ ziel: 'R', rechnung: '$R$', ergebnis: '6 k' }] })
    expect(naechsterSchritt(f)).toEqual({ art: 'abschluss' })
    f = abschliessen(f, J)
    expect(f.status).toBe('fertig')
    expect(naechsterSchritt(f)).toEqual({ art: 'nichts' })
  })

  it('ein Stück, das inzwischen ein anderes Gerät erledigt hat, bleibt unverändert', () => {
    const f = mitStueck(leer(), { von: 12, bis: 16 }, { kern: 'A', fragen: [frage('verstaendnis', 12)] }, J)
    expect(mitStueck(f, { von: 12, bis: 16 }, { kern: 'B', fragen: [frage('verstaendnis', 12)] }, J)).toBe(f)
  })

  it('leere Antwort zum ganzen Kapitel: im selben Durchgang nicht nochmal fragen', () => {
    let f = mitStueck(leer(), { von: 12, bis: 16 }, { kern: 'A', fragen: [] }, J)
    f = mitStueck(f, { von: 17, bis: 19 }, { kern: 'B', fragen: [] }, J)
    f = mitKapitelfragen(f, { fragen: [] }, J)
    expect(naechsterSchritt(f).art).toBe('kapitel')
    expect(naechsterSchritt(f, { kapitelGefragt: true })).toEqual({ art: 'rechnen', von: 12, bis: 16 })
  })

  it('nichts Lesbares im Kapitel ergibt kein_text', () => {
    let f = mitStueck(leer(), { von: 12, bis: 16 }, { kern: '', fragen: [] }, J)
    f = mitStueck(f, { von: 17, bis: 19 }, { kern: '', fragen: [] }, J)
    expect(naechsterSchritt(f)).toEqual({ art: 'abschluss' })
    expect(abschliessen(f, J).status).toBe('kein_text')
  })

  it('nach drei Fehlversuchen ruht das Kapitel, „Nochmal“ macht weiter, wo es war', () => {
    let f = mitStueck(leer(), { von: 12, bis: 16 }, { kern: 'A', fragen: [] }, J)
    for (let i = 0; i < 3; i++) f = mitFehler(f, 'Zu viele Anfragen', J)
    expect(f.status).toBe('fehler')
    expect(naechsterSchritt(f)).toEqual({ art: 'nichts' })
    f = neuVersuchen(f)
    expect(naechsterSchritt(f)).toEqual({ art: 'stueck', von: 17, bis: 19 })
    expect(abschliessen(f, J)).not.toHaveProperty('fehler')
  })

  it('liest die eigene Datei zurück und lässt unbekannte Felder stehen', () => {
    const f = { ...leer(), extra: 1 } as FragenDatei
    expect(liesFragenDatei(JSON.stringify(f))?.extra).toBe(1)
    expect(liesFragenDatei('kaputt')).toBeNull()
    expect(liesFragenDatei(undefined)).toBeNull()
  })
})

describe('Antwortformate', () => {
  it('Stück: falsche Art wird abgelehnt, Seite als Text wird zur Zahl', () => {
    expect(pruefeAntwort({ kern: 'k', fragen: [{ art: 'sokratisch', frage: 'f', antwort: 'a', seite: '13' }] }, SCHEMAS.stueck)).toEqual({
      kern: 'k',
      fragen: [{ art: 'sokratisch', frage: 'f', antwort: 'a', seite: 13 }]
    })
    expect(() => pruefeAntwort({ kern: 'k', fragen: [{ art: 'quiz', frage: 'f', antwort: 'a', seite: 1 }] }, SCHEMAS.stueck)).toThrow(/quiz/)
  })
  it('Rechnen: fehlende Schritte werden abgelehnt', () => {
    expect(() => pruefeAntwort({ aufgaben: [{ frage: 'f', ergebnis: 'e', seite: 1, tipps: [], wege: '' }] }, SCHEMAS.rechnen)).toThrow(/schritte/)
  })
})

describe('Vorfragen (wie VX server/vorfragen.mjs)', () => {
  it('sechs Seiten ab der aktuellen, nicht über das Buchende', () => {
    expect(vorfragenSeiten(12, 200)).toEqual({ ab: 12, bis: 17 })
    expect(vorfragenSeiten(198, 200)).toEqual({ ab: 198, bis: 200 })
    expect(vorfragenSeiten(201, 200)).toBeNull()
  })
  it('gleich, solange nicht weitergelesen wurde', () => {
    const alt = { buecher: [{ anhang: 'a', ab: 12 }] }
    expect(vorfragenGleich(alt, [{ anhang: 'a', ab: 12 }])).toBe(true)
    expect(vorfragenGleich(alt, [{ anhang: 'a', ab: 14 }])).toBe(false)
    expect(vorfragenGleich(null, [{ anhang: 'a', ab: 12 }])).toBe(false)
  })
  it('ordnet unbekannte Kennungen dem ersten Buch zu und hält Seiten im Bereich', () => {
    const teile = [{ anhang: 'a', titel: 'Elektronik', ab: 12, bis: 17, kapitel: '2', text: 'geheim' }]
    const d = vorfragenDatei(teile, { fragen: [{ anhang: 'falsch', frage: ' Was? ', antwort: 'So.', seite: 40 }] }, 'ollama/gemma3', new Date(J))
    expect(d.fragen).toEqual([{ id: '1', anhang: 'a', seite: 17, frage: 'Was?', antwort: 'So.' }])
    expect(d.buecher).toEqual([{ anhang: 'a', titel: 'Elektronik', ab: 12, bis: 17, kapitel: '2' }])
    expect(d.modell).toBe('ollama/gemma3')
  })
  it('heute ist das Datum des Geräts', () => {
    expect(heute(new Date(2026, 0, 5, 1, 30))).toBe('2026-01-05')
  })
})

describe('Angebot „Fragen erzeugen“', () => {
  const texte = (fragen?: object) =>
    new Map<string, string>([
      ['gemeinsam/anhaenge/A1.md', '---\nid: A1\ntyp: anhang\ntitel: Elektronik\ndatei: anhaenge/A1.pdf\n---\n'],
      ['lernen/stand/pc.json', JSON.stringify({ A1: { seite: 13, am: new Date(Date.now() - 60_000).toISOString() } })],
      ['lernen/inhalt/A1.json', JSON.stringify({ herkunft: 'pdf', version: 1, kapitel: [{ titel: '1', seite: 3, ebene: 1 }, { titel: '2 Teiler', seite: 12, ebene: 1 }, { titel: '3', seite: 20, ebene: 1 }] })],
      ...(fragen ? ([['lernen/fragen/A1/S012.json', JSON.stringify(fragen)]] as [string, string][]) : [])
    ])
  it('bietet an, solange das Kapitel keine fertigen Fragen hat', async () => {
    const { Bestand } = await import('../src')
    expect(kapitelOhneFragen(new Bestand(texte()), Date.now())).toEqual([{ anhang: 'A1', kapitel: '2 Teiler' }])
    const fertig = { ...neueFragenDatei('A1', { titel: '2 Teiler', von: 12, bis: 19 }, 'm', J), status: 'fertig', abschnitte: [{ von: 12, bis: 16, kern: '' }, { von: 17, bis: 19, kern: '' }] }
    expect(kapitelOhneFragen(new Bestand(texte(fertig)), Date.now())).toEqual([])
    expect(kapitelOhneFragen(new Bestand(texte({ ...fertig, status: 'laeuft' })), Date.now())).toHaveLength(1)
  })
})
