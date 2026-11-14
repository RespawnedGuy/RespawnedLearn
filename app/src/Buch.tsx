// Notizbuch (Vertrag Lernen 1.3, 5.3): Seiten untereinander, die letzte leere kommt von selbst dazu. Jede Seite hat
// Lineatur, Bilder, Tinte und am Rand die Verweise aufs Skript („S. 12“, Tippen springt hin).
import { useEffect, useRef, useState } from 'react'
import {
  A4,
  blattFormat,
  buchDokument,
  buchSeiteJson,
  buchSeitenNummern,
  linkZiel,
  ohneMarkeImBuch,
  liesTinte,
  liesBuchSeite,
  pfade,
  platzFuerMarkierung,
  platzImBuch,
  setzeFeld,
  strichLage,
  ulid,
  verweiseBeimSchreiben,
  SEITE_BREITE,
  type BlattBild,
  type Bereich,
  type BuchBild,
  type BuchSeite,
  type Eintrag,
  type Farbe,
  type Lineatur,
  type Strich,
  type Ziel
} from '@rl/kern'
import { TintenEbene, geheZu, melde, neuerAnhang, useDaten, type Speicher, type Werkzeug } from '@rl/oberflaeche'
import { BildAufBlatt, LineaturBild } from './Blaetter'
import { MarkeKnopf } from './MarkeKnopf'
import { BuchMarken, type BuchAuswahl } from './BuchMarken'

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

/**
 * Markierung ins Buch (Vertrag Lernen 1.3, 5.3): der Ausschnitt unter die letzte Zeile der Seite, auf der zuletzt
 * geschrieben wurde, dazu ein Verweis ✦ mit der Markierung und der ID des Ausschnitts (`bild`, Lernen 1.5). Passt er dort nicht mehr hin, oben auf die nächste Seite.
 */
