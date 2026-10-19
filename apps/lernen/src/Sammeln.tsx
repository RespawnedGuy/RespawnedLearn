import { useRef, useState } from 'react'
import { liesMarken, pfade, type Bereich, type Eintrag, type Farbe } from '@rvx/kern'
import { PdfAnsicht, TintenEbene, Werkzeugleiste, geheZu, neuerAnhang, ortLink, useDaten, type Werkzeug } from '@rvx/oberflaeche'
import { karteAusStelle, quellenPdfs, WISSEN } from './wissen'

const FARBE_MARKE: Partial<Record<Farbe, string>> = { wichtig: 'wichtig', ergaenzung: 'ergaenzung' }

function liesSeite(schluessel: string): boolean {
  try {
    return localStorage.getItem(schluessel) === '1'
  } catch {
    return false
  }
}

/** Sammeln: Quellen wählen. Mit Quelle: Skript und leeres Blatt nebeneinander. */
export function Sammeln({ quelleId, seite }: { quelleId?: string; seite?: number }) {
  const { bestand } = useDaten()
  const quelle = quelleId ? bestand.dokumente.get(quelleId) : undefined
  if (quelle) return <Uebungsplatz quelle={quelle} seite={seite ?? 1} />
  return <QuellenListe />
}

function QuellenListe() {
  const { speicher, bestand } = useDaten()
  const eingabe = useRef<HTMLInputElement>(null)
  const liste = quellenPdfs(bestand)
  return (
    <div className="seite">
      <div className="seite-kopf">
        <h1>Sammeln</h1>
        <span style={{ flex: 1 }} />
        <button type="button" className="knopf haupt" onClick={() => eingabe.current?.click()}>
          Skript hinzufügen
        </button>
        <input
          ref={eingabe}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={async (e) => {
            for (const f of Array.from(e.target.files ?? [])) await neuerAnhang(speicher, f, [['art', 'skript']])
            e.target.value = ''
          }}
        />
      </div>
      <p className="klein-leise" style={{ marginTop: 0 }}>
        Du liest und schreibst selbst heraus, was wichtig ist. Das Herausarbeiten ist das Lernen.
      </p>
      <div className="raster">
        {liste.map((q) => {
          const n = liesMarken(bestand.texte.get(pfade.marken('lernen', q.id)) ?? '').length
          return (
            <a key={q.id} className="karte projekt-karte" href={ortLink('sammeln', q.id, 1)}>
              <span className="titel">{q.titel}</span>
              <span className="klein-leise">{n ? `${n} Stellen herausgearbeitet` : 'noch unberührt'}</span>
            </a>
          )
        })}
      </div>
      {!liste.length && <div className="leer">Noch keine Skripte. Füge ein PDF hinzu.</div>}
    </div>
  )
}

