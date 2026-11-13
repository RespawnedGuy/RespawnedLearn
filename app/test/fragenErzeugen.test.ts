// Kapitelfragen und Vorfragen auf Knopfdruck gegen den echten Speicher auf einem Ordner im Arbeitsspeicher.
// PDF und KI sind Scheine: Seiten als Text, die KI antwortet je Aufgabe mit einer festen Antwort.
import { afterEach, describe, expect, it } from 'vitest'
import { liesFragenDatei, offeneFragen, Bestand, lesestand, type PromptSchluessel } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { erzeugeKapitelfragen, erzeugeVorfragen, type Werkzeug } from '../src/fragenErzeugen'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const vorhin = () => new Date(Date.now() - 3600_000).toISOString()
const TEXT = 'Ein Spannungsteiler teilt die Spannung im Verhältnis der Widerstände. '.repeat(3)

function ordner(o: { inhalt?: boolean; seite?: number } = {}) {
  const p = new Platte()
  p.schreibe('gemeinsam/anhaenge/A1.md', '---\nid: A1\ntyp: anhang\ntitel: Elektronik\ndatei: anhaenge/A1.pdf\nart: skript\n---\n')
  p.schreibe('anhaenge/A1.pdf', '%PDF')
  p.schreibe('lernen/stand/pc.json', JSON.stringify({ A1: { seite: o.seite ?? 13, am: vorhin() } }))
  if (o.inhalt !== false)
    p.schreibe(
      'lernen/inhalt/A1.json',
      JSON.stringify({
        herkunft: 'pdf',
        version: 1,
        kapitel: [
          { titel: '1 Grundlagen', seite: 3, ebene: 1 },
          { titel: '2 Spannungsteiler', seite: 12, ebene: 1 },
          { titel: '3 Brücken', seite: 20, ebene: 1 }
        ]
      })
    )
  return p
}

