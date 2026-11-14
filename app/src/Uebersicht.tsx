// `#/uebersicht` (Nils 2026-11-14): alle Module auf einen Blick. Oben, was jetzt dran ist (je Modul das nächste
// Paket), dann die Lernzeit dieser Woche, dann je Modul Fortschritt und ob es bis zum Termin reicht. Gerechnet wird
// rein in `kern` (uebersicht.ts) mit demselben Plan wie auf der Modulseite; hier wird nichts geschrieben.
import { useMemo } from 'react'
import {
  alleLernzeiten,
  geplantJeWoche,
  lernziele,
  lesestand,
  liesEinheiten,
  modulStand,
  ordneUebersicht,
  stundenText,
  wochenAnfang,
  zeitSeit,
  type Lernziel,
  type ModulStand
} from '@rl/kern'
import { ortLink, useDaten } from '@rl/oberflaeche'
import { faellige } from './wissen'
import { einordnen } from './modulkarten'
import { rechneModulPlan, seitenText, tagKurz, useSeitenzahlen } from './lernplanDaten'
import { pomodoroEinstellungen } from './pomodoroStand'

const komma = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/** Heute als JJJJ-MM-TT in der Ortszeit des Geräts */
export function heuteText(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Zeile {
  z: Lernziel
  s: ModulStand
  offen: number
  karten: number
  woche: number
}

export function Uebersicht() {
  const { bestand } = useDaten()
  // Abgeschlossene Module zählen nicht; ein loses PDF nur, wenn schon darin gelesen wurde
  const ziele = lernziele(bestand).filter((z) => (z.modul ? !z.modul.abgeschlossen : !!z.zuletzt))
  const quellen = ziele.flatMap((z) => z.quellen)
  const seiten = useSeitenzahlen(quellen)
  const paketMinuten = pomodoroEinstellungen().lernen
  const seitenSchluessel = quellen.map((q) => seiten[q.id]).join(',')
  const heute = heuteText()

  const { zeilen, woche, geplant } = useMemo(() => {
    const stand = lesestand(bestand)
    const zeiten = alleLernzeiten(bestand)
    const [j, m, t] = wochenAnfang(heute).split('-').map(Number)
    const ab = new Date(j, m - 1, t).getTime()
    const karten = new Map<string, number>()
    for (const k of faellige(bestand)) {
      const id = einordnen(bestand, k.e).modul
      if (id) karten.set(id, (karten.get(id) ?? 0) + 1)
    }
    const zeilen: Zeile[] = ziele.map((z) => {
      const modul = z.modul ?? { id: z.id, titel: z.titel, quellen: [z.id], termin: null, stundenProWoche: null, schwer: [], uebungen: false, ects: null, stunden: null, ziel: '', pfad: '', favorit: false, abgeschlossen: false }
      const p = rechneModulPlan(bestand, modul, z.quellen, seiten, paketMinuten, stand, zeiten)
      return {
        z,
        s: modulStand({ modul, plan: p.plan, stand, heute, zuletzt: z.zuletzt?.am ?? null }),
        offen: z.modul ? liesEinheiten(bestand.texte.get(z.modul.pfad) ?? '').filter((e) => !e.erledigt).length : 0,
        karten: karten.get(z.id) ?? 0,
        woche: zeitSeit(zeiten, ab, modul)
      }
    })
    const reihe = ordneUebersicht(zeilen.map((x) => x.s)).map((s) => zeilen.find((x) => x.s === s)!)
    return { zeilen: reihe, woche: zeitSeit(zeiten, ab), geplant: geplantJeWoche(ziele.flatMap((z) => (z.modul ? [z.modul] : [])), heute) }
  }, [bestand, paketMinuten, seitenSchluessel, heute])

  if (!zeilen.length)
    return (
      <div className="seite uebersicht">
        <h1>Übersicht</h1>
        <p className="klein-leise">Noch nichts zu lernen. Lege unter „Sammeln“ ein Modul an oder füge ein Buch hinzu.</p>
        <a className="knopf haupt" href={ortLink('sammeln')}>
          Zu „Sammeln“
        </a>
      </div>
    )

  const dran = zeilen.filter((x) => x.s.naechstes && x.s.lage !== 'vorbei')
  return (
    <div className="seite uebersicht">
      <h1 className="nur-vorleser">Übersicht</h1>
      <section aria-labelledby="dran-titel">
        <h2 id="dran-titel" className="lern-gruppe-titel">
          Jetzt dran
        </h2>
        {dran.length ? (
          <ol className="pakete">
            {dran.map(({ z, s }, i) => (
              <li key={z.id} className={i === 0 ? 'paket jetzt' : 'paket'}>
                <a className="paket-zeile" href={ortLink('sammeln', s.naechstes!.anhang, String(s.naechstes!.von))}>
                  <span className="paket-modul">{z.titel}</span>
                  <span className="paket-seiten">{seitenText(s.naechstes!.von, s.naechstes!.bis)}</span>
                  <span className="klein-leise">{s.naechstes!.minuten} min</span>
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="klein-leise">Gerade ist kein Paket offen. Sobald ein Skript im Modul liegt, steht hier das nächste.</p>
        )}
      </section>

      <section aria-labelledby="woche-titel">
        <h2 id="woche-titel" className="lern-gruppe-titel" style={{ marginTop: 24 }}>
          Diese Woche
        </h2>
        <div className="uebersicht-woche">
          <span>{geplant ? `${stundenText(woche)} von ${komma(geplant)} h gelernt` : `${stundenText(woche)} gelernt`}</span>
          {geplant > 0 && <Balken wert={woche / 3_600_000} von={geplant} name="Lernzeit dieser Woche" />}
        </div>
      </section>

      <section aria-labelledby="module-titel">
        <h2 id="module-titel" className="lern-gruppe-titel" style={{ marginTop: 24 }}>
          Module
        </h2>
        <ul className="uebersicht-module">
          {zeilen.map((x) => (
            <ModulKarte key={x.z.id} x={x} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function Balken({ wert, von, name }: { wert: number; von: number; name: string }) {
  const anteil = von > 0 ? Math.min(1, wert / von) : 0
  return (
    <div className="uebersicht-balken" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(anteil * 100)}>
      <span style={{ width: `${anteil * 100}%` }} />
    </div>
  )
}

/** Ein Satz zur Lage, wie auf der Modulseite */
export function lageText(s: ModulStand, stundenProWoche: number | null): string {
  const z = s.zeitplan
  switch (s.lage) {
    case 'vorbei':
      return `Termin war am ${tagKurz(s.termin!)}`
    case 'fertig':
      return z ? `Alles gelesen, Wiederholung ab ${tagKurz(z.wiederholungAb)}` : 'Alles gelesen'
    case 'hinten':
      if (!z || z.noetigJeWoche === null) return 'Bis zum Termin bleibt nur noch die Wiederholungswoche'
      return `Bei ${komma(stundenProWoche ?? 0)} h pro Woche fehlen etwa ${komma(z.fehlen)} h`
    case 'plan':
      if (stundenProWoche || !s.seiten) return `Im Plan, Wiederholung ab ${tagKurz(z!.wiederholungAb)}`
      return `${z!.noetigJeWoche! < 1 ? 'Weniger als 1 h' : `Etwa ${komma(z!.noetigJeWoche!)} h`} pro Woche reichen bis ${tagKurz(z!.wiederholungAb)}`
    default:
      return s.seiten ? `Noch etwa ${stundenText(s.restMinuten * 60_000)} Lesen, ohne Termin` : 'Ohne Termin'
  }
}

function ModulKarte({ x }: { x: Zeile }) {
  const { z, s, offen, karten, woche } = x
  const href = z.modul ? ortLink('sammeln', 'modul', z.modul.id) : z.zuletzt ? ortLink('sammeln', z.zuletzt.anhang, z.zuletzt.seite) : ortLink('sammeln')
  const extras = [woche > 0 ? `${stundenText(woche)} diese Woche` : '', offen ? `${offen} ${offen === 1 ? 'Einheit' : 'Einheiten'} offen` : '', karten ? `${karten} ${karten === 1 ? 'Karte' : 'Karten'} fällig` : ''].filter(Boolean)
  return (
    <li className={`uebersicht-modul lage-${s.lage}`}>
      <a href={href} className="uebersicht-modul-link">
        <span className="uebersicht-modul-kopf">
          <span className="uebersicht-modul-titel">{z.titel}</span>
          {s.termin && <span className="klein-leise">{tagKurz(s.termin)}</span>}
        </span>
        {s.seiten > 0 && (
          <>
            <Balken wert={s.gelesen} von={s.seiten} name={`${z.titel}: gelesen`} />
            <span className="klein-leise">
              {s.gelesen} von {s.seiten} Seiten
            </span>
          </>
        )}
        <span className={s.lage === 'hinten' ? 'umfang-warnung' : 'klein-leise'}>{lageText(s, z.modul?.stundenProWoche ?? null)}</span>
        {extras.length > 0 && <span className="klein-leise">{extras.join(' · ')}</span>}
      </a>
    </li>
  )
}
