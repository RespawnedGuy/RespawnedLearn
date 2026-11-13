import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { automatisch } from '../src/syncPruefung'
import { VERTRAG, erlaubterDownload, istVersion, liesNeuigkeit, liesVertrag, vergleicheVersionen, vertragText, vertragsSchritt, zeigeNeuigkeit } from '../src/aktualisierung'

// Dieselbe Datei, die tools/neueste.mjs baut und der Tauri-Updater liest
const tabelle = fs.readFileSync(path.join(__dirname, '../../../testdaten/latest.json'), 'utf8')

describe('Versionen vergleichen', () => {
  it('zählt Stellen als Zahlen, nicht als Text', () => {
    expect(vergleicheVersionen('0.20.0', '0.19.0')).toBe(1)
    expect(vergleicheVersionen('0.9.0', '0.10.0')).toBe(-1)
    expect(vergleicheVersionen('1.10', '1.9')).toBe(1)
    expect(vergleicheVersionen('1.6', '1.6.0')).toBe(0)
    expect(vergleicheVersionen('v1.2.3', '1.2.3')).toBe(0)
  })

  it('stellt eine Vorabversion vor die fertige', () => {
    expect(vergleicheVersionen('1.0.0-beta.1', '1.0.0')).toBe(-1)
    expect(vergleicheVersionen('1.0.0', '1.0.0-beta.1')).toBe(1)
    expect(vergleicheVersionen('1.0.0-beta.1', '1.0.0-beta.2')).toBe(-1)
  })

  it('erkennt gültige Versionen', () => {
    for (const v of ['0.20.0', '1.6', 'v2.0.1', '1.0.0-beta.1']) expect(istVersion(v)).toBe(true)
    for (const v of ['', '1', 'eins', '1.2.3.4', '1.2.x', 3, null]) expect(istVersion(v)).toBe(false)
  })
})

describe('latest.json lesen', () => {
  it('liest die Testtabelle für Windows und Android', () => {
    const w = liesNeuigkeit(tabelle, 'windows')
    expect(w).toEqual({
      version: '9.9.9',
      notizen: 'Probe-Release für die Tests',
      datum: '2026-11-13T20:00:00Z',
      adresse: 'https://github.com/RespawnedGuy/RespawnedLearn/releases/download/v9.9.9/RespawnedLearn_9.9.9_x64-setup.exe'
    })
    expect(liesNeuigkeit(tabelle, 'android')?.adresse).toMatch(/_arm64\.apk$/)
  })

  it('sagt bei kaputter oder fremder Datei nichts', () => {
    for (const t of ['', '<html>', 'null', '[]', '{"version": "neu"}', '{"notes": "x"}']) expect(liesNeuigkeit(t, 'windows')).toBeNull()
  })

  it('öffnet keine Adresse außerhalb der Releases dieses Repos', () => {
    const fremd = JSON.stringify({ version: '9.9.9', platforms: { 'android-aarch64': { url: 'https://example.org/boese.apk', signature: '' } } })
    expect(liesNeuigkeit(fremd, 'android')).toMatchObject({ version: '9.9.9', adresse: null })
    expect(erlaubterDownload('https://github.com/RespawnedGuy/RespawnedLearn/releases/download/v1.0.0/a.apk')).toBe(true)
    expect(erlaubterDownload('https://github.com/RespawnedGuy/RespawnedLearn/releases/download/../../x/a.apk')).toBe(false)
    expect(erlaubterDownload('https://github.com/Fremder/RespawnedLearn/releases/download/v1.0.0/a.apk')).toBe(false)
    expect(erlaubterDownload('http://github.com/RespawnedGuy/RespawnedLearn/releases/download/v1.0.0/a.apk')).toBe(false)
  })

  it('zeigt nur eine neuere Version, die nicht weggeklickt ist', () => {
    const n = liesNeuigkeit(tabelle, 'windows')
    expect(zeigeNeuigkeit(n, '0.20.0', null)).toBe(true)
    expect(zeigeNeuigkeit(n, '9.9.9', null)).toBe(false)
    expect(zeigeNeuigkeit(n, '10.0.0', null)).toBe(false)
    expect(zeigeNeuigkeit(n, '0.20.0', '9.9.9')).toBe(false)
    expect(zeigeNeuigkeit(null, '0.20.0', null)).toBe(false)
  })
})

describe('Vertragsmarke', () => {
  it('legt die Marke an, wenn sie fehlt, und hebt sie nur nach oben', () => {
    expect(vertragsSchritt(undefined)).toEqual({ art: 'schreiben', text: vertragText(VERTRAG) })
    expect(vertragsSchritt(vertragText('1.5'), '1.6')).toEqual({ art: 'schreiben', text: '{"vertrag": "1.6"}\n' })
    expect(vertragsSchritt(vertragText('1.6'), '1.6')).toEqual({ art: 'gut' })
  })

  it('meldet einen neueren Vertrag und schreibt dann nicht', () => {
    expect(vertragsSchritt(vertragText('1.7'), '1.6')).toEqual({ art: 'neuer', gefunden: '1.7' })
    expect(vertragsSchritt('{"vertrag":"2.0","app":"1.0.0"}', '1.6')).toEqual({ art: 'neuer', gefunden: '2.0' })
  })

  it('lässt eine unlesbare Marke in Ruhe (halb übertragen)', () => {
    expect(vertragsSchritt('{"vertr', '1.6')).toEqual({ art: 'gut' })
    expect(vertragsSchritt('', '1.6')).toEqual({ art: 'gut' })
    expect(liesVertrag('{"vertrag": 1.6}')).toBeNull()
  })

  it('schreibt für dieselbe Version immer denselben Text', () => {
    expect(vertragText('1.6')).toBe(vertragText('1.6'))
    expect(liesVertrag(vertragText('1.6'))).toBe('1.6')
  })
})

describe('Konflikt der Vertragsmarke', () => {
  it('löst sich ohne Menschen: die höhere Version bleibt', () => {
    expect(automatisch('lernen/vertrag.json', vertragText('1.6'), vertragText('1.7'))).toEqual({ art: 'uebernehmen' })
    expect(automatisch('lernen/vertrag.json', vertragText('1.7'), vertragText('1.6'))).toEqual({ art: 'weg' })
    expect(automatisch('lernen/vertrag.json', vertragText('1.6'), vertragText('1.6'))).toEqual({ art: 'weg' })
  })

  it('gilt nur für die Marke selbst', () => {
    expect(automatisch('lernen/anderes.json', vertragText('1.6'), vertragText('1.7'))).toBeNull()
  })
})
