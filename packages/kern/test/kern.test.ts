import { describe, expect, it } from 'vitest'
import {
  Bestand,
  ersetzeBlock,
  felder,
  findeLinks,
  ankerParameter,
  fuelle,
  gliedere,
  haengeAn,
  liesAbrufe,
  liesMarken,
  liesTinte,
  markenZeile,
  neuesDokument,
  passtDazu,
  schalteAufgabe,
  setzeFeld,
  setzeMarke,
  setzeStatus,
  tinteSvg,
  ulid,
  zerlege
} from '../src'

const JOURNAL = `---
id: 01JTEST0000000000000000001
typ: journal
erstellt: 2026-10-19T08:00:00+02:00
geaendert: 2026-10-19T08:00:00+02:00
titel: Journal 19.10.2026
datum: 2026-10-19
# ein Kommentar, keine Überschrift
---
# Allgemein
Kaffee mit Jens

# #dd_os_76
## Mängelanzeige
### Mangel 1 - blockiert
Linie 4 weiterhin kaputt
- [ ] Elektriker anrufen
> [!blockade] Ersatzteil fehlt
> Wenn: Lieferung da
> Dann: Linie 4 neu auflegen
> Prüfen: 2026-10-26

### Mangel 2 - erledigt
- [x] Melder getauscht

# #privat_haus
- [ ] Dachrinne

# #dd_os_76 Nachmittag
- [ ] Bericht schreiben
`

describe('Frontmatter', () => {
  it('liest Felder und lässt Unbekanntes byte-genau stehen', () => {
    const text = '---\nid: X\ntitel: "a: b"\ntags: [a, "b, c"]\nabgeleitet:\n  ocr: x.md\n---\nRumpf\n'
    const f = felder(zerlege(text).kopf)
    expect(f.titel).toBe('a: b')
    expect(f.tags).toEqual(['a', 'b, c'])
    const neu = setzeFeld(text, 'titel', 'Neu')
    expect(neu).toBe('---\nid: X\ntitel: Neu\ntags: [a, "b, c"]\nabgeleitet:\n  ocr: x.md\n---\nRumpf\n')
    expect(setzeFeld(text, 'status', 'aktiv')).toContain('  ocr: x.md\nstatus: aktiv\n---')
  })

  it('setzt Links in Anführungszeichen', () => {
    const d = neuesDokument([['projekt', '[[01J]]'], ['n', 2]])
    expect(d).toBe('---\nprojekt: "[[01J]]"\nn: 2\n---\n')
    expect(felder(zerlege(d).kopf).projekt).toBe('[[01J]]')
  })
})

describe('Journal', () => {
  const g = gliedere(JOURNAL)

  it('ordnet Abschnitte über die H1 dem Projekt zu', () => {
    expect(g.bloecke.map((b) => [b.kuerzel, b.nr])).toEqual([
      ['dd_os_76', 0],
      ['privat_haus', 0],
      ['dd_os_76', 1]
    ])
    expect(g.bloecke[2].zusatz).toBe('Nachmittag')
    const mangel1 = g.abschnitte.find((a) => a.titel === 'Mangel 1')!
    expect(mangel1.status).toBe('blockiert')
    expect(mangel1.projekt).toBe('dd_os_76')
    expect(g.abschnitte.find((a) => a.titel === 'Allgemein')!.projekt).toBeNull()
  })

  it('findet Aufgaben mit Pfad und Blockaden mit Wenn-dann', () => {
    const a = g.aufgaben.find((x) => x.text === 'Elektriker anrufen')!
    expect(a.projekt).toBe('dd_os_76')
    expect(a.pfad).toEqual(['Mängelanzeige', 'Mangel 1'])
    expect(g.blockaden[0]).toMatchObject({ titel: 'Ersatzteil fehlt', wenn: 'Lieferung da', dann: 'Linie 4 neu auflegen', pruefen: '2026-10-26' })
  })

  it('hakt ab und setzt Status nur in der einen Zeile', () => {
    const a = g.aufgaben.find((x) => x.text === 'Elektriker anrufen')!
    const t = schalteAufgabe(JOURNAL, a.zeile)
    expect(t.split('\n')[a.zeile]).toBe('- [x] Elektriker anrufen')
    expect(t.length).toBe(JOURNAL.length)
    const m = g.abschnitte.find((x) => x.titel === 'Mangel 1')!
    expect(setzeStatus(JOURNAL, m.von, 'gelöst').split('\n')[m.von]).toBe('### Mangel 1 - gelöst')
    expect(setzeStatus(JOURNAL, m.von, null).split('\n')[m.von]).toBe('### Mangel 1')
  })

  it('ersetzt genau einen Projektblock (Bearbeiten in der Projektansicht)', () => {
    const t = ersetzeBlock(JOURNAL, 'dd_os_76', 1, '# #dd_os_76 Nachmittag\n- [x] Bericht schreiben')
    expect(t).toContain('- [x] Bericht schreiben')
    expect(t).toContain('- [ ] Elektriker anrufen')
    expect(t.endsWith('\n')).toBe(true)
    const geloescht = ersetzeBlock(JOURNAL, 'privat_haus', 0, '')
    expect(geloescht).not.toContain('Dachrinne')
    expect(geloescht).toContain('# #dd_os_76 Nachmittag')
  })

  it('hängt an den letzten Block des Projekts oder legt eine H1 an', () => {
    const t = haengeAn(JOURNAL, 'privat_haus', ['- [ ] Leiter holen'])
    const z = t.split('\n')
    expect(z[z.indexOf('- [ ] Dachrinne') + 1]).toBe('- [ ] Leiter holen')
    const neu = haengeAn('---\nid: x\n---\n', 'neu_1', ['- [ ] a'])
    expect(neu).toBe('---\nid: x\n---\n\n# #neu_1\n- [ ] a\n')
  })

  it('ignoriert Überschriften in Codeblöcken', () => {
    const g2 = gliedere('```\n# #kein_projekt\n```\n# #echt\n')
    expect(g2.bloecke.map((b) => b.kuerzel)).toEqual(['echt'])
  })
})

