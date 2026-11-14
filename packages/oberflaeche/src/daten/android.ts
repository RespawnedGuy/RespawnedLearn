// Brücke zur Android-Seite (app/src-tauri/android/MainActivity.kt): Hat die App „Zugriff auf alle Dateien“, und die
// Einstellung dazu öffnen. Am PC und im Browser gibt es die Brücke nicht.

interface AndroidBruecke {
  vorhanden(): boolean
  anfragen(): void
  /** ab v0.20.0: öffnet eine Release-Adresse dieses Repos im Browser (Download der neuen APK) */
  oeffnen?(adresse: string): void
  /** ab v0.21.0: Ordnerauswahl des Systems, Antwort als Ereignis `respawned-ordner` */
  ordnerWaehlen?(): void
  /** ab v0.22.0: „Nicht stören“ während der Pomodoro-Lernzeit (ab Android 10) */
  stilleMoeglich?(): boolean
  stilleErlaubt?(): boolean
  stilleAnfragen?(): void
  stilleAn?(ende: number): boolean
  stilleAus?(): void
}

/** Ergebnis der Ordnerauswahl: echter Pfad im Gerätespeicher, abgebrochen oder Fehler (SD-Karte, Cloud …) */
export type OrdnerAuswahl = { pfad: string } | { abgebrochen: true } | { fehler: string }

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

/** true, wenn die App die Ordnerauswahl des Systems anbieten kann (Android ab v0.21.0) */
export function kannOrdnerAuswaehlen(): boolean {
  return typeof bruecke()?.ordnerWaehlen === 'function'
}

/** Öffnet die Ordnerauswahl des Systems; der Pfad wird danach in Rust geprüft wie ein getippter (ordnerwahl.rs) */
export function ordnerAuswaehlen(): Promise<OrdnerAuswahl> {
  const b = bruecke()
  if (!b?.ordnerWaehlen) return Promise.resolve({ fehler: 'keine-auswahl' })
  return new Promise((fertig) => {
    const hoere = (e: Event) => {
      window.removeEventListener('respawned-ordner', hoere)
      fertig((e as CustomEvent<OrdnerAuswahl>).detail)
    }
    window.addEventListener('respawned-ordner', hoere)
    b.ordnerWaehlen!()
  })
}

/** Meldung zu einem Fehler der Ordnerauswahl */
export function auswahlFehler(fehler: string): string {
  return fehler === 'nur-geraetespeicher'
    ? 'Bitte einen Ordner im Gerätespeicher wählen. SD-Karten und Cloud-Ordner kann die App nicht direkt nutzen.'
    : 'Die Ordnerauswahl ließ sich nicht öffnen. Bitte den Pfad eintippen.'
}

/** true, wenn dieses Gerät „Nicht stören“ für die Lernzeit kann (Android ab 10 mit App ab v0.22.0); am PC nie */
export function stilleMoeglich(): boolean {
  const b = bruecke()
  return typeof b?.stilleMoeglich === 'function' && b.stilleMoeglich()
}

/** Hat der Nutzer den „Zugriff auf Nicht stören“ erteilt? */
export function stilleErlaubt(): boolean {
  const b = bruecke()
  return typeof b?.stilleErlaubt === 'function' && b.stilleErlaubt()
}

/** Öffnet die Systemseite „Zugriff auf Nicht stören“ */
export function stilleAnfragen(): void {
  bruecke()?.stilleAnfragen?.()
}

/** Schaltet die eigene Regel „Lernzeit“ bis `ende` an; ein Wecker des Systems schaltet sie zur Endzeit ab */
export function stilleAn(ende: number): boolean {
  const b = bruecke()
  return typeof b?.stilleAn === 'function' && b.stilleAn(ende)
}

export function stilleAus(): void {
  bruecke()?.stilleAus?.()
}
