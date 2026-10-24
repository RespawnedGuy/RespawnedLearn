import { Daumenleiste, Kopf, ortLink, useDaten, useOrt, type LeistenZiel } from '@rvx/oberflaeche'
import { Sammeln } from './Sammeln'
import { Lernen } from './Lernen'
import { Nutzen } from './Nutzen'
import { lernziele, modulVon } from '@rvx/kern'
import { faellige } from './wissen'

/** Lern-App: drei Bereiche. Sie kennt keine Projekte. */
export function App() {
  const ort = useOrt()
  const { bestand } = useDaten()
  const bereich = ort[0] ?? 'sammeln'
  const quelle = bereich === 'sammeln' && ort[1] && ort[1] !== 'modul' ? bestand.dokumente.get(ort[1]) : undefined
  const modul = bereich === 'sammeln' && ort[1] === 'modul' ? lernziele(bestand).find((z) => z.id === ort[2]) : undefined
  const faellig = faellige(bestand).length

  // Feste Ziele wie in Arbeit: am PC als Reiter oben, am Handy in der Daumenleiste. Vorfragen und Kapitelfragen
  // kündigen sich als Hinweis über der Lernrunde an, Module und Bücher stehen auf der Startseite unter Sammeln.
  const ziele: LeistenZiel[] = [
    { titel: 'Sammeln', symbol: 'sammeln', ziel: ortLink('sammeln'), aktiv: bereich === 'sammeln' },
    { titel: 'Lernen', symbol: 'lernen', ziel: ortLink('lernen'), aktiv: bereich === 'lernen', zahl: faellig },
    { titel: 'Nutzen', symbol: 'nutzen', ziel: ortLink('nutzen'), aktiv: bereich === 'nutzen' }
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
      <Kopf app="lernen" oben={oben} ort={quelle ? quelle.titel : modul ? modul.titel : ziele.find((z) => z.aktiv)?.titel ?? 'Lernen'} ziele={ziele} />
      {bereich === 'lernen' ? <Lernen key={ort[1] ?? ''} ansicht={ort[1]} /> : bereich === 'nutzen' ? <Nutzen key={ort[1] ?? ''} id={ort[1]} /> : <Sammeln ort={ort} />}
      <Daumenleiste ziele={ziele} />
    </>
  )
}
