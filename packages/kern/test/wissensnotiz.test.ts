import { describe, expect, it } from 'vitest'
import { Bestand, gliedere, notizOhneZiel, notizTitel, wissensNotiz, zerlege, felder, type JournalEintrag } from '../src'

function eintrag(text: string, nr: number): JournalEintrag {
  const teil = gliedere(text).teile[nr]
  const rumpf = text.split('\n').slice(teil.kopf ? teil.von + 1 : teil.von, teil.bis).join('\n')
  return { datum: '2026-03-14', pfad: 'arbeit/journal/2026/2026-03-14.md', teil, rumpf }
}

describe('Wissensnotiz aus dem Journal', () => {
  it('nimmt die Überschrift als Titel und den Text unverändert', () => {
    const e = eintrag('# Spannungsteiler\nU2 = U · R2 / (R1 + R2)\n\n- belastet kleiner\n', 0)
    expect(notizTitel(e)).toBe('Spannungsteiler')
    const t = wissensNotiz(e, { id: '01JNOTIZ000000000000000001', jetzt: '2026-10-22T17:00:00+02:00', thema: '01JTHEMA000000000000000001' })
    const f = felder(zerlege(t).kopf)
    expect(f.typ).toBe('notiz')
    expect(f.titel).toBe('Spannungsteiler')
    expect(f.erstellt).toBe('2026-03-14T00:00:00+02:00')
    expect(f.thema).toBe('[[01JTHEMA000000000000000001]]')
    expect(zerlege(t).rumpf).toBe('U2 = U · R2 / (R1 + R2)\n\n- belastet kleiner\n')
  })

  it('ohne Überschrift: erste Zeile ohne Markdown, ohne Thema', () => {
    const e = eintrag('- **Ohmsches** Gesetz [[01JX|U = R · I]]\nmehr\n', 0)
    expect(notizTitel(e)).toBe('Ohmsches Gesetz U = R · I')
    const t = wissensNotiz(e, { id: '01JNOTIZ000000000000000002', jetzt: '2026-10-22T17:00:00+02:00' })
    expect(felder(zerlege(t).kopf).thema).toBeUndefined()
    const b = new Bestand(new Map([['lernen/karten/01JNOTIZ000000000000000002.md', t]]))
    expect(notizOhneZiel(b.dokumente.get('01JNOTIZ000000000000000002')!)).toBe(true)
  })
})
