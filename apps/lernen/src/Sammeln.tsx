import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import { liesMarken, modulVon, pfade, type Bereich, type Eintrag, type Farbe } from '@rvx/kern'
import { PdfAnsicht, Werkzeugleiste, ausschnitt, ladePdf, ZurueckPfeil, geheZu, ortLink, useDaten, type Werkzeug } from '@rvx/oberflaeche'
import { karteAusStelle, korrigiereFrage, merkeLesestelle, WISSEN } from './wissen'
import { frageVorschlagen, korrigiere } from './ki'
import { Inhalt } from './Inhalt'
import { ModulSeite, Start } from './Start'
import { InhaltKnopf } from './Kapitel'
import { Mitschrift } from './Mitschrift'
import { ErklaerFenster } from './Erklaeren'
import { AnsichtKopf, Blatt, BlattMenue, Trenner, fotosAufBlatt, legeBildAufBlatt, useAnordnung } from './Blaetter'

const FARBE_MARKE: Partial<Record<Farbe, string>> = { wichtig: 'wichtig', ergaenzung: 'ergaenzung' }

/** Platz über und unter der Seite im Vollbild: Rand oben, Werkzeugleiste unten */
const VOLLBILD_RAND = 100

/** Sammeln: Startseite mit Modulen und Büchern. Mit Quelle: Skript und leeres Blatt nebeneinander. */
export function Sammeln({ ort }: { ort: string[] }) {
  const { bestand } = useDaten()
  if (ort[1] === 'modul' && ort[2]) return <ModulSeite key={ort[2]} id={ort[2]} />
  if (ort[1] === 'mitschrift' && ort[2]) return <Mitschrift key={ort[2]} id={ort[2]} anker={ort[3]} />
  const quelle = ort[1] ? bestand.dokumente.get(ort[1]) : undefined
  if (quelle) return <Uebungsplatz quelle={quelle} seite={ort[2] ? Number(ort[2]) || 1 : 1} />
  return <Start />
}

