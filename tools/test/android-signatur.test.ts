import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error reines Node-Skript ohne Typen
import { signaturEintragen } from '../android-signatur.mjs'

// Vorlage aus tauri-apps/tauri (crates/tauri-cli/templates/mobile/android/app/build.gradle.kts)
const vorlage = fs.readFileSync(path.join(__dirname, 'build.gradle.kts.vorlage'), 'utf8')

describe('Release-Signatur im Android-Build', () => {
  it('steht im android-Block vor buildTypes und gilt für den Release-Build', () => {
    const neu: string = signaturEintragen(vorlage)
    const android = neu.indexOf('android {')
    const konfig = neu.indexOf('signingConfigs {')
    const typen = neu.indexOf('buildTypes {')
    expect(android).toBeGreaterThan(-1)
    expect(konfig).toBeGreaterThan(android)
    expect(typen).toBeGreaterThan(konfig)
    const release = neu.slice(neu.indexOf('getByName("release") {'))
    expect(release.split('\n')[1].trim()).toBe('signingConfig = signingConfigs.getByName("release")')
    expect(neu.match(/signingConfig = /g)).toHaveLength(1)
    // der Debug-Build bleibt mit dem Debug-Schlüssel signiert
    const debug = neu.slice(neu.indexOf('getByName("debug")'), neu.indexOf('getByName("release")'))
    expect(debug).not.toContain('signingConfig')
  })

  it('liest Schlüssel und Passwort nur aus keystore.properties', () => {
    const neu: string = signaturEintragen(vorlage)
    expect(neu).toContain('rootProject.file("keystore.properties")')
    expect(neu.match(/^import java\.util\.Properties$/gm)).toHaveLength(1)
  })

  it('ändert beim zweiten Lauf nichts mehr', () => {
    const einmal: string = signaturEintragen(vorlage)
    expect(signaturEintragen(einmal)).toBe(einmal)
  })

  it('bricht laut ab, wenn die Vorlage anders aussieht', () => {
    expect(() => signaturEintragen('android {\n}\n')).toThrow(/buildTypes/)
  })
})
