// Zeichenblätter im Übungsplatz (Vertrag 5.3, „Blätter“): beliebig viele Blätter mit eigener Lineatur neben dem
// Skript, frei sortierbar, in der Breite ziehbar, nach unten verlängerbar. Die Lineatur zeichnet die App in
// Seitenkoordinaten, damit Tinte und Linien auf jedem Gerät übereinanderliegen.
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  A4,
  LINEATUREN,
  anordnungJson,
  bilderJson,
  blattFormat,
  liesAnordnung,
  liesBilder,
  platzFuerBild,
  rueckeBild,
  liesTinte,
  lineaturName,
  lineaturSchichten,
  neueBlattId,
  neuesBlatt,
  oeffneAnsicht,
  pfade,
  schliesseAnsicht,
  setzeBreiten,
  setzeLineatur,
  tinteSvg,
  ulid,
  verschiebeAnsicht,
  SEITE_BREITE,
  type Anordnung,
  type Ansicht,
  type BlattBild,
  type Farbe,
  type Lineatur
} from '@rl/kern'
import { TintenEbene, ausschnitt, bildUrl, melde, mitFinger, neuerAnhang, useDaten, type Speicher, type Werkzeug } from '@rl/oberflaeche'

/** Strichstärke der Lineatur in Bildschirmpixeln, unabhängig von der Größe des Blatts */
const STAERKE = { fein: 0.5, mittel: 0.8, kraeftig: 1.1, punkt: 2.4 } as const
const TON = { fein: '#e1dbef', mittel: '#cdc3e5', kraeftig: '#b6a9d8', punkt: '#b9aed6' } as const

