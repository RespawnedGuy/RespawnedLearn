// Tafelwerk (Vertrag Lernen 1.13): Tabs anlegen und weglegen, Bausteine hineinlegen oder ablehnen. Ein Tab ist ein
// Notizbuch mit `art: tafelwerk`; hineingelegt wird wie beim Einfügen, als Ausschnitt mit ✦-Verweis aufs Original.
import { useMemo } from 'react'
import { buchDokument, imTafelwerk, liesNein, neinZeile, pfade, setzeFeld, tafeln, ulid, type Baustein, type Bestand, type Eintrag, type Kopie } from '@rl/kern'
import { ausschnitt, geraet, melde, useDaten, type Speicher } from '@rl/oberflaeche'
import { fuegeAnsEnde, verhaeltnisVon } from './kopieren'

/** Neuer Tab, ohne Lineatur, ohne Modul (das Tafelwerk gehört allen Modulen) */
export async function neuerTab(speicher: Speicher, titel: string): Promise<string> {
  const id = ulid()
  await speicher.schreibe(pfade.buch(id), buchDokument({ id, titel: titel.trim() || 'Neuer Tab', lineatur: 'leer', art: 'tafelwerk', erstellt: new Date().toISOString() }))
  return id
}

/** Tab weglegen oder zurückholen (`status: archiviert`); gelöscht wird nichts */
export async function legeTabWeg(speicher: Speicher, id: string, weg: boolean) {
  await speicher.aendere(pfade.buch(id), (t) => setzeFeld(setzeFeld(t, 'status', weg ? 'archiviert' : undefined), 'geaendert', new Date().toISOString()))
}

/** Weggelegte Tabs, die zuletzt geänderten zuerst */
export function weggelegteTabs(dokumente: Iterable<Eintrag>): Eintrag[] {
  return [...dokumente]
    .filter((e) => e.typ === 'notizbuch' && e.felder.art === 'tafelwerk' && e.felder.status === 'archiviert')
    .sort((a, b) => String(b.felder.geaendert ?? '').localeCompare(String(a.felder.geaendert ?? '')))
}

/** Kopie einer Markierung: im Buch folgt das Verhältnis aus dem Bereich, im Skript aus dem Seitenbild */
export async function kopieVonBaustein(speicher: Speicher, bestand: Bestand, b: Baustein): Promise<Kopie | null> {
  const doc = bestand.dokumente.get(b.anhang)
  if (!doc) return null
  const { bereich, seite, id } = b.marke
  let verhaeltnis = bereich.b > 0 ? bereich.h / bereich.b : 0.5
  if (doc.typ !== 'notizbuch') {
    const src = await ausschnitt(speicher, String(doc.felder.datei ?? ''), seite, bereich, 600)
    if (src) verhaeltnis = await verhaeltnisVon(src)
  }
  return { anhang: b.anhang, seite, bereich: { ...bereich }, marke: id, verhaeltnis }
}

/** Baustein ans Ende eines Tabs legen, mit Meldung und Rückgängig */
export async function insTafelwerk(speicher: Speicher, bestand: Bestand, b: Baustein, tab: string) {
  const k = await kopieVonBaustein(speicher, bestand, b)
  if (!k) return
  const { zurueck } = await fuegeAnsEnde(speicher, tab, k)
  melde(`Steht jetzt in „${bestand.dokumente.get(tab)?.titel ?? 'Tafelwerk'}“.`, () => void zurueck())
}

/** „Nein“: in die Datei dieses Geräts, nur anhängen (Lernen 1.13) */
export async function nichtInsTafelwerk(speicher: Speicher, b: Baustein, g = geraet()) {
  const zeile = neinZeile(b.anhang, b.marke.id, new Date().toISOString())
  await speicher.aendere(pfade.tafelNein(g), (alt) => (alt && !alt.endsWith('\n') ? alt + '\n' : alt) + zeile)
}

/** Tabs, was darin liegt (Baustein → Tabs) und was abgelehnt ist; gerechnet, nicht gespeichert */
export function useTafelwerk() {
  const { bestand } = useDaten()
  return useMemo(() => {
    const tabs = tafeln(bestand.dokumente.values())
    // auch weggelegte Tabs zählen, damit ein Baustein darin nicht wieder angeboten wird
    const alleTabs = new Set([...bestand.dokumente.values()].filter((e) => e.typ === 'notizbuch' && e.felder.art === 'tafelwerk').map((e) => e.id))
    return { tabs, alleTabs, drin: imTafelwerk(bestand.texte, alleTabs), nein: liesNein(bestand.texte) }
  }, [bestand])
}
