import { describe, expect, it } from 'vitest'
import { aufgabeDokument, danachAbschnitte, fuelleBericht, imBericht, zaehleBericht } from '../src'

const VORLAGE = `### Inbetriebnahme
- Zentrale einschalten
- Linien prüfen
- [ ] Revisionsbuch dabei

### Messprotokolle #danach
| Messwert | Messung |
|---|---|
| Linie 1 | |
- Protokoll unterschreiben`

describe('Berichtsvorlagen', () => {
  it('macht Listenpunkte zu Aufgaben, Checkpunkte und Tabellen bleiben', () => {
    let n = 0
    const r = fuelleBericht(VORLAGE, () => `A${++n}`)
    expect(r.aufgaben.map((a) => a.titel)).toEqual(['Zentrale einschalten', 'Linien prüfen', 'Protokoll unterschreiben'])
    expect(r.text).toContain('- [[A1|Zentrale einschalten]]')
    expect(r.text).toContain('- [ ] Revisionsbuch dabei')
    expect(r.text).toContain('| Linie 1 | |')
    expect(r.cursor).toBe(r.text.length)
  })

  it('Aufgaben unter #danach hängen an den Aufgaben davor', () => {
    let n = 0
    const r = fuelleBericht(VORLAGE, () => `A${++n}`)
    expect(r.aufgaben[0].blockiertDurch).toEqual([])
    expect(r.aufgaben[2].blockiertDurch).toEqual(['A1', 'A2'])
  })

  it('setzt Platzhalter und Cursor, ein Punkt mit Cursor bleibt Text', () => {
    const r = fuelleBericht('## Prüfung {{datum}}\n- {{cursor}}\n- Melder', () => 'X', '2026-10-25')
    expect(r.text).toBe('## Prüfung 2026-10-25\n- \n- [[X|Melder]]')
    expect(r.cursor).toBe('## Prüfung 2026-10-25\n- '.length)
  })

  it('erkennt, ob der Cursor schon in einem Bericht steht', () => {
    expect(imBericht(['# #testprojekt', '## Montage BMA', ''])).toBe(true)
    expect(imBericht(['# #testprojekt', ''])).toBe(false)
    expect(imBericht(['# #a', '## B', '# #c', 'x'])).toBe(false)
    expect(imBericht([])).toBe(false)
  })

  it('sperrt einen #danach-Abschnitt, solange darüber etwas offen ist', () => {
    const zeilen = ['# #p', '## Montage', '### Inbetriebnahme', '- [[A1|Eins]]', '- [x] Haken', '### Messprotokolle #danach', '| a | b |', '## Anderer Bericht']
    const offen = new Set(['A1'])
    const f = (id: string) => (id === 'A1' ? offen.has(id) : null)
    expect(danachAbschnitte(zeilen, f)).toEqual([{ kopf: 5, bis: 7, gesperrt: true }])
    offen.delete('A1')
    expect(danachAbschnitte(zeilen, f)[0].gesperrt).toBe(false)
    // ein offener Checkpunkt sperrt auch
    zeilen[4] = '- [ ] Haken'
    expect(danachAbschnitte(zeilen, f)[0].gesperrt).toBe(true)
  })

  it('zählt nur im eigenen Bericht', () => {
    const zeilen = ['## Alt', '- [ ] offen', '## Neu', '### Teil #danach', 'x']
    expect(danachAbschnitte(zeilen, () => null)[0].gesperrt).toBe(false)
  })

  it('zählt, was eine Vorlage enthält', () => {
    expect(zaehleBericht(VORLAGE)).toEqual({ aufgaben: 3, haken: 1, tabellen: 1, danach: 1 })
  })

  it('legt eine Aufgabe mit Blockade gleich blockiert an', () => {
    const t = aufgabeDokument({ id: 'B', titel: 'T', jetzt: '2026-10-25T10:00:00+02:00', blockiertDurch: ['A1'] })
    expect(t).toContain('status: blockiert')
    expect(t).toMatch(/blockiert_durch:.*A1/s)
  })
})
