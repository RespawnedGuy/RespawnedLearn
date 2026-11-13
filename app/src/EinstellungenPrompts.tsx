import { liesPromptAbweichungen, pfade, PROMPTS, setzePrompt, STANDARD_PROMPTS, type PromptSchluessel } from '@rl/kern'
import { useState } from 'react'
import { useDaten } from '@rl/oberflaeche'

/**
 * Einstellungen › Anweisungen an die KI: vorausgefüllt, änderbar, „Standard“ holt den Originaltext zurück. Die
 * Abweichungen liegen im Datenordner und gelten damit auf allen Geräten (Vertrag Lernen 1.1, 5.8). Das Antwortformat
 * ist nicht Teil der Anweisung; ein geänderter Text kann die Funktion also nicht zerlegen.
 */
export function EinstellungenPrompts() {
  const { speicher, bestand } = useDaten()
  const pfad = pfade.kiPrompts()
  const text = bestand.texte.get(pfad)
  const eigen = liesPromptAbweichungen(text)
  const setze = (k: PromptSchluessel, wert: string | null) => void speicher.aendere(pfad, (alt) => setzePrompt(alt || undefined, k, wert))

  return (
    <section className="einstellungen-teil">
      <h2>Anweisungen an die KI</h2>
      <p className="klein-leise">
        So geht die KI bei den einzelnen Aufgaben vor. Du kannst jede Anweisung anpassen, sie gilt dann auf allen deinen Geräten. Das Antwortformat legt
        die App fest, damit alles weiter funktioniert.
      </p>
      {PROMPTS.map((p) => {
        const geaendert = p.schluessel in eigen
        return (
          <details key={p.schluessel} className="prompt karte">
            <summary>
              <b>{p.titel}</b>
              {geaendert && <span className="chip akzent">eigene Fassung</span>}
              <span className="klein-leise prompt-wofuer">{p.wofuer}</span>
            </summary>
            <PromptFeld wert={eigen[p.schluessel] ?? STANDARD_PROMPTS[p.schluessel]} onAendern={(w) => setze(p.schluessel, w)} />
            <div className="anbieter-knoepfe">
              <button type="button" className="knopf klein" disabled={!geaendert} onClick={() => setze(p.schluessel, null)}>
                Standard
              </button>
              {!geaendert && <span className="klein-leise">Das ist der Standard der App.</span>}
            </div>
          </details>
        )
      })}
    </section>
  )
}

/** Getippt wird sofort gespeichert; ganz leer gilt erst beim Verlassen als „Standard“, damit man neu schreiben kann */
function PromptFeld({ wert, onAendern }: { wert: string; onAendern: (w: string | null) => void }) {
  const [entwurf, setEntwurf] = useState<string | null>(null)
  return (
    <textarea
      className="eingabe prompt-text"
      rows={12}
      value={entwurf ?? wert}
      onChange={(e) => {
        setEntwurf(e.target.value)
        if (e.target.value.trim()) onAendern(e.target.value)
      }}
      onBlur={() => {
        if (entwurf !== null && !entwurf.trim()) onAendern(null)
        setEntwurf(null)
      }}
      spellCheck
    />
  )
}
