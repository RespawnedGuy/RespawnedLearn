// Löschen in Skript und Notizbuch (Vertrag Lernen 1.11, 5.4): mit dem Radierer durch Halten. Was nachweislich nichts
// trägt, verschwindet; alles andere wird weggelegt (`#archiv`) und lässt sich zurückholen. Jede Wirkung hat ihr
// Gegenstück, das den alten Stand genau wiederherstellt (Rückgängig).
import { archiviere, istOffen, liesBausteinText } from './bausteine'
import { liesBuchSeite, type BuchBild, type BuchSeite, type Verweis } from './buecher'
import { liesMarken, markenZeile, setzeMarke, entferneMarke, type Marke } from './marken'

export type Loeschwirkung = 'entfernen' | 'weglegen'

/** Wie wird gelöscht? Entfernt wird nur eine offene Markierung, auf die keine ✦-Marke in einem Buch zeigt. */
export function loeschwirkung(m: Pick<Marke, 'text'>, imBuch: boolean): Loeschwirkung {
  return istOffen(liesBausteinText(m.text)) && !imBuch ? 'entfernen' : 'weglegen'
}

const BUCHSEITE = /^lernen\/buecher\/[^/]+\/S\d{3}\.json$/

/** Zeigt eine ✦-Marke irgendeines Notizbuchs auf diese Markierung? */
export function markeImBuch(texte: ReadonlyMap<string, string>, anhang: string, markeId: string): boolean {
  for (const [pfad, text] of texte) {
    if (!BUCHSEITE.test(pfad) || !text.includes(markeId)) continue
    if (liesBuchSeite(text).verweise.some((v) => v.marke === markeId && v.anhang === anhang)) return true
  }
  return false
}

/** Nur was auf der Seite zu sehen ist: weggelegte Markierungen nicht (ab Lernen 1.11) */
export function sichtbareMarken(marken: Marke[]): Marke[] {
  return marken.filter((m) => !liesBausteinText(m.text).archiviert)
}

/** Wirkung auf den Text der Markierungsdatei; unbekannte Markierung: Text bleibt */
export function loescheMarke(text: string, id: string, wirkung: Loeschwirkung): string {
  const m = liesMarken(text).find((x) => x.id === id)
  if (!m) return text
  if (wirkung === 'entfernen') return entferneMarke(text, id)
  const neu = archiviere(m.text, true)
  return neu === m.text ? text : setzeMarke(text, { ...m, text: neu })
}

/**
 * Rückgängig: die alte Zeile genau so zurück, an ihre alte Stelle. Gibt es die Markierung noch (weggelegt), wird ihre
 * Zeile ersetzt; sonst an der alten Zeilennummer eingefügt.
 */
export function stelleMarkeWieder(text: string, alt: Marke): string {
  if (liesMarken(text).some((x) => x.id === alt.id)) return setzeMarke(text, alt)
  const zeilen = text.split('\n')
  zeilen.splice(Math.min(alt.zeile, zeilen.length), 0, markenZeile(alt))
  return zeilen.join('\n')
}

/** Was von einer Buchseite genommen wurde, mit Platz, damit Rückgängig es genau so zurücklegt */
export interface VonDerSeite {
  verweis?: Verweis
  bild?: { bild: BuchBild; stelle: number }
}

/** Randmarke ohne Markierung (automatisch beim Schreiben) von der Seite nehmen; null, wenn es sie nicht gibt */
export function ohneVerweis(s: BuchSeite, id: string): { seite: BuchSeite; weg: VonDerSeite } | null {
  const v = s.verweise.find((w) => w.id === id)
  if (!v) return null
  return { seite: { ...s, verweise: s.verweise.filter((w) => w !== v) }, weg: { verweis: v } }
}

/** Bild vom Blatt nehmen (die Bilddatei bleibt); null, wenn es das Bild nicht gibt */
export function ohneBild(s: BuchSeite, id: string): { seite: BuchSeite; weg: VonDerSeite } | null {
  const stelle = s.bilder.findIndex((b) => b.id === id)
  if (stelle < 0) return null
  return { seite: { ...s, bilder: s.bilder.filter((_, i) => i !== stelle) }, weg: { bild: { bild: s.bilder[stelle], stelle } } }
}

/** ✦-Marke samt Ausschnitt (wie `ohneMarkeImBuch`), aber mit dem, was wegging */
export function ohneMarke(s: BuchSeite, verweisId: string): { seite: BuchSeite; weg: VonDerSeite } | null {
  const v = s.verweise.find((w) => w.id === verweisId)
  if (!v || v.marke === undefined) return null
  const gehoert = v.bild !== undefined
    ? (b: BuchBild) => b.id === v.bild
    : (b: BuchBild) => b.bereich !== undefined && b.anhang === v.anhang && b.seite === v.seite && Math.abs(b.y - v.y) < 0.5
  const stelle = s.bilder.findIndex(gehoert)
  return {
    seite: { ...s, bilder: stelle < 0 ? s.bilder : s.bilder.filter((_, i) => i !== stelle), verweise: s.verweise.filter((w) => w !== v) },
    weg: { verweis: v, ...(stelle < 0 ? {} : { bild: { bild: s.bilder[stelle], stelle } }) }
  }
}

/** Rückgängig auf der Buchseite: was noch fehlt, kommt an seinen alten Platz zurück */
export function legeZurueck(s: BuchSeite, weg: VonDerSeite): BuchSeite {
  const verweise = weg.verweis && !s.verweise.some((w) => w.id === weg.verweis!.id) ? [...s.verweise, weg.verweis] : s.verweise
  let bilder = s.bilder
  if (weg.bild && !bilder.some((b) => b.id === weg.bild!.bild.id)) {
    bilder = [...bilder]
    bilder.splice(Math.min(weg.bild.stelle, bilder.length), 0, weg.bild.bild)
  }
  return { ...s, verweise, bilder }
}

/** Oberstes Bild unter einem Punkt (Seitenkoordinaten, Breite 1000) */
export function bildAn(bilder: BuchBild[], x: number, y: number): BuchBild | null {
  for (let i = bilder.length - 1; i >= 0; i--) {
    const b = bilder[i]
    if (x >= b.x && x <= b.x + b.b && y >= b.y && y <= b.y + b.h) return b
  }
  return null
}
