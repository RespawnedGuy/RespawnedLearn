// Löschen in Skript und Notizbuch (Vertrag Lernen 1.11, 5.4): Radierer halten, danach Rückgängig. Die Regeln stehen rein
// in `kern/loeschen.ts`; hier wird geschrieben (immer über `speicher.aendere`: bekannter Stand, sonst Konfliktkopie).
import { buchSeiteJson, legeZurueck, liesBuchSeite, liesMarken, loescheMarke, loeschwirkung, markeImBuch, ohneBild, ohneMarke, ohneSeitenverweise, ohneVerweis, pfade, stelleMarkeWieder, type BuchSeite, type Loeschwirkung, type VonDerSeite } from '@rl/kern'
import { melde, type Speicher } from '@rl/oberflaeche'

/**
 * Markierung (Baustein) im Skript oder Buch löschen: offen und ohne ✦ → Zeile weg, sonst weggelegt. Liefert die Wirkung
 * und das Rückgängig, das die alte Zeile genau wiederherstellt; null, wenn es die Markierung nicht (mehr) gibt.
 */
export async function loescheMarkierung(speicher: Speicher, texte: ReadonlyMap<string, string>, anhang: string, markeId: string): Promise<{ wirkung: Loeschwirkung; rueckgaengig: () => Promise<void> } | null> {
  const pfad = pfade.marken('lernen', anhang)
  const alt = liesMarken(speicher.text(pfad) ?? '').find((m) => m.id === markeId)
  if (!alt) return null
  const wirkung = loeschwirkung(alt, markeImBuch(texte, anhang, markeId))
  await speicher.aendere(pfad, (t) => loescheMarke(t, markeId, wirkung))
  return { wirkung, rueckgaengig: () => speicher.aendere(pfad, (t) => stelleMarkeWieder(t, alt)) }
}

/** Wie `loescheMarkierung`, mit Meldung und Rückgängig */
export async function loescheMarkierungMitMeldung(speicher: Speicher, texte: ReadonlyMap<string, string>, anhang: string, markeId: string) {
  const r = await loescheMarkierung(speicher, texte, anhang, markeId)
  if (!r) return
  melde(r.wirkung === 'entfernen' ? 'Markierung gelöscht' : 'Baustein weggelegt (zurückholen in Nutzen › Weggelegt)', () => void r.rueckgaengig())
}

export type AufDerSeite = { art: 'marke' | 'verweis' | 'bild'; id: string }

const NEHMEN: Record<AufDerSeite['art'], (s: BuchSeite, id: string) => { seite: BuchSeite; weg: VonDerSeite } | null> = {
  marke: ohneMarke,
  verweis: ohneVerweis,
  bild: ohneBild
}

/** ✦-Marke samt Ausschnitt, automatische Randmarke oder Bild von einer Buchseite nehmen; liefert das Rückgängig */
export function nimmVonDerSeite(speicher: Speicher, buchId: string, nr: number, was: AufDerSeite): Promise<(() => Promise<void>) | null> {
  return nimm(speicher, buchId, nr, (s) => NEHMEN[was.art](s, was.id))
}

async function nimm(speicher: Speicher, buchId: string, nr: number, nehmen: (s: BuchSeite) => { seite: BuchSeite; weg: VonDerSeite } | null): Promise<(() => Promise<void>) | null> {
  const pfad = pfade.buchSeite(buchId, nr)
  let weg: VonDerSeite | null = null
  await speicher.aendere(pfad, (t) => {
    const r = nehmen(liesBuchSeite(t))
    if (!r) return t
    weg = r.weg
    return buchSeiteJson(r.seite)
  })
  const w: VonDerSeite | null = weg
  if (!w) return null
  return () => speicher.aendere(pfad, (t) => buchSeiteJson(legeZurueck(liesBuchSeite(t), w)))
}

const MELDUNG: Record<AufDerSeite['art'], string> = {
  marke: 'Marke und Ausschnitt entfernt. Die Markierung im Skript bleibt.',
  verweis: 'Randmarke entfernt',
  bild: 'Bild vom Blatt genommen (das Bild selbst bleibt erhalten)'
}

export async function nimmVonDerSeiteMitMeldung(speicher: Speicher, buchId: string, nr: number, was: AufDerSeite) {
  const zurueck = await nimmVonDerSeite(speicher, buchId, nr, was)
  if (zurueck) melde(MELDUNG[was.art], () => void zurueck())
}

/**
 * Seitenverweise lösen (Nils 2026-11-17): eine Skriptseite (✕ in der Blase oder im „✎ n“) oder mit `ziel` null alle
 * (Radierer + Halten auf der Blase). ✦-Marken bleiben. Schreibt man später mit derselben Skriptseite weiter, entsteht
 * der Verweis neu.
 */
export async function loeseSeitenverweise(speicher: Speicher, buchId: string, nr: number, ziel: { anhang: string; seite: number } | null) {
  const zurueck = await nimm(speicher, buchId, nr, (s) => ohneSeitenverweise(s, ziel))
  if (zurueck) melde(ziel ? `Verweis auf Seite ${ziel.seite} gelöst` : 'Seitenverweise gelöst', () => void zurueck())
}
