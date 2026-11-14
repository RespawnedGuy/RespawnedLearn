// Nach `tauri android init`: Berechtigungen für den Datenordner im gemeinsamen Speicher eintragen und die eigene
// MainActivity und das App-Symbol einsetzen (siehe app/src-tauri/android/MainActivity.kt), bei vorhandenem Schlüssel die Release-Signatur. Läuft in der GitHub Action vor dem Android-Build.
import fs from 'node:fs'
import path from 'node:path'
import { manifestAnpassen } from './android-manifest.mjs'
import { signaturEintragen } from './android-signatur.mjs'
import { symboleKopieren } from './android-symbole.mjs'

const gen = path.resolve('app/src-tauri/gen/android/app/src/main')
const manifestPfad = path.join(gen, 'AndroidManifest.xml')
const manifest = manifestAnpassen(fs.readFileSync(manifestPfad, 'utf8'))
fs.writeFileSync(manifestPfad, manifest)

const alt = fs.readdirSync(path.join(gen, 'java'), { recursive: true }).map(String).find((p) => p.endsWith('MainActivity.kt'))
if (!alt) throw new Error('MainActivity.kt nicht gefunden – hat sich der Aufbau von gen/android geändert?')
const altPfad = path.join(gen, 'java', alt)
const paket = /^package\s+([\w.]+)/m.exec(fs.readFileSync(altPfad, 'utf8'))?.[1]
if (!paket) throw new Error('Paketzeile in MainActivity.kt fehlt')
const neu = fs.readFileSync('app/src-tauri/android/MainActivity.kt', 'utf8').replace('package PAKET', `package ${paket}`)
fs.writeFileSync(altPfad, neu)
const symbole = symboleKopieren(path.resolve('app/src-tauri/icons/android'), path.join(gen, 'res'))
// Release-Signatur nur, wenn die Action aus ihren Secrets gen/android/keystore.properties geschrieben hat
const gradlePfad = path.resolve('app/src-tauri/gen/android/app/build.gradle.kts')
const signiert = fs.existsSync(path.resolve('app/src-tauri/gen/android/keystore.properties'))
if (signiert) fs.writeFileSync(gradlePfad, signaturEintragen(fs.readFileSync(gradlePfad, 'utf8')))

console.log(`Android angepasst: ${path.relative('.', manifestPfad)}, ${path.relative('.', altPfad)} (${paket}), ${symbole.length} Symboldateien${signiert ? ', Release-Signatur eingetragen' : ', ohne Release-Signatur'}`)
