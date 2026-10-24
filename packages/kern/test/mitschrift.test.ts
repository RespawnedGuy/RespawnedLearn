import { describe, expect, it } from 'vitest'
import { Bestand, abschnittAn, ankerIn, gliederung, kartenAus, klarTitel, mitschriftenVon, obersteEbene, stelleVon, zeileVonAnker } from '../src'

const TEXT = `## Mitschrift
### [[ISO 9001|Norm]]
DIN VDE 0834-1

\`\`\`mermaid
# kein Titel
\`\`\`
### Apparatur
#### Zimmersignalleuchten
- Erkennbar aus 20m bei 500 lx ^k7x2m9
#### Ruftaster
- rot
### Planung
`

describe('Mitschrift', () => {
  it('liest die Überschriften wie geschrieben, ohne Codeblöcke und Linkklammern', () => {
    expect(gliederung(TEXT).map((u) => [u.ebene, u.titel])).toEqual([
      [2, 'Mitschrift'],
      [3, 'Norm'],
      [3, 'Apparatur'],
      [4, 'Zimmersignalleuchten'],
      [4, 'Ruftaster'],
      [3, 'Planung']
    ])
    expect(klarTitel('[[01M42#^rs42mb|Fachkraft für Rufanlagen]] ^ab12')).toBe('Fachkraft für Rufanlagen')
  })

  it('kennt den Abschnitt einer Zeile und findet den Anker', () => {
    const z = zeileVonAnker(TEXT, 'k7x2m9')
    expect(z).toBe(9)
    expect(abschnittAn(TEXT, z)).toEqual(['Apparatur', 'Zimmersignalleuchten'])
    expect(abschnittAn(TEXT, 13)).toEqual(['Planung'])
    expect(obersteEbene(gliederung(TEXT))).toBe(3)
    // „## Beschreibung“ und „## Priming“ sind kurz, unter „## Mitschrift“ steht fast alles
    const lang = '## Beschreibung\nKurs\n## Priming\n## Mitschrift\n' + TEXT.split('\n').slice(1).join('\n') + '\n- mehr\n'.repeat(20)
    expect(obersteEbene(gliederung(lang), lang.split('\n').length)).toBe(3)
    expect(obersteEbene(gliederung('## A\nx\n## B\ny\n### C\n'))).toBe(2)
    expect(ankerIn('- rot')).toBeNull()
  })

  it('ordnet Mitschriften dem Modul zu und Karten ihrer Mitschrift', () => {
    const b = new Bestand(
      new Map([
        ['lernen/module/M1.md', '---\nid: M1\ntyp: modul\ntitel: Rufanlagen\n---\n'],
        ['lernen/karten/N2.md', '---\nid: N2\ntyp: notiz\ntitel: Tag 2\nerstellt: 2026-04-29T08:00:00+02:00\nthema: "[[M1]]"\n---\n# B\n'],
        ['lernen/karten/N1.md', '---\nid: N1\ntyp: notiz\ntitel: Tag 1\nerstellt: 2026-04-28T08:00:00+02:00\nthema: "[[M1]]"\n---\n' + TEXT],
        ['lernen/karten/K1.md', '---\nid: K1\ntyp: frage\ntitel: Wie weit?\nthema: "[[M1]]"\nstelle: "[[N1#^k7x2m9]]"\n---\n?? Wie weit?\n:: 20 m\n']
      ])
    )
    expect(mitschriftenVon(b, 'M1').map((e) => e.id)).toEqual(['N1', 'N2'])
    const k = b.dokumente.get('K1')!
    expect(stelleVon(k)).toEqual({ notiz: 'N1', anker: 'k7x2m9' })
    expect(kartenAus(b, 'N1').map((e) => e.id)).toEqual(['K1'])
  })
})
