import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error reines Node-Skript ohne Typen
import { baueNeueste, pruefeNeueste, pruefeSignatur } from '../neueste.mjs'

// Testtabelle, die auch kern (aktualisierung.test.ts) und Rust (aktualisieren.rs, Format des Tauri-Updaters) lesen
const wurzel = path.join(__dirname, '../../testdaten')
const tabelle = JSON.parse(fs.readFileSync(path.join(wurzel, 'latest.json'), 'utf8'))
const ordner = path.join(wurzel, 'aktualisierung')
const dateien: Record<string, string | null> = {}
for (const n of fs.readdirSync(ordner)) {
  if (n.endsWith('.sig') || n.endsWith('.pub')) continue
  const sig = path.join(ordner, `${n}.sig`)
  dateien[n] = fs.existsSync(sig) ? fs.readFileSync(sig, 'utf8') : null
}
const probe = { version: '9.9.9', notizen: 'Probe-Release für die Tests', datum: '2026-11-13T20:00:00Z', repo: 'RespawnedGuy/RespawnedLearn' }

describe('latest.json bauen', () => {
  it('ergibt aus den signierten Dateien genau die Testtabelle', () => {
    expect(baueNeueste({ ...probe, dateien })).toEqual(tabelle)
  })

  it('bietet nur signierte Dateien an und ordnet MSI, Installer und APK richtig zu', () => {
    const n = baueNeueste({
      ...probe,
      dateien: {
        'RespawnedLearn_9.9.9_x64-setup.exe': 'sigA',
        'RespawnedLearn_9.9.9_x64_en-US.msi': 'sigB\n',
        'RespawnedLearn_9.9.9_arm64.apk': null,
        'RespawnedLearn_9.9.9_arm64_debug.apk': 'sigC',
        'SHA256SUMS.txt': null
      }
    })
    expect(Object.keys(n.platforms).sort()).toEqual(['windows-x86_64', 'windows-x86_64-msi', 'windows-x86_64-nsis'])
    expect(n.platforms['windows-x86_64-msi']).toEqual({ signature: 'sigB', url: 'https://github.com/RespawnedGuy/RespawnedLearn/releases/download/v9.9.9/RespawnedLearn_9.9.9_x64_en-US.msi' })
    expect(n.platforms['windows-x86_64'].url).toMatch(/_x64-setup\.exe$/)
  })
})

describe('Gegenprobe nach dem Hochladen', () => {
  it('nimmt den echten Stand an', () => {
    expect(pruefeNeueste(tabelle, dateien)).toEqual([])
  })

  it('meldet fehlende Datei, falsche Signatur, fremde Version und leere Liste', () => {
    const ohneApk = { ...dateien }
    delete ohneApk['RespawnedLearn_9.9.9_arm64.apk']
    expect(pruefeNeueste(tabelle, ohneApk)).toEqual(['android-aarch64: RespawnedLearn_9.9.9_arm64.apk fehlt im Release'])
    const falsch = { ...dateien, 'RespawnedLearn_9.9.9_x64-setup.exe': 'andere' }
    expect(pruefeNeueste(tabelle, falsch)).toHaveLength(2)
    expect(pruefeNeueste({ ...tabelle, version: '9.9.8' }, dateien)).toHaveLength(3)
    expect(pruefeNeueste({ version: '1.0.0', platforms: {} }, {})).toEqual(['latest.json nennt keine Plattform'])
  })
})

describe('Signatur selbst nachprüfen (unabhängig vom Updater)', () => {
  const schluessel = fs.readFileSync(path.join(ordner, 'testschluessel.pub'), 'utf8')
  const exe = fs.readFileSync(path.join(ordner, 'RespawnedLearn_9.9.9_x64-setup.exe'))
  const sig = tabelle.platforms['windows-x86_64'].signature

  it('nimmt die echte Datei an', () => {
    expect(pruefeSignatur(exe, sig, schluessel)).toBe('gut')
  })

  it('lehnt veränderte Datei, fremde Signatur und fremden Schlüssel ab', () => {
    const anders = Buffer.from(exe)
    anders[0] ^= 1
    expect(pruefeSignatur(anders, sig, schluessel)).toBe('falsch')
    expect(pruefeSignatur(exe, tabelle.platforms['android-aarch64'].signature, schluessel)).toBe('falsch')
    // zweiter Wegwerf-Schlüssel wie in aktualisieren.rs
    const fremd = Buffer.from('untrusted comment: minisign public key: 8EA6BC101864FF6E\nRWRu/2QYELymjvZEb7W6v34GRFTPQw3DzVf2NsfrEbkO4DEZ45HitYld\n').toString('base64')
    expect(pruefeSignatur(exe, sig, fremd)).toBe('falscher-schluessel')
    expect(pruefeSignatur(exe, 'kaputt', schluessel)).toBe('unlesbar')
  })
})
