import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDF_LADEN } from '../src/pdf/sicher'

describe('pdf.js öffnet Dateien ohne eval', () => {
  it('schaltet eval aus und jeder Aufruf von getDocument nutzt die Einstellung', () => {
    expect(PDF_LADEN.isEvalSupported).toBe(false)
    const quelle = fs.readFileSync(path.join(__dirname, '../src/pdf/pdf.ts'), 'utf8')
    const aufrufe = quelle.match(/getDocument\(\{[^}]*/g) ?? []
    expect(aufrufe.length).toBeGreaterThan(0)
    for (const a of aufrufe) expect(a).toContain('...PDF_LADEN')
  })
})
