import { useRef, useState } from 'react'
import { LINEATUREN, anordnungJson, leeresPdf, type Lineatur, gliederung, linkZiel, obersteEbene, inhaltVon, kapitelBei, kartenAus, kurzDatum, lernziele, mitschriftenVon, lesestand, liesMarken, ordneLernziele, pfade, type Bestand, type Eintrag, type Lernziel, type Lesestelle, type Modul } from '@rl/kern'
import { Dialog, geheZu, neuerAnhang, ortLink, useDaten } from '@rl/oberflaeche'
import { KapitelUebersicht, kapitelKurz } from './Kapitel'
import { faelligZahl, kartenFuer, kartenImModul } from './modulkarten'
import { LineaturBild } from './Blaetter'
import { neueMitschrift, neuesModul, schalteFavorit, setzeModulFeld, setzeQuellen } from './wissen'

/** Wohin ein Klick auf ein Lernziel führt: an die letzte Stelle, sonst an den Anfang des ersten PDFs */
export function zielLink(z: Lernziel): string {
  if (z.zuletzt) return ortLink('sammeln', z.zuletzt.anhang, z.zuletzt.seite)
  if (z.quellen[0]) return ortLink('sammeln', z.quellen[0].id, 1)
  return z.modul ? ortLink('sammeln', 'modul', z.modul.id) : ortLink('sammeln')
}

