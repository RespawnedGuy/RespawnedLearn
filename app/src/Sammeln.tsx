import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { eingabeVon, liesBausteinText, liesMarken, markeAn, modulVon, pfade, type Bereich, type Eintrag, type Farbe, type Marke } from '@rl/kern'
import { PdfAnsicht, Werkzeugleiste, ausschnitt, ZurueckPfeil, ersetzeOrt, hatStift, melde, mitFinger, ortLink, useDaten, type Werkzeug } from '@rl/oberflaeche'
import { kurzId, naechsteSeite, type Rueckweg } from '@rl/kern'
import { benenneSkript, karteAusStelle, korrigiereFrage, merkeLesestelle, setzeBereich } from './wissen'
import { useLernzeit } from './lernzeitMessen'
import { SammelnPlan } from './SammelnPlan'
import { frageVorschlagen, korrigiere } from './ki'
import { Inhalt } from './Inhalt'
import { ModulSeite, Start } from './Start'
import { InhaltKnopf } from './Kapitel'
import { Mitschrift } from './Mitschrift'
import { ErklaerFenster } from './Erklaeren'
import { AnsichtKopf, Trenner, useAnordnung } from './Blaetter'
import { BuchAnsicht, bildInsBuch, markierungInsBuch, type BuchSprung, fotosInsBuch, lineaturVon, neuesBuch, setzeBuchLineatur, benenneNotizbuch } from './Buch'
import { NameFeld } from './NameFeld'
import { BuchWahl } from './BuchWahl'
import { BuchAlleinSeite } from './BuchAllein'
import { hebeAn } from './anheben'
import { RueckwegKnopf, useRueckwege } from './Rueckweg'
import { BausteinMenue, Verlinken, karteVon, schwebeLage } from './BausteinMenue'
import { MarkeRahmen } from './MarkeRahmen'

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
  // `buch/<id>/<seite>/<marke>`: Seite und Markierung sind freiwillig (Sprung aus einem Baustein, Lernen 1.9)
  if (ort[1] === 'buch' && ort[2]) return <BuchAlleinSeite key={ort[2]} id={ort[2]} seite={Number(ort[3]) || 0} marke={ort[4]} />
  const quelle = ort[1] ? bestand.dokumente.get(ort[1]) : undefined
  // Stellen-Verweise tragen nur die ID; ist sie ein Notizbuch, öffnet sich das Buch an der Seite
  if (quelle?.typ === 'notizbuch') return <BuchAlleinSeite key={quelle.id} id={quelle.id} seite={Number(ort[2]) || 0} />
  if (quelle) return <Angehoben key={quelle.id} quelle={quelle} seite={ort[2] ? Number(ort[2]) || 1 : 1} />
  return <Start />
}

