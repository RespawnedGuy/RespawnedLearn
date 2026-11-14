// `tauri android init` legt das Standardsymbol von Tauri an und übernimmt app/src-tauri/icons/android nicht
// (geprüft an der APK von v0.25.0). Darum kopiert die Action unsere Symbole danach über die Vorlage.
import fs from 'node:fs'
import path from 'node:path'

/** Kopiert alle Dateien aus `quelle` (icons/android) nach `zielRes` (gen/android/app/src/main/res) und überschreibt
 *  gleichnamige Dateien der Vorlage. Gibt die kopierten Pfade relativ zu `quelle` zurück. */
export function symboleKopieren(quelle, zielRes) {
  const dateien = fs.readdirSync(quelle, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(quelle, path.join(e.parentPath, e.name)))
    .sort()
  if (!dateien.some((d) => d.endsWith('ic_launcher.png'))) throw new Error(`Keine Android-Symbole in ${quelle}`)
  for (const d of dateien) {
    fs.mkdirSync(path.dirname(path.join(zielRes, d)), { recursive: true })
    fs.copyFileSync(path.join(quelle, d), path.join(zielRes, d))
  }
  return dateien
}
