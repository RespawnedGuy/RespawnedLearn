// @vitest-environment happy-dom
// Brücke zur Ordnerauswahl unter Android (MainActivity.kt): Antwort kommt als Ereignis `respawned-ordner`
import { afterEach, describe, expect, it } from 'vitest'
import { auswahlFehler, kannOrdnerAuswaehlen, ordnerAuswaehlen } from '../src/daten/android'

type Fenster = { RespawnedAndroid?: Record<string, () => unknown> }
const fenster = () => window as unknown as Fenster

/** Stellt die Brücke nach: antwortet wie MainActivity.kt asynchron mit einem Ereignis */
function bruecke(antwort: unknown) {
  fenster().RespawnedAndroid = {
    vorhanden: () => true,
    anfragen: () => {},
    ordnerWaehlen: () => setTimeout(() => window.dispatchEvent(new CustomEvent('respawned-ordner', { detail: antwort })), 0)
  }
}

afterEach(() => delete fenster().RespawnedAndroid)

describe('Ordnerauswahl unter Android', () => {
  it('ohne Brücke (PC, ältere App) gibt es keine Auswahl', async () => {
    expect(kannOrdnerAuswaehlen()).toBe(false)
    expect(await ordnerAuswaehlen()).toEqual({ fehler: 'keine-auswahl' })
  })

  it('ältere Brücke ohne ordnerWaehlen bietet keine Auswahl an', () => {
    fenster().RespawnedAndroid = { vorhanden: () => true, anfragen: () => {} }
    expect(kannOrdnerAuswaehlen()).toBe(false)
  })

  it('liefert den Pfad, Abbruch und Fehler, jeweils genau einmal', async () => {
    bruecke({ pfad: '/storage/emulated/0/Sync/Lernen' })
    expect(kannOrdnerAuswaehlen()).toBe(true)
    expect(await ordnerAuswaehlen()).toEqual({ pfad: '/storage/emulated/0/Sync/Lernen' })
    bruecke({ abgebrochen: true })
    expect(await ordnerAuswaehlen()).toEqual({ abgebrochen: true })
    bruecke({ fehler: 'nur-geraetespeicher' })
    expect(await ordnerAuswaehlen()).toEqual({ fehler: 'nur-geraetespeicher' })
  })

  it('erklärt Fehler verständlich', () => {
    expect(auswahlFehler('nur-geraetespeicher')).toContain('Gerätespeicher')
    expect(auswahlFehler('keine-auswahl')).toContain('eintippen')
  })
})