/** Linien, Kästchen, Punkte … als SVG unter der Tinte */
export const LineaturBild = memo(function LineaturBild({ art, format, breite = SEITE_BREITE }: { art: Lineatur; format: number; breite?: number }) {
  const schichten = lineaturSchichten(art, format)
  if (!schichten.length) return null
  // breite < 1000 zeigt nur die linke obere Ecke, in Originalgröße erkennbar (Vorschau im Menü)
  return (
    <svg className="lineatur" viewBox={`0 0 ${breite} ${Math.round(breite * format)}`} preserveAspectRatio={breite < SEITE_BREITE ? 'xMinYMin slice' : 'none'} aria-hidden="true">
      {schichten.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={TON[s.staerke]} strokeWidth={STAERKE[s.staerke]} strokeLinecap={s.staerke === 'punkt' ? 'round' : 'butt'} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
})

/** Hat dieses Blatt auf irgendeiner Seite Tinte? Dann wird es beim Schließen nur ausgeblendet. */
function blattHatTinte(alle: string[], text: (p: string) => string | undefined, anhangId: string, blatt: string): boolean {
  const muster = new RegExp(`^lernen/blaetter/${anhangId}/S\\d{3}${blatt === '1' ? '' : `-${blatt}`}\\.svg$`)
  return alle.some((p) => muster.test(p) && liesTinte(text(p) ?? '').length > 0)
}

/** Anordnung der Ansichten lesen und ändern; gespeichert wird im Datenordner, damit sie auf allen Geräten gilt */
export function useAnordnung(anhangId: string) {
  const { speicher } = useDaten()
  const pfad = pfade.blattAnordnung(anhangId)
  const anordnung = liesAnordnung(speicher.text(pfad))
  const sichere = (neu: Anordnung) => void speicher.schreibe(pfad, anordnungJson(neu))
  return {
    anordnung,
    neuesBlatt: (l: Lineatur) => sichere(neuesBlatt(anordnung, neueBlattId(anordnung, ulid()), l)),
    verschiebe: (id: string, r: -1 | 1) => sichere(verschiebeAnsicht(anordnung, id, r)),
    breiten: (b: Record<string, number>) => sichere(setzeBreiten(anordnung, b)),
    lineatur: (id: string, l: Lineatur) => sichere(setzeLineatur(anordnung, id, l)),
    schliesse: (id: string) => sichere(schliesseAnsicht(anordnung, id, id !== 'pdf' && blattHatTinte(speicher.pfade(), (p) => speicher.text(p), anhangId, id))),
    oeffne: (id: string) => sichere(oeffneAnsicht(anordnung, id)),
    /** Ziel für ein Bild: das erste offene Blatt; sonst ein ausgeblendetes wieder öffnen oder ein neues anlegen */
    zielBlatt: (): string => {
      const offen = anordnung.ansichten.find((v) => v.art === 'blatt' && !v.zu)
      if (offen) return offen.id
      const zu = anordnung.ansichten.find((v) => v.art === 'blatt')
      if (zu) {
        sichere(oeffneAnsicht(anordnung, zu.id))
        return zu.id
      }
      const id = neueBlattId(anordnung, ulid())
      sichere(neuesBlatt(anordnung, id, 'kariert'))
      return id
    }
  }
}

/** Seitenverhältnis (Höhe/Breite) eines Bilds, sobald es geladen ist */
async function verhaeltnisVon(src: string): Promise<number> {
  const i = new Image()
  i.src = src
  await i.decode().catch(() => {})
  return i.naturalWidth ? i.naturalHeight / i.naturalWidth : 0.75
}

/**
 * Bild auf ein Blatt der Seite legen (unter das unterste Bild, das Blatt wächst bei Bedarf). `src` dient nur dazu,
 * das Seitenverhältnis zu bestimmen; gespeichert wird der Verweis auf den Anhang bzw. den Ausschnitt.
 */
export async function legeBildAufBlatt(
  speicher: Speicher,
  ort: { anhangId: string; seite: number; blatt: string },
  bild: Pick<BlattBild, 'anhang' | 'seite' | 'bereich'>,
  src: string
): Promise<void> {
  const verhaeltnis = await verhaeltnisVon(src)
  const bilderPfad = pfade.blattBilder(ort.anhangId, ort.seite)
  const tintePfad = pfade.blatt(ort.anhangId, ort.seite, ort.blatt)
  const bilder = liesBilder(speicher.text(bilderPfad))
  const format = blattFormat(speicher.text(tintePfad))
  const platz = platzFuerBild(bilder, ort.blatt, verhaeltnis, format)
  if (platz.format > format) await speicher.schreibe(tintePfad, tinteSvg(liesTinte(speicher.text(tintePfad) ?? ''), SEITE_BREITE * platz.format))
  const { format: _f, ...lage } = platz
  await speicher.aendere(bilderPfad, (alt) => bilderJson([...liesBilder(alt), { id: ulid().slice(-8).toLowerCase(), blatt: ort.blatt, ...bild, ...lage }]))
  melde('Bild liegt auf dem Blatt. Mit „Lesen“ verschieben, vergrößern oder entfernen.')
}

/** Fotos aus Kamera, Galerie oder Zwischenablage ablegen und aufs Blatt legen */
export async function fotosAufBlatt(speicher: Speicher, ort: { anhangId: string; seite: number; blatt: string }, dateien: Iterable<File>) {
  for (const f of dateien) {
    if (!f.type.startsWith('image/')) continue
    const id = await neuerAnhang(speicher, f.name ? f : new File([f], `Bild ${new Date().toLocaleString('de-DE')}.png`, { type: f.type }))
    const url = URL.createObjectURL(f)
    try {
      await legeBildAufBlatt(speicher, ort, { anhang: id }, url)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** Ein Bild auf dem Blatt; mit „Lesen“ antippen, dann ziehen, an der Ecke vergrößern oder entfernen */
function BildAufBlatt({ bild, format, aktiv, gewaehlt, onWahl, onAendern, onEntfernen }: { bild: BlattBild; format: number; aktiv: boolean; gewaehlt: boolean; onWahl: () => void; onAendern: (b: BlattBild) => void; onEntfernen: () => void }) {
  const { speicher, bestand } = useDaten()
  const [src, setSrc] = useState<string | null>(null)
  const [lage, setLage] = useState<BlattBild | null>(null)
  const zug = useRef<{ art: 'ziehen' | 'groesse'; x: number; y: number; proPx: number; start: BlattBild } | null>(null)
  const quelle = bestand.dokumente.get(bild.anhang)
  const datei = typeof quelle?.felder.datei === 'string' ? quelle.felder.datei : ''
  const { seite, bereich } = bild
  useEffect(() => {
    let weg = false
    const p = seite && bereich ? (datei ? ausschnitt(speicher, datei, seite, bereich, 1400) : Promise.resolve(null)) : bildUrl(speicher, bestand, bild.anhang)
    void p.then((s) => !weg && setSrc(s))
    return () => {
      weg = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speicher, bild.anhang, datei, seite, bereich?.x, bereich?.y, bereich?.b, bereich?.h, !!quelle])
  const b = lage ?? bild
  const hoehe = SEITE_BREITE * format
  const runter = (art: 'ziehen' | 'groesse') => (e: React.PointerEvent<HTMLElement>) => {
    if (!aktiv) return
    e.stopPropagation()
    if (!gewaehlt) return onWahl()
    const flaeche = e.currentTarget.closest('.blatt-flaeche')?.getBoundingClientRect()
    if (!flaeche) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    zug.current = { art, x: e.clientX, y: e.clientY, proPx: SEITE_BREITE / flaeche.width, start: bild }
  }
  const bewegen = (e: React.PointerEvent) => {
    const z = zug.current
    if (!z) return
    const dx = (e.clientX - z.x) * z.proPx
    const dy = (e.clientY - z.y) * z.proPx
    setLage(z.art === 'ziehen' ? rueckeBild(z.start, z.start.x + dx, z.start.y + dy, z.start.b, format) : rueckeBild(z.start, z.start.x, z.start.y, z.start.b + dx, format))
  }
  const hoch = () => {
    if (zug.current && lage) onAendern(lage)
    zug.current = null
    setLage(null)
  }
  return (
    <div
      className={`blatt-bild${aktiv ? ' beweglich' : ''}${gewaehlt ? ' gewaehlt' : ''}`}
      style={{ left: `${(b.x / SEITE_BREITE) * 100}%`, top: `${(b.y / hoehe) * 100}%`, width: `${(b.b / SEITE_BREITE) * 100}%`, height: `${(b.h / hoehe) * 100}%` }}
      onPointerDown={runter('ziehen')}
      onPointerMove={bewegen}
      onPointerUp={hoch}
      onPointerCancel={hoch}
    >
      {src ? <img src={src} alt={quelle?.titel ?? 'Bild'} draggable={false} /> : <span className="klein-leise">{quelle ? 'lädt …' : 'Bild fehlt noch'}</span>}
      {gewaehlt && aktiv && (
        <>
          <button type="button" className="blatt-bild-weg" onPointerDown={(e) => e.stopPropagation()} onClick={onEntfernen} aria-label="Bild vom Blatt nehmen" title="Vom Blatt nehmen (das Bild selbst bleibt erhalten)">
            ×
          </button>
          <span className="blatt-bild-ecke" onPointerDown={runter('groesse')} onPointerMove={bewegen} onPointerUp={hoch} onPointerCancel={hoch} aria-hidden="true" />
        </>
      )}
    </div>
  )
}

/** Ein Zeichenblatt zur Skriptseite: Lineatur, Bilder, Tinte, unten „Verlängern“ (Bilder kommen über die Werkzeugleiste) */
export function Blatt({ anhangId, seite, ansicht, werkzeug, farbe }: { anhangId: string; seite: number; ansicht: Ansicht; werkzeug: Werkzeug; farbe: Farbe }) {
  const { speicher } = useDaten()
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const pfad = pfade.blatt(anhangId, seite, ansicht.id)
  const bilderPfad = pfade.blattBilder(anhangId, seite)
  const format = blattFormat(speicher.text(pfad))
  const bilder = liesBilder(speicher.text(bilderPfad)).filter((b) => b.blatt === ansicht.id)
  const lesen = werkzeug === 'lesen'
  useEffect(() => {
    if (!lesen) setGewaehlt(null)
  }, [lesen])
  const verlaengern = () => {
    // Die Striche bleiben, wo sie sind; nur die Seite wird eine A4-Höhe länger
    void speicher.schreibe(pfad, tinteSvg(liesTinte(speicher.text(pfad) ?? ''), SEITE_BREITE * (format + A4)))
  }
  const aendere = (f: (alle: BlattBild[]) => BlattBild[]) => void speicher.aendere(bilderPfad, (alt) => bilderJson(f(liesBilder(alt))))
  return (
    <>
      <div className="blatt-flaeche pdf-seite zeichnen" style={{ aspectRatio: `1 / ${format}` }} onPointerDown={() => setGewaehlt(null)}>
        <LineaturBild art={ansicht.lineatur ?? 'kariert'} format={format} />
        {bilder.map((b) => (
          <BildAufBlatt
            key={b.id}
            bild={b}
            format={format}
            aktiv={lesen}
            gewaehlt={gewaehlt === b.id}
            onWahl={() => setGewaehlt(b.id)}
            onAendern={(neu) => aendere((alle) => alle.map((x) => (x.id === neu.id ? neu : x)))}
            onEntfernen={() => {
              setGewaehlt(null)
              aendere((alle) => alle.filter((x) => x.id !== b.id))
            }}
          />
        ))}
        <TintenEbene pfad={pfad} format={format} werkzeug={werkzeug === 'markieren' ? 'stift' : werkzeug} farbe={farbe} />
      </div>
      <div className="blatt-unten">
        <button type="button" className="knopf still klein" onClick={verlaengern} title="Das Blatt um eine Seite nach unten verlängern">
          + Platz nach unten
        </button>
      </div>
    </>
  )
}

/** Kopf einer Ansicht: Name oder Lineatur, verschieben, schließen */
export function AnsichtKopf({
  ansicht,
  name,
  erste,
  letzte,
  allein,
  onLineatur,
  onVerschiebe,
  onSchliesse
}: {
  ansicht: Ansicht
  name?: ReactNode
  erste: boolean
  letzte: boolean
  allein: boolean
  onLineatur: (l: Lineatur) => void
  onVerschiebe: (r: -1 | 1) => void
  onSchliesse: () => void
}) {
  return (
    <div className="ansicht-kopf">
      {ansicht.art === 'blatt' ? (
        <select className="lineatur-wahl" value={ansicht.lineatur ?? 'kariert'} onChange={(e) => onLineatur(e.target.value as Lineatur)} aria-label="Lineatur">
          {LINEATUREN.map((l) => (
            <option key={l.art} value={l.art}>
              {l.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="ansicht-name">{name}</span>
      )}
      <span style={{ flex: 1 }} />
      {!allein && (
        <>
          <button type="button" className="knopf still klein symbol" disabled={erste} onClick={() => onVerschiebe(-1)} aria-label="Nach vorn">
            <span className="nur-breit">‹</span>
            <span className="nur-schmal">↑</span>
          </button>
          <button type="button" className="knopf still klein symbol" disabled={letzte} onClick={() => onVerschiebe(1)} aria-label="Nach hinten">
            <span className="nur-breit">›</span>
            <span className="nur-schmal">↓</span>
          </button>
          <button type="button" className="knopf still klein symbol" onClick={onSchliesse} aria-label={ansicht.art === 'pdf' ? 'Skript ausblenden' : 'Blatt schließen'} title={ansicht.art === 'pdf' ? 'Skript ausblenden' : 'Blatt schließen (Geschriebenes bleibt)'}>
            ×
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Griff zwischen zwei Ansichten: ziehen verteilt die Breite der beiden Nachbarn neu (Maus, Stift, Finger).
 * Während des Ziehens zeigt onZiehen die neuen Breiten, gespeichert wird beim Loslassen.
 */
export function Trenner({ links, rechts, onZiehen, onFertig }: { links: Ansicht; rechts: Ansicht; onZiehen: (b: Record<string, number>) => void; onFertig: (b: Record<string, number>) => void }) {
  const start = useRef<{ x: number; proPx: number; l: number; r: number } | null>(null)
  const letzte = useRef<Record<string, number> | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const berechne = (x: number) => {
    const s = start.current!
    const summe = s.l + s.r
    const min = Math.min(summe / 2, 220 * s.proPx)
    const l = Math.min(summe - min, Math.max(min, s.l + (x - s.x) * s.proPx))
    return { [links.id]: l, [rechts.id]: summe - l }
  }
  return (
    <div
      ref={ref}
      className="ansicht-trenner"
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite ändern"
      onPointerDown={(e) => {
        const a = ref.current?.previousElementSibling?.getBoundingClientRect()
        const b = ref.current?.nextElementSibling?.getBoundingClientRect()
        if (!a || !b) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, proPx: (links.breite + rechts.breite) / (a.width + b.width), l: links.breite, r: rechts.breite }
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        letzte.current = berechne(e.clientX)
        onZiehen(letzte.current)
      }}
      onPointerUp={() => {
        if (start.current && letzte.current) onFertig(letzte.current)
        start.current = null
        letzte.current = null
      }}
      onPointerCancel={() => {
        start.current = null
        letzte.current = null
        onZiehen({})
      }}
    />
  )
}

/** „+ Blatt“: neues Blatt mit Lineatur oder Ausgeblendetes wieder zeigen */
export function BlattMenue({ anordnung, onNeu, onOeffne }: { anordnung: Anordnung; onNeu: (l: Lineatur) => void; onOeffne: (id: string) => void }) {
  const [offen, setOffen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!offen) return
    const weg = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOffen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    addEventListener('pointerdown', weg, true)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', weg, true)
      removeEventListener('keydown', esc)
    }
  }, [offen])
  const zu = anordnung.ansichten.filter((v) => v.zu)
  let nr = 0
  const nummer = new Map(anordnung.ansichten.filter((v) => v.art === 'blatt').map((v) => [v.id, ++nr]))
  return (
    <div className="blatt-menue-huelle" ref={ref}>
      <button type="button" className="knopf klein" aria-expanded={offen} onClick={() => setOffen(!offen)}>
        + Blatt
      </button>
      {offen && (
        <div className="blatt-menue" role="menu">
          <div className="klein-leise">Neues Blatt</div>
          <div className="lineatur-knoepfe">
            {LINEATUREN.map((l) => (
              <button
                key={l.art}
                type="button"
                role="menuitem"
                className="lineatur-knopf"
                onClick={() => {
                  onNeu(l.art)
                  setOffen(false)
                }}
              >
                <span className="lineatur-probe">
                  <LineaturBild art={l.art} format={0.5} breite={300} />
                </span>
                {l.name}
              </button>
            ))}
          </div>
          {zu.length > 0 && (
            <>
              <div className="klein-leise">Wieder zeigen</div>
              {zu.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="menuitem"
                  className="knopf still klein"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => {
                    onOeffne(v.id)
                    setOffen(false)
                  }}
                >
                  {v.art === 'pdf' ? 'Skript' : `Blatt ${nummer.get(v.id)} · ${lineaturName(v.lineatur ?? 'kariert')}`}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Kamera und Bild in der Werkzeugleiste: legt Fotos aufs erste offene Blatt der Seite */
export function BildKnoepfe({ onDateien }: { onDateien: (d: File[]) => void }) {
  const galerie = useRef<HTMLInputElement>(null)
  const kamera = useRef<HTMLInputElement>(null)
  const nimm = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateien(Array.from(e.target.files ?? []))
    e.target.value = ''
  }
  return (
    <>
      <span className="trenner" />
      {mitFinger() && (
        <button type="button" onClick={() => kamera.current?.click()} title="Foto aufnehmen und aufs Blatt legen">
          Kamera
        </button>
      )}
      <button type="button" onClick={() => galerie.current?.click()} title="Foto, Screenshot oder Bild aufs Blatt legen (am PC auch mit Strg+V)">
        Bild
      </button>
      <input ref={galerie} type="file" accept="image/*" multiple hidden onChange={nimm} />
      <input ref={kamera} type="file" accept="image/*" capture="environment" hidden onChange={nimm} />
    </>
  )
}
