import { describe, expect, it } from 'vitest'
import { RUHE_MS, StiftRuhe } from '../src/stiftRuhe'

describe('Stift und Handballen', () => {
  it('ohne Stift darf der Finger alles', () => {
    const r = new StiftRuhe()
    expect(r.schreibt(1000)).toBe(false)
    expect(r.fingerErlaubt(1000)).toBe(true)
  })

  it('solange der Stift aufliegt, schreibt man und der Handballen löst nichts aus', () => {
    const r = new StiftRuhe()
    r.ab(1000)
    expect(r.schreibt(5000)).toBe(true)
    expect(r.fingerErlaubt(5000)).toBe(false)
  })

  it('eine halbe Sekunde nach dem Absetzen ist die Leiste wieder bedienbar', () => {
    const r = new StiftRuhe()
    r.ab(1000)
    r.hoch(2000)
    expect(r.fingerErlaubt(2000 + RUHE_MS - 1)).toBe(false)
    expect(r.fingerErlaubt(2000 + RUHE_MS)).toBe(true)
  })
})