/** Erst alte Zeichenblätter zu Notizbüchern anheben (Vertrag Lernen 1.3), dann den Übungsplatz zeigen */
function Angehoben({ quelle, seite }: { quelle: Eintrag; seite: number }) {
  const { speicher, bestand } = useDaten()
  const [fertig, setFertig] = useState(false)
  useEffect(() => {
    let weg = false
    void hebeAn(speicher, bestand, quelle)
      .then((n) => n && melde(n === 1 ? 'Die Blätter dieses Skripts stehen jetzt in einem Notizbuch.' : `Die Blätter dieses Skripts stehen jetzt in ${n} Notizbüchern.`))
      .catch(() => melde('Die alten Blätter ließen sich nicht übernehmen. Sie bleiben unverändert im Ordner.'))
      .finally(() => !weg && setFertig(true))
    return () => {
      weg = true
    }
    // nur einmal je Skript; spätere Änderungen sind schon im neuen Format
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return fertig ? <Uebungsplatz quelle={quelle} seite={seite} /> : <div className="leer">Wird geöffnet …</div>
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
  // Gezogenes Rechteck oder angetippte Markierung (`marke`); beides öffnet dasselbe Menü wie im Notizbuch
  const [auswahl, setAuswahl] = useState<{ seite: number; bereich: Bereich; punkt?: { x: number; y: number }; marke?: Marke } | null>(null)
  const [modus, setModus] = useState<'wahl' | 'wissen' | 'frage' | 'link' | 'erklaeren'>('wahl')
  const [titel, setTitel] = useState('')
  // Name und Schlagworte des Bausteins (Vertrag Lernen 1.8), „…“ zeigt die übrigen Wege
  const [name, setName] = useState('')
  useEffect(() => {
    setName(auswahl?.marke ? eingabeVon(liesBausteinText(auswahl.marke.text)) : '')
  }, [auswahl])
  // Vorschlag der KI für die Frage einer Lernkarte (null = noch keiner, '' = keiner zu haben)
  const [vorschlag, setVorschlag] = useState<string | null>(null)
  const [vollbild, setVollbild] = useState(false)
  const marken = liesMarken(bestand.texte.get(pfade.marken('lernen', quelle.id)) ?? '')
  const modul = modulVon(bestand, quelle.id)

  // Skript ausgeblendet (z. B. altes Heft für ein Buch auf Papier): dann keine Seitenzahl, dafür „Skript zeigen“
  const skriptZu = ansichten.anordnung.ansichten.some((v) => v.art === 'pdf' && v.zu)

  // Randmarken: Eine Skriptseite zählt erst, wenn sie 2 s stehen bleibt, damit Durchscrollen keine Marken setzt.
  // Die beim Öffnen angesprungene Seite gilt sofort. Ohne sichtbares Skript entsteht keine Marke.
  const [stabil, setStabil] = useState(sprungSeite)
  useEffect(() => {
    const t = setTimeout(() => setStabil(seite), 2000)
    return () => clearTimeout(t)
  }, [seite])
  const ziel = skriptZu ? null : { anhang: quelle.id, seite: stabil }
  useLernzeit({ ziel: modul?.id ?? quelle.id, art: 'sammeln', quelle: quelle.id, ...(skriptZu ? {} : { seite: stabil }) })

  // Aktives Buch: offen und in den letzten 15 Minuten beschrieben. Dorthin geht jede neue Markierung als Ausschnitt.
  const aktiv = useRef<{ id: string; nr: number; zeit: number } | null>(null)
  const aktivesBuch = () => {
    const a = aktiv.current
    if (!a || Date.now() - a.zeit > 15 * 60_000) return null
    return ansichten.anordnung.ansichten.some((v) => v.id === a.id && !v.zu) ? a : null
  }
  const markierungAuchInsBuch = async (m: { seite: number; bereich: Bereich; marke: string }) => {
    const a = aktivesBuch()
    if (!a) return
    const src = await ausschnitt(speicher, String(quelle.felder.datei ?? ''), m.seite, m.bereich, 1400)
    if (!src) return
    await markierungInsBuch(speicher, a.id, a.nr, { anhang: quelle.id, ...m }, src)
    melde(`Steht auch in „${bestand.dokumente.get(a.id)?.titel ?? 'Notizbuch'}“.`)
  }

  // Rückweg: „✎ n“ auf der Skriptseite öffnet die Stelle im Buch
  const wege = useRueckwege(quelle.id)
  const [buchSprung, setBuchSprung] = useState<(BuchSprung & { id: string }) | null>(null)
  const oeffneStelle = (w: Rueckweg) => {
    ansichten.zeigeBuch(w.buch)
    setHandyWahl(w.buch)
    setBuchSprung((s) => ({ id: w.buch, nr: w.nr, y: w.y, mal: (s?.mal ?? 0) + 1 }))
  }

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

  // Wohin Bilder gehen: ins erste offene Notizbuch; gibt es keins, entsteht eins zu diesem Skript
  const buchFuerBild = async (): Promise<string> => {
    const da = ansichten.zielBuch()
    if (da) return da
    const id = await neuesBuch(speicher, { titel: `Notizen ${quelle.titel}`, lineatur: 'kariert', modul: modul?.id ?? null })
    ansichten.zeigeBuch(id)
    return id
  }

  // Ausschnitt der Seite als Bild ins Buch, z. B. eine Aufgabe, um sie dort zu lösen
  const insBuch = async () => {
    if (!auswahl) return
    const datei = String(quelle.felder.datei ?? '')
    const src = await ausschnitt(speicher, datei, auswahl.seite, auswahl.bereich, 1400)
    if (!src) return
    await bildInsBuch(speicher, await buchFuerBild(), { anhang: quelle.id, seite: auswahl.seite, bereich: auswahl.bereich }, src)
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
      void buchFuerBild().then((id) => fotosInsBuch(speicher, id, bilder))
    }
    addEventListener('paste', einfuegen)
    return () => removeEventListener('paste', einfuegen)
  })

  const fertig = async (art: 'wissen' | 'frage' | 'link' | 'nur', ziel?: Eintrag) => {
    if (!auswahl) return
    const eigen = titel.trim()
    // Wissenskarte ohne eigenen Begriff: der Name des Bausteins
    const text = eigen || (art === 'wissen' && liesBausteinText(name).name) || (art === 'frage' ? vorschlag || 'Was steht hier?' : 'Stelle')
    const alt = auswahl.marke
    // Unverändert wieder zugemacht: nichts schreiben
    if (art === 'nur' && alt && eingabeVon(liesBausteinText(alt.text)) === name.trim()) return setAuswahl(null)
    const markeId = alt?.id ?? kurzId()
    const id = await karteAusStelle(speicher, { quelle, seite: auswahl.seite, bereich: auswahl.bereich, art, titel: text, ziel, farbe: FARBE_MARKE[farbe] ?? null, markeId, name })
    if (art === 'nur') melde(name.trim() ? 'Baustein gemerkt' : 'Baustein gemerkt, der Name fehlt noch (Nutzen › Offen)')
    if (art !== 'nur' && art !== 'link') melde('Lernkarte angelegt')
    if (!alt) void markierungAuchInsBuch({ seite: auswahl.seite, bereich: auswahl.bereich, marke: markeId })
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
        gewaehlt={auswahl?.marke?.id ?? null}
        onMarke={(m) => {
          setAuswahl({ seite: m.seite, bereich: m.bereich, marke: m })
          setModus('wahl')
        }}
        vorTippen={(nr, p, art) => {
          // wie im Notizbuch (Buch.tsx): Finger und Maus wählen beim Markieren, mit Stift-Gerät der Finger auch sonst
          const darf = werkzeug === 'markieren' || (art === 'touch' && hatStift())
          const treffer = darf ? markeAn(marken.filter((m) => m.seite === nr), p) : null
          if (treffer) {
            setAuswahl({ seite: nr, bereich: treffer.bereich, marke: treffer.marke })
            setModus('wahl')
          } else if (auswahl?.marke) setAuswahl(null)
          return !!treffer
        }}
        onRechteck={(nr, bereich, punkt) => {
          setAuswahl({ seite: nr, bereich, punkt })
          setModus('wahl')
        }}
        zusatz={(nr) => (
          <>
          {wege.get(nr) && <RueckwegKnopf wege={wege.get(nr)!} onOeffne={oeffneStelle} />}
          {auswahl?.seite === nr && (
            <>
              {auswahl.marke && (
                <MarkeRahmen
                  bereich={auswahl.bereich}
                  farbe={auswahl.marke.farbe}
                  onFertig={(neu) => {
                    const m = auswahl.marke!
                    setAuswahl({ ...auswahl, bereich: neu, punkt: undefined, marke: { ...m, bereich: neu } })
                    void setzeBereich(speicher, quelle.id, m.id, neu)
                  }}
                />
              )}
              {!auswahl.marke && <div className="auswahl" style={{ left: `${auswahl.bereich.x * 100}%`, top: `${auswahl.bereich.y * 100}%`, width: `${auswahl.bereich.b * 100}%`, height: `${auswahl.bereich.h * 100}%` }} />}
              <div className="schwebe" style={schwebeLage(auswahl.bereich, auswahl.punkt)}>
                {modus === 'wahl' && (
                  <BausteinMenue
                    name={name}
                    onName={setName}
                    onBaustein={() => void fertig('nur')}
                    onLernkarte={() => setModus('frage')}
                    onAbbrechen={() => setAuswahl(null)}
                    zurKarte={karteVon(auswahl.marke)}
                    bausteinTitel="Als Baustein merken: findet sich in allen Skripten wieder; ist ein Notizbuch aktiv, steht die Stelle auch dort"
                    mehr={
                      <>
                        <button type="button" className="knopf klein" onClick={() => setModus('wissen')}>
                          Wissenskarte
                        </button>
                        <button type="button" className="knopf klein" onClick={() => setModus('link')}>
                          Verlinken
                        </button>
                        {!auswahl.marke && (
                          <button type="button" className="knopf klein" onClick={() => setModus('erklaeren')} title="Die KI erklärt die Stelle in einfachen Worten">
                            Erklären
                          </button>
                        )}
                        <button type="button" className="knopf klein" onClick={() => void insBuch()} title="Die Stelle als Bild ins Notizbuch legen, um dort daran zu arbeiten">
                          Ins Buch
                        </button>
                      </>
                    }
                  />
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
          )}
          </>
        )}
      />
  )
  const alleOffen = ansichten.anordnung.ansichten.filter((v) => !v.zu)
  const handy = alleOffen.find((v) => v.id === handyWahl) ?? alleOffen[0]
  const offen = breit ? alleOffen : alleOffen.filter((v) => v === handy)

  return (
    <div>
      <div className="plan-leiste">
        <h1 className="plan-titel">
          <NameFeld name={quelle.titel} art="Skript" leerErlaubt onName={(n) => void benenneSkript(speicher, bestand, quelle.id, n)} />
        </h1>
        <InhaltKnopf quelle={quelle} seite={seite} />
        <span style={{ flex: 1 }} />
        {skriptZu ? (
          <button type="button" className="knopf klein" onClick={() => ansichten.oeffne('pdf')}>
            Skript zeigen
          </button>
        ) : (
          <span className="klein-leise" aria-live="polite">
            S. {seite}
            {seiten ? ` / ${seiten}` : ''}
          </span>
        )}
        {modul && !skriptZu && <SammelnPlan modul={modul} quelle={quelle} seite={stabil} />}
        <BuchWahl quelle={quelle} modul={modul?.id ?? null} offen={alleOffen.filter((v) => v.art === 'buch').map((v) => v.id)} onWahl={ansichten.zeigeBuch} />
        <button type="button" className="knopf klein" onClick={vollbildUmschalten} title="Kopf ausblenden, ganze Seite zeigen">
          ⤢ Vollbild
        </button>
      </div>
      {!breit && alleOffen.length > 1 && (
        <div className="segmente klein handy-ansichten" role="tablist" aria-label="Ansicht">
          {alleOffen.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v === handy} className={v === handy ? 'aktiv' : ''} onClick={() => {
                setHandyWahl(v.id)
                setBuchSprung(null)
                // zurück zum Skript: dort weiter, wo es zuletzt stand
                if (v.art === 'pdf') setSprung((s) => ({ seite: seiteRef.current, mal: s.mal + 1, sanft: false }))
                else scrollTo({ top: 0 })
              }}>
              {v.art === 'pdf' ? 'Skript' : (bestand.dokumente.get(v.id)?.titel ?? 'Buch')}
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
              aria-label={v.art === 'pdf' ? 'Skript' : (bestand.dokumente.get(v.id)?.titel ?? 'Notizbuch')}
            >
              <AnsichtKopf
                ansicht={v}
                name={
                  v.art === 'pdf' ? 'Skript' : <NameFeld name={bestand.dokumente.get(v.id)?.titel ?? 'Notizbuch'} art="Notizbuch" onName={(n) => void benenneNotizbuch(speicher, v.id, n)} />
                }
                lineatur={v.art === 'buch' ? lineaturVon(bestand.dokumente.get(v.id)) : undefined}
                erste={i === 0}
                letzte={i === offen.length - 1}
                allein={alleOffen.length === 1}
                onLineatur={(l) => void setzeBuchLineatur(speicher, v.id, l)}
                onVerschiebe={(r) => ansichten.verschiebe(v.id, r)}
                onSchliesse={() => ansichten.schliesse(v.id)}
              />
              {v.art === 'pdf' ? skript : v.art === 'buch' ? <BuchAnsicht id={v.id} werkzeug={werkzeug} farbe={farbe} ziel={ziel} sprung={buchSprung?.id === v.id ? buchSprung : null} onGeschrieben={(nr) => (aktiv.current = { id: v.id, nr, zeit: Date.now() })} /> : null}
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
          onMarke={(marke) => void markierungAuchInsBuch({ seite: auswahl.seite, bereich: auswahl.bereich, marke })}
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
        onBilder={(d) => void buchFuerBild().then((id) => fotosInsBuch(speicher, id, d))}
      />
    </div>
  )
}
