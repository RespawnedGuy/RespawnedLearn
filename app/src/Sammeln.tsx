import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { liesMarken, lineaturName, modulVon, naechsteSeite, pfade, type Bereich, type Eintrag, type Farbe } from '@rl/kern'
import { PdfAnsicht, Werkzeugleiste, ausschnitt, ladePdf, ZurueckPfeil, ersetzeOrt, geheZu, mitFinger, ortLink, useDaten, type Werkzeug } from '@rl/oberflaeche'
import { karteAusStelle, korrigiereFrage, merkeLesestelle, WISSEN } from './wissen'
import { frageVorschlagen, korrigiere } from './ki'
import { Inhalt } from './Inhalt'
import { ModulSeite, Start } from './Start'
import { InhaltKnopf } from './Kapitel'
import { Mitschrift } from './Mitschrift'
import { ErklaerFenster } from './Erklaeren'
import { AnsichtKopf, Blatt, BildKnoepfe, BlattMenue, Trenner, fotosAufBlatt, legeBildAufBlatt, useAnordnung } from './Blaetter'

const FARBE_MARKE: Partial<Record<Farbe, string>> = { wichtig: 'wichtig', ergaenzung: 'ergaenzung' }

/** Ab hier stehen Skript und Blätter nebeneinander und scrollen je für sich (wie `@media (max-width: 900px)` in lernen.css) */
const BREIT = '(min-width: 901px)'

