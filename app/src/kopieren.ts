// Kopieren und Einfügen (Vertrag Lernen 1.12, 5.3): Kopieren legt eine gespeicherte Markierung in die Ablage des
// Geräts, Einfügen legt ihren Ausschnitt mit ✦-Marke an die angetippte Stelle einer Buchseite. Geschrieben wird über
// `speicher.aendere` (bekannter Stand, sonst Konfliktkopie), Rückgängig nimmt Marke und Ausschnitt wieder weg.
import { useEffect, useRef } from 'react'
import { blattFormat, buchSeiteJson, buchSeitenNummern, kurzId, legeEin, liesBuchSeite, liesTinte, ortAmEnde, pfade, strichLage, type Kopie } from '@rl/kern'
import { melde, type Speicher } from '@rl/oberflaeche'
import { legeInAblage, letzterOrt } from './ablage'
import { nimmVonDerSeite } from './loeschen'

/** Höhe durch Breite eines Bildes (Ausschnitt aus dem Skript) */
export async function verhaeltnisVon(src: string): Promise<number> {
  const i = new Image()
  i.src = src
  await i.decode().catch(() => {})
  return i.naturalWidth ? i.naturalHeight / i.naturalWidth : 0.75
}

/** Kopie in die Ablage; im Buch steht der Bereich in Seitenbreiten, das Verhältnis folgt daraus */
export function kopiere(k: Kopie) {
  legeInAblage(k)
  melde('Kopiert. Im Notizbuch mit „Markieren“ an die Stelle tippen und einfügen.')
}

/**
 * Kopie an `ort` (Seitenkoordinaten, Breite 1000; mit `b` aus einem aufgezogenen Rechteck) auf Seite `nr` des Buchs
 * legen. Liefert das Rückgängig.
 */
export async function fuegeEin(speicher: Speicher, buchId: string, nr: number, k: Kopie, ort: { x: number; y: number; b?: number }): Promise<() => Promise<void>> {
  const pfad = pfade.buchSeite(buchId, nr)
  const format = blattFormat(speicher.text(pfade.buchTinte(buchId, nr)))
  const ids = { bild: kurzId(), verweis: kurzId() }
  const am = new Date().toISOString()
  await speicher.aendere(pfad, (t) => buchSeiteJson(legeEin(liesBuchSeite(t), k, ort, format, ids, am).seite))
  return async () => {
    await nimmVonDerSeite(speicher, buchId, nr, { art: 'marke', id: ids.verweis })
  }
}

export async function fuegeEinMitMeldung(speicher: Speicher, buchId: string, nr: number, k: Kopie, ort: { x: number; y: number; b?: number }) {
  const zurueck = await fuegeEin(speicher, buchId, nr, k, ort)
  melde('Eingefügt', () => void zurueck())
}

/**
 * Kopie ans Ende eines Buchs: unter das Unterste der letzten Seite, passt sie dort nicht mehr, oben auf die nächste.
 * Liefert Seite und Rückgängig.
 */
export async function fuegeAnsEnde(speicher: Speicher, buchId: string, k: Kopie): Promise<{ nr: number; zurueck: () => Promise<void> }> {
  const da = buchSeitenNummern(speicher.pfade(), buchId)
  let nr = da[da.length - 1] ?? 1
  const lage = (n: number) => {
    const tinte = speicher.text(pfade.buchTinte(buchId, n)) ?? ''
    return ortAmEnde(liesBuchSeite(speicher.text(pfade.buchSeite(buchId, n))).bilder, liesTinte(tinte).map(strichLage), k, blattFormat(tinte))
  }
  let ort: { x: number; y: number; b?: number } | null = lage(nr)
  if (!ort) {
    nr += 1
    ort = lage(nr) ?? { x: 0, y: 0 }
  }
  return { nr, zurueck: await fuegeEin(speicher, buchId, nr, k, ort) }
}

/**
 * Knopf „Einfügen“ der Werkzeugleiste: an die zuletzt angetippte Stelle, wenn sie in einem der `buecher` liegt, sonst
 * ans Ende des ersten. Nichts in der Ablage oder kein Buch: nichts.
 */
export async function fuegeEinPerKnopf(speicher: Speicher, buecher: string[], k: Kopie | null) {
  if (!k || !buecher.length) return
  const o = letzterOrt()
  if (o && buecher.includes(o.buch)) return fuegeEinMitMeldung(speicher, o.buch, o.nr, k, o)
  const { zurueck } = await fuegeAnsEnde(speicher, buecher[0], k)
  melde('Eingefügt', () => void zurueck())
}

const schreibtGerade = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t as HTMLElement | null)?.isContentEditable === true

/** Strg+C kopiert das Gewählte, solange `fn` gesetzt ist; in Eingabefeldern bleibt Strg+C beim Text */
export function useKopierTaste(fn: (() => void) | null) {
  const ref = useRef(fn)
  ref.current = fn
  const an = fn !== null
  useEffect(() => {
    if (!an) return
    const kopieren = (e: ClipboardEvent) => {
      if (!ref.current || schreibtGerade(e.target) || getSelection()?.toString()) return
      e.preventDefault()
      ref.current()
    }
    addEventListener('copy', kopieren)
    return () => removeEventListener('copy', kopieren)
  }, [an])
}

/** Strg+V ohne Bilder in der Zwischenablage des Systems: `fn` fügt die eigene Kopie ein und sagt, ob es etwas tat */
export function useEinfuegeTaste(fn: () => boolean) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const einfuegen = (e: ClipboardEvent) => {
      if (schreibtGerade(e.target)) return
      if (Array.from(e.clipboardData?.files ?? []).some((f) => f.type.startsWith('image/'))) return
      if (ref.current()) e.preventDefault()
    }
    addEventListener('paste', einfuegen)
    return () => removeEventListener('paste', einfuegen)
  }, [])
}
