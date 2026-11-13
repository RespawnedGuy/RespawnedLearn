// Nach `tauri android init`: Berechtigungen für den Datenordner im gemeinsamen Speicher eintragen und die eigene
// MainActivity einsetzen (siehe app/src-tauri/android/MainActivity.kt). Läuft in der GitHub Action vor dem Android-Build.
import fs from 'node:fs'
import path from 'node:path'

const gen = path.resolve('app/src-tauri/gen/android/app/src/main')
const manifestPfad = path.join(gen, 'AndroidManifest.xml')
let manifest = fs.readFileSync(manifestPfad, 'utf8')
const rechte = [
  '<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />',
  // bis Android 10 genügen die alten Rechte
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />'
]
for (const r of rechte) if (!manifest.includes(r.split('"')[1])) manifest = manifest.replace(/<application/, `${r}\n    <application`)
if (!manifest.includes('requestLegacyExternalStorage')) manifest = manifest.replace(/<application/, '<application android:requestLegacyExternalStorage="true"')
// Ollama im eigenen Netz spricht unverschlüsseltes http (Port 11434); welche Adressen die App erreichen darf, regelt
// die Freigabe in app/src-tauri/capabilities/default.json
if (manifest.includes('usesCleartextTraffic')) manifest = manifest.replace(/android:usesCleartextTraffic="[^"]*"/, 'android:usesCleartextTraffic="true"')
else manifest = manifest.replace(/<application/, '<application android:usesCleartextTraffic="true"')
fs.writeFileSync(manifestPfad, manifest)

const alt = fs.readdirSync(path.join(gen, 'java'), { recursive: true }).map(String).find((p) => p.endsWith('MainActivity.kt'))
if (!alt) throw new Error('MainActivity.kt nicht gefunden – hat sich der Aufbau von gen/android geändert?')
const altPfad = path.join(gen, 'java', alt)
const paket = /^package\s+([\w.]+)/m.exec(fs.readFileSync(altPfad, 'utf8'))?.[1]
if (!paket) throw new Error('Paketzeile in MainActivity.kt fehlt')
const neu = fs.readFileSync('app/src-tauri/android/MainActivity.kt', 'utf8').replace('package PAKET', `package ${paket}`)
fs.writeFileSync(altPfad, neu)
console.log(`Android angepasst: ${path.relative('.', manifestPfad)}, ${path.relative('.', altPfad)} (${paket})`)
