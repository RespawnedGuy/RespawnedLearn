import { describe, expect, it } from 'vitest'
import {
  erklaerAuftrag,
  jsonAusText,
  korrekturAnnehmen,
  liesPromptAbweichungen,
  PROMPTS,
  pruefeAntwort,
  rueckmeldungAuftrag,
  SCHEMAS,
  setzePrompt,
  STANDARD_PROMPTS,
  vorschlagAuftrag,
  wirksamerPrompt
} from '../src/index'

describe('KI-Anweisungen als Einstellung (Vertrag Lernen 1.1, 5.8)', () => {
  it('hat zu jedem Schlüssel einen Standardtext', () => {
    for (const p of PROMPTS) expect(STANDARD_PROMPTS[p.schluessel].length).toBeGreaterThan(100)
    // Hinweise auf das Read-Werkzeug von Claude Code sind raus, Bilder gehen direkt an den Anbieter
    for (const t of Object.values(STANDARD_PROMPTS)) expect(t).not.toMatch(/Read-Werkzeug/)
  })

  it('ohne Datei gilt der Standard', () => {
    expect(wirksamerPrompt(undefined, 'erklaeren')).toBe(STANDARD_PROMPTS.erklaeren)
    expect(wirksamerPrompt('kaputt{', 'erklaeren')).toBe(STANDARD_PROMPTS.erklaeren)
  })

  it('speichert nur Abweichungen und „Standard“ entfernt sie wieder', () => {
    const eins = setzePrompt(undefined, 'erklaeren', 'Erkläre wie für ein Kind.')
    expect(JSON.parse(eins)).toEqual({ prompts: { erklaeren: 'Erkläre wie für ein Kind.' } })
    expect(wirksamerPrompt(eins, 'erklaeren')).toBe('Erkläre wie für ein Kind.')
    expect(wirksamerPrompt(eins, 'rueckmeldung')).toBe(STANDARD_PROMPTS.rueckmeldung)
    const zurueck = setzePrompt(eins, 'erklaeren', null)
    expect(JSON.parse(zurueck)).toEqual({ prompts: {} })
    expect(wirksamerPrompt(zurueck, 'erklaeren')).toBe(STANDARD_PROMPTS.erklaeren)
  })

  it('wer den Standardtext (oder nichts) einträgt, hat keine Abweichung', () => {
    expect(liesPromptAbweichungen(setzePrompt(undefined, 'korrektur', STANDARD_PROMPTS.korrektur + '\n'))).toEqual({})
    expect(liesPromptAbweichungen(setzePrompt(undefined, 'korrektur', '   '))).toEqual({})
  })

  it('lässt Unbekanntes in der Datei stehen', () => {
    const alt = JSON.stringify({ zukunft: 1, prompts: { neu_in_2027: 'x', erklaeren: 'alt' } })
    const neu = JSON.parse(setzePrompt(alt, 'erklaeren', 'neu'))
    expect(neu).toEqual({ zukunft: 1, prompts: { neu_in_2027: 'x', erklaeren: 'neu' } })
    expect(liesPromptAbweichungen(alt)).toEqual({ erklaeren: 'alt' })
  })
})

