// Suche im Tafelwerk (Vertrag Lernen 1.14): über Bausteine (Name, Schlagworte, Quelle), eigene Markierungen und
// Textfelder aller Tabs. Ein Treffer springt in seinen Tab, an Seite und Höhe, die Stelle leuchtet kurz auf.
import { useMemo, useState } from 'react'
import { sucheImTafelwerk, type TafelTreffer } from '@rl/kern'
import { Symbol, useDaten } from '@rl/oberflaeche'
import { useBausteine } from './Bausteine'
import { Formeltext } from './Inhalt'

const ART: Record<TafelTreffer['art'], string> = { baustein: 'Baustein', markierung: 'Markierung', text: 'Textfeld' }

export function TafelSuche({ tabs, onSprung }: { tabs: { id: string; titel: string }[]; onSprung: (t: TafelTreffer) => void }) {
  const { bestand } = useDaten()
  const bausteine = useBausteine()
  const [anfrage, setAnfrage] = useState('')
  const treffer = useMemo(
    () => (anfrage.trim() ? sucheImTafelwerk(bestand.texte, tabs, bausteine, anfrage, (a) => bestand.dokumente.get(a)?.titel ?? '') : []),
    [anfrage, bestand, tabs, bausteine]
  )
  const tabName = (id: string) => tabs.find((t) => t.id === id)?.titel ?? 'Tab'
  return (
    <div className="tafel-suche" role="search">
      <label className="tafel-suche-feld">
        <Symbol name="lupe" groesse={16} />
        <input
          className="eingabe"
          type="search"
          enterKeyHint="search"
          placeholder="Im Tafelwerk suchen, z. B. Fluss oder #formel"
          aria-label="Im Tafelwerk suchen"
          value={anfrage}
          onChange={(e) => setAnfrage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAnfrage('')
            if (e.key === 'Enter' && treffer[0]) {
              e.preventDefault()
              onSprung(treffer[0])
              setAnfrage('')
            }
          }}
        />
      </label>
      {anfrage.trim() && (
        <div className="eintraege-liste karte tafel-treffer" aria-live="polite">
          {!treffer.length ? (
            <div className="leer klein-leise">Nichts gefunden.</div>
          ) : (
            treffer.slice(0, 30).map((t, i) => (
              <button
                key={`${t.tab}-${t.nr}-${t.y}-${i}`}
                type="button"
                className="eintrag-zeile"
                onClick={() => {
                  onSprung(t)
                  setAnfrage('')
                }}
              >
                <span className="eintrag-titel">
                  <Formeltext text={t.titel} />
                </span>
                <span className="klein-leise">
                  {ART[t.art]} · {tabName(t.tab)}, S. {t.nr}
                  {t.quelle ? ` · aus ${t.quelle}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
