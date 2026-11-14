import { Fehlergrenze, Funktionsleiste, Kopf, Meldungen, geheZu, ortLink, Symbol, useDaten, useOrt, type KopfZiel } from '@rl/oberflaeche'
import { Sammeln } from './Sammeln'
import { Lernen } from './Lernen'
import { Nutzen } from './Nutzen'
import { Konflikte } from './Konflikte'
import { Einstellungen } from './Einstellungen'
import { linkZiel, lernziele, modulVon } from '@rl/kern'
import { lernFunktionen, mitschriftFunktionen, type LeistenFunktion } from './funktionen'
import { usePlus } from './plus'
import { faellige } from './wissen'
import { useEffect } from 'react'
import { verbindeOrdner } from './kianbieter/zugang'
import { AppHinweise } from './Aktualisierung'
import { useNeuererVertrag } from './vertragsmarke'
import { PomodoroChip } from './Pomodoro'

/** Lern-App: drei Bereiche. Sie kennt keine Projekte. */
export function App() {
  const ort = useOrt()
  const { bestand, speicher } = useDaten()
  // Gemeinsamer KI-Zugang im Datenordner: Änderungen von anderen Geräten gelten ohne Neustart
  useEffect(() => verbindeOrdner(speicher), [speicher])
  // Vertragsmarke im Datenordner (Lernen 1.6): warnt, wenn ein anderes Gerät eine neuere App hat
  const neuererVertrag = useNeuererVertrag(speicher)
  const bereich = ort[0] ?? 'sammeln'
  const quelle = bereich === 'sammeln' && ort[1] && ort[1] !== 'modul' && ort[1] !== 'mitschrift' ? bestand.dokumente.get(ort[1]) : undefined
  const mitschrift = bereich === 'sammeln' && ort[1] === 'mitschrift' && ort[2] ? bestand.dokumente.get(ort[2]) : undefined
  const mitschriftModul = mitschrift ? linkZiel(mitschrift.felder.thema) : null
  const plus = usePlus()
  const modul = bereich === 'sammeln' && ort[1] === 'modul' ? lernziele(bestand).find((z) => z.id === ort[2]) : undefined
  const faellig = faellige(bestand).length

  // Bereiche als Tabs oben, am Handy wie am PC (Stil „Linie“, Nils 13.11.). Vorfragen und Kapitelfragen kündigen
  // sich als Hinweis über der Lernrunde an, Module und Bücher stehen auf der Startseite unter Sammeln.
  const ziele: KopfZiel[] = [
    { titel: 'Sammeln', ziel: ortLink('sammeln'), aktiv: bereich === 'sammeln' },
    { titel: 'Lernen', ziel: ortLink('lernen'), aktiv: bereich === 'lernen', zahl: faellig },
    { titel: 'Nutzen', ziel: ortLink('nutzen'), aktiv: bereich === 'nutzen' }
  ]
  // Funktionsleiste unten (nur Handy): Skript und Buch bringen ihre Werkzeuge selbst mit, hier Lernen und Mitschrift
  const leiste: LeistenFunktion[] = bereich === 'lernen' ? lernFunktionen(ort) : mitschriftFunktionen(plus)
  const konflikte = speicher.konflikte().length + speicher.syncProbleme().length + (speicher.hinweis ? 1 : 0)

  // Eine Ebene höher, falls es keinen Verlauf gibt; die Startseite unter Sammeln ist ganz oben
  const buchModul = quelle ? modulVon(bestand, quelle.id) : undefined
  const oben =
    quelle ? (buchModul && buchModul.quellen.length > 1 ? ortLink('sammeln', 'modul', buchModul.id) : ortLink('sammeln'))
    : mitschrift ? (mitschriftModul ? ortLink('sammeln', 'modul', mitschriftModul) : ortLink('nutzen', mitschrift.id))
    : modul ? ortLink('sammeln')
    : bereich === 'lernen' && ort[1] === 'modul' && ort[2] ? ortLink('sammeln', 'modul', ort[2])
    : bereich === 'lernen' && ort[1] ? ortLink('lernen')
    : bereich === 'nutzen' && ort[1] ? ortLink('nutzen')
    : bereich === 'konflikte' || bereich === 'einstellungen' ? ortLink('sammeln')
    : bereich === 'sammeln' && !ort[1] ? null
    : ortLink('sammeln')

  return (
    <>
      <Kopf
        app="lernen"
        oben={oben}
        ort={quelle ? quelle.titel : mitschrift ? mitschrift.titel : modul ? modul.titel : bereich === 'konflikte' ? 'Konflikte' : bereich === 'einstellungen' ? 'Einstellungen' : ziele.find((z) => z.aktiv)?.titel ?? 'Lernen'}
        ziele={ziele}
        rechts={
          <>
          {/* Pomodoro (Nils 14.11.): beim Sammeln und Lernen, läuft er, auch in den anderen Bereichen */}
          <PomodoroChip zeigen={bereich === 'sammeln' || bereich === 'lernen'} />
          <a
            className={`kopf-zahnrad${bereich === 'einstellungen' ? ' aktiv' : ''}`}
            href={ortLink('einstellungen')}
            aria-label={konflikte ? `Einstellungen, ${konflikte} Konflikt${konflikte > 1 ? 'e' : ''}` : 'Einstellungen'}
            title="Einstellungen"
          >
            <Symbol name="zahnrad" groesse={20} />
            {/* Am Handy ist neben den Tabs kein Platz für den Konflikt-Text: roter Punkt, der Text steht in den Einstellungen */}
            {konflikte > 0 && <span className="zahnrad-punkt nur-schmal" aria-hidden="true" />}
          </a>
          </>
        }
      />
      {/* Stürzt eine Ansicht ab, bleiben Kopf und Leiste bedienbar */}
      <main id="inhalt">
      <AppHinweise neuererVertrag={neuererVertrag} inEinstellungen={bereich === 'einstellungen'} />
      <Fehlergrenze ort={ort.join('/')}>
        {bereich === 'konflikte' ? <Konflikte /> : bereich === 'einstellungen' ? <Einstellungen /> : bereich === 'lernen' ? <Lernen key={ort.slice(1).join('/')} ort={ort} /> : bereich === 'nutzen' ? <Nutzen key={ort[1] ?? ''} id={ort[1]} /> : <Sammeln ort={ort} />}
      </Fehlergrenze>
      </main>
      {leiste.length > 0 && (
        <Funktionsleiste
          name={bereich === 'lernen' ? 'Lernen' : 'Einfügen'}
          fokusBehalten={bereich !== 'lernen'}
          funktionen={leiste.map((f) => ({ ...f, tun: typeof f.ziel === 'function' ? f.ziel : () => geheZu(...(f.ziel as string).replace(/^#\//, '').split('/')) }))}
        />
      )}
      <Meldungen />
    </>
  )
}
