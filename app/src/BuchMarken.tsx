// Markieren im eigenen Notizbuch (Vertrag Lernen 1.9, 5.4): Das Rechteck wird ein Baustein wie im Skript. Die Zeilen
// stehen in `lernen/markierungen/<buch-id>.md`, die Maße in Seitenbreiten, damit sie beim Wachsen der Seite stehen bleiben.
import { useState } from 'react'
import { ausSeitenbreiten, eingabeVon, inSeitenbreiten, kurzId, liesBausteinText, liesMarken, pfade, type Bereich, type Eintrag, type Farbe, type Marke } from '@rl/kern'
import { melde, useDaten, type Werkzeug } from '@rl/oberflaeche'
import { BausteinMenue, Verlinken, karteVon, schwebeLage } from './BausteinMenue'
import { karteAusStelle, setzeBereich } from './wissen'
import { MarkeRahmen } from './MarkeRahmen'

/** Gezogenes Rechteck (relativ zur jetzigen Seitenhöhe) oder eine angetippte Markierung */
export interface BuchAuswahl {
  bereich: Bereich
  punkt?: { x: number; y: number }
  marke?: Marke
}

const markenFarbe = (f: Farbe) => (f === 'wichtig' || f === 'ergaenzung' ? f : null)

export function BuchMarken({
  buch,
  nr,
  format,
  werkzeug,
  farbe,
  auswahl,
  onAuswahl
}: {
  buch: Eintrag
  nr: number
  format: number
  werkzeug: Werkzeug
  farbe: Farbe
  auswahl: BuchAuswahl | null
  onAuswahl: (a: BuchAuswahl | null) => void
}) {
  const { speicher, bestand } = useDaten()
  const marken = liesMarken(bestand.texte.get(pfade.marken('lernen', buch.id)) ?? '').filter((m) => m.seite === nr)
  // Beim Lesen öffnet Antippen die Markierung; in den anderen Werkzeugen wählt die Tinte sie über `markeAn` (Buch.tsx)
  const antippbar = werkzeug === 'lesen'
  const gewaehlt = auswahl?.marke
  return (
    <>
      {marken.map((m) => {
        const b = ausSeitenbreiten(m.bereich, format)
        const t = liesBausteinText(m.text)
        return (
          <button
            type="button"
            key={m.id}
            className={`marke ${m.farbe ?? ''}${gewaehlt?.id === m.id ? ' gewaehlt verschiebbar' : ''}`}
            title={t.name || t.verweise[0]?.titel || 'Baustein ohne Namen'}
            aria-label={`Baustein ${t.name || 'ohne Namen'}`}
            style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.b * 100}%`, height: `${b.h * 100}%`, pointerEvents: antippbar ? 'auto' : 'none' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              // der Stift wählt nie (Nils 2026-11-14)
              if ((e.nativeEvent as PointerEvent).pointerType !== 'pen') onAuswahl({ bereich: b, marke: m })
            }}
          />
        )
      })}
      {gewaehlt && (
        <MarkeRahmen
          bereich={auswahl.bereich}
          farbe={gewaehlt.farbe}
          onFertig={(neu) => {
            const inBreiten = inSeitenbreiten(neu, format)
            onAuswahl({ bereich: neu, marke: { ...gewaehlt, bereich: inBreiten } })
            void setzeBereich(speicher, buch.id, gewaehlt.id, inBreiten)
          }}
        />
      )}
      {auswahl && <Menue key={auswahl.marke?.id ?? `${auswahl.bereich.x}|${auswahl.bereich.y}`} buch={buch} nr={nr} format={format} farbe={farbe} auswahl={auswahl} onZu={() => onAuswahl(null)} speicher={speicher} />}
    </>
  )
}

function Menue({ buch, nr, format, farbe, auswahl, onZu, speicher }: { buch: Eintrag; nr: number; format: number; farbe: Farbe; auswahl: BuchAuswahl; onZu: () => void; speicher: ReturnType<typeof useDaten>['speicher'] }) {
  const alt = auswahl.marke
  const [name, setName] = useState(() => (alt ? eingabeVon(liesBausteinText(alt.text)) : ''))
  const [karte, setKarte] = useState<'frage' | 'wissen' | 'link' | null>(null)
  const [titel, setTitel] = useState('')
  const b = auswahl.bereich

  const fertig = async (art: 'nur' | 'frage' | 'wissen' | 'link', ziel?: Eintrag) => {
    const eigen = titel.trim()
    const text = eigen || (art === 'wissen' ? liesBausteinText(name).name || 'Stelle' : art === 'frage' ? 'Was steht hier?' : 'Stelle')
    onZu()
    // Unverändert wieder zugemacht: nichts schreiben
    if (art === 'nur' && alt && eingabeVon(liesBausteinText(alt.text)) === name.trim()) return
    await karteAusStelle(speicher, {
      quelle: buch,
      seite: nr,
      bereich: alt ? alt.bereich : inSeitenbreiten(b, format),
      art,
      titel: text,
      ziel,
      farbe: markenFarbe(farbe),
      markeId: alt?.id ?? kurzId(),
      name
    })
    if (art === 'nur') melde(name.trim() ? 'Baustein gemerkt' : 'Baustein gemerkt, der Name fehlt noch (Nutzen › Offen)')
    else if (art !== 'link') melde('Lernkarte angelegt')
  }

  return (
    <>
      {!alt && <div className="auswahl" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.b * 100}%`, height: `${b.h * 100}%` }} />}
      <div
        className="schwebe"
        style={schwebeLage(b, auswahl.punkt)}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {karte === null ? (
          <BausteinMenue
            name={name}
            onName={setName}
            onBaustein={() => void fertig('nur')}
            onLernkarte={() => setKarte('frage')}
            onAbbrechen={onZu}
            zurKarte={karteVon(alt)}
            bausteinTitel="Als Baustein merken: findet sich mit den Bausteinen aus allen Skripten wieder"
            mehr={
              <>
                <button type="button" className="knopf klein" onClick={() => setKarte('wissen')}>
                  Wissenskarte
                </button>
                <button type="button" className="knopf klein" onClick={() => setKarte('link')}>
                  Verlinken
                </button>
              </>
            }
          />
        ) : karte === 'link' ? (
          <Verlinken onWahl={(e) => void fertig('link', e)} onZurueck={() => setKarte(null)} />
        ) : (
          <>
            <input
              className="eingabe"
              autoFocus
              aria-label={karte === 'wissen' ? 'Begriff' : 'Frage'}
              placeholder={karte === 'wissen' ? 'Begriff (z. B. Spannung)' : 'Frage (die Stelle ist die Antwort)'}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fertig(karte)
                if (e.key === 'Escape') onZu()
              }}
            />
            <div className="reihe">
              <button type="button" className="knopf haupt klein" onClick={() => void fertig(karte)}>
                Anlegen
              </button>
              <button type="button" className="knopf still klein" onClick={() => setKarte(null)}>
                Zurück
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

