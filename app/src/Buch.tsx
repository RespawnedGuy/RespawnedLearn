// Notizbuch (Vertrag Lernen 1.3, 5.3): Seiten untereinander, die letzte leere kommt von selbst dazu. Jede Seite hat
// Lineatur, Bilder, Tinte und am Rand die Verweise aufs Skript („S. 12“, Tippen springt hin).
import { useEffect, useState } from 'react'
import {
  A4,
  blattFormat,
  buchDokument,
  buchSeiteJson,
  buchSeitenNummern,
  linkZiel,
  liesBuchSeite,
  pfade,
  platzImBuch,
  setzeFeld,
  ulid,
  SEITE_BREITE,
  type BlattBild,
  type BuchBild,
  type BuchSeite,
  type Eintrag,
  type Farbe,
  type Lineatur
} from '@rl/kern'
import { TintenEbene, geheZu, melde, neuerAnhang, useDaten, type Speicher, type Werkzeug } from '@rl/oberflaeche'
import { BildAufBlatt, LineaturBild } from './Blaetter'

export const LINEATUR_STANDARD: Lineatur = 'kariert'

export const lineaturVon = (e: Eintrag | undefined): Lineatur => (typeof e?.felder.lineatur === 'string' ? (e.felder.lineatur as Lineatur) : LINEATUR_STANDARD)

/** Alle Notizbücher, die nicht archiviert sind */
export function notizbuecher(dokumente: Iterable<Eintrag>): Eintrag[] {
  return [...dokumente].filter((e) => e.typ === 'notizbuch' && e.felder.status !== 'archiviert')
}

export const modulVonBuch = (e: Eintrag) => linkZiel(e.felder.modul)

/** Seiten, die es gibt, und die eine leere danach */
export function seitenVon(speicher: Speicher, id: string): number[] {
  const da = buchSeitenNummern(speicher.pfade(), id)
  return [...da, (da[da.length - 1] ?? 0) + 1]
}

export const seitenText = (n: number) => (n === 0 ? 'noch leer' : n === 1 ? '1 Seite' : `${n} Seiten`)

/** Neues Notizbuch anlegen; gehört zum Modul, wenn eins angegeben ist */
export async function neuesBuch(speicher: Speicher, b: { titel: string; lineatur: Lineatur; modul?: string | null }): Promise<string> {
  const id = ulid()
  const jetzt = new Date().toISOString()
  await speicher.schreibe(pfade.buch(id), buchDokument({ id, titel: b.titel, lineatur: b.lineatur, modul: b.modul, erstellt: jetzt }))
  return id
}

export async function setzeBuchLineatur(speicher: Speicher, id: string, lineatur: Lineatur) {
  await speicher.aendere(pfade.buch(id), (t) => setzeFeld(setzeFeld(t, 'lineatur', lineatur), 'geaendert', new Date().toISOString()))
}

const aendereSeite = (speicher: Speicher, id: string, nr: number, f: (s: BuchSeite) => BuchSeite) =>
  speicher.aendere(pfade.buchSeite(id, nr), (alt) => buchSeiteJson(f(liesBuchSeite(alt))))

async function verhaeltnisVon(src: string): Promise<number> {
  const i = new Image()
  i.src = src
  await i.decode().catch(() => {})
  return i.naturalWidth ? i.naturalHeight / i.naturalWidth : 0.75
}

/**
 * Bild ins Buch: unter das unterste Bild der letzten Seite; passt es dort nicht mehr auf die Seite, auf eine neue.
 * Gespeichert wird nur der Verweis auf Foto bzw. PDF-Ausschnitt.
 */
export async function bildInsBuch(speicher: Speicher, id: string, bild: Pick<BuchBild, 'anhang' | 'seite' | 'bereich'>, src: string): Promise<void> {
  const verhaeltnis = await verhaeltnisVon(src)
  const da = buchSeitenNummern(speicher.pfade(), id)
  let nr = da[da.length - 1] ?? 1
  let format = blattFormat(speicher.text(pfade.buchTinte(id, nr)))
  let platz = platzImBuch(liesBuchSeite(speicher.text(pfade.buchSeite(id, nr))).bilder, verhaeltnis, format)
  if (platz.format > format) {
    nr += 1
    format = A4
    platz = platzImBuch([], verhaeltnis, format)
  }
  const { format: _f, ...lage } = platz
  await aendereSeite(speicher, id, nr, (s) => ({ ...s, bilder: [...s.bilder, { id: ulid().slice(-8).toLowerCase(), ...bild, ...lage }] }))
  melde('Bild liegt im Buch. Mit „Lesen“ verschieben, vergrößern oder entfernen.')
}

