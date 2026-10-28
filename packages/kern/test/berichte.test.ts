import { describe, expect, it } from 'vitest'
import { Bestand, berichtFortschreiben, berichtSchluessel, berichtStellen, entferneBerichtStelle, ersetzeBerichtStelle, loeseBerichtLinksAuf } from '../src'

const kopf = (datum: string) => `---
id: 01JJOURNAL${datum.replace(/-/g, '')}0000000
typ: journal
titel: Journal ${datum}
datum: ${datum}
---
`
const TAG1 = `${kopf('2026-10-21')}# #dd_bsz_gehe
## Rückfragen Aufmaß
Archiv oti?

# #dd_bsz_gehe
## EMA Installation
Weiterleitung GLT:
REL1 - Betrieb

### 3.1 Bewegungsmelder
#### Com2bus
12V = 1

# #anderes
## EMA Installation
gehört nicht dazu
`
const TAG2 = `${kopf('2026-10-22')}# #dd_bsz_gehe
## EMA  installation - offen
### 3.5 Zentrale
Parametrierung erledigt
`

describe('Berichte aus dem Journal', () => {
  it('nimmt jede ## unter einem Projekt, gleiche Titel über Tage zusammen', () => {
    const b = new Bestand(new Map([['arbeit/journal/2026/2026-10-21.md', TAG1], ['arbeit/journal/2026/2026-10-22.md', TAG2]]))
    const alle = b.journalBerichte('dd_bsz_gehe')
    expect(alle.map((x) => x.schluessel)).toEqual(['ema installation', 'rückfragen aufmaß'])
    const ema = alle[0]
    expect(ema.von).toBe('2026-10-21')
    expect(ema.bis).toBe('2026-10-22')
    expect(ema.tage.map((t) => t.datum)).toEqual(['2026-10-21', '2026-10-22'])
    expect(ema.tage[0].rumpf).toBe('Weiterleitung GLT:\nREL1 - Betrieb\n\n### 3.1 Bewegungsmelder\n#### Com2bus\n12V = 1')
    expect(b.journalBerichte('anderes')[0].tage[0].rumpf).toBe('gehört nicht dazu')
  })

  it('Schlüssel ignoriert Status, #wichtig und Schreibweise', () => {
    expect(berichtSchluessel('EMA  Installation #wichtig - blockiert')).toBe('ema installation')
  })

  it('schreibt einen Tag zurück, die ## bleibt', () => {
    const s = berichtStellen(TAG1).find((x) => x.kuerzel === 'dd_bsz_gehe' && x.schluessel === 'ema installation')!
    const neu = ersetzeBerichtStelle(TAG1, s, 'Neu')
    expect(neu).toContain('## EMA Installation\nNeu\n\n# #anderes\n## EMA Installation\ngehört nicht dazu')
    expect(neu).toContain('## Rückfragen Aufmaß\nArchiv oti?\n')
    // unbekannte Stelle: nichts ändern
    expect(ersetzeBerichtStelle(TAG1, { ...s, kopf: '## Weg' }, 'x')).toBe(TAG1)
  })

  it('löscht eine Berichtsstelle samt Überschrift, Nachbarn bleiben', () => {
    const s = berichtStellen(TAG1).find((x) => x.kuerzel === 'dd_bsz_gehe' && x.schluessel === 'ema installation')!
    const neu = entferneBerichtStelle(TAG1, s)
    expect(neu).not.toContain('Weiterleitung GLT')
    expect(neu).not.toContain('Com2bus')
    expect(neu).toContain('## Rückfragen Aufmaß\nArchiv oti?\n\n# #dd_bsz_gehe\n\n# #anderes\n## EMA Installation\ngehört nicht dazu\n')
    const r = berichtStellen(TAG1).find((x) => x.schluessel === 'rückfragen aufmaß')!
    expect(entferneBerichtStelle(TAG1, r)).toContain('# #dd_bsz_gehe\n\n# #dd_bsz_gehe\n## EMA Installation')
    expect(entferneBerichtStelle(TAG1, { ...s, kopf: '## Weg' })).toBe(TAG1)
  })

  it('Links auf einen gelöschten Bericht werden Text, andere bleiben', () => {
    const t = '| Was | Bericht |\n|---|---|\n| EMA | [[P1#bericht=ema%20installation\\|EMA Installation]] |\nSiehe [[P1#bericht=r%C3%BCckfragen|Rückfragen]] und [[P1|Projekt]].\n'
    const neu = loeseBerichtLinksAuf(t, 'P1', 'ema installation')
    expect(neu).toContain('| EMA | EMA Installation |')
    expect(neu).toContain('[[P1#bericht=r%C3%BCckfragen|Rückfragen]] und [[P1|Projekt]]')
    expect(loeseBerichtLinksAuf(t, 'P2', 'ema installation')).toBe(t)
  })

  it('fortschreiben legt die ## im heutigen Journal an oder findet sie', () => {
    const leer = kopf('2026-10-23')
    const a = berichtFortschreiben(leer, 'dd_bsz_gehe', 'EMA Installation')
    expect(a.text).toContain('# #dd_bsz_gehe\n## EMA Installation\n')
    expect(a.text.split('\n')[a.zeile - 1]).toBe('## EMA Installation')
    const b = berichtFortschreiben(TAG2, 'dd_bsz_gehe', 'EMA Installation')
    expect(b.text).toBe(TAG2)
    const c = berichtFortschreiben(TAG1, 'dd_bsz_gehe', 'Brandschutz')
    expect(c.text).toContain('12V = 1\n\n## Brandschutz\n')
    expect(berichtStellen(c.text).filter((x) => x.kuerzel === 'dd_bsz_gehe').map((x) => x.titel)).toEqual(['Rückfragen Aufmaß', 'EMA Installation', 'Brandschutz'])
  })

  it('eine ## mit #unterpunkt ist nur eine Überschrift, kein Bericht', () => {
    const t = kopf('2026-10-28') + '# #dd_bsz_gehe\n## Montage\nKabel gezogen\n## Kabelweg #unterpunkt\nüber die Decke\n'
    const z = t.split('\n')
    const stellen = berichtStellen(t)
    expect(stellen.map((x) => x.titel)).toEqual(['Montage'])
    expect(stellen[0].bis).toBe(z.indexOf('## Kabelweg #unterpunkt'))
  })
})