function Uebungsplatz({ quelle, seite }: { quelle: Eintrag; seite: number }) {
  const { speicher, bestand } = useDaten()
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('stift')
  const [farbe, setFarbe] = useState<Farbe>('alltag')
  const ansichten = useAnordnung(quelle.id)
  // Breiten während des Ziehens am Trenner, gespeichert erst beim Loslassen
  const [entwurf, setEntwurf] = useState<Record<string, number>>({})
  const [seiten, setSeiten] = useState(0)
  const [auswahl, setAuswahl] = useState<{ bereich: Bereich; punkt: { x: number; y: number } } | null>(null)
  const [modus, setModus] = useState<'wahl' | 'wissen' | 'frage' | 'link' | 'erklaeren'>('wahl')
  const [titel, setTitel] = useState('')
  // Vorschlag der KI für die Frage einer Lernkarte (null = noch keiner, '' = keiner zu haben)
  const [vorschlag, setVorschlag] = useState<string | null>(null)
  const [vollbild, setVollbild] = useState(false)
  const [hoehe, setHoehe] = useState(() => innerHeight)
  const marken = liesMarken(bestand.texte.get(pfade.marken('lernen', quelle.id)) ?? '')
  const modul = modulVon(bestand, quelle.id)

  // Skript ausgeblendet (z. B. Heft für ein Buch auf Papier): Seitenzahl trotzdem kennen, fürs Blättern
  const datei = String(quelle.felder.datei ?? '')
  const skriptZu = ansichten.anordnung.ansichten.some((v) => v.art === 'pdf' && v.zu)
  useEffect(() => {
    if (!skriptZu || !datei) return
    let weg = false
    void ladePdf(speicher, datei).then((d) => !weg && d && setSeiten(d.numPages))
    return () => {
      weg = true
    }
  }, [skriptZu, datei, speicher])

  // Stelle merken, damit die Startseite genau hier weitermacht
  useEffect(() => {
    void merkeLesestelle(speicher, quelle.id, seite)
  }, [speicher, quelle.id, seite])

  // Vollbild: Kopf und Leiste weg, die Seite passt ganz auf den Schirm
  useEffect(() => {
    if (!vollbild) return
    const groesse = () => setHoehe(innerHeight)
    const raus = () => !document.fullscreenElement && setVollbild(false)
    const tasten = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // ein offener Dialog (z. B. Inhalt) schließt mit Esc selbst
      if (document.querySelector('.dialog-huelle')) return
      if (e.key === 'Escape') setVollbild(false)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') geheZu('sammeln', quelle.id, Math.max(1, seite - 1))
      if (e.key === 'ArrowRight' || e.key === 'PageDown') geheZu('sammeln', quelle.id, seiten ? Math.min(seiten, seite + 1) : seite + 1)
    }
    document.body.classList.add('vollbild-an')
    addEventListener('resize', groesse)
    addEventListener('keydown', tasten)
    document.addEventListener('fullscreenchange', raus)
    groesse()
    return () => {
      document.body.classList.remove('vollbild-an')
      removeEventListener('resize', groesse)
      removeEventListener('keydown', tasten)
      document.removeEventListener('fullscreenchange', raus)
    }
  }, [vollbild, quelle.id, seite, seiten])

  const vollbildUmschalten = () => {
    if (vollbild) {
      setVollbild(false)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      return
    }
    setVollbild(true)
    // Wo der Browser echtes Vollbild kann, verschwinden auch seine Leisten; sonst reicht das Ausblenden des Kopfs
    void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  // Lernkarte: sobald die Frage gefragt ist, schlägt die KI eine vor (im Hintergrund, Tippen geht weiter)
  const bereich = auswahl?.bereich
  useEffect(() => {
    setVorschlag(null)
    if (modus !== 'frage' || !bereich) return
    const ab = new AbortController()
    void frageVorschlagen(speicher, quelle, seite, bereich, ab.signal).then((f) => !ab.signal.aborted && setVorschlag(f ?? ''))
    return () => ab.abort()
  }, [modus, bereich, speicher, quelle, seite])

  // Ausschnitt der Seite als Bild aufs Blatt, z. B. eine Aufgabe, um sie dort zu lösen (das PDF darf dann klein werden)
  const insBlatt = async () => {
    if (!auswahl) return
    const datei = String(quelle.felder.datei ?? '')
    const src = await ausschnitt(speicher, datei, seite, auswahl.bereich, 1400)
    if (!src) return
    await legeBildAufBlatt(speicher, { anhangId: quelle.id, seite, blatt: ansichten.zielBlatt() }, { anhang: quelle.id, seite, bereich: auswahl.bereich }, src)
    setAuswahl(null)
    setModus('wahl')
  }

  // Bild aus der Zwischenablage (Screenshot, Strg+V) aufs erste offene Blatt
  useEffect(() => {
    const einfuegen = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement | null)?.isContentEditable) return
      const bilder = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
      if (!bilder.length) return
      e.preventDefault()
      void fotosAufBlatt(speicher, { anhangId: quelle.id, seite, blatt: ansichten.zielBlatt() }, bilder)
    }
    addEventListener('paste', einfuegen)
    return () => removeEventListener('paste', einfuegen)
  })

  const fertig = async (art: 'wissen' | 'frage' | 'link', ziel?: Eintrag) => {
    if (!auswahl) return
    const eigen = titel.trim()
    const text = eigen || (art === 'frage' ? vorschlag || 'Was steht hier?' : 'Stelle')
    const id = await karteAusStelle(speicher, { quelle, seite, bereich: auswahl.bereich, art, titel: text, ziel, farbe: FARBE_MARKE[farbe] ?? null })
    // Selbst getippte Fragen: Schreibfehler nachträglich korrigieren, die Karte ist schon da
    if (art === 'frage' && eigen && eigen !== vorschlag) void korrigiere(eigen).then((neu) => {
        if (neu) void korrigiereFrage(speicher, id, eigen, neu)
      })
    setAuswahl(null)
    setTitel('')
    setModus('wahl')
  }

  const skript = (
      <PdfAnsicht
        app="lernen"
        anhangId={quelle.id}
        pfad={String(quelle.felder.datei ?? '')}
        marken={marken.filter((m) => m.seite === seite)}
        werkzeug={werkzeug}
        farbe={farbe}
        nurSeite={seite}
        maxHoehe={vollbild ? hoehe - VOLLBILD_RAND : undefined}
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
                    <button type="button" className="knopf klein" onClick={() => setModus('erklaeren')} title="Die KI erklärt die Stelle in einfachen Worten">
                      Erklären
                    </button>
                    <button type="button" className="knopf klein" onClick={() => void insBlatt()} title="Die Stelle als Bild aufs Blatt legen, um dort daran zu arbeiten">
                      Ins Blatt
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
                    {modus === 'frage' && vorschlag === null && <div className="klein-leise">KI sucht eine passende Frage …</div>}
                    {modus === 'frage' && vorschlag && vorschlag !== titel.trim() && (
                      <button type="button" className="ki-vorschlag" onClick={() => setTitel(vorschlag)} title="Vorschlag übernehmen">
                        <span className="klein-leise">Vorschlag (tippen zum Übernehmen)</span>
                        <Inhalt text={vorschlag} />
                      </button>
                    )}
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
  )
  const offen = ansichten.anordnung.ansichten.filter((v) => !v.zu)

  return (
    <div>
      <div className="plan-leiste">
        <strong className="plan-titel">{quelle.titel}</strong>
        <InhaltKnopf quelle={quelle} seite={seite} />
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
        <BlattMenue anordnung={ansichten.anordnung} onNeu={ansichten.neuesBlatt} onOeffne={ansichten.oeffne} />
        <button type="button" className="knopf klein" onClick={vollbildUmschalten} title="Kopf ausblenden, ganze Seite zeigen">
          ⤢ Vollbild
        </button>
      </div>
      <div className="uebungsplatz" style={vollbild ? ({ '--vollhoehe': `${hoehe - VOLLBILD_RAND}px` } as CSSProperties) : undefined}>
        {offen.map((v, i) => (
          <Fragment key={v.id}>
            {i > 0 && (
              <Trenner
                links={{ ...offen[i - 1], breite: entwurf[offen[i - 1].id] ?? offen[i - 1].breite }}
                rechts={{ ...v, breite: entwurf[v.id] ?? v.breite }}
                onZiehen={setEntwurf}
                onFertig={(b) => {
                  ansichten.breiten(b)
                  setEntwurf({})
                }}
              />
            )}
            <section className={`platz-ansicht ${v.art === 'pdf' ? 'platz-skript' : 'platz-blatt'}`} style={{ flexGrow: entwurf[v.id] ?? v.breite }} aria-label={v.art === 'pdf' ? 'Skript' : 'Blatt'}>
              <AnsichtKopf
                ansicht={v}
                name="Skript"
                erste={i === 0}
                letzte={i === offen.length - 1}
                allein={offen.length === 1}
                onLineatur={(l) => ansichten.lineatur(v.id, l)}
                onVerschiebe={(r) => ansichten.verschiebe(v.id, r)}
                onSchliesse={() => ansichten.schliesse(v.id)}
              />
              {v.art === 'pdf' ? skript : <Blatt anhangId={quelle.id} seite={seite} ansicht={v} werkzeug={werkzeug} farbe={farbe} />}
            </section>
          </Fragment>
        ))}
      </div>
      {vollbild && (
        <ZurueckPfeil
          schwebend
          oben={modul && modul.quellen.length > 1 ? ortLink('sammeln', 'modul', modul.id) : ortLink('sammeln')}
          vorher={() => {
            setVollbild(false)
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
          }}
        />
      )}
      {vollbild && (
        <div className="vollbild-steuer" role="toolbar" aria-label="Vollbild">
          <InhaltKnopf quelle={quelle} seite={seite} kompakt />
          <button type="button" disabled={seite <= 1} onClick={() => geheZu('sammeln', quelle.id, Math.max(1, seite - 1))} aria-label="Seite zurück">
            ‹
          </button>
          <span>
            S. {seite}
            {seiten ? ` / ${seiten}` : ''}
          </span>
          <button type="button" disabled={!!seiten && seite >= seiten} onClick={() => geheZu('sammeln', quelle.id, seiten ? Math.min(seiten, seite + 1) : seite + 1)} aria-label="Seite vor">
            ›
          </button>
          <button type="button" onClick={vollbildUmschalten} title="Vollbild beenden (Esc)" aria-label="Vollbild beenden">
            ✕
          </button>
        </div>
      )}
      {auswahl && modus === 'erklaeren' && (
        <ErklaerFenster
          quelle={quelle}
          seite={seite}
          bereich={auswahl.bereich}
          farbe={FARBE_MARKE[farbe] ?? null}
          onZu={(behalten) => {
            // ohne Behalten bleibt die Auswahl stehen, um daraus doch noch eine Karte zu machen
            if (behalten) setAuswahl(null)
            setModus('wahl')
          }}
        />
      )}
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
