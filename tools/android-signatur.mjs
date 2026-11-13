// Trägt in das von `tauri android init` erzeugte app/build.gradle.kts die Release-Signatur ein. Schlüssel, Alias und
// Passwort stehen in gen/android/keystore.properties, die nur die GitHub Action aus ihren Secrets schreibt (nie im Repo).
// Rein, damit der Test es gegen die Tauri-Vorlage prüfen kann (tools/test/android-signatur.test.ts).

const KONFIG = `    signingConfigs {
        create("release") {
            val schluessel = Properties().apply { rootProject.file("keystore.properties").inputStream().use { load(it) } }
            keyAlias = schluessel.getProperty("keyAlias")
            keyPassword = schluessel.getProperty("password")
            storeFile = file(schluessel.getProperty("storeFile"))
            storePassword = schluessel.getProperty("password")
        }
    }
`

/** @param {string} gradle Inhalt von app/build.gradle.kts @returns {string} */
export function signaturEintragen(gradle) {
  if (gradle.includes('signingConfigs')) return gradle
  if (!/^import java\.util\.Properties$/m.test(gradle)) gradle = `import java.util.Properties\n${gradle}`
  const typen = /^(\s*)buildTypes\s*\{/m
  if (!typen.test(gradle)) throw new Error('buildTypes fehlt in build.gradle.kts – hat sich die Tauri-Vorlage geändert?')
  gradle = gradle.replace(typen, (m) => `${KONFIG}${m}`)
  const release = /getByName\("release"\)\s*\{/
  if (!release.test(gradle)) throw new Error('getByName("release") fehlt in build.gradle.kts')
  return gradle.replace(release, (m) => `${m}\n            signingConfig = signingConfigs.getByName("release")`)
}
