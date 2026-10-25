// Berichtsvorlagen (Vertrag 5.2, `vorlage` mit `art: bericht`): ein fertiger Baustein, der an der Cursorstelle
// als Bericht ins Journal geschrieben wird. Listenpunkte `- Text` werden eigene Aufgaben, `- [ ]` bleiben
// Checkpunkte, Tabellen bleiben Markdown. Eine Überschrift mit `#danach` ist ein Abschnitt, der erst bedienbar
// wird, wenn alles darüber im selben Bericht erledigt ist.
import { linkText } from './aufgaben'
import { findeLinks } from './links'
import { fuelle } from './vorlagen'

/** `#danach` in einer Überschrift (wie `#wichtig`) */
export const DANACH = /(?:^|\s+)#danach(?=\s|$)/i

const UEBERSCHRIFT = /^(#{1,6})\s+(.*)$/
const CODE = /^\s*(```|~~~)/
/** Listenpunkt ohne Haken und ohne Link: wird in einer Berichtsvorlage eine Aufgabe */
const LISTENPUNKT = /^(\s*)[-*] +(?!\[[ xX]\])(?!.*\[\[)(.*\S)\s*$/
const HAKEN_OFFEN = /^\s*[-*] \[ \]/
const MARKE = '\u0000'

export interface VorlagenAufgabe {
  id: string
  titel: string
  /** Aufgaben aus der Vorlage, die vorher erledigt sein müssen (Abschnitt mit `#danach`) */
  blockiertDurch: string[]
}

function ebene(zeile: string): number {
  const u = UEBERSCHRIFT.exec(zeile)
  return u ? u[1].length : 0
}

/**
 * Füllt eine Berichtsvorlage: Platzhalter wie bei jeder Vorlage, dazu wird jeder Listenpunkt `- Text` eine Aufgabe
 * mit neuer ID (`- [[ID|Text]]`). Aufgaben unter einer Überschrift mit `#danach` hängen an allen Aufgaben davor
 * im selben Bericht. Die Dateien legt der Aufrufer an.
 */
export function fuelleBericht(vorlage: string, neueId: () => string, heute?: string): { text: string; cursor: number; aufgaben: VorlagenAufgabe[] } {
  const f = fuelle(vorlage, heute)
  const mitMarke = f.text.slice(0, f.cursor) + MARKE + f.text.slice(f.cursor)
  const aufgaben: VorlagenAufgabe[] = []
  let bisher: string[] = []
  let danach: { ebene: number; vorher: string[] } | null = null
  let imCode = false
  const zeilen = mitMarke.split('\n').map((z) => {
    if (CODE.test(z)) imCode = !imCode
    if (imCode) return z
    const e = ebene(z)
    if (e) {
      if (e <= 2) bisher = []
      if (danach && e <= danach.ebene) danach = null
      if (DANACH.test(z) && !danach) danach = { ebene: e, vorher: [...bisher] }
      return z
    }
    const m = LISTENPUNKT.exec(z)
    if (!m) return z
    // Steht der Cursor im Punkt, bleibt er zum Weiterschreiben Text; am Ende steht er hinter dem Link
    const titel = m[2].replace(new RegExp(`${MARKE}$`), '').trim()
    if (!titel || titel.includes(MARKE)) return z
    const id = neueId()
    aufgaben.push({ id, titel, blockiertDurch: danach ? danach.vorher : [] })
    bisher.push(id)
    return `${m[1]}- [[${id}|${linkText(titel)}]]${m[2].endsWith(MARKE) ? MARKE : ''}`
  })
  const voll = zeilen.join('\n')
  const cursor = voll.indexOf(MARKE)
  return { text: voll.replace(MARKE, ''), cursor, aufgaben }
}

/** Steht die letzte Zeile (Cursorzeile) schon in einem Bericht, also unter einer H2 statt direkt unter einer H1? */
export function imBericht(zeilenBisCursor: string[]): boolean {
  for (let i = zeilenBisCursor.length - 1; i >= 0; i--) {
    const e = ebene(zeilenBisCursor[i])
    if (e === 1) return false
    if (e === 2) return true
  }
  return false
}

export interface DanachAbschnitt {
  /** Zeile der Überschrift (0-basiert) */
  kopf: number
  /** erste Zeile nach dem Abschnitt (0-basiert, exklusiv) */
  bis: number
  /** noch nicht bedienbar: darüber ist im selben Bericht etwas offen */
  gesperrt: boolean
}

/**
 * Alle Abschnitte mit `#danach` und ob sie noch gesperrt sind. Offen ist darüber, vom Beginn des Berichts
 * (letzte H1 oder H2) bis zur Überschrift: ein Checkpunkt `- [ ]` oder ein Link auf eine Aufgabe, für die
 * `offen(id)` true liefert (false: erledigt, null: keine Aufgabe).
 */
export function danachAbschnitte(zeilen: string[], offen: (id: string) => boolean | null): DanachAbschnitt[] {
  const ebenen: number[] = []
  const istOffen: boolean[] = []
  let imCode = false
  for (const z of zeilen) {
    if (CODE.test(z)) imCode = !imCode
    const e = imCode ? 0 : ebene(z)
    ebenen.push(e)
    istOffen.push(!imCode && !e && (HAKEN_OFFEN.test(z) || findeLinks(z).some((l) => !l.einbettung && offen(l.ziel) === true)))
  }
  const ergebnis: DanachAbschnitt[] = []
  for (let k = 0; k < zeilen.length; k++) {
    const e = ebenen[k]
    if (!e || !DANACH.test(zeilen[k])) continue
    let bis = k + 1
    while (bis < zeilen.length && !(ebenen[bis] && ebenen[bis] <= e)) bis++
    let von = k - 1
    while (von >= 0 && !(ebenen[von] && ebenen[von] <= 2)) von--
    let gesperrt = false
    for (let i = Math.max(von, 0); i < k && !gesperrt; i++) if (istOffen[i]) gesperrt = true
    ergebnis.push({ kopf: k, bis, gesperrt })
  }
  return ergebnis
}

/** Was eine Berichtsvorlage enthält, für die Rückmeldung beim Bearbeiten */
export function zaehleBericht(vorlage: string) {
  let n = 0
  const { aufgaben } = fuelleBericht(vorlage, () => String(n++))
  const zeilen = vorlage.split('\n')
  return {
    aufgaben: aufgaben.length,
    haken: zeilen.filter((z) => HAKEN_OFFEN.test(z)).length,
    tabellen: zeilen.filter((z, i) => /^\s*\|/.test(z) && !/^\s*\|/.test(zeilen[i - 1] ?? '')).length,
    danach: zeilen.filter((z) => ebene(z) && DANACH.test(z)).length
  }
}
