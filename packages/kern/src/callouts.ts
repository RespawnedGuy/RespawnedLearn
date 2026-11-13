// Callout-Typen (`> [!note]`, wie in Obsidian) in deutschen Worten. Die Datei behält den Typ, nur die Anzeige übersetzt.

const NAMEN: Record<string, string> = {
  note: 'Hinweis',
  info: 'Info',
  tip: 'Tipp',
  hint: 'Tipp',
  important: 'Wichtig',
  warning: 'Achtung',
  caution: 'Vorsicht',
  attention: 'Achtung',
  danger: 'Gefahr',
  error: 'Fehler',
  bug: 'Fehler',
  failure: 'Fehlgeschlagen',
  fail: 'Fehlgeschlagen',
  missing: 'Fehlt',
  success: 'Erledigt',
  check: 'Erledigt',
  done: 'Erledigt',
  question: 'Frage',
  help: 'Frage',
  faq: 'Frage',
  example: 'Beispiel',
  quote: 'Zitat',
  cite: 'Zitat',
  abstract: 'Zusammenfassung',
  summary: 'Zusammenfassung',
  tldr: 'Zusammenfassung',
  todo: 'Aufgabe'
}

/** Anzeigename eines Callout-Typs; eigene Typen (z. B. `erklaerung`, `transkript`) mit großem Anfangsbuchstaben */
export function calloutName(typ: string): string {
  const t = typ.toLowerCase()
  return NAMEN[t] ?? (t ? t[0].toUpperCase() + t.slice(1) : t)
}
