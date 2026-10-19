import { Kopf, geheZu, ortLink, useDaten, useOrt, type MenueGruppe } from '@rvx/oberflaeche'
import { Sammeln } from './Sammeln'
import { Lernen } from './Lernen'
import { Nutzen } from './Nutzen'
import { faellige, quellenPdfs } from './wissen'

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
  const quelle = bereich === 'sammeln' && ort[1] ? bestand.dokumente.get(ort[1]) : undefined
  const faellig = faellige(bestand).length

  const gruppen: MenueGruppe[] = [
    {
      titel: 'Bereiche',
      eintraege: BEREICHE.map(([id, titel]) => ({ titel, ziel: ortLink(id), aktiv: bereich === id, zahl: id === 'lernen' ? faellig : undefined }))
    },
    {
      titel: 'Quellen',
      eintraege: quellenPdfs(bestand)
        .slice(0, 8)
        .map((q) => ({ titel: q.titel, ziel: ortLink('sammeln', q.id, 1), aktiv: quelle?.id === q.id }))
    },
    { titel: 'Mehr', eintraege: [{ titel: 'Arbeit', ziel: '/' }] }
  ]

  return (
    <>
      <Kopf
        app="lernen"
        ort={quelle ? quelle.titel : BEREICHE.find(([id]) => id === bereich)?.[1] ?? 'Lernen'}
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
      {bereich === 'lernen' ? <Lernen /> : bereich === 'nutzen' ? <Nutzen key={ort[1] ?? ''} id={ort[1]} /> : <Sammeln quelleId={ort[1]} seite={ort[2] ? Number(ort[2]) : undefined} />}
    </>
  )
}
