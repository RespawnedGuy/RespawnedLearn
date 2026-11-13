// Welcher Schritt beim Start zu sehen ist. Unter Android kommt zuerst die Erklärung zur Erlaubnis
// „Zugriff auf alle Dateien“ (Android: erst begründen, dann anfragen), dann die Ordnerwahl, dann die App.

export type StartSchritt = 'erlaubnis' | 'ordner' | 'app'

/**
 * @param zugriff Ergebnis der Android-Brücke: true/false, null = keine Brücke (PC, Browser)
 * @param ordner gewählter Datenordner oder null
 */
export function startSchritt(zugriff: boolean | null, ordner: string | null): StartSchritt {
  // auch bei schon gewähltem Ordner: Wer den Zugriff später entzieht, bekommt die Erklärung statt Lesefehlern
  if (zugriff === false) return 'erlaubnis'
  return ordner ? 'app' : 'ordner'
}
