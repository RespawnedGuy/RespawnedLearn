import { Kopf, geheZu, ortLink, useDaten, useOrt, type MenueGruppe } from '@rvx/oberflaeche'
import { Sammeln } from './Sammeln'
import { Lernen } from './Lernen'
import { Nutzen } from './Nutzen'
import { lernziele, ordneLernziele } from '@rvx/kern'
import { faellige } from './wissen'
import { zielLink } from './Start'

const BEREICHE = [
  ['sammeln', 'Sammeln'],
  ['lernen', 'Lernen'],
  ['nutzen', 'Nutzen']
] as const

/** Lern-App: drei Bereiche. Sie kennt keine Projekte. */
export function App() {
  const ort = useOrt()
  const { bestand } = useDaten()
  const bereich = (ort[0] ?? 'sammeln') as (typeof BEREICHE)[number][0]
  const quelle = bereich === 'sammeln' && ort[1] && ort[1] !== 'modul' ? bestand.dokumente.get(ort[1]) : undefined
  const ziele = lernziele(bestand)
  const modul = bereich === 'sammeln' && ort[1] === 'modul' ? ziele.find((z) => z.id === ort[2]) : undefined
  const reihe = ordneLernziele(ziele)
  const faellig = faellige(bestand).length

  const gruppen: MenueGruppe[] = [
    {
      titel: 'Bereiche',
      eintraege: BEREICHE.map(([id, titel]) => ({ titel, ziel: ortLink(id), aktiv: bereich === id, zahl: id === 'lernen' ? faellig : undefined }))
    },
    {
      titel: 'Module und Bücher',
      eintraege: [...reihe.favoriten, ...reihe.kuerzlich]
        .slice(0, 8)
        .map((z) => ({ titel: z.titel, ziel: zielLink(z), aktiv: modul?.id === z.id || (!!quelle && z.quellen.some((q) => q.id === quelle.id)) }))
    }
  ]

  return (
    <>
      <Kopf
        app="lernen"
        ort={quelle ? quelle.titel : modul ? modul.titel : BEREICHE.find(([id]) => id === bereich)?.[1] ?? 'Lernen'}
        gruppen={gruppen}
        mitte={
          <nav className="segmente" aria-label="Bereiche">
            {BEREICHE.map(([id, titel]) => (
              <button key={id} type="button" className={bereich === id ? 'aktiv' : ''} onClick={() => geheZu(id)}>
                {titel}
                {id === 'lernen' && faellig > 0 ? ` · ${faellig}` : ''}
              </button>
            ))}
          </nav>
        }
      />
      {bereich === 'lernen' ? <Lernen /> : bereich === 'nutzen' ? <Nutzen key={ort[1] ?? ''} id={ort[1]} /> : <Sammeln ort={ort} />}
    </>
  )
}
