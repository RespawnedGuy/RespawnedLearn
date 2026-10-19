// Lernkarten und Wiederholungsprotokoll der Lern-App.
// Abrufblöcke im Text: `?? Frage` und `:: Antwort` (Vertrag 4). Das Protokoll ist pro Gerät und Monat
// eine JSONL-Datei, an die nur angehängt wird (Vertrag 8), damit offline nie ein Konflikt entsteht.

export interface Abruf {
  frage: string
  antwort: string
}

/** Liest `?? Frage` / `:: Antwort` aus einem Rumpf. Die Antwort reicht bis zur nächsten Frage. */
export function liesAbrufe(rumpf: string): Abruf[] {
  const out: Abruf[] = []
  let akt: Abruf | null = null
  let inAntwort = false
  for (const z of rumpf.split('\n')) {
    if (z.startsWith('?? ')) {
      if (akt) out.push(akt)
      akt = { frage: z.slice(3).trim(), antwort: '' }
      inAntwort = false
    } else if (akt && z.startsWith(':: ')) {
      akt.antwort = z.slice(3).trim()
      inAntwort = true
    } else if (akt && inAntwort && z.trim() !== '') {
      akt.antwort += '\n' + z
    } else if (akt && inAntwort && z.trim() === '') {
      inAntwort = false
    }
  }
  if (akt) out.push(akt)
  return out
}

export type Note = 'nochmal' | 'schwer' | 'gut' | 'leicht'

export interface Wiederholung {
  karte: string
  am: string
  note: Note
  /** Einschätzung vor dem Aufdecken (Metakognition): unsicher | eher_sicher | sicher */
  sicher?: string
}

export function liesProtokoll(text: string): Wiederholung[] {
  const out: Wiederholung[] = []
  for (const z of text.split('\n')) {
    if (!z.trim()) continue
    try {
      const w = JSON.parse(z) as Wiederholung
      if (w.karte && w.am && w.note) out.push(w)
    } catch {
      // kaputte Zeile überspringen, nie löschen
    }
  }
  return out
}

export function protokollZeile(w: Wiederholung): string {
  return JSON.stringify(w) + '\n'
}