function Uebungsplatz({ quelle, seite }: { quelle: Eintrag; seite: number }) {
  const { speicher, bestand } = useDaten()
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('stift')
  const [farbe, setFarbe] = useState<Farbe>('alltag')
  const [getauscht, setGetauscht] = useState(() => liesSeite('rvx-lernen-blatt-links'))
  const [seiten, setSeiten] = useState(0)
  const [auswahl, setAuswahl] = useState<{ bereich: Bereich; punkt: { x: number; y: number } } | null>(null)
  const [modus, setModus] = useState<'wahl' | 'wissen' | 'frage' | 'link'>('wahl')
  const [titel, setTitel] = useState('')
  const marken = liesMarken(bestand.texte.get(pfade.marken('lernen', quelle.id)) ?? '')

  const tauschen = () => {
    setGetauscht(!getauscht)
    try {
      localStorage.setItem('rvx-lernen-blatt-links', getauscht ? '0' : '1')
    } catch {
      /* nur für diese Sitzung */
    }
  }

  const fertig = async (art: 'wissen' | 'frage' | 'link', ziel?: Eintrag) => {
    if (!auswahl) return
    await karteAusStelle(speicher, { quelle, seite, bereich: auswahl.bereich, art, titel: titel.trim() || (art === 'frage' ? 'Was steht hier?' : 'Stelle'), ziel, farbe: FARBE_MARKE[farbe] ?? null })
    setAuswahl(null)
    setTitel('')
    setModus('wahl')
  }

  const skript = (
    <section className="platz-skript" aria-label="Skript">
      <PdfAnsicht
        app="lernen"
        anhangId={quelle.id}
        pfad={String(quelle.felder.datei ?? '')}
        marken={marken.filter((m) => m.seite === seite)}
        werkzeug={werkzeug}
        farbe={farbe}
        nurSeite={seite}
        onSeiten={setSeiten}
        onMarke={(m) => {
          const z = /\[\[([^\]|]+)/.exec(m.text)?.[1]
          if (z) geheZu('nutzen', z)
        }}
        onRechteck={(_, bereich, punkt) => {
          setAuswahl({ bereich, punkt })
          setModus('wahl')
        }}
        zusatz={() =>
          auswahl && (
            <>
              <div className="auswahl" style={{ left: `${auswahl.bereich.x * 100}%`, top: `${auswahl.bereich.y * 100}%`, width: `${auswahl.bereich.b * 100}%`, height: `${auswahl.bereich.h * 100}%` }} />
              <div className="schwebe" style={{ left: Math.max(8, auswahl.punkt.x - 150), top: auswahl.punkt.y + 12 }}>
                {modus === 'wahl' && (
                  <div className="reihe">
                    <button type="button" className="knopf haupt klein" onClick={() => setModus('wissen')}>
                      Wissenskarte
                    </button>
                    <button type="button" className="knopf klein" onClick={() => setModus('link')}>
                      Verlinken
                    </button>
                    <button type="button" className="knopf klein" onClick={() => setModus('frage')}>
                      Lernkarte
                    </button>
                    <button type="button" className="knopf still klein" onClick={() => setAuswahl(null)}>
                      ×
                    </button>
                  </div>
                )}
                {(modus === 'wissen' || modus === 'frage') && (
                  <>
                    <input
                      className="eingabe"
                      autoFocus
                      placeholder={modus === 'wissen' ? 'Begriff (z. B. Spannung)' : 'Frage (die Stelle ist die Antwort)'}
                      value={titel}
                      onChange={(e) => setTitel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void fertig(modus)
                        if (e.key === 'Escape') setAuswahl(null)
                      }}
                    />
                    <div className="reihe">
                      <button type="button" className="knopf haupt klein" onClick={() => void fertig(modus)}>
                        Anlegen
                      </button>
                      <button type="button" className="knopf still klein" onClick={() => setModus('wahl')}>
                        Zurück
                      </button>
                    </div>
                  </>
                )}
                {modus === 'link' && <Verlinken onWahl={(e) => void fertig('link', e)} onZurueck={() => setModus('wahl')} />}
              </div>
            </>
          )
        }
      />
    </section>
  )
  const blatt = (
    <section className="platz-blatt" aria-label="Blatt">
      <div className="blatt-titel">Blatt · zu S. {seite}</div>
      <div className="blatt-flaeche pdf-seite zeichnen">
        <TintenEbene pfad={pfade.blatt(quelle.id, seite)} format={1.414} werkzeug={werkzeug === 'markieren' ? 'stift' : werkzeug} farbe={farbe} />
      </div>
    </section>
  )

  return (
    <div>
      <div className="plan-leiste">
        <a className="knopf still klein" href={ortLink('sammeln')}>
          ‹ Quellen
        </a>
        <strong>{quelle.titel}</strong>
        <span style={{ flex: 1 }} />
        <a className={`knopf klein symbol${seite <= 1 ? ' aus' : ''}`} href={ortLink('sammeln', quelle.id, Math.max(1, seite - 1))} aria-label="Seite zurück">
          ‹
        </a>
        <span className="klein-leise">
          S. {seite}
          {seiten ? ` / ${seiten}` : ''}
        </span>
        <a className="knopf klein symbol" href={ortLink('sammeln', quelle.id, seiten ? Math.min(seiten, seite + 1) : seite + 1)} aria-label="Seite vor">
          ›
        </a>
        <button type="button" className="knopf klein" onClick={tauschen}>
          Blatt {getauscht ? 'rechts' : 'links'} ⇄
        </button>
      </div>
      <div className={`uebungsplatz${getauscht ? ' getauscht' : ''}`}>
        {skript}
        {blatt}
      </div>
      <Werkzeugleiste werkzeug={werkzeug} farbe={farbe} onWerkzeug={setWerkzeug} onFarbe={setFarbe} />
    </div>
  )
}

function Verlinken({ onWahl, onZurueck }: { onWahl: (e: Eintrag) => void; onZurueck: () => void }) {
  const { bestand } = useDaten()
  const [q, setQ] = useState('')
  const treffer = bestand
    .nachTyp(...WISSEN)
    .filter((e) => e.typ !== 'frage' && e.titel.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6)
  return (
    <>
      <input className="eingabe" autoFocus placeholder="Mit welcher Karte verbinden?" value={q} onChange={(e) => setQ(e.target.value)} />
      {treffer.map((e) => (
        <button key={e.id} type="button" className="knopf klein" style={{ justifyContent: 'flex-start' }} onClick={() => onWahl(e)}>
          {e.titel}
        </button>
      ))}
      <button type="button" className="knopf still klein" onClick={onZurueck}>
        Zurück
      </button>
    </>
  )
}