async function geraet(p: Platte) {
  const s = new Speicher({ ablage: ablageImSpeicher(p), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return s
}

/** Seiten 17 bis 19 sind Scans (kein Text) */
function werkzeug(fehlerBeiAufruf?: number) {
  const aufgaben: PromptSchluessel[] = []
  const texte: string[] = []
  const w: Werkzeug = {
    seitenzahl: async () => 200,
    seitenText: async (_pfad, von, bis) => ({ seiten: 200, texte: Array.from({ length: bis - von + 1 }, (_, i) => (von + i >= 17 && von + i <= 19 ? '' : TEXT)) }),
    modell: async () => 'anthropic/claude-sonnet-5-5',
    async frage<T>(aufgabe: PromptSchluessel, a: { text: string }) {
      aufgaben.push(aufgabe)
      texte.push(a.text)
      if (fehlerBeiAufruf === aufgaben.length) throw new Error('Zu viele Anfragen. Eine Minute warten.')
      const antwort: Record<string, unknown> = {
        kapitel_stueck: { kern: 'Teilerregel', fragen: [{ art: 'verstaendnis', frage: 'Warum teilt er?', antwort: 'Verhältnis.', seite: 13 }] },
        kapitel_ganz: { fragen: [{ art: 'sokratisch', frage: 'Wo endet das Modell?', antwort: '- Last', seite: 1 }] },
        kapitel_rechnen: { aufgaben: [{ frage: 'U2?', ergebnis: '3,8 V', seite: 14, tipps: ['Ohm'], schritte: [{ ziel: 'R', rechnung: '$R$', ergebnis: '6 k' }], wege: '' }] },
        vorfragen: { fragen: [{ anhang: 'A1', frage: 'Was passiert?', antwort: 'Es teilt.', seite: 14 }] }
      }
      return antwort[aufgabe] as T
    }
  }
  return { w, aufgaben, texte }
}

const PFAD = 'lernen/fragen/A1/S012.json'

describe('Kapitelfragen auf Knopfdruck', () => {
  it('erzeugt das Kapitel Schritt für Schritt, Scans gehen nicht an die KI', async () => {
    const p = ordner()
    const s = await geraet(p)
    const { w, aufgaben, texte } = werkzeug()
    const meldungen: string[] = []
    const r = await erzeugeKapitelfragen(s, w, (m) => meldungen.push(m))
    expect(r).toEqual({ neu: 3, kapitel: 1, hinweis: undefined })
    // Stück 12–16, (17–19 ist ein Scan), ganzes Kapitel, Rechenaufgaben zu 12–16
    expect(aufgaben).toEqual(['kapitel_stueck', 'kapitel_ganz', 'kapitel_rechnen'])
    expect(texte[0]).toContain('--- Seite 12 ---')
    expect(texte[0]).toContain('Kapitel: 2 Spannungsteiler (PDF-Seiten 12 bis 19)')
    expect(meldungen[0]).toBe('Elektronik: Seiten 12 bis 16 von 19')
    const f = liesFragenDatei(s.text(PFAD))!
    expect(f).toMatchObject({ status: 'fertig', modell: 'anthropic/claude-sonnet-5-5', von: 12, bis: 19 })
    expect(f.fragen.map((q) => q.id)).toEqual(['12-1', 'kapitel-1', '12-r1'])
    // geschrieben auf den Ordner und für die Lernrunde lesbar: bis Seite 13 gelesen, also nur die Frage auf S. 13
    await s.speichereAlles()
    expect(p.dateien.has(PFAD)).toBe(true)
    const b = new Bestand(s.alleTexte())
    expect(offeneFragen(b, lesestand(b)).map((q) => q.id)).toEqual(['12-1'])
  })

  it('nochmal drücken fragt nichts mehr nach', async () => {
    const s = await geraet(ordner())
    await erzeugeKapitelfragen(s, werkzeug().w)
    const zweit = werkzeug()
    expect(await erzeugeKapitelfragen(s, zweit.w)).toMatchObject({ neu: 0, kapitel: 1 })
    expect(zweit.aufgaben).toEqual([])
  })

  it('bricht beim Fehler ab, merkt den Versuch und macht beim nächsten Mal dort weiter', async () => {
    const s = await geraet(ordner())
    await expect(erzeugeKapitelfragen(s, werkzeug(2).w)).rejects.toThrow(/Zu viele Anfragen/)
    const f = liesFragenDatei(s.text(PFAD))!
    expect(f).toMatchObject({ status: 'laeuft', versuche: 1, fehler: 'Zu viele Anfragen. Eine Minute warten.' })
    expect(f.abschnitte.map((a) => a.von)).toEqual([12, 17])
    const weiter = werkzeug()
    await erzeugeKapitelfragen(s, weiter.w)
    expect(weiter.aufgaben).toEqual(['kapitel_ganz', 'kapitel_rechnen'])
    expect(liesFragenDatei(s.text(PFAD))).not.toHaveProperty('fehler')
  })

  it('abgebrochen zählt nicht als Fehlversuch', async () => {
    const s = await geraet(ordner())
    const ab = new AbortController()
    const { w } = werkzeug()
    const frage = w.frage.bind(w)
    w.frage = async (aufgabe, a) => {
      const r = await frage(aufgabe, a)
      ab.abort()
      return r as never
    }
    await expect(erzeugeKapitelfragen(s, w, undefined, ab.signal)).rejects.toThrow()
    expect(liesFragenDatei(s.text(PFAD))).not.toHaveProperty('versuche')
  })

  it('schreibt nie über eine unlesbare Fragendatei', async () => {
    const p = ordner()
    p.schreibe(PFAD, '{kaputt')
    const s = await geraet(p)
    const { w, aufgaben } = werkzeug()
    expect(await erzeugeKapitelfragen(s, w)).toMatchObject({ neu: 0 })
    expect(aufgaben).toEqual([])
    expect(s.text(PFAD)).toBe('{kaputt')
  })

  it('ohne Inhaltsverzeichnis sagt die App, warum nichts kommt', async () => {
    const s = await geraet(ordner({ inhalt: false }))
    expect((await erzeugeKapitelfragen(s, werkzeug().w)).hinweis).toMatch(/Elektronik.*kein Inhaltsverzeichnis/)
  })
})

describe('Vorfragen auf Knopfdruck', () => {
  it('erzeugt sie einmal, liefert sie ohne Weiterlesen wieder, „Neue“ fragt neu', async () => {
    const s = await geraet(ordner({ seite: 12 }))
    const { w, aufgaben, texte } = werkzeug()
    const v = await erzeugeVorfragen(s, w)
    expect(v).toMatchObject({ buecher: [{ anhang: 'A1', titel: 'Elektronik', ab: 12, bis: 17, kapitel: '2 Spannungsteiler' }], fragen: [{ id: '1', seite: 14, frage: 'Was passiert?' }] })
    expect(texte[0]).toContain('Buch: Elektronik (Kennung A1), Kapitel 2 Spannungsteiler, PDF-Seiten 12 bis 17')
    expect(await erzeugeVorfragen(s, w)).toEqual(v)
    expect(aufgaben).toEqual(['vorfragen'])
    await erzeugeVorfragen(s, w, { neu: true })
    expect(aufgaben).toEqual(['vorfragen', 'vorfragen'])
  })

  it('nur Scans: Hinweis statt Anfrage', async () => {
    const s = await geraet(ordner({ seite: 17 }))
    const { w, aufgaben } = werkzeug()
    w.seitenText = async (_p, von, bis) => ({ seiten: 200, texte: Array.from({ length: bis - von + 1 }, () => '') })
    expect(await erzeugeVorfragen(s, w)).toHaveProperty('hinweis')
    expect(aufgaben).toEqual([])
  })
})
