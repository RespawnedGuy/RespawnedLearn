// Platz einfügen auf einer Buchseite (Vertrag Lernen 1.14): an der angetippten Höhe nach unten ziehen, alles darunter
// rückt um die gezogene Strecke. Die Rechnung steht in kern/platz.ts; hier das Ziehen, Schreiben und Rückgängig.
import { useEffect, useRef, useState } from 'react'
import { A4, MM, SEITE_BREITE, fuegePlatzEin, pfade, tinteSvg } from '@rl/kern'
import { melde, type Speicher } from '@rl/oberflaeche'

/**
 * Rückt ab `ab` alles um `um` nach unten und schreibt nur die Dateien, die sich ändern. Rückgängig schreibt die alten
 * Texte byte-gleich zurück, aber nur, solange keine dieser Dateien seitdem weiter verändert wurde.
 */
export async function fuegePlatzEinMitMeldung(speicher: Speicher, id: string, nr: number, ab: number, um: number): Promise<number> {
  const orte = { tinte: pfade.buchTinte(id, nr), seite: pfade.buchSeite(id, nr), marken: pfade.marken('lernen', id) }
  const alt = { tinte: speicher.text(orte.tinte) ?? null, seite: speicher.text(orte.seite) ?? null, marken: speicher.text(orte.marken) ?? null }
  const neu = fuegePlatzEin({ ...alt, nr }, ab, um)
  if (!neu.gerueckt) {
    melde('Darunter steht nichts, das rücken könnte.')
    return 0
  }
  const geschrieben: { pfad: string; alt: string | null; neu: string }[] = []
  for (const k of ['tinte', 'seite', 'marken'] as const) {
    const t = neu[k]
    if (t === null) continue
    await speicher.schreibe(orte[k], t)
    geschrieben.push({ pfad: orte[k], alt: alt[k], neu: t })
  }
  melde(`${Math.round(um / MM)} mm Platz eingefügt`, () => {
    // ganz oder gar nicht: halb zurückgerückt passten Striche, Bilder und Markierungen nicht mehr zueinander
    if (geschrieben.some((g) => speicher.text(g.pfad) !== g.neu)) {
      melde('Rückgängig geht nicht mehr: Die Seite wurde inzwischen weiter bearbeitet.')
      return
    }
    // Neu entstehen kann nur die Tinte einer Seite ohne Striche; sie bleibt dann leer und A4 hoch (die App löscht nichts)
    for (const g of geschrieben) void speicher.schreibe(g.pfad, g.alt ?? tinteSvg([], SEITE_BREITE * A4))
  })
  return neu.gerueckt
}

/**
 * Über der Seite: eine Linie an der angetippten Höhe. Wer nach unten zieht, sieht die Lücke wachsen; Loslassen fügt
 * den Platz ein. Tippen ohne Ziehen oder Escape bricht ab.
 */
export function PlatzZiehen({ ab, hoehe, onFertig, onAbbruch }: { ab: number; hoehe: number; onFertig: (um: number) => void; onAbbruch: () => void }) {
  const [um, setUm] = useState(0)
  const zug = useRef<{ y: number; proPx: number; id: number } | null>(null)
  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && onAbbruch()
    addEventListener('keydown', taste)
    return () => removeEventListener('keydown', taste)
  }, [onAbbruch])
  const prozent = (y: number) => `${(y / hoehe) * 100}%`
  return (
    <div
      className="buch-platz"
      role="slider"
      aria-label="Platz einfügen: nach unten ziehen"
      aria-valuemin={0}
      aria-valuenow={Math.round(um / MM)}
      aria-valuetext={`${Math.round(um / MM)} mm`}
      tabIndex={-1}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        const w = e.currentTarget.getBoundingClientRect().width
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* dann ohne */
        }
        zug.current = { y: e.clientY, proPx: SEITE_BREITE / w, id: e.pointerId }
      }}
      onPointerMove={(e) => {
        const z = zug.current
        if (z && z.id === e.pointerId) setUm(Math.max(0, (e.clientY - z.y) * z.proPx))
      }}
      onPointerUp={() => {
        const z = zug.current
        zug.current = null
        if (z && um >= 2 * MM) onFertig(um)
        else onAbbruch()
      }}
      onPointerCancel={() => {
        zug.current = null
        setUm(0)
      }}
    >
      <div className="buch-platz-luecke" style={{ top: prozent(ab), height: prozent(um) }} />
      <div className="buch-platz-linie" style={{ top: prozent(ab) }}>
        <span className="buch-platz-hinweis">{um > 0 ? `${Math.round(um / MM)} mm` : 'Nach unten ziehen'}</span>
      </div>
    </div>
  )
}
