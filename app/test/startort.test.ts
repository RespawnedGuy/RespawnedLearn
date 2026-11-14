// @vitest-environment happy-dom
// Womit die App startet: Übersicht oder zuletzt offenes Skript (Nils 2026-11-14)
import { describe, expect, it } from 'vitest'
import { Bestand } from '@rl/kern'
import { letztesSkript, startZiel } from '../src/startort'

const pdf = (id: string) => `---\nid: ${id}\ntyp: anhang\ntitel: ${id}\ndatei: anhaenge/2026/11/${id}.pdf\nart: skript\n---\n`
const mitStand = new Bestand(
  new Map([
    ['gemeinsam/anhaenge/P1.md', pdf('P1')],
    ['gemeinsam/anhaenge/P2.md', pdf('P2')],
    ['lernen/stand/pc.json', JSON.stringify({ P1: { seite: 7, am: '2026-11-13T10:00:00Z' } })],
    ['lernen/stand/handy.json', JSON.stringify({ P2: { seite: 12, am: '2026-11-14T08:00:00Z' } })]
  ])
)
const ohneStand = new Bestand(new Map([['gemeinsam/anhaenge/P1.md', pdf('P1')]]))

describe('Start der App', () => {
  it('zuletzt offenes Skript ist die jüngste Stelle über alle Geräte', () => {
    expect(letztesSkript(mitStand)).toBe('#/sammeln/P2/12')
    expect(letztesSkript(ohneStand)).toBeNull()
  })
  it('ohne Adresse: Übersicht oder Skript je nach Einstellung, ohne gelesene Stelle die Übersicht', () => {
    expect(startZiel('', 'uebersicht', mitStand)).toBe('#/uebersicht')
    expect(startZiel('#/', 'skript', mitStand)).toBe('#/sammeln/P2/12')
    expect(startZiel('', 'skript', ohneStand)).toBe('#/uebersicht')
  })
  it('mit Adresse (Neuladen, Verweis) bleibt sie', () => {
    expect(startZiel('#/lernen', 'skript', mitStand)).toBeNull()
  })
})
