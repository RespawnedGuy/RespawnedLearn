// Brücke zur Android-Seite (app/src-tauri/android/MainActivity.kt): Hat die App „Zugriff auf alle Dateien“, und die
// Einstellung dazu öffnen. Am PC und im Browser gibt es die Brücke nicht.

interface AndroidBruecke {
  vorhanden(): boolean
  anfragen(): void
  /** ab v0.20.0: öffnet eine Release-Adresse dieses Repos im Browser (Download der neuen APK) */
  oeffnen?(adresse: string): void
}

const bruecke = (): AndroidBruecke | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { RespawnedAndroid?: AndroidBruecke }).RespawnedAndroid

/** true/false unter Android, null wo es keine Brücke gibt (PC, Browser, ältere App ohne Brücke) */
export function dateizugriff(): boolean | null {
  const b = bruecke()
  return b ? b.vorhanden() : null
}

/** Öffnet ab Android 11 die Seite „Zugriff auf alle Dateien“, bis Android 10 den Systemdialog */
export function dateizugriffAnfragen(): void {
  bruecke()?.anfragen()
}

/** Öffnet den Download einer neuen APK im Browser; Android prüft beim Installieren, dass die Signatur passt */
export function oeffneDownload(adresse: string): void {
  const b = bruecke()
  if (b?.oeffnen) b.oeffnen(adresse)
  else window.open(adresse, '_blank', 'noopener')
}
