import { describe, expect, it } from 'vitest'
import { kiBlock } from '../src/kiBlock'

describe('Erklärung als Block auf der Wissenskarte', () => {
  it('schreibt Erklärung und Rückfragen als eingeklappten Callout, Leerzeilen bleiben im Block', () => {
    const block = kiBlock(
      [
        { von: 'ki', text: 'Die Spannung teilt sich auf.\n\n- an R1\n- an R2' },
        { von: 'ich', text: 'Warum mehr an R2?' },
        { von: 'ki', text: 'Weil R2 größer ist.' }
      ],
      '2026-10-31'
    )
    expect(block).toBe(
      ['> [!ki]- Erklärung der KI vom 2026-10-31', '> Die Spannung teilt sich auf.', '>', '> - an R1', '> - an R2', '>', '> Rückfrage: Warum mehr an R2?', '>', '> Weil R2 größer ist.'].join('\n')
    )
    expect(block.split('\n').every((z) => z.startsWith('>'))).toBe(true)
  })
})
