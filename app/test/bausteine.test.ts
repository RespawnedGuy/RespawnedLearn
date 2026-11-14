// @vitest-environment happy-dom
// Bausteine gegen den echten Speicher (Vertrag Lernen 1.8, 5.4): Markieren, benennen, weglegen, zurückholen
import { afterEach, describe, expect, it } from 'vitest'
import { Bestand, alleBausteine, liesMarken, offeneBausteine, pfade, sucheBausteine } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { benenneBaustein, karteAusStelle, legeBausteinWeg } from '../src/wissen'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const A = '01JBEXAMP000000000SKRPT001'
const ALT = '- S. 2 · Markiert %%rn 0.100 0.100 0.200 0.200 2026-10-01%% ^alt001\n'

async function geraet() {
  const p = new Platte()
  p.schreibe(`gemeinsam/anhaenge/${A}.md`, `---\nid: ${A}\ntyp: anhang\nerstellt: 2026-10-01T10:00:00+02:00\ngeaendert: 2026-10-01T10:00:00+02:00\ntitel: Skript ET1\ndatei: anhaenge/a.pdf\nart: skript\n---\n`)
  p.schreibe(pfade.marken('lernen', A), `---\ntyp: markierungen\n---\n${ALT}`)
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return { p, s }
}

const bereich = { x: 0.1, y: 0.4, b: 0.7, h: 0.1 }
const marken = (s: Speicher) => liesMarken(s.text(pfade.marken('lernen', A)) ?? '')

describe('Bausteine im Speicher', () => {
  it('„Baustein“ schreibt Name und Schlagworte in die Markierung, ohne Namen bleibt der Text leer', async () => {
    const { s } = await geraet()
    const quelle = new Bestand(s.alleTexte()).dokumente.get(A)!
    await karteAusStelle(s, { quelle, seite: 12, bereich, art: 'nur', titel: 'Stelle', farbe: null, markeId: 'neu001', name: ' Stammfunktion  umformen #integral ' })
    await karteAusStelle(s, { quelle, seite: 13, bereich, art: 'nur', titel: 'Stelle', farbe: null, markeId: 'neu002', name: '' })
    const m = marken(s)
    expect(m.find((x) => x.id === 'neu001')!.text).toBe('Stammfunktion umformen #integral')
    expect(m.find((x) => x.id === 'neu002')!.text).toBe('')
    // die alte Zeile bleibt Byte für Byte stehen
    expect(s.text(pfade.marken('lernen', A))).toContain(ALT)
    const alle = alleBausteine(s.alleTexte())
    expect(offeneBausteine(alle).map((b) => b.marke.id)).toEqual(['alt001', 'neu002'])
    expect(sucheBausteine(alle, 'integral').map((b) => b.marke.id)).toEqual(['neu001'])
  })

  it('Lernkarte aus dem Baustein: Name bleibt, Verweis auf die Karte kommt dazu', async () => {
    const { s } = await geraet()
    const quelle = new Bestand(s.alleTexte()).dokumente.get(A)!
    const karte = await karteAusStelle(s, { quelle, seite: 12, bereich, art: 'frage', titel: 'Wie lautet die Stammfunktion von x^n?', farbe: null, markeId: 'neu003', name: 'Potenzregel #integral' })
    expect(marken(s).find((x) => x.id === 'neu003')!.text).toBe(`Potenzregel #integral [[${karte}|Wie lautet die Stammfunktion von x^n?]]`)
    expect(s.text(pfade.karte(karte))).toContain('typ: frage')
  })

  it('benennen, weglegen und zurückholen ändern nur diese Zeile', async () => {
    const { s } = await geraet()
    await benenneBaustein(s, A, 'alt001', 'Spannungsteiler #et')
    expect(marken(s)[0].text).toBe('Spannungsteiler #et')
    await legeBausteinWeg(s, A, 'alt001', true)
    expect(marken(s)[0].text).toBe('Spannungsteiler #et #archiv')
    expect(sucheBausteine(alleBausteine(s.alleTexte()), 'spannung')).toEqual([])
    await legeBausteinWeg(s, A, 'alt001', false)
    expect(marken(s)[0]).toMatchObject({ text: 'Spannungsteiler #et', seite: 2, datum: '2026-10-01', bereich: { x: 0.1, y: 0.1, b: 0.2, h: 0.2 } })
    // unbekannte Marke: nichts passiert
    const vorher = s.text(pfade.marken('lernen', A))
    await benenneBaustein(s, A, 'gibtsnicht', 'X')
    expect(s.text(pfade.marken('lernen', A))).toBe(vorher)
  })
})
