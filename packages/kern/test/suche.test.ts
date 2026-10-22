import { describe, expect, it } from 'vitest'
import { Bestand, lesbar, normalisiere, suche } from '../src'

const journal = (datum: string, rumpf: string) => `---
id: 01JTESTJ${datum.replace(/-/g, '')}0000000000
typ: journal
titel: Journal ${datum}
datum: ${datum}
---
${rumpf}`

const PROJEKT = `---
id: 01JTESTPROJEKT000000000001
typ: projekt
titel: Bürohaus Oststraße
kuerzel: dd_os_76
---
`
const AUFGABE = `---
id: 01JTESTAUFGABE000000000001
typ: aufgabe
titel: Mängel an Linie 4 melden
projekt: "[[01JTESTPROJEKT000000000001]]"
---
Hausmeister Bescheid geben
`

const b = new Bestand(
  new Map([
    ['arbeit/projekte/os.md', PROJEKT],
    ['arbeit/aufgaben/a.md', AUFGABE],
    ['arbeit/journal/2026-10-21.md', journal('2026-10-21', 'Einkauf\n\n# #dd_os_76 Begehung\nRauchmelder im Flur defekt\nSchlüssel beim [[01JTESTAUFGABE000000000001|Hausmeister]]\n')],
    ['arbeit/journal/2026-10-22.md', journal('2026-10-22', '# Allgemein\nRauchmelder zu Hause testen\n')]
  ])
)

describe('suche', () => {
  it('ignoriert Groß/klein und Umlaute', () => {
    expect(normalisiere('Mängel Straße')).toBe('mangel strasse')
    expect(suche(b, 'mangel').map((t) => t.art)).toEqual(['aufgabe'])
    expect(suche(b, 'oststrasse').map((t) => t.art)).toEqual(['projekt'])
  })

  it('findet Journalabschnitte mit allen Wörtern und springt an die beste Zeile', () => {
    const t = suche(b, 'rauchmelder flur')
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ art: 'journal', datum: '2026-10-21', projekt: 'dd_os_76', titel: 'Begehung' })
    expect(t[0].text).toContain('Rauchmelder im Flur')
    // Zeile in der ganzen Datei: Kopf hat 6 Zeilen, dann Einkauf, Leerzeile, H1, Rauchmelder
    expect(t[0].zeile).toBe(9)
  })

  it('filtert nach Projekt und Art', () => {
    expect(suche(b, 'rauchmelder').map((t) => t.datum)).toEqual(['2026-10-22', '2026-10-21'])
    expect(suche(b, 'rauchmelder', { projekt: 'dd_os_76' }).map((t) => t.datum)).toEqual(['2026-10-21'])
    expect(suche(b, 'hausmeister', { art: 'aufgabe' })).toHaveLength(1)
  })

  it('sucht im lesbaren Text, nicht in IDs', () => {
    expect(lesbar('vor [[01X|Hausmeister]] ![[01Y|Foto]] nach')).toBe('vor Hausmeister  nach')
    expect(suche(b, '01JTEST')).toEqual([])
  })
})
