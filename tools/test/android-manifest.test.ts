import { describe, expect, it } from 'vitest'
// @ts-expect-error reines Node-Skript ohne Typen
import { manifestAnpassen } from '../android-manifest.mjs'

// Aufbau wie die Vorlage von tauri-cli (templates/mobile/android/app/src/main/AndroidManifest.xml), gekürzt
const vorlage = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.respawnedlearn"
        android:usesCleartextTraffic="\${usesCleartextTraffic}">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`

describe('AndroidManifest nach tauri android init', () => {
  it('schaltet die Sicherung der App-Daten ab (KI-Zugang und Tresorschlüssel liegen dort)', () => {
    const m: string = manifestAnpassen(vorlage)
    expect(m).toContain('android:allowBackup="false"')
    expect(manifestAnpassen(vorlage.replace('<application', '<application android:allowBackup="true"'))).not.toContain('allowBackup="true"')
  })

  it('trägt Rechte, alten Speicherzugriff und http genau einmal ein, auch beim zweiten Lauf', () => {
    const m: string = manifestAnpassen(manifestAnpassen(vorlage))
    expect(m.match(/MANAGE_EXTERNAL_STORAGE/g)).toHaveLength(1)
    expect(m.match(/requestLegacyExternalStorage/g)).toHaveLength(1)
    expect(m.match(/allowBackup/g)).toHaveLength(1)
    expect(m).toContain('android:usesCleartextTraffic="true"')
    expect(m).not.toContain('${usesCleartextTraffic}')
  })

  it('Nicht stören in der Lernzeit: Recht, Wecker-Empfänger nur intern, Regel-Aktion an MainActivity, genau einmal', () => {
    const m: string = manifestAnpassen(manifestAnpassen(vorlage))
    expect(m.match(/android\.permission\.ACCESS_NOTIFICATION_POLICY/g)).toHaveLength(1)
    expect(m.match(/<receiver android:name="\.StilleEnde" android:exported="false" \/>/g)).toHaveLength(1)
    expect(m.indexOf('.StilleEnde')).toBeLessThan(m.indexOf('</application>'))
    expect(m.match(/AUTOMATIC_ZEN_RULE/g)).toHaveLength(1)
    const activity = m.slice(m.indexOf('<activity'), m.indexOf('</activity>'))
    expect(activity).toContain('android.app.action.AUTOMATIC_ZEN_RULE')
    expect(activity).toContain('android.intent.category.LAUNCHER')
  })
})
