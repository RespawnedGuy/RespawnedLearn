// Änderungen am AndroidManifest.xml, das `tauri android init` erzeugt (rein, getestet in tools/test/android-manifest.test.ts).
// Aufgerufen von tools/android-anpassen.mjs in der GitHub Action.

const RECHTE = [
  '<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />',
  // bis Android 10 genügen die alten Rechte
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />'
]

/** Setzt ein Attribut am <application>-Element, ersetzt einen vorhandenen Wert */
function attribut(manifest, name, wert) {
  const muster = new RegExp(`android:${name}="[^"]*"`)
  if (muster.test(manifest)) return manifest.replace(muster, `android:${name}="${wert}"`)
  return manifest.replace(/<application/, `<application android:${name}="${wert}"`)
}

export function manifestAnpassen(manifest) {
  for (const r of RECHTE) if (!manifest.includes(r.split('"')[1])) manifest = manifest.replace(/<application/, `${r}\n    <application`)
  if (!manifest.includes('requestLegacyExternalStorage')) manifest = attribut(manifest, 'requestLegacyExternalStorage', 'true')
  // Unverschlüsseltes http (Ollama im eigenen Netz, Port 11434); welche Rechner erreichbar sind, prüft ollama.rs
  manifest = attribut(manifest, 'usesCleartextTraffic', 'true')
  // Keine Sicherung der App-Daten (Geräte- und Cloud-Backup, adb backup): dort liegen KI-Zugang und Tresorschlüssel
  manifest = attribut(manifest, 'allowBackup', 'false')
  return manifest
}
