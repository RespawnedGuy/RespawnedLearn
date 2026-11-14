// @vitest-environment happy-dom
// Lernzeit messen gegen den echten Speicher auf einem Ordner im Arbeitsspeicher: falsche Uhr, Eingaben und Verdecken.
import { afterEach, describe, expect, it } from 'vitest'
import { Bestand, alleLernzeiten, liesLernzeit, zeitIn } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { erstelleLernuhr, schreibeLernzeit } from '../src/lernzeitMessen'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const T0 = Date.parse('2026-10-31T23:50:00Z')
const MIN = 60_000

async function geraet(p: Platte) {
  const s = new Speicher({ ablage: ablageImSpeicher(p), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return s
}

describe('Lernuhr', () => {
  it('misst nur bei Eingaben, Verdecken beendet, alles landet in der Monatsdatei des Geräts', async () => {
    const p = new Platte()
    const s = await geraet(p)
    let jetzt = T0
    const geschrieben: Promise<void>[] = []
    const u = erstelleLernuhr({ jetzt: () => jetzt, schreibe: (f) => geschrieben.push(...schreibeLernzeit(s, f, 'pc')) })

    u.setzeKontext({ ziel: 'M1', art: 'sammeln', quelle: 'P1', seite: 3 })
    for (let i = 1; i <= 4; i++) {
      jetzt = T0 + i * MIN
      u.eingabe()
    }
    u.setzeKontext({ ziel: 'M1', art: 'sammeln', quelle: 'P1', seite: 5 })
    jetzt = T0 + 6 * MIN
    u.eingabe()
    u.tick() // nach 5 Minuten wird das Bisherige schon geschrieben
    expect(geschrieben).toHaveLength(1)
    // App verdeckt: Abschnitt endet bei der letzten Eingabe
    jetzt = T0 + 9 * MIN
    u.verdeckt()
    // danach Mitschrift im neuen Monat, dann Leerlauf
    jetzt = T0 + 30 * MIN
    u.setzeKontext({ ziel: 'M1', art: 'mitschrift' })
    jetzt = T0 + 33 * MIN
    u.eingabe()
    jetzt = T0 + 60 * MIN
    u.tick()
    await Promise.all(geschrieben)

    const okt = liesLernzeit(s.text('lernen/zeit/2026-10.pc.jsonl') ?? '')
    const nov = liesLernzeit(s.text('lernen/zeit/2026-11.pc.jsonl') ?? '')
    expect(okt).toEqual([{ ziel: 'M1', art: 'sammeln', am: '2026-10-31T23:50:00.000Z', bis: '2026-10-31T23:56:00.000Z', quelle: 'P1', seiten: [3, 5] }])
    expect(nov).toEqual([{ ziel: 'M1', art: 'mitschrift', am: '2026-11-01T00:20:00.000Z', bis: '2026-11-01T00:23:00.000Z' }])
    const b = new Bestand(new Map([...['lernen/zeit/2026-10.pc.jsonl', 'lernen/zeit/2026-11.pc.jsonl'].map((x) => [x, s.text(x) ?? ''] as [string, string])]))
    expect(zeitIn(alleLernzeiten(b), { id: 'M1', quellen: ['P1'] })).toBe(9 * MIN)
  })

  it('Eingaben ohne offenen Kontext zählen nicht, schnelle Eingaben werden zusammengefasst', () => {
    let jetzt = T0
    const fertig: unknown[] = []
    const u = erstelleLernuhr({ jetzt: () => jetzt, schreibe: (f) => fertig.push(...f) })
    u.eingabe()
    u.setzeKontext({ ziel: 'M1', art: 'lernen' })
    jetzt += 2_000
    u.eingabe() // unter 5 s nach dem Start: ignoriert, aber unschädlich
    jetzt += 2 * MIN
    u.eingabe()
    u.beende()
    expect(fertig).toEqual([{ ziel: 'M1', art: 'lernen', am: '2026-10-31T23:50:00.000Z', bis: '2026-10-31T23:52:02.000Z' }])
    u.eingabe()
    jetzt += 10 * MIN
    u.tick()
    expect(fertig).toHaveLength(1)
  })

  it('hängt an, ohne Vorhandenes zu verändern, auch wenn die letzte Zeile kein Zeilenende hat', async () => {
    const p = new Platte()
    const alt = '{"ziel":"M0","art":"lernen","am":"2026-11-01T00:00:00.000Z","bis":"2026-11-01T00:10:00.000Z"}'
    p.schreibe('lernen/zeit/2026-11.pc.jsonl', alt)
    const s = await geraet(p)
    await Promise.all(schreibeLernzeit(s, [{ ziel: 'M1', art: 'lernen', am: '2026-11-02T00:00:00.000Z', bis: '2026-11-02T00:01:00.000Z' }], 'pc'))
    const text = s.text('lernen/zeit/2026-11.pc.jsonl') ?? ''
    expect(text.startsWith(alt + '\n')).toBe(true)
    expect(liesLernzeit(text).map((a) => a.ziel)).toEqual(['M0', 'M1'])
  })
})
