import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// Windows und macOS unterscheiden Groß- und Kleinschreibung in Dateinamen nicht: zwei Dateien, die sich nur darin
// unterscheiden, brechen dort den Build (v0.20.0: Aktualisierung.tsx neben aktualisierung.ts), unter Linux nicht.
describe('Dateinamen im Repo', () => {
  it('unterscheiden sich nicht nur in Groß- und Kleinschreibung (auch ohne Endung, wegen der Auflösung von Importen)', () => {
    const dateien = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
    const gesehen = new Map<string, string>()
    const doppelt: string[] = []
    for (const d of dateien) {
      const schluessel = d.toLowerCase().replace(/\.(tsx?|mjs|js)$/, '')
      const frueher = gesehen.get(schluessel)
      if (frueher && frueher !== d) doppelt.push(`${frueher} ↔ ${d}`)
      gesehen.set(schluessel, d)
    }
    expect(doppelt).toEqual([])
  })
})
