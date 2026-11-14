import { useState } from 'react'
import { kurzDatum, notizOhneZiel, tag, type Eintrag } from '@rl/kern'
import { ortLink, useDaten } from '@rl/oberflaeche'
import { TYPNAME, WISSEN, alleEintraege, lernstaende, type Lernstand } from './wissen'

const OHNE = 'ohne-thema'

/** Lernstand in Worten: neu, fällig oder bis wann eine Karte sitzt */
export function standText(st: Lernstand | undefined): { text: string; art: '' | 'akzent' | 'rot' } {
  if (!st) return { text: 'neu', art: '' }
  const due = st.karte.dueAt
  if (due.getTime() <= Date.now()) return { text: 'fällig', art: 'rot' }
  return { text: `sitzt bis ${kurzDatum(tag(due))}`, art: 'akzent' }
}

/** Liste aller vorhandenen Einträge, mit Filter nach Art. Ein Klick öffnet den Eintrag in „Nutzen“. */
export function Eintraege({ nurLernkarten = false, eintraege }: { nurLernkarten?: boolean; eintraege?: Eintrag[] }) {
  const { bestand } = useDaten()
  const [typ, setTyp] = useState<string | null>(null)
  const alle = eintraege ?? alleEintraege(bestand)
  const st = lernstaende(bestand)
  const arten = WISSEN.filter((t) => alle.some((e) => e.typ === t))
  // Notizen ohne Thema (z. B. aus dem Journal verschoben) warten darauf, eingeordnet zu werden
  const ohneThema = alle.filter(notizOhneZiel).length
  const liste = typ === OHNE ? alle.filter(notizOhneZiel) : typ ? alle.filter((e) => e.typ === typ) : alle
  if (!alle.length) return <div className="leer">Noch keine Einträge. Markiere im Skript eine Stelle und mache daraus Wissen oder eine Lernkarte.</div>
  return (
    <div className="eintraege">
      {!nurLernkarten && (arten.length > 1 || ohneThema > 0) && (
        <div className="eintraege-filter" role="group" aria-label="Nach Art filtern">
          <button type="button" className={`knopf klein${typ === null ? ' haupt' : ''}`} onClick={() => setTyp(null)} aria-pressed={typ === null}>
            Alle · {alle.length}
          </button>
          {arten.map((t) => (
            <button key={t} type="button" className={`knopf klein${typ === t ? ' haupt' : ''}`} onClick={() => setTyp(t)} aria-pressed={typ === t}>
              {TYPNAME[t] ?? t} · {alle.filter((e) => e.typ === t).length}
            </button>
          ))}
          {ohneThema > 0 && (
            <button type="button" className={`knopf klein${typ === OHNE ? ' haupt' : ''}`} onClick={() => setTyp(OHNE)} aria-pressed={typ === OHNE}>
              Ohne Thema · {ohneThema}
            </button>
          )}
        </div>
      )}
      <div className="eintraege-liste karte">
        {liste.map((e) => {
          const s = st.has(e.id) || e.typ === 'frage' || nurLernkarten ? standText(st.get(e.id)) : null
          const geaendert = String(e.felder.geaendert ?? e.felder.erstellt ?? '').slice(0, 10)
          return (
            <a key={e.id} className="eintrag-zeile" href={ortLink('nutzen', e.id)}>
              <span className="eintrag-titel">{e.titel || 'Ohne Titel'}</span>
              {!nurLernkarten && <span className="chip">{TYPNAME[e.typ] ?? e.typ}</span>}
              {s && <span className={`chip${s.art ? ` ${s.art}` : ''}`}>{s.text}</span>}
              {geaendert && <span className="klein-leise eintrag-datum">{kurzDatum(geaendert)}</span>}
            </a>
          )
        })}
      </div>
    </div>
  )
}
