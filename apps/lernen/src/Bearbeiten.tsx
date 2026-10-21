import { useEffect, useMemo, useRef, useState } from 'react'
import { ankerParameter, pfade, type Eintrag } from '@rvx/kern'
import { Editor, ausschnitt, bildMitTinte, geheZu, tintenStand, useDaten, type DarstellungHilfen } from '@rvx/oberflaeche'
import { WISSEN, aendereEintrag } from './wissen'

/** Was der Editor in der Lern-App darstellt: Ausschnitte aus dem Skript, Bilder, Links auf anderes Wissen */
function useHilfen(): DarstellungHilfen {
  const { speicher, bestand } = useDaten()
  const ref = useRef(bestand)
  ref.current = bestand
  return useMemo<DarstellungHilfen>(
    () => ({
      async ausschnitt(anhangId, seite, markeId) {
        const b = ref.current
        const datei = b.dokumente.get(anhangId)?.felder.datei
        const m = b.marken(pfade.marken('lernen', anhangId)).find((x) => x.id === markeId)
        if (typeof datei !== 'string' || !m) return null
        return ausschnitt(speicher, datei, seite, m.bereich)
      },
      bild: (id) => bildMitTinte(speicher, ref.current, 'lernen', id),
      bildStand: (id) => tintenStand(speicher, 'lernen', id),
      wissen(id) {
        const e = ref.current.dokumente.get(id)
        if (!e || !WISSEN.includes(e.typ)) return null
        return {
          titel: e.titel,
          text: e.rumpf
            .replace(/!?\[\[[^\]]*\]\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 220)
        }
      },
      titel: (id) => ref.current.dokumente.get(id)?.titel ?? null,
      oeffne(l) {
        const p = ankerParameter(l.anker)
        if (p.marke) geheZu('sammeln', l.ziel, Number(p.seite) || 1)
        else geheZu('nutzen', l.ziel)
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speicher, bestand]
  )
}

/**
 * Eintrag bearbeiten: Titel und Text als Markdown, wird nebenbei gespeichert. Löschen gibt es nicht,
 * Wissen wird nur aktualisiert. Lernkarten: `?? Frage` und darunter `:: Antwort`.
 */
export function Bearbeiten({ e, onFertig }: { e: Eintrag; onFertig: () => void }) {
  const { speicher, bestand } = useDaten()
  const hilfen = useHilfen()
  // Aktueller Stand aus dem Bestand, damit nach dem Speichern nichts Altes zurückgeschrieben wird
  const aktuell = bestand.dokumente.get(e.id) ?? e
  const [titel, setTitel] = useState(aktuell.titel)
  const offen = useRef<{ titel?: string; rumpf?: string }>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef(aktuell)
  ref.current = aktuell

  const sichern = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const neu = offen.current
    offen.current = {}
    if (neu.titel !== undefined || neu.rumpf !== undefined) void aendereEintrag(speicher, ref.current, neu)
  }
  const spaeter = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(sichern, 700)
  }
  // Beim Schließen sofort sichern, was noch aussteht
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => sichern(), [])

  return (
    <div className="bearbeiten">
      <input
        className="titel-eingabe"
        aria-label="Titel"
        value={titel}
        onChange={(ev) => {
          setTitel(ev.target.value)
          offen.current.titel = ev.target.value
          spaeter()
        }}
      />
      <div className="bearbeiten-text">
        <Editor
          wert={aktuell.rumpf}
          onAenderung={(text) => {
            offen.current.rumpf = text
            spaeter()
          }}
          hilfen={hilfen}
          autofokus
          platzhalter="In eigenen Worten …"
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="klein-leise">
          Lernkarte: <code>?? Frage</code>, darunter <code>:: Antwort</code>. Formeln in <code>$$ … $$</code>. Wird automatisch gespeichert.
        </span>
        <button
          type="button"
          className="knopf haupt klein"
          onClick={() => {
            sichern()
            onFertig()
          }}
        >
          Fertig
        </button>
      </div>
    </div>
  )
}
