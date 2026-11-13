import { Daumenleiste, Fehlergrenze, Kopf, Meldungen, ortLink, useDaten, useOrt, type LeistenZiel } from '@rl/oberflaeche'
import { Sammeln } from './Sammeln'
import { Lernen } from './Lernen'
import { Nutzen } from './Nutzen'
import { Konflikte } from './Konflikte'
import { linkZiel, lernziele, modulVon } from '@rl/kern'
import { PlusKnopf, useTastaturOffen } from './PlusKnopf'
import { usePlus } from './plus'
import { faellige } from './wissen'

/** Lern-App: drei Bereiche. Sie kennt keine Projekte. */
export function App() {
  const ort = useOrt()
  const { bestand } = useDaten()
  const bereich = ort[0] ?? 'sammeln'
  const quelle = bereich === 'sammeln' && ort[1] && ort[1] !== 'modul' && ort[1] !== 'mitschrift' ? bestand.dokumente.get(ort[1]) : undefined
  const mitschrift = bereich === 'sammeln' && ort[1] === 'mitschrift' && ort[2] ? bestand.dokumente.get(ort[2]) : undefined
  const mitschriftModul = mitschrift ? linkZiel(mitschrift.felder.thema) : null
  const plus = usePlus()
  const tastatur = useTastaturOffen()
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
    : mitschrift ? (mitschriftModul ? ortLink('sammeln', 'modul', mitschriftModul) : ortLink('nutzen', mitschrift.id))
    : modul ? ortLink('sammeln')
    : bereich === 'lernen' && ort[1] === 'modul' && ort[2] ? ortLink('sammeln', 'modul', ort[2])
    : bereich === 'lernen' && ort[1] ? ortLink('lernen')
    : bereich === 'nutzen' && ort[1] ? ortLink('nutzen')
    : bereich === 'konflikte' ? ortLink('sammeln')
    : bereich === 'sammeln' && !ort[1] ? null
    : ortLink('sammeln')

  return (
    <>
      <Kopf app="lernen" oben={oben} ort={quelle ? quelle.titel : mitschrift ? mitschrift.titel : modul ? modul.titel : bereich === 'konflikte' ? 'Konflikte' : ziele.find((z) => z.aktiv)?.titel ?? 'Lernen'} ziele={ziele} />
      {/* Stürzt eine Ansicht ab, bleiben Kopf und Leiste bedienbar */}
      <Fehlergrenze ort={ort.join('/')}>
        {bereich === 'konflikte' ? <Konflikte /> : bereich === 'lernen' ? <Lernen key={ort.slice(1).join('/')} ort={ort} /> : bereich === 'nutzen' ? <Nutzen key={ort[1] ?? ''} id={ort[1]} /> : <Sammeln ort={ort} />}
      </Fehlergrenze>
      <Daumenleiste ziele={ziele} mitte={plus ? <PlusKnopf ziel={plus} /> : undefined} nurMitte={!!plus && tastatur} />
      <Meldungen />
    </>
  )
}