export async function fotosInsBuch(speicher: Speicher, id: string, dateien: Iterable<File>) {
  for (const f of dateien) {
    if (!f.type.startsWith('image/')) continue
    const anhang = await neuerAnhang(speicher, f.name ? f : new File([f], `Bild ${new Date().toLocaleString('de-DE')}.png`, { type: f.type }))
    const url = URL.createObjectURL(f)
    try {
      await bildInsBuch(speicher, id, { anhang }, url)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** Ein Notizbuch: alle Seiten untereinander */
export function BuchAnsicht({ id, werkzeug, farbe }: { id: string; werkzeug: Werkzeug; farbe: Farbe }) {
  const { speicher, bestand } = useDaten()
  const buch = bestand.dokumente.get(id)
  if (!buch) return <div className="leer">Dieses Notizbuch liegt (noch) nicht im Datenordner. Bringt Syncthing es gerade, erscheint es gleich.</div>
  const lineatur = lineaturVon(buch)
  return (
    <div className="buch-seiten">
      {seitenVon(speicher, id).map((nr) => (
        <BuchBlatt key={nr} id={id} nr={nr} lineatur={lineatur} werkzeug={werkzeug} farbe={farbe} />
      ))}
    </div>
  )
}

function BuchBlatt({ id, nr, lineatur, werkzeug, farbe }: { id: string; nr: number; lineatur: Lineatur; werkzeug: Werkzeug; farbe: Farbe }) {
  const { speicher, bestand } = useDaten()
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const tinte = pfade.buchTinte(id, nr)
  const format = blattFormat(speicher.text(tinte))
  const seite = liesBuchSeite(speicher.text(pfade.buchSeite(id, nr)))
  const lesen = werkzeug === 'lesen'
  useEffect(() => {
    if (!lesen) setGewaehlt(null)
  }, [lesen])
  const hoehe = SEITE_BREITE * format
  const aendere = (f: (b: BuchBild[]) => BuchBild[]) => void aendereSeite(speicher, id, nr, (s) => ({ ...s, bilder: f(s.bilder) }))
  const ohneBlatt = ({ blatt: _b, ...b }: BlattBild): BuchBild => b
  return (
    <div className="buch-blatt">
      <div className="buch-rand" aria-label={`Verweise auf Seite ${nr}`}>
        {seite.verweise.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`verweis${v.marke ? ' aus-markierung' : ''}`}
            style={{ top: `${(v.y / hoehe) * 100}%` }}
            title={`${bestand.dokumente.get(v.anhang)?.titel ?? 'Skript'}, Seite ${v.seite}`}
            onClick={() => geheZu('sammeln', v.anhang, v.seite)}
          >
            {v.marke ? '✦ ' : ''}S. {v.seite}
          </button>
        ))}
      </div>
      <div className="blatt-flaeche pdf-seite zeichnen" style={{ aspectRatio: `1 / ${format}` }} role="group" aria-label={`Buchseite ${nr}`} onPointerDown={() => setGewaehlt(null)}>
        <LineaturBild art={lineatur} format={format} />
        {seite.bilder.map((b) => (
          <BildAufBlatt
            key={b.id}
            bild={{ ...b, blatt: '' }}
            format={format}
            aktiv={lesen}
            gewaehlt={gewaehlt === b.id}
            onWahl={() => setGewaehlt(b.id)}
            onAendern={(neu) => aendere((alle) => alle.map((x) => (x.id === neu.id ? ohneBlatt(neu) : x)))}
            onEntfernen={() => {
              setGewaehlt(null)
              aendere((alle) => alle.filter((x) => x.id !== b.id))
            }}
          />
        ))}
        <TintenEbene pfad={tinte} format={format} werkzeug={werkzeug === 'markieren' ? 'stift' : werkzeug} farbe={farbe} />
      </div>
    </div>
  )
}
