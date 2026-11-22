// Ein Notizbuch für sich, ohne Skript daneben (z. B. „Buch ohne PDF“ für ein Buch auf Papier, Vertrag Lernen 1.3)
import { useState } from 'react'
import { liesMarken, linkZiel, pfade, SEITE_BREITE, type Farbe } from '@rl/kern'
import { Werkzeugleiste, useDaten, type Werkzeug } from '@rl/oberflaeche'
import { AnsichtKopf } from './Blaetter'
import { BuchAnsicht, benenneNotizbuch, fotosInsBuch, lineaturVon, setzeBuchLineatur } from './Buch'
import { NameFeld } from './NameFeld'
import { useAblage } from './ablage'
import { fuegeEinPerKnopf } from './kopieren'
import { useLernzeit } from './lernzeitMessen'

export function BuchAlleinSeite({ id, seite = 0, marke }: { id: string; seite?: number; marke?: string }) {
  const { speicher, bestand } = useDaten()
  // Sprung an eine Seite, bei einem Baustein an die Höhe der Markierung (in Seitenbreiten, Lernen 1.9)
  const [sprung] = useState(() => {
    if (!seite) return null
    const m = marke ? liesMarken(bestand.texte.get(pfade.marken('lernen', id)) ?? '').find((x) => x.id === marke) : undefined
    return { nr: seite, y: m ? m.bereich.y * SEITE_BREITE : 0, mal: 1 }
  })
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('stift')
  const [farbe, setFarbe] = useState<Farbe>('alltag')
  const kopie = useAblage()
  const buch = bestand.dokumente.get(id)
  const modul = linkZiel(buch?.felder.modul)
  useLernzeit(modul ? { ziel: modul, art: 'sammeln' } : null)
  return (
    <div>
      <div className="plan-leiste">
        <h1 className="plan-titel">
          <NameFeld name={buch?.titel ?? 'Notizbuch'} art="Notizbuch" onName={(n) => void benenneNotizbuch(speicher, id, n)} />
        </h1>
        {modul && bestand.dokumente.get(modul) && bestand.dokumente.get(modul)!.titel !== buch?.titel && (
          <a className="knopf klein" href={`#/sammeln/modul/${encodeURIComponent(modul)}`}>
            {bestand.dokumente.get(modul)!.titel}
          </a>
        )}
        <span className="plan-luecke" />
        <Werkzeugleiste
          werkzeug={werkzeug}
          farbe={farbe}
          onWerkzeug={setWerkzeug}
          onFarbe={setFarbe}
          onBilder={(d) => void fotosInsBuch(speicher, id, d)}
          onEinfuegen={kopie ? () => void fuegeEinPerKnopf(speicher, [id], kopie) : undefined}
        />
        <span className="plan-luecke" />
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
        <BuchAnsicht id={id} werkzeug={werkzeug} farbe={farbe} sprung={sprung} />
      </div>
    </div>
  )
}
