import { describe, expect, it } from 'vitest'
import { Bestand, ersetzeTeil, gliedere, neuesDokument, setzeStatus, setzeWichtig, tieferSetzen, trenneOffenes } from '../src'

const KOPF = `---
id: 01JTEST0000000000000000009
typ: journal
erstellt: 2026-10-19T08:00:00+02:00
geaendert: 2026-10-19T08:00:00+02:00
titel: Journal 19.10.2026
datum: 2026-10-19
---
`
const TEXT = `${KOPF}Notiz ohne Überschrift

# #dd_os_76 Montage
## Linie 4
Kabel gezogen
- [x] Trasse gesetzt
- [ ] Linie 4 auflegen

### Mangel 1 - blockiert
> [!blockade] Modul fehlt
> Wenn: Lieferung da

### Mangel 2 - erledigt
> [!blockade] Schlüssel fehlte
> Wenn: Hausmeister da

# Allgemein
Kaffee
`

describe('Review', () => {
  it('teilt das Journal in Einträge, auch den Text vor der ersten H1', () => {
    const t = gliedere(TEXT).teile
    expect(t.map((x) => [x.nr, x.kuerzel, x.zusatz, x.kopf])).toEqual([
      [0, null, '', ''],
      [1, 'dd_os_76', 'Montage', '# #dd_os_76 Montage'],
      [2, null, 'Allgemein', '# Allgemein']
    ])
    expect(gliedere(`${KOPF}# Nur H1\n`).teile).toHaveLength(1)
    expect(gliedere(KOPF).teile).toHaveLength(0)
  })

  it('markiert Überschriften als wichtig, ohne Status, Anker oder Projekt zu verlieren', () => {
    const z = TEXT.split('\n').indexOf('# #dd_os_76 Montage')
    const an = setzeWichtig(TEXT, z, true)
    expect(an.split('\n')[z]).toBe('# #dd_os_76 Montage #wichtig')
    const t = gliedere(an).teile[1]
    expect([t.kuerzel, t.zusatz, t.wichtig]).toEqual(['dd_os_76', 'Montage', true])
    expect(setzeWichtig(an, z, false)).toBe(TEXT)

    const h = '### Mangel 1 - blockiert ^a1b2c3'
    const w = setzeWichtig(h, 0, true)
    expect(w).toBe('### Mangel 1 #wichtig - blockiert ^a1b2c3')
    expect(setzeStatus(w, 0, 'gelöst')).toBe('### Mangel 1 #wichtig - gelöst ^a1b2c3')
    const a = gliedere(w).abschnitte[0]
    expect([a.titel, a.status, a.anker, a.wichtig]).toEqual(['Mangel 1', 'blockiert', 'a1b2c3', true])
    // „#wichtig“ allein ist kein Projekt
    expect(gliedere('# #wichtig\n').teile[0].kuerzel).toBe(null)
  })

  it('ersetzt und löscht Einträge, erkennt sie an Nummer und Kopf', () => {
    const neu = ersetzeTeil(TEXT, 1, '# #dd_os_76 Montage', '# #dd_os_76 Montage\nKurz: Linie 4 fertig')
    expect(neu).toContain('# #dd_os_76 Montage\nKurz: Linie 4 fertig\n\n# Allgemein')
    expect(ersetzeTeil(TEXT, 1, '# anders', 'x')).toBe(TEXT)
    // verschobene Nummer: die eindeutige Kopfzeile reicht
    expect(ersetzeTeil(TEXT, 7, '# Allgemein', '# Allgemein\nTee')).toContain('# Allgemein\nTee\n')
    const weg = ersetzeTeil(TEXT, 1, '# #dd_os_76 Montage', '')
    expect(weg).toBe(`${KOPF}Notiz ohne Überschrift\n\n# Allgemein\nKaffee\n`)
    expect(ersetzeTeil(weg, 0, '', '')).toBe(`${KOPF}# Allgemein\nKaffee\n`)
  })

  it('lässt beim Bericht Offenes im Journal und nimmt den Rest mit', () => {
    const t = gliedere(TEXT).teile[1]
    const rumpf = TEXT.split('\n').slice(t.von + 1, t.bis).join('\n')
    const { bleibt, bericht } = trenneOffenes(rumpf)
    expect(bleibt).toEqual(['## Linie 4', '- [ ] Linie 4 auflegen', '### Mangel 1 - blockiert', '> [!blockade] Modul fehlt', '> Wenn: Lieferung da'])
    expect(bericht).toContain('Kabel gezogen')
    expect(bericht).toContain('- [x] Trasse gesetzt')
    expect(bericht).toContain('### Mangel 1 - blockiert')
    expect(bericht).toContain('> [!blockade] Schlüssel fehlte')
    expect(bericht).not.toContain('- [ ] Linie 4 auflegen')
  })

  it('setzt Überschriften tiefer, aber nicht in Codeblöcken', () => {
    expect(tieferSetzen('## A\n```\n# kein\n```\n###### F')).toBe('### A\n```\n# kein\n```\n###### F')
  })

  it('findet Einträge und Berichte im Bestand', () => {
    const projekt = neuesDokument([['id', 'P1'], ['typ', 'projekt'], ['titel', 'Schule'], ['kuerzel', 'dd_os_76']])
    const b1 = neuesDokument([['id', 'B1'], ['typ', 'bericht'], ['titel', 'Montage Linie 4'], ['projekt', '[[P1]]'], ['von', '2026-10-14'], ['bis', '2026-10-16']])
    const b2 = neuesDokument([['id', 'B2'], ['typ', 'bericht'], ['titel', 'Ohne Datei'], ['kuerzel', 'privat_haus'], ['von', '2026-10-01']])
    const b = new Bestand(
      new Map([
        ['arbeit/journal/2026/2026-10-19.md', TEXT],
        ['arbeit/projekte/dd_os_76.md', projekt],
        ['arbeit/berichte/B1.md', b1],
        ['arbeit/berichte/B2.md', b2]
      ])
    )
    const e = b.eintraege()
    expect(e.map((x) => x.teil.nr)).toEqual([0, 1, 2])
    expect(e[2].rumpf).toBe('Kaffee')
    expect(b.berichte('dd_os_76').map((x) => [x.id, x.von, x.bis])).toEqual([['B1', '2026-10-14', '2026-10-16']])
    expect(b.berichte('privat_haus')[0]).toMatchObject({ id: 'B2', bis: '2026-10-01' })
    expect(b.berichte()).toHaveLength(2)
  })
})