describe('Antwort der KI gegen das Schema prüfen', () => {
  it('nimmt eine gültige Rückmeldung und entfernt Unbekanntes', () => {
    const r = pruefeAntwort({ urteil: 'teilweise', gelesen: 'U = R·I', richtig: ['Ansatz'], fehlt: [], fehler: ['Einheit'], tipp: 'Einheit prüfen', extra: 1 }, SCHEMAS.urteil)
    expect(r).toEqual({ urteil: 'teilweise', gelesen: 'U = R·I', richtig: ['Ansatz'], fehlt: [], fehler: ['Einheit'], tipp: 'Einheit prüfen' })
  })

  it('meldet fehlende Felder, falsche Typen und unbekannte Werte', () => {
    expect(() => pruefeAntwort({ antwort: 'x' }, SCHEMAS.erklaerung)).toThrow(/begriff/)
    expect(() => pruefeAntwort({ frage: 3 }, SCHEMAS.frage)).toThrow(/Text/)
    expect(() => pruefeAntwort({ urteil: 'super', gelesen: '', richtig: [], fehlt: [], fehler: [], tipp: '' }, SCHEMAS.urteil)).toThrow(/super/)
    expect(() => pruefeAntwort({ urteil: 'richtig', gelesen: '', richtig: 'alles', fehlt: [], fehler: [], tipp: '' }, SCHEMAS.urteil)).toThrow(/Liste/)
    expect(() => pruefeAntwort([], SCHEMAS.frage)).toThrow(/Objekt/)
  })

  it('verzeiht ganze Zahlen als Text', () => {
    expect(pruefeAntwort({ s: '13' }, { type: 'object', properties: { s: { type: 'integer' } }, required: ['s'] })).toEqual({ s: 13 })
    expect(() => pruefeAntwort({ s: 1.5 }, { type: 'object', properties: { s: { type: 'integer' } }, required: ['s'] })).toThrow(/ganze Zahl/)
  })

  it('liest JSON auch mit Zaun oder Satz davor', () => {
    expect(jsonAusText('{"frage":"Warum?"}')).toEqual({ frage: 'Warum?' })
    expect(jsonAusText('Hier ist es:\n```json\n{"frage":"Warum?"}\n```')).toEqual({ frage: 'Warum?' })
    expect(jsonAusText('Klar! {"frage":"Wie?"} Gern geschehen.')).toEqual({ frage: 'Wie?' })
    expect(() => jsonAusText('Keine Ahnung')).toThrow(/JSON/)
  })
})

describe('Material der Aufgaben', () => {
  it('fasst die Stelle in Tags und kürzt', () => {
    const t = vorschlagAuftrag({ buch: 'Elektronik', seite: 12, stelle: 'x'.repeat(5000) })
    expect(t.startsWith('Buch: Elektronik, Seite 12\n<stelle>\n')).toBe(true)
    expect(t.length).toBeLessThan(4100)
    expect(vorschlagAuftrag({ art: 'mitschrift', buch: 'Physik', abschnitt: 'Kap 1 › Ohm', stelle: 'U=RI' })).toContain('Mitschrift: Physik, Abschnitt: Kap 1 › Ohm')
  })

  it('Erklären: ohne Verlauf erklären, mit Verlauf nur die letzte Rückfrage', () => {
    expect(erklaerAuftrag({ buch: 'B', seite: 3, stelle: 's', kontext: 'k', verlauf: [] })).toMatch(/Erkläre die Stelle\.$/)
    const mit = erklaerAuftrag({ buch: 'B', seite: 3, stelle: 's', kontext: 'k', verlauf: [{ von: 'ki', text: 'A' }, { von: 'ich', text: 'Warum?' }] })
    expect(mit).toContain('<verlauf>\nKI: A\n\nIch: Warum?\n</verlauf>\nBeantworte die letzte Rückfrage.')
  })

  it('Rückmeldung nennt das Bild, wenn eines beiliegt', () => {
    expect(rueckmeldungAuftrag({ art: 'rechnen', frage: 'F', muster: 'M', antwort: '', mitBild: true })).toMatch(/Rechenaufgabe[\s\S]*beiliegenden Bild/)
    expect(rueckmeldungAuftrag({ art: 'karte', frage: 'F', muster: 'M', antwort: 'meins', mitBild: false })).toContain('<antwort>\nmeins\n</antwort>')
  })

  it('Korrektur nimmt nur kleine Änderungen an', () => {
    expect(korrekturAnnehmen('Warum flist Strom?', 'Warum fließt Strom?')).toBe('Warum fließt Strom?')
    expect(korrekturAnnehmen('Warum?', 'Warum?')).toBeNull()
    expect(korrekturAnnehmen('Warum?', 'Warum fließt Strom in einem geschlossenen Kreis immer im Kreis?')).toBeNull()
  })
})
