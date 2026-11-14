// Ein Notizbuch für sich, ohne Skript daneben (z. B. „Buch ohne PDF“ für ein Buch auf Papier, Vertrag Lernen 1.3)
import { useState } from 'react'
import { linkZiel, type Farbe } from '@rl/kern'
import { Werkzeugleiste, useDaten, type Werkzeug } from '@rl/oberflaeche'
import { AnsichtKopf } from './Blaetter'
import { BuchAnsicht, fotosInsBuch, lineaturVon, setzeBuchLineatur } from './Buch'
import { useLernzeit } from './lernzeitMessen'

export function BuchAlleinSeite({ id }: { id: string }) {
  const { speicher, bestand } = useDaten()
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('stift')
  const [farbe, setFarbe] = useState<Farbe>('alltag')
  const buch = bestand.dokumente.get(id)
  const modul = linkZiel(buch?.felder.modul)
  useLernzeit(modul ? { ziel: modul, art: 'sammeln' } : null)
  return (
    <div>
      <div className="plan-leiste">
        <h1 className="plan-titel">{buch?.titel ?? 'Notizbuch'}</h1>
        {modul && bestand.dokumente.get(modul) && bestand.dokumente.get(modul)!.titel !== buch?.titel && (
          <a className="knopf klein" href={`#/sammeln/modul/${encodeURIComponent(modul)}`}>
            {bestand.dokumente.get(modul)!.titel}
          </a>
        )}
      </div>
      <div className="buch-allein">
        <AnsichtKopf
          ansicht={{ art: 'buch', id, breite: 1 }}
          lineatur={lineaturVon(buch)}
          erste
          letzte
          allein
          onLineatur={(l) => void setzeBuchLineatur(speicher, id, l)}
          onVerschiebe={() => {}}
          onSchliesse={() => {}}
        />
        <BuchAnsicht id={id} werkzeug={werkzeug} farbe={farbe} />
      </div>
      <Werkzeugleiste werkzeug={werkzeug} farbe={farbe} onWerkzeug={setWerkzeug} onFarbe={setFarbe} onBilder={(d) => void fotosInsBuch(speicher, id, d)} />
    </div>
  )
}
