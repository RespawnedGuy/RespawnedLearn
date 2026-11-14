import { describe, expect, it } from 'vitest'
import { alleBausteine, archiviere, benenne, eingabeVon, liesBausteinText, liesMarken, markenZeile, mitVerweis, offeneBausteine, sucheBausteine } from '../src'

const zeile = (seite: number, text: string, id: string, datum = '2026-11-14') =>
  markenZeile({ id, seite, text, bereich: { x: 0.1, y: 0.2, b: 0.5, h: 0.1 }, datum, farbe: null })

describe('Text eines Bausteins (Vertrag Lernen 1.8, 5.4)', () => {
  it('trennt Name, Schlagworte und Verweise', () => {
    const t = liesBausteinText('Stammfunktion umformen #integral #Stamm-funktion [[01JB|Wie lautet die Stammfunktion?]]')
    expect(t).toEqual({
      name: 'Stammfunktion umformen',
      schlagworte: ['integral', 'Stamm-funktion'],
      verweise: [{ ziel: '01JB', titel: 'Wie lautet die Stammfunktion?' }],
      archiviert: false
    })
  })

  it('liest alte Texte: nur Verweis, nur Text, „Markiert“ ohne Name', () => {
    expect(liesBausteinText('[[01JB|Spannung]]')).toMatchObject({ name: '', verweise: [{ ziel: '01JB', titel: 'Spannung' }] })
    expect(liesBausteinText('Merksatz Spannungsteiler').name).toBe('Merksatz Spannungsteiler')
    expect(liesBausteinText('Markiert').name).toBe('')
    expect(liesBausteinText('').name).toBe('')
  })

  it('# mitten im Wort ist kein Schlagwort, doppelte Schlagworte zählen einmal', () => {
    expect(liesBausteinText('Programmieren in C# #info #info')).toMatchObject({ name: 'Programmieren in C#', schlagworte: ['info'] })
  })

  it('benennen ändert Name und Schlagworte, Verweise und Archiv bleiben', () => {
    const alt = 'Alt #x #archiv [[01JB|Frage]]'
    expect(benenne(alt, 'Neu #integral')).toBe('Neu #integral #archiv [[01JB|Frage]]')
    expect(benenne('Markiert', '  Potenzregel  ')).toBe('Potenzregel')
    // ein #archiv in der Eingabe legt nicht weg
    expect(liesBausteinText(benenne('', 'A #archiv')).archiviert).toBe(false)
  })

  it('weglegen und zurückholen ist umkehrbar', () => {
    const t = 'Potenzregel #integral [[01JB|F]]'
    const weg = archiviere(t, true)
    expect(liesBausteinText(weg).archiviert).toBe(true)
    expect(archiviere(weg, false)).toBe(t)
  })

  it('Verweis anhängen, nicht doppelt; Titel ohne [, ] und |', () => {
    expect(mitVerweis('Potenzregel #integral', '01JB', 'Was ist [x|y]?')).toBe('Potenzregel #integral [[01JB|Was ist xy?]]')
    expect(mitVerweis('A [[01JB|F]]', '01JB', 'F')).toBe('A [[01JB|F]]')
  })

  it('Eingabe fürs Namensfeld', () => {
    expect(eingabeVon(liesBausteinText('Potenzregel #integral #archiv [[01JB|F]]'))).toBe('Potenzregel #integral')
  })

  it('der Text bleibt eine gültige Markierungszeile', () => {
    const text = benenne('', 'Stammfunktion #integral')
    const m = liesMarken(zeile(12, mitVerweis(text, '01JB', 'Frage'), 'c4n8q1'))
    expect(m).toHaveLength(1)
    expect(m[0].text).toBe('Stammfunktion #integral [[01JB|Frage]]')
  })
})

describe('Bausteine im Datenordner', () => {
  const texte = new Map<string, string>([
    [
      'lernen/markierungen/ET.md',
      ['---', 'typ: markierungen', '---', zeile(12, 'Stammfunktion umformen #integral', 'a1', '2026-11-10'), zeile(40, 'Markiert', 'a2', '2026-11-01'), zeile(41, '', 'a3', '2026-11-12'), zeile(7, 'Alte Übung #integral #archiv', 'a4')].join('\n')
    ],
    ['lernen/markierungen/RT.md', [zeile(3, '[[01JB|Sprungantwort PT1]]', 'b1', '2026-11-13'), zeile(9, 'Partielle Integration #Integral', 'b2', '2026-11-14')].join('\n')],
    ['lernen/module/m.md', zeile(1, 'kein Baustein', 'x9')]
  ])
  const alle = alleBausteine(texte)

  it('liest nur Markierungsdateien, mit Anhang und Titel', () => {
    expect(alle.map((b) => `${b.anhang}:${b.marke.id}:${b.titel}`)).toEqual([
      'ET:a1:Stammfunktion umformen',
      'ET:a2:',
      'ET:a3:',
      'ET:a4:Alte Übung',
      'RT:b1:Sprungantwort PT1',
      'RT:b2:Partielle Integration'
    ])
  })

  it('offen: ohne Name, Schlagwort und Verweis, nicht weggelegt; älteste zuerst', () => {
    expect(offeneBausteine(alle).map((b) => b.marke.id)).toEqual(['a2', 'a3'])
  })

  it('Suche über alle Skripte, ohne Groß/klein, Umlaute und #; weggelegte und offene fehlen', () => {
    expect(sucheBausteine(alle, 'integral').map((b) => b.marke.id)).toEqual(['b2', 'a1'])
    expect(sucheBausteine(alle, '#INTEGRAL').map((b) => b.marke.id)).toEqual(['b2', 'a1'])
    expect(sucheBausteine(alle, 'pt1 sprung').map((b) => b.marke.id)).toEqual(['b1'])
    expect(sucheBausteine(alle, 'uebung')).toEqual([])
    expect(sucheBausteine(alle, '')).toEqual([])
  })

  it('Treffer im Schlagwort vor Treffer im Namen; Skripttitel zählt mit', () => {
    const titel = (a: string) => (a === 'ET' ? 'Elektrotechnik 1' : 'Regelungstechnik')
    expect(sucheBausteine(alle, 'integration').map((b) => b.marke.id)).toEqual(['b2'])
    expect(sucheBausteine(alle, 'integral elektrotechnik', titel).map((b) => b.marke.id)).toEqual(['a1'])
  })
})
