// Vertragsmarke im Datenordner (Vertrag Lernen 1.6, 8): Die App trägt ihre Vertragsversion in `lernen/vertrag.json` ein,
// nur nach oben. Hat ein anderes Gerät mit neuerer App den Ordner schon auf einen neueren Vertrag gehoben, warnt sie,
// statt mit dem alten Verständnis der Dateien weiterzuarbeiten (PC aktualisiert, Handy noch nicht).
import { useEffect, useState } from 'react'
import { VERTRAG_PFAD, vertragsSchritt } from '@rl/kern'
import type { Speicher } from '@rl/oberflaeche'

/** Liefert die gefundene neuere Vertragsversion oder null; prüft bei jeder Änderung im Ordner neu */
export function useNeuererVertrag(speicher: Speicher): string | null {
  const [neuer, setNeuer] = useState<string | null>(null)
  useEffect(() => {
    const pruefe = () => {
      const s = vertragsSchritt(speicher.text(VERTRAG_PFAD))
      if (s.art === 'schreiben') void speicher.schreibe(VERTRAG_PFAD, s.text)
      setNeuer(s.art === 'neuer' ? s.gefunden : null)
    }
    pruefe()
    return speicher.abonniere(pruefe)
  }, [speicher])
  return neuer
}