describe('Markierungen und Links', () => {
  it('schreibt und liest eine Marke verlustfrei', () => {
    const m = { id: 'a7k2c9', seite: 1, text: 'Datenschrank fehlt', bereich: { x: 0.12, y: 0.3, b: 0.43, h: 0.08 }, datum: '2026-10-19', farbe: 'wichtig' }
    const z = markenZeile(m)
    expect(z).toBe('- S. 1 · Datenschrank fehlt %%rn 0.120 0.300 0.430 0.080 2026-10-19 wichtig%% ^a7k2c9')
    const text = setzeMarke('---\nid: x\n---\n', m)
    expect(liesMarken(text)[0]).toMatchObject({ ...m, zeile: 3 })
    expect(liesMarken(setzeMarke(text, { ...m, text: 'neu' }))).toHaveLength(1)
  })

  it('findet Links, Einbettungen und Seitenanker', () => {
    const l = findeLinks('- [ ] a ![[01JX#seite=2&marke=ab12|EG, S. 2]] und [[01JY|Ding]] ![[01JZ@2026-01-02]]')
    expect(l.map((x) => [x.einbettung, x.ziel, x.anzeige, x.stand])).toEqual([
      [true, '01JX', 'EG, S. 2', null],
      [false, '01JY', 'Ding', null],
      [true, '01JZ', null, '2026-01-02']
    ])
    expect(ankerParameter(l[0].anker)).toEqual({ seite: '2', marke: 'ab12' })
  })
})

describe('Bestand', () => {
  const projekt = neuesDokument([['id', '01JPROJ'], ['typ', 'projekt'], ['titel', 'DD OS 76'], ['kuerzel', 'dd_os_76'], ['status', 'aktiv']])
  const plan = neuesDokument([['id', '01JPLAN'], ['typ', 'anhang'], ['titel', 'EG Grundriss'], ['datei', 'anhaenge/2026/10/eg.pdf'], ['art', 'plan'], ['projekt', '[[01JPROJ]]']])
  const wissen = neuesDokument([['id', '01JWISS'], ['typ', 'erklaerung'], ['titel', 'Spannungsteiler']])
  const b = new Bestand(
    new Map([
      ['arbeit/journal/2026/2026-10-19.md', JOURNAL],
      ['arbeit/projekte/dd_os_76.md', projekt],
      ['gemeinsam/anhaenge/01JPLAN.md', plan],
      ['lernen/karten/01JWISS.md', wissen]
    ])
  )

  it('baut die Chronik aus Journal-Blöcken, neueste zuerst', () => {
    const c = b.chronik('dd_os_76')
    expect(c).toHaveLength(2)
    expect(c[0].text.startsWith('# #dd_os_76 Nachmittag')).toBe(true)
  })

  it('sammelt Offenes ohne Erledigtes', () => {
    const o = b.offen('dd_os_76')
    expect(o.map((x) => x.art + ':' + x.text)).toEqual(['aufgabe:Elektriker anrufen', 'aufgabe:Bericht schreiben', 'blockade:Ersatzteil fehlt', 'abschnitt:Mangel 1'])
  })

  it('kennt mehrere Pläne pro Projekt', () => {
    expect(b.plaene('01JPROJ').map((p) => p.id)).toEqual(['01JPLAN'])
  })

  it('schlägt Projektpunkte und passendes Wissen vor', () => {
    const v = passtDazu(b, { kuerzel: 'dd_os_76', text: 'Spannungsteiler am Melder prüfen' })
    expect(v.some((x) => x.art === 'offen')).toBe(true)
    expect(v.find((x) => x.art === 'wissen')?.einfuegen).toBe('![[01JWISS]]')
  })
})

describe('Sonstiges', () => {
  it('ULIDs sind 26 Zeichen und zeitlich sortiert', () => {
    const a = ulid(1000)
    const c = ulid(2000)
    expect(a).toHaveLength(26)
    expect(a < c).toBe(true)
  })

  it('füllt Vorlagen mit Datum und Cursor', () => {
    const f = fuelle('> Prüfen: {{heute+7}}\n{{cursor}}x', '2026-10-30')
    expect(f.text).toBe('> Prüfen: 2026-11-06\nx')
    expect(f.cursor).toBe(f.text.length - 1)
  })

  it('liest Abrufblöcke', () => {
    expect(liesAbrufe('?? Wie groß ist e?\n:: 1,602e-19 C\nmehr\n\n?? Zweite\n:: b')).toEqual([
      { frage: 'Wie groß ist e?', antwort: '1,602e-19 C\nmehr' },
      { frage: 'Zweite', antwort: 'b' }
    ])
  })

  it('speichert Tinte als SVG und liest sie zurück', () => {
    const s = [{ farbe: 'wichtig' as const, breite: 3, punkte: [[1, 2, 0.5], [3, 4, 0.7]] as [number, number, number][], d: 'M1 2L3 4Z' }]
    expect(liesTinte(tinteSvg(s, 1414))).toEqual(s)
  })
})
