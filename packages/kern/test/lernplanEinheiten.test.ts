import { describe, expect, it } from 'vitest'
import { liesEinheiten, neueEinheit, schalteEinheit } from '../src/lernplanEinheiten'

const modul = '---\nid: M1\ntyp: modul\ntitel: ET\n---\nEigene Notiz\n\n## Lernplan\n- [ ] S. 13: Effektivwert = Spitzenwert / √2\n- [x] Aufgabe 3.4 rechnen\nkein Haken\n\n## Sonstiges\n- [ ] gehört nicht dazu\n'

describe('eigene Einheiten im Modul', () => {
  it('liest nur die Aufgaben unter „## Lernplan“, mit Seite', () => {
    expect(liesEinheiten(modul)).toEqual([
      { zeile: 8, erledigt: false, seite: 13, text: 'Effektivwert = Spitzenwert / √2' },
      { zeile: 9, erledigt: true, seite: null, text: 'Aufgabe 3.4 rechnen' }
    ])
    expect(liesEinheiten('---\nid: M2\n---\n')).toEqual([])
  })

  it('Umschalten ändert nur das Kästchen dieser Zeile, alles andere bleibt byte-gleich', () => {
    const neu = schalteEinheit(modul, 8)
    expect(neu).toBe(modul.replace('- [ ] S. 13', '- [x] S. 13'))
    expect(schalteEinheit(neu, 8)).toBe(modul)
    // keine Einheit (mehr) an dieser Stelle, oder außerhalb des Abschnitts: nichts ändert sich
    expect(schalteEinheit(modul, 10)).toBe(modul)
    expect(schalteEinheit(modul, 13)).toBe(modul)
  })

  it('neue Einheit ans Ende des Abschnitts, ohne Abschnitt ans Dateiende', () => {
    expect(neueEinheit(modul, '  Ohmsches   Gesetz ', 3)).toBe(modul.replace('kein Haken\n', 'kein Haken\n- [ ] S. 3: Ohmsches Gesetz\n'))
    expect(neueEinheit('---\nid: M2\n---\n', 'Fakt')).toBe('---\nid: M2\n---\n## Lernplan\n- [ ] Fakt\n')
    expect(neueEinheit('---\nid: M2\n---\nText', 'Fakt')).toBe('---\nid: M2\n---\nText\n\n## Lernplan\n- [ ] Fakt\n')
    expect(neueEinheit(modul, '   ')).toBe(modul)
  })

  it('eine Überschrift „## Lernplan“ im Kopfbereich zählt nicht', () => {
    expect(liesEinheiten('---\nnotiz: |\n## Lernplan\n- [ ] nein\n---\n')).toEqual([])
  })
})
