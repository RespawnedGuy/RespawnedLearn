// Änderungen am AndroidManifest.xml, das `tauri android init` erzeugt (rein, getestet in tools/test/android-manifest.test.ts).
// Aufgerufen von tools/android-anpassen.mjs in der GitHub Action.

const RECHTE = [
  '<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />',
  // bis Android 10 genügen die alten Rechte
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
  // „Nicht stören“ während der Pomodoro-Lernzeit: ohne diese Zeile steht die App nicht in der Liste „Zugriff auf Nicht stören“
  '<uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />'
]

// Wecker, der „Nicht stören“ zur Endzeit abschaltet (StilleEnde in MainActivity.kt); nur von der App selbst erreichbar
const EMPFAENGER = '<receiver android:name=".StilleEnde" android:exported="false" />'
// Die Regel „Lernzeit“ nennt MainActivity als Seite, die sie erklärt; Android verlangt dafür diese Aktion
const ZEN_REGEL = '<intent-filter><action android:name="android.app.action.AUTOMATIC_ZEN_RULE" /><category android:name="android.intent.category.DEFAULT" /></intent-filter>'

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
  if (!manifest.includes('.StilleEnde')) manifest = manifest.replace('</application>', `    ${EMPFAENGER}\n    </application>`)
  if (!manifest.includes('AUTOMATIC_ZEN_RULE') && manifest.includes('</activity>')) manifest = manifest.replace('</activity>', `    ${ZEN_REGEL}\n        </activity>`)
  return manifest
}