export async function markierungInsBuch(
  speicher: Speicher,
  id: string,
  nr: number,
  m: { anhang: string; seite: number; bereich: Bereich; marke: string },
  src: string
): Promise<void> {
  const verhaeltnis = await verhaeltnisVon(src)
  const lage = (n: number) =>
    platzFuerMarkierung(
      liesBuchSeite(speicher.text(pfade.buchSeite(id, n))).bilder,
      liesTinte(speicher.text(pfade.buchTinte(id, n)) ?? '').map(strichLage),
      m.bereich.b,
      verhaeltnis,
      blattFormat(speicher.text(pfade.buchTinte(id, n)))
    )
  let platz = lage(nr)
  if (!platz) {
    nr += 1
    platz = lage(nr) ?? platzFuerMarkierung([], [], m.bereich.b, verhaeltnis, A4)!
  }
  const p = platz
  const kurz = () => ulid().slice(-8).toLowerCase()
  const bild = kurz()
  await aendereSeite(speicher, id, nr, (s) => ({
    ...s,
    bilder: [...s.bilder, { id: bild, anhang: m.anhang, seite: m.seite, bereich: m.bereich, ...p }],
    verweise: [...s.verweise, { id: kurz(), y: p.y, anhang: m.anhang, seite: m.seite, marke: m.marke, bild, am: new Date().toISOString() }]
  }))
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

/** Sprung an eine Stelle im Buch (vom Skript aus, „✎ 2“) */
export interface BuchSprung {
  nr: number
  y: number
  mal: number
}

/** Bis zum nächsten scrollbaren Vorfahren (Ansicht am PC) oder im Fenster (Handy) zu einer Höhe der Seite scrollen */
function scrolleZu(el: HTMLElement, anteil: number) {
  const r = el.getBoundingClientRect()
  let p = el.parentElement
  while (p && !(/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight)) p = p.parentElement
  const ziel = r.top + r.height * anteil
  if (p) p.scrollBy({ top: ziel - p.getBoundingClientRect().top - 80, behavior: 'smooth' })
  else scrollBy({ top: ziel - 160, behavior: 'smooth' })
}

/**
 * Ein Notizbuch: alle Seiten untereinander. Mit `ziel` (die Skriptseite, die gerade offen ist) entstehen beim
 * Schreiben Randmarken (kern/randmarken.ts); ohne Skript keine.
 */
export function BuchAnsicht({
  id,
  werkzeug,
  farbe,
  ziel = null,
  sprung,
  onGeschrieben
}: {
  id: string
  werkzeug: Werkzeug
  farbe: Farbe
  ziel?: Ziel | null
  sprung?: BuchSprung | null
  /** nach jedem Strich, mit der Buchseite (macht das Buch zum aktiven für Markierungen) */
  onGeschrieben?: (nr: number) => void
}) {
  const { speicher, bestand } = useDaten()
  const ref = useRef<HTMLDivElement>(null)
  const [hervor, setHervor] = useState<{ nr: number; y: number } | null>(null)
  useEffect(() => {
    if (!sprung) return
    const el = ref.current?.querySelector<HTMLElement>(`[data-buchseite="${sprung.nr}"]`)
    if (!el) return
    const format = blattFormat(speicher.text(pfade.buchTinte(id, sprung.nr)))
    scrolleZu(el, sprung.y / (SEITE_BREITE * format))
    setHervor({ nr: sprung.nr, y: sprung.y })
    const t = setTimeout(() => setHervor(null), 2500)
    return () => clearTimeout(t)
    // nur bei einem neuen Sprung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprung?.mal])
  const buch = bestand.dokumente.get(id)
  if (!buch) return <div className="leer">Dieses Notizbuch liegt (noch) nicht im Datenordner. Bringt Syncthing es gerade, erscheint es gleich.</div>
  const lineatur = lineaturVon(buch)
  return (
    <div className="buch-seiten" ref={ref}>
      {seitenVon(speicher, id).map((nr) => (
        <BuchBlatt key={nr} id={id} nr={nr} lineatur={lineatur} werkzeug={werkzeug} farbe={farbe} ziel={ziel} hervor={hervor?.nr === nr ? hervor.y : null} onGeschrieben={onGeschrieben} />
      ))}
    </div>
  )
}

/** Nach einem Strich: Randmarke setzen oder verwaiste wegräumen. Gespeichert wird mit der Tinte (1 s Ruhe). */
function markeNachStrich(speicher: Speicher, id: string, nr: number, neu: Strich, alle: Strich[], ziel: Ziel | null) {
  const anfang = neu.punkte[0]?.[1] ?? 0
  const lagen = alle.map(strichLage)
  const marke = { id: ulid().slice(-8).toLowerCase(), am: new Date().toISOString() }
  const pfad = pfade.buchSeite(id, nr)
  // Ändert sich nichts, entsteht auch keine (leere) Seitendatei
  if (!verweiseBeimSchreiben(liesBuchSeite(speicher.text(pfad)).verweise, lagen, anfang, ziel, marke)) return
  void aendereSeite(speicher, id, nr, (s) => {
    const v = verweiseBeimSchreiben(s.verweise, lagen, anfang, ziel, marke)
    return v ? { ...s, verweise: v } : s
  })
}

function BuchBlatt({
  id,
  nr,
  lineatur,
  werkzeug,
  farbe,
  ziel,
  hervor,
  onGeschrieben
}: {
  id: string
  nr: number
  lineatur: Lineatur
  werkzeug: Werkzeug
  farbe: Farbe
  ziel: Ziel | null
  hervor: number | null
  onGeschrieben?: (nr: number) => void
}) {
  const { speicher, bestand } = useDaten()
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  // Markieren wie im Skript (Vertrag Lernen 1.9): Rechteck → Baustein
  const [auswahl, setAuswahl] = useState<BuchAuswahl | null>(null)
  const buch = bestand.dokumente.get(id)
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
    <div className="buch-blatt" data-buchseite={nr}>
      <div className="buch-rand" aria-label={`Verweise auf Seite ${nr}`}>
        {seite.verweise.map((v) =>
          v.marke ? (
            <MarkeKnopf
              key={v.id}
              verweis={v}
              blinkt={hervor === v.y}
              style={{ top: `${(v.y / hoehe) * 100}%` }}
              onEntfernen={() => {
                setGewaehlt(null)
                // Schon weg (anderes Gerät)? Dann bleibt die Seite, wie sie ist.
                void aendereSeite(speicher, id, nr, (s) => ohneMarkeImBuch(s, v.id) ?? s).then(() =>
                  melde('Marke und Ausschnitt entfernt. Die Markierung im Skript bleibt.')
                )
              }}
            />
          ) : (
            <button
              key={v.id}
              type="button"
              className={`verweis${hervor === v.y ? ' blinkt' : ''}`}
              style={{ top: `${(v.y / hoehe) * 100}%` }}
              title={`${bestand.dokumente.get(v.anhang)?.titel ?? 'Skript'}, Seite ${v.seite}`}
              onClick={() => geheZu('sammeln', v.anhang, v.seite)}
            >
              S. {v.seite}
            </button>
          )
        )}
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
        <TintenEbene
          pfad={tinte}
          format={format}
          werkzeug={werkzeug}
          farbe={farbe}
          onStrich={(neu, alle) => {
            markeNachStrich(speicher, id, nr, neu, alle, ziel)
            onGeschrieben?.(nr)
          }}
          onRechteck={(bereich, punkt) => setAuswahl({ bereich, punkt })}
        />
        {buch && <BuchMarken buch={buch} nr={nr} format={format} werkzeug={werkzeug} farbe={farbe} auswahl={auswahl} onAuswahl={setAuswahl} />}
      </div>
    </div>
  )
}
