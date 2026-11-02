// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Fehlergrenze } from '../src/Fehlergrenze'

// Echtes React-DOM in happy-dom: Eine abstürzende Ansicht darf nur sich selbst ersetzen, der Rest bleibt stehen.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let kaputt = true
function Ansicht() {
  if (kaputt) throw new Error('Feld fehlt')
  return h('p', { id: 'ansicht' }, 'Journal')
}

let wurzel: HTMLDivElement
let root: Root
const zeige = (el: ReturnType<typeof h>) => act(() => root.render(el))
const app = (ort: string, extra: Record<string, unknown> = {}) =>
  h('div', null, h('nav', { id: 'kopf' }, 'Kopf'), h(Fehlergrenze, { ort, ...extra }, h(Ansicht)))

beforeEach(() => {
  kaputt = true
  wurzel = document.createElement('div')
  document.body.append(wurzel)
  root = createRoot(wurzel)
  // React und die Grenze protokollieren den Absturz absichtlich; im Testlauf nur stören
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  act(() => root.unmount())
  wurzel.remove()
  vi.restoreAllMocks()
})

describe('Fehlergrenze', () => {
  it('ersetzt nur die abgestürzte Ansicht, Kopf bleibt bedienbar', async () => {
    const beiFehler = vi.fn()
    await zeige(app('journal', { beiFehler }))
    expect(wurzel.querySelector('#kopf')?.textContent).toBe('Kopf')
    const meldung = wurzel.querySelector('[role="alert"]')
    expect(meldung?.textContent).toContain('Diese Ansicht lässt sich gerade nicht anzeigen.')
    expect(meldung?.textContent).toContain('Deine Einträge sind davon nicht betroffen')
    // Der rohe Fehler steht nur eingeklappt darunter
    expect(wurzel.querySelector('details code')?.textContent).toBe('Error: Feld fehlt')
    expect(beiFehler).toHaveBeenCalledOnce()
  })

  it('versucht es beim Wechsel der Ansicht von selbst neu', async () => {
    await zeige(app('journal'))
    expect(wurzel.querySelector('#ansicht')).toBeNull()
    kaputt = false
    await zeige(app('projekte'))
    expect(wurzel.querySelector('[role="alert"]')).toBeNull()
    expect(wurzel.querySelector('#ansicht')?.textContent).toBe('Journal')
  })

  it('„Nochmal versuchen“ baut die Ansicht neu auf', async () => {
    await zeige(app('journal'))
    kaputt = false
    const knopf = [...wurzel.querySelectorAll('button')].find((b) => b.textContent === 'Nochmal versuchen')!
    await act(() => knopf.click())
    expect(wurzel.querySelector('#ansicht')?.textContent).toBe('Journal')
  })

  it('ohne Fehler bleibt die Ansicht beim Ortswechsel erhalten (kein Neuaufbau)', async () => {
    kaputt = false
    await zeige(app('journal'))
    const vorher = wurzel.querySelector('#ansicht')
    await zeige(app('journal/2026-11-02'))
    expect(wurzel.querySelector('#ansicht')).toBe(vorher)
  })

  it('leise: Fenster verschwindet mit kurzer Meldung, die Seite bleibt frei', async () => {
    const meldungen: string[] = []
    const hoer = (e: Event) => meldungen.push((e as CustomEvent<{ text: string }>).detail.text)
    addEventListener('rvx:meldung', hoer)
    await zeige(h('div', null, h('nav', { id: 'kopf' }, 'Kopf'), h(Fehlergrenze, { leise: 'Das Aufgabenfenster' }, h(Ansicht))))
    removeEventListener('rvx:meldung', hoer)
    expect(wurzel.querySelector('[role="alert"]')).toBeNull()
    expect(wurzel.querySelector('#kopf')).not.toBeNull()
    expect(meldungen).toEqual(['Das Aufgabenfenster ließ sich nicht öffnen.'])
  })
})
