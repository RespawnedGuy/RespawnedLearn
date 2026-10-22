import { Kopf, geheZu, ortLink, useDaten, useOrt, type MenueGruppe } from '@rvx/oberflaeche'
import { Sammeln } from './Sammeln'
import { Lernen } from './Lernen'
import { Nutzen } from './Nutzen'
import { lesestand, lernziele, modulVon, offeneFragen, ordneLernziele } from '@rvx/kern'
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
  const fragen = offeneFragen(bestand, lesestand(bestand)).length

  const gruppen: MenueGruppe[] = [
    {
      titel: 'Bereiche',
      eintraege: [
        ...BEREICHE.map(([id, titel]) => ({ titel, ziel: ortLink(id), aktiv: bereich === id && ort[1] !== 'fragen' && ort[1] !== 'vorfragen', zahl: id === 'lernen' ? faellig : undefined })),
        { titel: 'Vorfragen', ziel: ortLink('lernen', 'vorfragen'), aktiv: bereich === 'lernen' && ort[1] === 'vorfragen' },
        ...(fragen ? [{ titel: 'Fragen zum Kapitel', ziel: ortLink('lernen', 'fragen'), aktiv: bereich === 'lernen' && ort[1] === 'fragen', zahl: fragen }] : [])
      ]
    },
    {
      titel: 'Module und Bücher',
      eintraege: [...reihe.favoriten, ...reihe.kuerzlich]
        .slice(0, 8)
        .map((z) => ({ titel: z.titel, ziel: zielLink(z), aktiv: modul?.id === z.id || (!!quelle && z.quellen.some((q) => q.id === quelle.id)) }))
    }
  ]

  // Eine Ebene höher, falls es keinen Verlauf gibt; die Startseite unter Sammeln ist ganz oben
  const buchModul = quelle ? modulVon(bestand, quelle.id) : undefined
  const oben =
    quelle ? (buchModul && buchModul.quellen.length > 1 ? ortLink('sammeln', 'modul', buchModul.id) : ortLink('sammeln'))
    : modul ? ortLink('sammeln')
    : bereich === 'lernen' && ort[1] ? ortLink('lernen')
    : bereich === 'nutzen' && ort[1] ? ortLink('nutzen')
    : bereich === 'sammeln' && !ort[1] ? null
    : ortLink('sammeln')

  return (
    <>
      <Kopf
        app="lernen"
        oben={oben}
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
      {bereich === 'lernen' ? <Lernen key={ort[1] ?? ''} ansicht={ort[1]} /> : bereich === 'nutzen' ? <Nutzen key={ort[1] ?? ''} id={ort[1]} /> : <Sammeln ort={ort} />}
    </>
  )
}