export function wann(am: string, jetzt = new Date()): string {
  const d = new Date(am.length === 10 ? `${am}T12:00:00` : am)
  const tage = Math.round((new Date(jetzt.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  if (tage < 14) return `vor ${tage} Tagen`
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: d.getFullYear() === jetzt.getFullYear() ? undefined : 'numeric' })
}

function stelleText(z: Lernziel, b: Bestand): string {
  const s = z.zuletzt
  if (!s) {
    // Ohne Lesestelle: Lehrgang mit Mitschrift, zuletzt mitgeschrieben
    const m = z.modul ? mitschriftenVon(b, z.modul.id) : []
    const am = m.map((e) => String(e.felder.geaendert ?? e.felder.erstellt ?? '')).sort().pop()
    return am ? `Zuletzt mitgeschrieben ${wann(am)}` : 'noch nicht begonnen'
  }
  const pdf = z.quellen.length > 1 ? `${z.quellen.find((q) => q.id === s.anhang)?.titel ?? 'PDF'}, ` : ''
  const k = kapitelBei(inhaltVon(b, s.anhang)?.kapitel ?? [], s.seite)
  return `Weiter bei ${pdf}S. ${s.seite}${k ? ` (${kapitelKurz(k, 36)})` : ''} · ${wann(s.am)}`
}

/** Startseite der Lern-App: oben die Favoriten, darunter zuletzt bearbeitet. Ein Klick springt an die letzte Stelle. */
export function Start() {
  const { speicher, bestand } = useDaten()
  const eingabe = useRef<HTMLInputElement>(null)
  const [neu, setNeu] = useState(false)
  const [heft, setHeft] = useState(false)
  const [auswahl, setAuswahl] = useState(false)
  const [suche, setSuche] = useState('')
  const alle = lernziele(bestand)
  const w = suche.trim().toLowerCase()
  const gruppen = ordneLernziele(w ? alle.filter((z) => z.titel.toLowerCase().includes(w) || z.quellen.some((q) => q.titel.toLowerCase().includes(w))) : alle)
  const leer = !alle.length

  return (
    <div className="seite">
      <div className="seite-kopf">
        <h1>Was lerne ich gerade?</h1>
        <span style={{ flex: 1 }} />
        {/* Am PC drei Knöpfe nebeneinander, am Handy ein „+ Neu“ mit Erklärung je Möglichkeit (Design-Prüfung Kl5) */}
        <button type="button" className="knopf nur-breit" onClick={() => setNeu(true)}>
          Neues Modul
        </button>
        <button type="button" className="knopf nur-breit" onClick={() => setHeft(true)} title="Für ein Buch auf Papier: leeres Heft mit großer Zeichenfläche, Kamera und Bildern">
          Buch ohne PDF
        </button>
        <button type="button" className="knopf haupt nur-breit" onClick={() => eingabe.current?.click()}>
          Buch hinzufügen
        </button>
        <button type="button" className="knopf haupt nur-schmal" onClick={() => setAuswahl(true)}>
          + Neu
        </button>
        <input
          ref={eingabe}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={async (e) => {
            // Jedes einzelne PDF wird ein Buch: ein Modul mit genau diesem PDF
            for (const f of Array.from(e.target.files ?? [])) {
              const titel = f.name.replace(/\.[^.]+$/, '')
              const id = await neuerAnhang(speicher, f, [['art', 'skript']])
              await neuesModul(speicher, { titel, quellen: [id] })
            }
            e.target.value = ''
          }}
        />
      </div>
      <p className="klein-leise nur-breit start-erklaerung">
        Ein Modul bündelt mehrere PDFs zu einem Ziel, ein Buch ist ein Modul mit einem PDF. Du liest und schreibst selbst heraus, was wichtig ist.
      </p>
      {alle.length > 8 && (
        <div className="lern-suche">
          <input className="eingabe" type="search" placeholder="Modul oder PDF suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
        </div>
      )}
      {gruppen.favoriten.length > 0 && <Gruppe titel="Favoriten" ziele={gruppen.favoriten} />}
      {gruppen.kuerzlich.length > 0 && <Gruppe titel="Zuletzt bearbeitet" ziele={gruppen.kuerzlich} />}
      {gruppen.weitere.length > 0 && <Gruppe titel={gruppen.favoriten.length || gruppen.kuerzlich.length ? 'Weitere' : undefined} ziele={gruppen.weitere} />}
      {gruppen.abgeschlossen.length > 0 && <Gruppe titel="Abgeschlossen" ziele={gruppen.abgeschlossen} />}
      {leer && <div className="leer">Noch nichts zum Lernen. Füge ein Buch (PDF) hinzu oder lege ein Modul an.</div>}
      {!leer && w && !gruppen.favoriten.length && !gruppen.kuerzlich.length && !gruppen.weitere.length && !gruppen.abgeschlossen.length && (
        <div className="leer">Nichts gefunden.</div>
      )}
      {heft && <NeuesHeft onZu={() => setHeft(false)} />}
      {auswahl && (
        <Dialog titel="Was möchtest du anlegen?" onZu={() => setAuswahl(false)}>
          <div className="neu-auswahl">
            {(
              [
                ['Buch hinzufügen', 'Ein PDF, das du durcharbeitest, z. B. ein Skript oder Fachbuch.', () => eingabe.current?.click()],
                ['Neues Modul', 'Mehrere PDFs und Mitschriften zu einem Ziel, z. B. ein Lehrgang.', () => setNeu(true)],
                ['Buch ohne PDF', 'Für ein Buch auf Papier: leeres Heft mit großer Zeichenfläche, Kamera und Bildern.', () => setHeft(true)]
              ] as const
            ).map(([titel, text, tu]) => (
              <button
                key={titel}
                type="button"
                className="knopf neu-option"
                onClick={(e) => {
                  // Erst das modale Fenster schließen: solange es offen ist, ist die Seite dahinter (Dateiwahl) gesperrt
                  e.currentTarget.closest('dialog')?.close()
                  setAuswahl(false)
                  tu()
                }}
              >
                <b>{titel}</b>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {neu && (
        <NeuesModul
          onZu={() => setNeu(false)}
          onFertig={(id) => {
            setNeu(false)
            geheZu('sammeln', 'modul', id)
          }}
        />
      )}
    </div>
  )
}

function Gruppe({ titel, ziele }: { titel?: string; ziele: Lernziel[] }) {
  return (
    <section className="lern-gruppe">
      {titel && <h2 className="lern-gruppe-titel">{titel}</h2>}
      <div className="raster">
        {ziele.map((z) => (
          <Kachel key={z.id} z={z} />
        ))}
      </div>
    </section>
  )
}

function Kachel({ z }: { z: Lernziel }) {
  const { speicher, bestand } = useDaten()
  const mitschriften = z.modul ? mitschriftenVon(bestand, z.modul.id).length : 0
  const art =
    !z.modul || (z.quellen.length === 1 && !mitschriften) ? 'Buch'
    : [z.quellen.length && `${z.quellen.length} ${z.quellen.length === 1 ? 'PDF' : 'PDFs'}`, mitschriften && `${mitschriften} ${mitschriften === 1 ? 'Mitschrift' : 'Mitschriften'}`].filter(Boolean).join(' · ') || 'Modul'
  const uebersicht = z.modul ? ortLink('sammeln', 'modul', z.modul.id) : null
  const weiter = weiterLink(z, bestand)
  return (
    <div className="karte lern-kachel">
      {/* Klick auf die Kachel: Übersicht des Moduls. Ein loses PDF hat keine, dort geht es direkt ins PDF. */}
      <a className="lern-weiter" href={uebersicht ?? weiter ?? zielLink(z)}>
        <span className="titel">{z.titel}</span>
        {z.modul?.ziel && <span className="lern-ziel">{z.modul.ziel}</span>}
        <span className="klein-leise">{stelleText(z, bestand)}</span>
      </a>
      <div className="lern-fuss">
        <span className="chip">{art}</span>
        <span style={{ flex: 1 }} />
        {uebersicht && (
          <a className="knopf klein" href={uebersicht}>
            Übersicht
          </a>
        )}
        {weiter && (
          <a className="knopf haupt klein" href={weiter}>
            {z.zuletzt || (z.modul && mitschriftenVon(bestand, z.modul.id).length) ? 'Weiterlernen' : 'Anfangen'}
          </a>
        )}
      </div>
      <FavoritStern an={z.favorit} onKlick={() => void schalteFavorit(speicher, z)} />
    </div>
  )
}

/** Wo es weitergeht: an der letzten Stelle im PDF oder in der zuletzt geänderten Mitschrift, je nachdem was jünger ist */
function weiterLink(z: Lernziel, b: Bestand): string | null {
  const m = z.modul ? mitschriftenVon(b, z.modul.id) : []
  const zeit = (e: Eintrag) => String(e.felder.geaendert ?? e.felder.erstellt ?? '')
  const neueste = [...m].sort((x, y) => zeit(y).localeCompare(zeit(x)))[0]
  const pdf = z.quellen.length ? zielLink(z) : null
  if (!neueste) return pdf
  if (!pdf) return ortLink('sammeln', 'mitschrift', neueste.id)
  const pdfZeit = z.zuletzt ? new Date(z.zuletzt.am).getTime() : 0
  return new Date(zeit(neueste)).getTime() > pdfZeit ? ortLink('sammeln', 'mitschrift', neueste.id) : pdf
}

export function FavoritStern({ an, onKlick }: { an: boolean; onKlick: () => void }) {
  return (
    <button type="button" className={`favorit-stern${an ? ' an' : ''}`} onClick={onKlick} aria-pressed={an} title={an ? 'Aus den Favoriten nehmen' : 'Als Favorit oben anzeigen'}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill={an ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
      </svg>
    </button>
  )
}

/** PDFs, die noch in keinem Modul stecken */
function losePdfs(ziele: Lernziel[]): Eintrag[] {
  return ziele.filter((z) => !z.modul).flatMap((z) => z.quellen)
}

/** Seiten eines leeren Hefts; jede Seite hat ihre eigenen Blätter und Bilder */
const HEFT_SEITEN = 60

/**
 * Buch auf Papier: ein leeres PDF (Heft) mit Lineatur als Quelle, damit Seiten, Lesestand und Module wie bei
 * jedem Buch funktionieren. Der Übungsplatz zeigt statt des PDFs ein großes Blatt für Fotos, Ausschnitte und Tinte.
 */
function NeuesHeft({ onZu }: { onZu: () => void }) {
  const { speicher } = useDaten()
  const [titel, setTitel] = useState('')
  const [lineatur, setLineatur] = useState<Lineatur>('kariert')
  const [laeuft, setLaeuft] = useState(false)
  const anlegen = async () => {
    const t = titel.trim()
    if (!t || laeuft) return
    setLaeuft(true)
    const datei = new File([leeresPdf(HEFT_SEITEN, lineatur, t)], `${t}.pdf`, { type: 'application/pdf' })
    const id = await neuerAnhang(speicher, datei, [['art', 'skript'], ['heft', lineatur]], t)
    await speicher.schreibe(
      pfade.blattAnordnung(id),
      anordnungJson({ ansichten: [{ art: 'pdf', id: 'pdf', breite: 3, zu: true }, { art: 'blatt', id: '1', lineatur, breite: 2 }] })
    )
    await neuesModul(speicher, { titel: t, quellen: [id] })
    onZu()
    geheZu('sammeln', id, 1)
  }
  return (
    <Dialog titel="Buch ohne PDF" onZu={onZu}>
      <p className="klein-leise" style={{ margin: 0 }}>
        Ein leeres Heft mit {HEFT_SEITEN} Seiten. Auf jeder Seite schreibst du auf einem großen Blatt, legst Fotos aus dem Buch darauf und nimmst bei Bedarf weitere Blätter dazu.
      </p>
      <label className="feld">
        Name
        <input className="eingabe" autoFocus placeholder="z. B. Mathematik Klasse 10" value={titel} onChange={(e) => setTitel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void anlegen()} />
      </label>
      <div className="feld">
        Papier
        <div className="lineatur-knoepfe">
          {LINEATUREN.map((l) => (
            <button key={l.art} type="button" className={`lineatur-knopf${lineatur === l.art ? ' gewaehlt' : ''}`} aria-pressed={lineatur === l.art} onClick={() => setLineatur(l.art)}>
              <span className="lineatur-probe">
                <LineaturBild art={l.art} format={0.5} breite={300} />
              </span>
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <div className="dialog-knoepfe">
        <button type="button" className="knopf still" onClick={onZu}>
          Abbrechen
        </button>
        <button type="button" className="knopf haupt" disabled={!titel.trim() || laeuft} onClick={() => void anlegen()}>
          Anlegen
        </button>
      </div>
    </Dialog>
  )
}

function NeuesModul({ onZu, onFertig }: { onZu: () => void; onFertig: (id: string) => void }) {
  const { speicher, bestand } = useDaten()
  const [titel, setTitel] = useState('')
  const [ziel, setZiel] = useState('')
  const [wahl, setWahl] = useState<string[]>([])
  const lose = losePdfs(lernziele(bestand))
  const anlegen = async () => {
    if (!titel.trim()) return
    onFertig(await neuesModul(speicher, { titel: titel.trim(), ziel, quellen: wahl }))
  }
  return (
    <Dialog titel="Neues Modul" onZu={onZu}>
      <label className="feld">
        Name
        <input className="eingabe" autoFocus placeholder="z. B. Elektrotechnik 2" value={titel} onChange={(e) => setTitel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void anlegen()} />
      </label>
      <label className="feld">
        Ziel
        <input className="eingabe" placeholder="Was will ich damit erreichen? (optional)" value={ziel} onChange={(e) => setZiel(e.target.value)} />
      </label>
      {lose.length > 0 && (
        <div className="feld">
          PDFs, die noch keinem Modul gehören
          <div className="pdf-wahl">
            {lose.map((q) => (
              <label key={q.id}>
                <input type="checkbox" checked={wahl.includes(q.id)} onChange={(e) => setWahl(e.target.checked ? [...wahl, q.id] : wahl.filter((x) => x !== q.id))} />
                {q.titel}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="dialog-knoepfe">
        <button type="button" className="knopf still" onClick={onZu}>
          Abbrechen
        </button>
        <button type="button" className="knopf haupt" disabled={!titel.trim()} onClick={() => void anlegen()}>
          Anlegen
        </button>
      </div>
    </Dialog>
  )
}

/** Übersicht eines Moduls: Name, Ziel, PDFs. Nichts wird gelöscht; ein entferntes PDF steht wieder lose auf der Startseite. */
export function ModulSeite({ id }: { id: string }) {
  const { speicher, bestand } = useDaten()
  const eingabe = useRef<HTMLInputElement>(null)
  const [zuordnen, setZuordnen] = useState(false)
  const stand = lesestand(bestand)
  const ziele = lernziele(bestand, stand)
  const z = ziele.find((x) => x.id === id && x.modul)
  if (!z?.modul)
    return (
      <div className="seite">
        <div className="leer">
          Dieses Modul gibt es (noch) nicht. <a href={ortLink('sammeln')}>Zur Startseite</a>
        </div>
      </div>
    )
  const m: Modul = z.modul
  const lose = losePdfs(ziele)

  return (
    <div className="seite modul-seite">
      <div className="seite-kopf">
        <h1 className="nur-vorleser">{m.titel}</h1>
        <input
          key={`t-${m.titel}`}
          className="titel-eingabe"
          defaultValue={m.titel}
          size={Math.max(8, m.titel.length + 1)}
          aria-label="Name des Moduls"
          onBlur={(e) => {
            const t = e.target.value.trim()
            if (t && t !== m.titel) void setzeModulFeld(speicher, m, 'titel', t)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <FavoritStern an={m.favorit} onKlick={() => void schalteFavorit(speicher, z)} />
        <span style={{ flex: 1 }} />
        <ModulLernen modulId={m.id} haupt={!z.quellen.length} />
        {z.quellen.length > 0 && (
          <a className="knopf haupt" href={zielLink(z)}>
            {z.zuletzt ? 'Weiterlesen' : 'Anfangen'}
          </a>
        )}
      </div>
      <label className="feld">
        Ziel
        <textarea
          key={`z-${m.ziel}`}
          className="eingabe"
          rows={2}
          defaultValue={m.ziel}
          placeholder="Was will ich mit diesem Modul erreichen? (Prüfung, Fähigkeit, Frage)"
          onBlur={(e) => {
            const t = e.target.value.trim()
            if (t !== m.ziel) void setzeModulFeld(speicher, m, 'ziel', t || undefined)
          }}
        />
      </label>

      <Mitschriften modulId={m.id} />

      <h2 className="lern-gruppe-titel" style={{ marginTop: 24 }}>
        {z.quellen.length === 1 ? 'PDF' : 'PDFs'}
      </h2>
      <div className="modul-pdfs">
        {z.quellen.map((q, i) => (
          <PdfZeile
            key={q.id}
            q={q}
            stelle={z.zuletzt?.anhang === q.id ? z.zuletzt : null}
            seite={stand[q.id]?.seite}
            hoch={i > 0 ? () => void setzeQuellen(speicher, m, tausche(m.quellen, i, i - 1)) : undefined}
            entfernen={() => void setzeQuellen(speicher, m, m.quellen.filter((x) => x !== q.id))}
          />
        ))}
        {!z.quellen.length && <div className="klein-leise">Noch keine PDFs in diesem Modul.</div>}
      </div>
      <div className="reihe" style={{ marginTop: 12 }}>
        <button type="button" className="knopf" onClick={() => eingabe.current?.click()}>
          PDF hochladen
        </button>
        {lose.length > 0 && (
          <button type="button" className="knopf" onClick={() => setZuordnen(true)}>
            Vorhandenes PDF hinzufügen
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="knopf still" onClick={() => void setzeModulFeld(speicher, m, 'status', m.abgeschlossen ? undefined : 'abgeschlossen')}>
          {m.abgeschlossen ? 'Wieder aufnehmen' : 'Als abgeschlossen markieren'}
        </button>
        <input
          ref={eingabe}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={async (e) => {
            const neu: string[] = []
            for (const f of Array.from(e.target.files ?? [])) neu.push(await neuerAnhang(speicher, f, [['art', 'skript']]))
            if (neu.length) await setzeQuellen(speicher, m, [...m.quellen, ...neu])
            e.target.value = ''
          }}
        />
      </div>
      {zuordnen && (
        <Dialog titel="Vorhandenes PDF hinzufügen" onZu={() => setZuordnen(false)}>
          <div className="pdf-wahl">
            {lose.map((q) => (
              <button
                key={q.id}
                type="button"
                className="knopf klein"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => {
                  void setzeQuellen(speicher, m, [...m.quellen, q.id])
                  setZuordnen(false)
                }}
              >
                {q.titel}
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  )
}

/** Lernen nur in diesem Modul (geordnet); die Zahl sagt, wie viel heute dran ist */
function ModulLernen({ modulId, haupt }: { modulId: string; haupt: boolean }) {
  const { bestand } = useDaten()
  if (!kartenImModul(bestand, modulId).length) return null
  const n = faelligZahl(bestand, { modul: modulId })
  return (
    <a className={`knopf${haupt ? ' haupt' : ''}`} href={ortLink('lernen', 'modul', modulId)}>
      Lernen{n ? ` · ${n}` : ''}
    </a>
  )
}

/** Mitschriften des Moduls mit ihrer Gliederung; ein Tipp auf eine Überschrift öffnet die Mitschrift dort */
function Mitschriften({ modulId }: { modulId: string }) {
  const { speicher, bestand } = useDaten()
  const liste = mitschriftenVon(bestand, modulId)
  return (
    <>
      <h2 className="lern-gruppe-titel" style={{ marginTop: 24 }}>
        {liste.length === 1 ? 'Mitschrift' : 'Mitschriften'}
      </h2>
      <div className="modul-mitschriften">
        {liste.map((e) => (
          <MitschriftZeile key={e.id} e={e} />
        ))}
        {!liste.length && <div className="klein-leise">Noch keine Mitschrift. Für Lehrgänge und Vorlesungen ohne Skript.</div>}
      </div>
      <div className="reihe" style={{ marginTop: 12 }}>
        <button type="button" className="knopf" onClick={async () => geheZu('sammeln', 'mitschrift', await neueMitschrift(speicher, modulId))}>
          Neue Mitschrift
        </button>
      </div>
    </>
  )
}

function MitschriftZeile({ e }: { e: Eintrag }) {
  const { bestand } = useDaten()
  const modulId = linkZiel(e.felder.thema)
  const [auf, setAuf] = useState(false)
  const teile = gliederung(e.rumpf)
  const oben = obersteEbene(teile, e.rumpf.split('\n').length)
  // Zugeklappt nur die oberste gliedernde Ebene, aufgeklappt alles darunter
  const zeige = auf ? teile.filter((u) => u.ebene >= oben) : teile.filter((u) => u.ebene === oben)
  const karten = kartenAus(bestand, e.id).length
  const geaendert = String(e.felder.geaendert ?? e.felder.erstellt ?? '').slice(0, 10)
  return (
    <div className="karte modul-mitschrift">
      <a href={ortLink('sammeln', 'mitschrift', e.id)} className="modul-pdf-titel">
        <strong>{e.titel}</strong>
        <span className="klein-leise">
          {teile.length ? `${teile.length} Abschnitte` : 'noch leer'}
          {karten ? ` · ${karten} ${karten === 1 ? 'Lernkarte' : 'Lernkarten'}` : ''}
          {geaendert ? ` · geändert ${kurzDatum(geaendert)}` : ''}
        </span>
      </a>
      {zeige.length > 0 && (
        <div className="modul-mitschrift-gliederung">
          {zeige.map((u) => {
            const n = modulId ? kartenFuer(bestand, { modul: modulId, teil: [e.id, u.zeile] }).length : 0
            return (
              <div key={u.zeile} className="gliederung-zeile" style={{ paddingLeft: (u.ebene - oben) * 16 }}>
                <a href={ortLink('sammeln', 'mitschrift', e.id, `z${u.zeile}`)}>{u.titel}</a>
                {n > 0 && (
                  <a className="chip gliederung-lernen" href={ortLink('lernen', 'modul', modulId!, e.id, u.zeile)} title={`Nur „${u.titel}“ lernen`}>
                    {n} {n === 1 ? 'Karte' : 'Karten'}
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
      {teile.some((u) => u.ebene > oben) ? (
        <button type="button" className="knopf still klein" style={{ alignSelf: 'flex-start' }} onClick={() => setAuf((a) => !a)}>
          {auf ? 'Weniger' : 'Ganze Gliederung'}
        </button>
      ) : null}
    </div>
  )
}

function tausche<T>(a: T[], i: number, j: number): T[] {
  const b = [...a]
  ;[b[i], b[j]] = [b[j], b[i]]
  return b
}

function PdfZeile({ q, stelle, seite, hoch, entfernen }: { q: Eintrag; stelle: Lesestelle | null; seite?: number; hoch?: () => void; entfernen: () => void }) {
  const { bestand } = useDaten()
  const n = liesMarken(bestand.texte.get(pfade.marken('lernen', q.id)) ?? '').length
  const bei = seite ?? 1
  return (
    <div className={`karte modul-pdf${stelle ? ' zuletzt' : ''}`}>
      <a href={ortLink('sammeln', q.id, bei)} className="modul-pdf-titel">
        <strong>{q.titel}</strong>
        <span className="klein-leise">
          {seite ? `S. ${seite}` : 'noch nicht geöffnet'}
          {n ? ` · ${n} Stellen herausgearbeitet` : ''}
          {stelle ? ` · zuletzt ${wann(stelle.am)}` : ''}
        </span>
      </a>
      {hoch && (
        <button type="button" className="knopf still klein symbol" onClick={hoch} aria-label="Nach oben" title="Nach oben">
          ↑
        </button>
      )}
      <button type="button" className="knopf still klein" onClick={entfernen} title="Aus dem Modul nehmen (das PDF und alles Herausgearbeitete bleibt)">
        Herausnehmen
      </button>
      <KapitelUebersicht quelle={q} seite={seite} />
    </div>
  )
}