function useBreit(): boolean {
  const [breit, setBreit] = useState(() => matchMedia(BREIT).matches)
  useEffect(() => {
    const m = matchMedia(BREIT)
    const f = () => setBreit(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return breit
}

/** Sammeln: Startseite mit Modulen und Büchern. Mit Quelle: das Skript scrollt, Blätter stehen daneben. */
export function Sammeln({ ort }: { ort: string[] }) {
  const { bestand } = useDaten()
  if (ort[1] === 'modul' && ort[2]) return <ModulSeite key={ort[2]} id={ort[2]} />
  if (ort[1] === 'mitschrift' && ort[2]) return <Mitschrift key={ort[2]} id={ort[2]} anker={ort[3]} />
  const quelle = ort[1] ? bestand.dokumente.get(ort[1]) : undefined
  if (quelle) return <Uebungsplatz quelle={quelle} seite={ort[2] ? Number(ort[2]) || 1 : 1} />
  return <Start />
}

function Uebungsplatz({ quelle, seite: sprungSeite }: { quelle: Eintrag; seite: number }) {
  const { speicher, bestand } = useDaten()
  const breit = useBreit()
  // Die Seite in der Adresse ist ein Sprungziel (Lesestand, Inhalt, Link); beim Scrollen folgt `seite` der sichtbaren
  const [seite, setSeite] = useState(sprungSeite)
  const seiteRef = useRef(sprungSeite)
  const [sprung, setSprung] = useState({ seite: sprungSeite, mal: 0, sanft: false })
  const springe = (nr: number) => setSprung((s) => ({ seite: nr, mal: s.mal + 1, sanft: true }))
  const [skriptFlaeche, setSkriptFlaeche] = useState<HTMLElement | null>(null)
  const platz = useRef<HTMLDivElement>(null)
  // Am Handy steht immer nur eine Ansicht da (Nils 13.11.: dort wird kaum mitgeschrieben)
  const [handyWahl, setHandyWahl] = useState<string>('pdf')
  // Am Handy liest man eher (Nils 13.11.): mit „Lesen“ scrollt der Finger das Skript, statt zu schreiben
  const [werkzeug, setWerkzeug] = useState<Werkzeug>(() => (!matchMedia(BREIT).matches && mitFinger() ? 'lesen' : 'stift'))
  const [farbe, setFarbe] = useState<Farbe>('alltag')
  const ansichten = useAnordnung(quelle.id)
  // Breiten während des Ziehens am Trenner, gespeichert erst beim Loslassen
  const [entwurf, setEntwurf] = useState<Record<string, number>>({})
  const [seiten, setSeiten] = useState(0)
  const [auswahl, setAuswahl] = useState<{ seite: number; bereich: Bereich; punkt: { x: number; y: number } } | null>(null)
  const [modus, setModus] = useState<'wahl' | 'wissen' | 'frage' | 'link' | 'erklaeren'>('wahl')
  const [titel, setTitel] = useState('')
  // Vorschlag der KI für die Frage einer Lernkarte (null = noch keiner, '' = keiner zu haben)
  const [vorschlag, setVorschlag] = useState<string | null>(null)
  const [vollbild, setVollbild] = useState(false)
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

  // Sprung von außen (Inhalt, Link, Zurück im Verlauf): dorthin scrollen. Die eigene Adresse beim Scrollen ändert
  // `sprungSeite` nur auf die schon sichtbare Seite, das springt nicht.
  useEffect(() => {
    if (sprungSeite === seiteRef.current) return
    seiteRef.current = sprungSeite
    setSeite(sprungSeite)
    springe(sprungSeite)
  }, [sprungSeite])

  const sichtbar = (nr: number) => {
    seiteRef.current = nr
    setSeite(nr)
    ersetzeOrt('sammeln', quelle.id, nr)
  }

  // Stelle merken, damit die Startseite genau hier weitermacht (erst wenn das Scrollen kurz ruht)
  useEffect(() => {
    const t = setTimeout(() => void merkeLesestelle(speicher, quelle.id, seite), 1500)
    return () => clearTimeout(t)
  }, [speicher, quelle.id, seite])

  // Höhe des Platzes bis zum unteren Rand: Skript und Blätter scrollen darin je für sich
  useLayoutEffect(() => {
    const el = platz.current
    if (!el || !breit) return
    const messen = () => el.style.setProperty('--platz-oben', `${Math.max(0, el.getBoundingClientRect().top + scrollY)}px`)
    messen()
    // Vollbild blendet den Kopf erst im nächsten Effekt aus: danach noch einmal messen
    const f = requestAnimationFrame(messen)
    addEventListener('resize', messen)
    return () => {
      cancelAnimationFrame(f)
      removeEventListener('resize', messen)
    }
  }, [breit, vollbild])

  // Pfeile und Bild auf/ab blättern seitenweise, auch im scrollenden Skript
  useEffect(() => {
    const tasten = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t?.isContentEditable) return
      // ein offener Dialog (z. B. Inhalt) schließt mit Esc selbst
      if (document.querySelector('.dialog-huelle, dialog[open]')) return
      if (e.key === 'Escape' && vollbild) setVollbild(false)
      const r = e.key === 'ArrowLeft' || e.key === 'PageUp' ? -1 : e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : 0
      if (!r) return
      e.preventDefault()
      springe(naechsteSeite(seiteRef.current, r, seiten))
    }
    addEventListener('keydown', tasten)
    return () => removeEventListener('keydown', tasten)
  }, [vollbild, seiten])

  // Vollbild: Kopf und Leiste weg, das Skript nutzt die ganze Höhe
  useEffect(() => {
    if (!vollbild) return
    const raus = () => !document.fullscreenElement && setVollbild(false)
    document.body.classList.add('vollbild-an')
    document.addEventListener('fullscreenchange', raus)
    return () => {
      document.body.classList.remove('vollbild-an')
      document.removeEventListener('fullscreenchange', raus)
    }
  }, [vollbild])

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
  const auswahlSeite = auswahl?.seite ?? seite
  useEffect(() => {
    setVorschlag(null)
    if (modus !== 'frage' || !bereich) return
    const ab = new AbortController()
    void frageVorschlagen(speicher, quelle, auswahlSeite, bereich, ab.signal).then((f) => !ab.signal.aborted && setVorschlag(f ?? ''))
    return () => ab.abort()
  }, [modus, bereich, speicher, quelle, auswahlSeite])

  // Ausschnitt der Seite als Bild aufs Blatt, z. B. eine Aufgabe, um sie dort zu lösen (das PDF darf dann klein werden)
  const insBlatt = async () => {
    if (!auswahl) return
    const datei = String(quelle.felder.datei ?? '')
    const src = await ausschnitt(speicher, datei, auswahl.seite, auswahl.bereich, 1400)
    if (!src) return
    await legeBildAufBlatt(speicher, { anhangId: quelle.id, seite: auswahl.seite, blatt: ansichten.zielBlatt() }, { anhang: quelle.id, seite: auswahl.seite, bereich: auswahl.bereich }, src)
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
    const id = await karteAusStelle(speicher, { quelle, seite: auswahl.seite, bereich: auswahl.bereich, art, titel: text, ziel, farbe: FARBE_MARKE[farbe] ?? null })
    // Selbst getippte Fragen: Schreibfehler nachträglich korrigieren, die Karte ist schon da
    if (art === 'frage' && eigen && eigen !== vorschlag) void korrigiere(speicher, eigen).then((neu) => {
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
        marken={marken}
        werkzeug={werkzeug}
        farbe={farbe}
        springeZu={sprung}
        onSeite={sichtbar}
        scrollFlaeche={breit ? skriptFlaeche : null}
        onSeiten={setSeiten}
        onMarke={(m) => {
          const z = /\[\[([^\]|]+)/.exec(m.text)?.[1]
          if (z) geheZu('nutzen', z)
        }}
        onRechteck={(nr, bereich, punkt) => {
          setAuswahl({ seite: nr, bereich, punkt })
          setModus('wahl')
        }}
        zusatz={(nr) =>
          auswahl?.seite === nr && (
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
  const alleOffen = ansichten.anordnung.ansichten.filter((v) => !v.zu)
  const handy = alleOffen.find((v) => v.id === handyWahl) ?? alleOffen[0]
  const offen = breit ? alleOffen : alleOffen.filter((v) => v === handy)

  return (
    <div>
      <div className="plan-leiste">
        <h1 className="plan-titel">{quelle.titel}</h1>
        <InhaltKnopf quelle={quelle} seite={seite} />
        <span style={{ flex: 1 }} />
        {/* Ohne Skript (Heft) scrollt nichts, dort bleibt das Blättern, bis Hefte Notizbücher werden */}
        {skriptZu && (
          <a className={`knopf klein symbol${seite <= 1 ? ' aus' : ''}`} href={ortLink('sammeln', quelle.id, Math.max(1, seite - 1))} aria-label="Seite zurück">
            ‹
          </a>
        )}
        <span className="klein-leise" aria-live="polite">
          S. {seite}
          {seiten ? ` / ${seiten}` : ''}
        </span>
        {skriptZu && (
          <a className="knopf klein symbol" href={ortLink('sammeln', quelle.id, naechsteSeite(seite, 1, seiten))} aria-label="Seite vor">
            ›
          </a>
        )}
        <BlattMenue anordnung={ansichten.anordnung} onNeu={ansichten.neuesBlatt} onOeffne={ansichten.oeffne} />
        <button type="button" className="knopf klein" onClick={vollbildUmschalten} title="Kopf ausblenden, ganze Seite zeigen">
          ⤢ Vollbild
        </button>
      </div>
      {!breit && alleOffen.length > 1 && (
        <div className="segmente klein handy-ansichten" role="tablist" aria-label="Ansicht">
          {alleOffen.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v === handy} className={v === handy ? 'aktiv' : ''} onClick={() => setHandyWahl(v.id)}>
              {v.art === 'pdf' ? 'Skript' : lineaturName(v.lineatur ?? 'kariert')}
            </button>
          ))}
        </div>
      )}
      <div ref={platz} className="uebungsplatz">
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
            <section
              ref={v.art === 'pdf' ? setSkriptFlaeche : undefined}
              className={`platz-ansicht ${v.art === 'pdf' ? 'platz-skript' : 'platz-blatt'}`}
              style={{ flexGrow: entwurf[v.id] ?? v.breite } as CSSProperties}
              aria-label={v.art === 'pdf' ? 'Skript' : 'Blatt'}
            >
              <AnsichtKopf
                ansicht={v}
                name="Skript"
                erste={i === 0}
                letzte={i === offen.length - 1}
                allein={alleOffen.length === 1}
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
          <span>
            S. {seite}
            {seiten ? ` / ${seiten}` : ''}
          </span>
          <button type="button" onClick={vollbildUmschalten} title="Vollbild beenden (Esc)" aria-label="Vollbild beenden">
            ✕
          </button>
        </div>
      )}
      {auswahl && modus === 'erklaeren' && (
        <ErklaerFenster
          quelle={quelle}
          seite={auswahl.seite}
          bereich={auswahl.bereich}
          farbe={FARBE_MARKE[farbe] ?? null}
          onZu={(behalten) => {
            // ohne Behalten bleibt die Auswahl stehen, um daraus doch noch eine Karte zu machen
            if (behalten) setAuswahl(null)
            setModus('wahl')
          }}
        />
      )}
      <Werkzeugleiste
        werkzeug={werkzeug}
        farbe={farbe}
        onWerkzeug={setWerkzeug}
        onFarbe={setFarbe}
        extra={<BildKnoepfe onDateien={(d) => void fotosAufBlatt(speicher, { anhangId: quelle.id, seite, blatt: ansichten.zielBlatt() }, d)} />}
      />
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
