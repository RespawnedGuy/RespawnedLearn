// Das Tagesjournal ist die Quelle der Arbeits-App. Eine H1 mit Projekttag (`# #dd_os_76`) ordnet alles
// darunter dem Projekt zu, bis zur nächsten H1. Status steht am Ende einer Überschrift (`### Mangel 1 - blockiert`).
// Alle Zeilennummern zählen in der ganzen Datei (inklusive Frontmatter), damit Änderungen genau zurückfinden.

import { findeLinks } from './links'

export const STATUS = ['offen', 'blockiert', 'wartet', 'erledigt', 'gelöst'] as const
export type Status = (typeof STATUS)[number]

export interface Abschnitt {
  ebene: number
  titel: string
  status: Status | null
  anker: string | null
  /** `#wichtig` an der Überschrift */
  wichtig: boolean
  /** `#unterpunkt` an einer H2: nur eine Überschrift, kein Bericht */
  unterpunkt: boolean
  /** Projektkürzel aus der umgebenden H1, null außerhalb eines Projekts */
  projekt: string | null
  /** Zeile der Überschrift */
  von: number
  /** erste Zeile nach dem Abschnitt (exklusiv) */
  bis: number
}

export interface ProjektBlock {
  kuerzel: string
  /** Zusatz hinter dem Tag in der H1, z. B. `# #dd_os_76 Begehung` */
  zusatz: string
  von: number
  bis: number
  /** der wievielte Block dieses Projekts in der Datei (0-basiert), für stabiles Zurückschreiben */
  nr: number
}

export interface Aufgabe {
  zeile: number
  erledigt: boolean
  text: string
  projekt: string | null
  /** Überschriften-Pfad ohne die Projekt-H1, z. B. ["Mängelanzeige", "Mangel 1"] */
  pfad: string[]
}

export interface Blockade {
  zeile: number
  titel: string
  wenn: string
  dann: string
  pruefen: string | null
  projekt: string | null
  pfad: string[]
}

/**
 * Ein Eintrag im Journal: alles unter einer H1 bis zur nächsten, mit oder ohne Projekttag. Text vor der
 * ersten H1 zählt als eigener Eintrag ohne Kopf. Das ist die Einheit, mit der der Review arbeitet.
 */
export interface Teil {
  /** der wievielte Eintrag in der Datei (0-basiert) */
  nr: number
  von: number
  /** erste Zeile nach dem Eintrag (exklusiv) */
  bis: number
  /** die H1-Zeile im Rohtext, '' beim Text vor der ersten H1 */
  kopf: string
  kuerzel: string | null
  /** Text der H1 ohne Projekttag, z. B. „Begehung“ oder „Allgemein“ */
  zusatz: string
  wichtig: boolean
}

export interface Gliederung {
  abschnitte: Abschnitt[]
  bloecke: ProjektBlock[]
  teile: Teil[]
  aufgaben: Aufgabe[]
  blockaden: Blockade[]
  /** Zeile, an der der Rumpf beginnt (nach dem Frontmatter) */
  rumpfStart: number
}

const TAG = /^#([\p{L}\d_][\p{L}\d_/-]*)(?:\s+(.*))?$/u
const UEBERSCHRIFT = /^(#{1,6})[ \t]+(.*?)[ \t]*$/
const STATUS_ENDE = new RegExp(`\\s+[-–]\\s+(${STATUS.join('|')})$`, 'i')
const ANKER_ENDE = /\s+\^([a-z0-9-]+)$/i
const AUFGABE = /^(\s*)[-*] \[( |x|X)\] (.*)$/
const BLOCKADE = /^>\s*\[!blockade\][+-]?\s*(.*)$/i
const WICHTIG = /(^|\s+)#wichtig(?=\s|$)/gi
const UNTERPUNKT = /(^|\s+)#unterpunkt(?=\s|$)/gi

export function rumpfStart(zeilen: string[]): number {
  if (zeilen[0]?.trim() !== '---') return 0
  for (let i = 1; i < zeilen.length; i++) if (zeilen[i].trim() === '---') return i + 1
  return 0
}

export function zerlegeUeberschrift(roh: string): { titel: string; status: Status | null; anker: string | null; wichtig: boolean; unterpunkt: boolean } {
  let titel = roh
  let anker: string | null = null
  const a = ANKER_ENDE.exec(titel)
  if (a) {
    anker = a[1]
    titel = titel.slice(0, a.index)
  }
  const ohne = titel.replace(WICHTIG, '')
  const wichtig = ohne !== titel
  titel = ohne.replace(UNTERPUNKT, '')
  const unterpunkt = titel !== ohne
  let status: Status | null = null
  const s = STATUS_ENDE.exec(titel)
  if (s) {
    status = s[1].toLowerCase() as Status
    titel = titel.slice(0, s.index)
  }
  return { titel: titel.trim(), status, anker, wichtig, unterpunkt }
}

export function projektTag(h1Titel: string): { kuerzel: string; zusatz: string } | null {
  const m = TAG.exec(h1Titel.trim())
  return m ? { kuerzel: m[1], zusatz: (m[2] ?? '').trim() } : null
}

export function gliedere(text: string): Gliederung {
  const zeilen = text.split('\n')
  const start = rumpfStart(zeilen)
  const abschnitte: Abschnitt[] = []
  const bloecke: ProjektBlock[] = []
  const aufgaben: Aufgabe[] = []
  const blockaden: Blockade[] = []
  const teile: Teil[] = []
  const zaehler = new Map<string, number>()
  let teil: Teil | null = null

  let projekt: string | null = null
  let block: ProjektBlock | null = null
  const stapel: Abschnitt[] = []
  let imCode = false

  const schliesse = (ebene: number, zeile: number) => {
    while (stapel.length && stapel[stapel.length - 1].ebene >= ebene) stapel.pop()!.bis = zeile
  }
  const pfad = () => stapel.filter((a) => !(a.ebene === 1 && a.projekt)).map((a) => a.titel)

  for (let i = start; i < zeilen.length; i++) {
    const z = zeilen[i]
    if (/^\s*(```|~~~)/.test(z)) imCode = !imCode
    if (imCode) continue
    const u = UEBERSCHRIFT.exec(z)
    if (u) {
      const ebene = u[1].length
      schliesse(ebene, i)
      const zerlegt = zerlegeUeberschrift(u[2])
      if (ebene === 1) {
        if (block) block.bis = i
        if (teil) teil.bis = i
        else if (zeilen.slice(start, i).some((x) => x.trim() !== '')) teile.push({ nr: 0, von: start, bis: i, kopf: '', kuerzel: null, zusatz: '', wichtig: false })
        const tag = projektTag(zerlegt.titel)
        projekt = tag?.kuerzel ?? null
        block = null
        if (tag) {
          const nr = zaehler.get(tag.kuerzel) ?? 0
          zaehler.set(tag.kuerzel, nr + 1)
          block = { kuerzel: tag.kuerzel, zusatz: tag.zusatz, von: i, bis: zeilen.length, nr }
          bloecke.push(block)
        }
        teil = { nr: teile.length, von: i, bis: zeilen.length, kopf: z, kuerzel: projekt, zusatz: tag ? tag.zusatz : zerlegt.titel, wichtig: zerlegt.wichtig }
        teile.push(teil)
      }
      const a: Abschnitt = { ebene, ...zerlegt, projekt, von: i, bis: zeilen.length }
      abschnitte.push(a)
      stapel.push(a)
      continue
    }
    const t = AUFGABE.exec(z)
    if (t) {
      aufgaben.push({ zeile: i, erledigt: t[2] !== ' ', text: t[3].trim(), projekt, pfad: pfad() })
      continue
    }
    const b = BLOCKADE.exec(z)
    if (b) {
      const bl: Blockade = { zeile: i, titel: b[1].trim(), wenn: '', dann: '', pruefen: null, projekt, pfad: pfad() }
      for (let j = i + 1; j < zeilen.length && zeilen[j].startsWith('>'); j++) {
        const f = /^>\s*(Wenn|Dann|Prüfen|Pruefen):\s*(.*)$/i.exec(zeilen[j])
        if (!f) continue
        const k = f[1].toLowerCase()
        if (k === 'wenn') bl.wenn = f[2].trim()
        else if (k === 'dann') bl.dann = f[2].trim()
        else bl.pruefen = f[2].trim() || null
      }
      blockaden.push(bl)
    }
  }
  if (!teil && zeilen.slice(start).some((x) => x.trim() !== '')) teile.push({ nr: 0, von: start, bis: zeilen.length, kopf: '', kuerzel: null, zusatz: '', wichtig: false })
  return { abschnitte, bloecke, teile, aufgaben, blockaden, rumpfStart: start }
}

/** Hakt eine Aufgabe ab oder wieder auf. Ändert nur die eine Zeile. */
export function schalteAufgabe(text: string, zeile: number): string {
  const zeilen = text.split('\n')
  const m = AUFGABE.exec(zeilen[zeile] ?? '')
  if (!m) return text
  zeilen[zeile] = zeilen[zeile].replace(/\[( |x|X)\]/, m[2] === ' ' ? '[x]' : '[ ]')
  return zeilen.join('\n')
}

/** Setzt oder entfernt den Status am Ende einer Überschrift (`### Mangel 1 - blockiert`). */
export function setzeStatus(text: string, zeile: number, status: Status | null): string {
  const zeilen = text.split('\n')
  const u = UEBERSCHRIFT.exec(zeilen[zeile] ?? '')
  if (!u) return text
  const t = zerlegeUeberschrift(u[2])
  zeilen[zeile] = ueberschrift(u[1], t.titel, t.wichtig, status, t.anker)
  return zeilen.join('\n')
}

function ueberschrift(rauten: string, titel: string, wichtig: boolean, status: Status | null, anker: string | null) {
  return `${rauten} ${titel}${wichtig ? ' #wichtig' : ''}${status ? ` - ${status}` : ''}${anker ? ` ^${anker}` : ''}`.replace(/^(#+)  +/, '$1 ')
}

/** Markiert eine Überschrift als wichtig (`#wichtig` vor dem Status) oder nimmt die Markierung weg. */
export function setzeWichtig(text: string, zeile: number, wichtig: boolean): string {
  const zeilen = text.split('\n')
  const u = UEBERSCHRIFT.exec(zeilen[zeile] ?? '')
  if (!u) return text
  const t = zerlegeUeberschrift(u[2])
  if (t.wichtig === wichtig) return text
  zeilen[zeile] = ueberschrift(u[1], t.titel, wichtig, t.status, t.anker)
  return zeilen.join('\n')
}

/** Text eines Eintrags ohne Leerzeilen am Ende */
export function teilText(text: string, t: { von: number; bis: number }): string {
  return blockText(text, t)
}

/**
 * Ersetzt einen Eintrag (Zeilen von..bis, inklusive H1). Der Eintrag wird über Nummer und Kopfzeile
 * wiedererkannt; ist er nicht mehr eindeutig zu finden (anderes Gerät war schneller), bleibt der Text unverändert.
 * Leerer neuer Text löscht den Eintrag samt Abstand.
 */
export function ersetzeTeil(text: string, nr: number, kopf: string, neu: string): string {
  const alle = gliedere(text).teile
  let t = alle.find((x) => x.nr === nr && x.kopf === kopf)
  // Hat sich die Nummer verschoben (Eintrag davor gelöscht), reicht eine eindeutige Kopfzeile
  if (!t) {
    const gleich = alle.filter((x) => x.kopf === kopf)
    if (gleich.length !== 1) return text
    t = gleich[0]
  }
  const zeilen = text.split('\n')
  let ende = t.bis
  while (ende > t.von + 1 && zeilen[ende - 1].trim() === '') ende--
  if (neu.trim() === '') {
    // Leerzeilen danach mitnehmen, damit keine Lücke bleibt
    while (ende < zeilen.length && zeilen[ende].trim() === '') ende++
    zeilen.splice(t.von, ende - t.von)
  } else zeilen.splice(t.von, ende - t.von, ...neu.replace(/\n+$/, '').split('\n'))
  return zeilen.join('\n').replace(/\n*$/, '\n')
}

const OFFEN_STATUS = new Set<Status>(['offen', 'blockiert', 'wartet'])

/**
 * Trennt einen Eintrag für einen Bericht: Was noch offen ist (Aufgaben `- [ ]`, ungelöste Blockaden und
 * Überschriften mit Status offen/blockiert/wartet), bleibt im Journal, damit „Offen“ vollständig bleibt.
 * Alles andere wandert in den Bericht. Die Reihenfolge bleibt erhalten.
 */
export function trenneOffenes(rumpf: string, offeneAufgabe?: (id: string) => boolean): { bleibt: string[]; bericht: string[] } {
  const zeilen = rumpf.replace(/\n+$/, '').split('\n')
  const g = gliedere(rumpf)
  const halten = new Set<number>()
  // Sätze mit einer offenen Aufgabe (`[[ID|…]]`) bleiben im Journal und stehen zugleich im Bericht
  const mitAufgabe = new Set<number>()
  if (offeneAufgabe) zeilen.forEach((z, i) => z.includes('[[') && findeLinks(z).some((l) => !l.einbettung && offeneAufgabe(l.ziel)) && mitAufgabe.add(i))
  for (const i of mitAufgabe) halten.add(i)
  for (const a of g.aufgaben) if (!a.erledigt) halten.add(a.zeile)
  for (const a of g.abschnitte) if (a.status && OFFEN_STATUS.has(a.status)) halten.add(a.von)
  for (const b of g.blockaden) {
    const huelle = g.abschnitte.filter((x) => x.von < b.zeile && x.bis > b.zeile && x.ebene > 1).pop()
    if (huelle && (huelle.status === 'erledigt' || huelle.status === 'gelöst')) continue
    for (let j = b.zeile; j < zeilen.length && (j === b.zeile || zeilen[j].startsWith('>')); j++) halten.add(j)
  }
  // Überschriften über allem, was bleibt, bleiben mit: Sie geben den offenen Punkten ihren Zusammenhang
  for (const z of [...halten]) for (const a of g.abschnitte) if (a.von < z && a.bis > z) halten.add(a.von)
  const bleibt: string[] = []
  const bericht: string[] = []
  zeilen.forEach((z, i) => {
    if (halten.has(i)) bleibt.push(z)
    // eine offene Überschrift steht in beiden: im Journal für „Offen“, im Bericht für den Zusammenhang
    if (!halten.has(i) || UEBERSCHRIFT.test(z) || mitAufgabe.has(i)) bericht.push(z)
  })
  return { bleibt, bericht }
}

/** Überschriften um n Ebenen tiefer setzen (höchstens H6), damit Einträge unter einem Datum stehen können */
export function tieferSetzen(text: string, n = 1): string {
  let imCode = false
  return text
    .split('\n')
    .map((z) => {
      if (/^\s*(```|~~~)/.test(z)) imCode = !imCode
      if (imCode) return z
      const u = /^(#{1,6})([ \t].*)$/.exec(z)
      return u ? '#'.repeat(Math.min(6, u[1].length + n)) + u[2] : z
    })
    .join('\n')
}

/** Text eines Projektblocks (Zeilen von..bis) */
export function blockText(text: string, b: { von: number; bis: number }): string {
  return text.split('\n').slice(b.von, b.bis).join('\n').replace(/\n+$/, '')
}

/**
 * Ersetzt den n-ten Block eines Projekts in einer Journaldatei. Damit bearbeitet die Projektansicht
 * genau dieselben Zeilen wie das Journal, ohne Kopie. Leerer neuer Text löscht den Block.
 */
export function ersetzeBlock(text: string, kuerzel: string, nr: number, neu: string): string {
  const b = gliedere(text).bloecke.find((x) => x.kuerzel === kuerzel && x.nr === nr)
  if (!b) return text
  const zeilen = text.split('\n')
  // Leerzeilen am Blockende gehören zum Abstand, nicht zum Inhalt
  let ende = b.bis
  while (ende > b.von + 1 && zeilen[ende - 1].trim() === '') ende--
  const ersatz = neu.trim() === '' ? [] : neu.replace(/\n+$/, '').split('\n')
  zeilen.splice(b.von, ende - b.von, ...ersatz)
  return zeilen.join('\n').replace(/\n*$/, '\n')
}

/**
 * Hängt Zeilen unter den letzten Block des Projekts an. Fehlt der Block, entsteht am Ende eine neue H1.
 * So landen Aufgaben aus dem Plan oder dem Handy immer im heutigen Journal beim richtigen Projekt.
 */
export function haengeAn(text: string, kuerzel: string | null, zeilenNeu: string[]): string {
  const zeilen = text.replace(/\n+$/, '').split('\n')
  if (kuerzel) {
    const bl = gliedere(text).bloecke.filter((b) => b.kuerzel === kuerzel)
    const b = bl[bl.length - 1]
    if (b) {
      let ende = Math.min(b.bis, zeilen.length)
      while (ende > b.von + 1 && zeilen[ende - 1].trim() === '') ende--
      zeilen.splice(ende, 0, ...zeilenNeu)
      return zeilen.join('\n') + '\n'
    }
    const leer = zeilen.length === 0 || zeilen[zeilen.length - 1].trim() === ''
    return [...zeilen, ...(leer ? [] : ['']), `# #${kuerzel}`, ...zeilenNeu].join('\n') + '\n'
  }
  return [...zeilen, ...zeilenNeu].join('\n') + '\n'
}

/** Ein Arbeitsabschnitt innerhalb eines Eintrags; Zeilen zählen im Rumpf (ohne die H1) */
export interface RumpfAbschnitt {
  titel: string
  /** die Überschriftszeile im Rohtext */
  kopf: string
  von: number
  /** erste Zeile nach dem Abschnitt (exklusiv) */
  bis: number
}

/**
 * Die obersten Abschnitte eines Eintrags (meist die H2 unter `# #projekt`). Jeder davon kann einzeln zum
 * Bericht werden, wenn an einem Tag mehrere Arbeiten im selben Projekt stehen.
 */
export function abschnitteImRumpf(rumpf: string): RumpfAbschnitt[] {
  // Leerzeile davor, damit eine Trennlinie `---` am Anfang nicht als Frontmatter gilt
  const g = gliedere('\n' + rumpf)
  const ebenen = g.abschnitte.map((a) => a.ebene)
  if (!ebenen.length) return []
  const oben = Math.min(...ebenen)
  const zeilen = rumpf.split('\n')
  return g.abschnitte
    .filter((a) => a.ebene === oben)
    .map((a) => {
      const von = a.von - 1
      let bis = Math.min(a.bis - 1, zeilen.length)
      while (bis > von + 1 && zeilen[bis - 1].trim() === '') bis--
      return { titel: a.titel, kopf: zeilen[von], von, bis }
    })
}

/** Ersetzt die Zeilen von..bis eines Abschnitts im Rumpf */
export function ersetzeRumpfAbschnitt(rumpf: string, a: { von: number; bis: number }, neu: string[]): string {
  const zeilen = rumpf.split('\n')
  zeilen.splice(a.von, a.bis - a.von, ...neu)
  return zeilen.join('\n')
}

/**
 * Ordnet einen Eintrag einem anderen Projekt zu (oder keinem): Nur der Projekttag in seiner H1 ändert sich,
 * Zusatz, `#wichtig` und Status bleiben. Ein Eintrag ohne Kopf bekommt eine H1.
 */
export function setzeProjektTag(text: string, t: { von: number; kopf: string }, kuerzel: string | null): string {
  const zeilen = text.split('\n')
  if (!t.kopf) {
    if (!kuerzel) return text
    zeilen.splice(t.von, 0, `# #${kuerzel}`)
    return zeilen.join('\n')
  }
  if (zeilen[t.von] !== t.kopf) return text
  let rest = t.kopf.replace(/^#[ \t]+/, '')
  const tag = /^#([\p{L}\d_][\p{L}\d_/-]*)(?=\s|$)/u.exec(rest)
  if (tag && tag[1].toLowerCase() !== 'wichtig') rest = rest.slice(tag[0].length).trim()
  zeilen[t.von] = `# ${kuerzel ? `#${kuerzel}${rest ? ' ' : ''}` : ''}${rest || (kuerzel ? '' : 'Allgemein')}`
  return zeilen.join('\n')
}

/**
 * Ein Abschnitt `##` unter `# #projekt` ist ein Bericht, außer er trägt `#unterpunkt`. Gleiche Titel im selben Projekt setzen ihn über
 * mehrere Tage fort; das Projekt zeigt sie zusammenhängend (Vertrag 0.21). Der Schlüssel macht Titel
 * vergleichbar, ohne Status, `#wichtig`, Anker, Groß-/Kleinschreibung und doppelte Leerzeichen.
 */
export function berichtSchluessel(titel: string): string {
  return zerlegeUeberschrift(titel).titel.toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface BerichtStelle {
  kuerzel: string
  schluessel: string
  titel: string
  /** die H2-Zeile im Rohtext */
  kopf: string
  /** die wievielte Stelle mit diesem Projekt und Schlüssel in der Datei (0-basiert) */
  nr: number
  /** Zeile der H2 */
  von: number
  /** erste Zeile nach dem Abschnitt ohne Leerzeilen am Ende (exklusiv) */
  bis: number
}

/** Alle Berichtsabschnitte (`##` unter einem Projekt) einer Journaldatei */
export function berichtStellen(text: string, g: Gliederung = gliedere(text)): BerichtStelle[] {
  const zeilen = text.split('\n')
  const zaehler = new Map<string, number>()
  const out: BerichtStelle[] = []
  for (const a of g.abschnitte) {
    if (a.ebene !== 2 || !a.projekt || !a.titel || a.unterpunkt) continue
    const schluessel = berichtSchluessel(a.titel)
    const k = `${a.projekt}\n${schluessel}`
    const nr = zaehler.get(k) ?? 0
    zaehler.set(k, nr + 1)
    let bis = Math.min(a.bis, zeilen.length)
    while (bis > a.von + 1 && zeilen[bis - 1].trim() === '') bis--
    out.push({ kuerzel: a.projekt, schluessel, titel: a.titel, kopf: zeilen[a.von], nr, von: a.von, bis })
  }
  return out
}

/**
 * Ersetzt den Text unter einer Berichtsüberschrift. Die `##`-Zeile selbst bleibt, damit der Bericht
 * zusammenhält. Ist die Stelle nicht mehr eindeutig zu finden, bleibt der Text unverändert.
 */
export function ersetzeBerichtStelle(text: string, s: { kuerzel: string; schluessel: string; nr: number; kopf: string }, rumpf: string): string {
  const t = findeBerichtStelle(text, s)
  if (!t) return text
  const zeilen = text.split('\n')
  const neu = rumpf.replace(/\n+$/, '')
  zeilen.splice(t.von + 1, t.bis - t.von - 1, ...(neu ? neu.split('\n') : []))
  return zeilen.join('\n').replace(/\n*$/, '\n')
}

/** Sucht eine Berichtsstelle wieder: zuerst nach Nummer und Kopfzeile, sonst nur nach eindeutiger Kopfzeile */
function findeBerichtStelle(text: string, s: { kuerzel: string; schluessel: string; nr: number; kopf: string }): BerichtStelle | undefined {
  const alle = berichtStellen(text).filter((x) => x.kuerzel === s.kuerzel && x.schluessel === s.schluessel)
  const t = alle.find((x) => x.nr === s.nr && x.kopf === s.kopf)
  if (t) return t
  const gleich = alle.filter((x) => x.kopf === s.kopf)
  return gleich.length === 1 ? gleich[0] : undefined
}

/**
 * Löscht eine Berichtsstelle samt `##`-Zeile aus dem Journal. Die H1 des Projekts bleibt stehen.
 * Ist die Stelle nicht mehr eindeutig zu finden, bleibt der Text unverändert.
 */
export function entferneBerichtStelle(text: string, s: { kuerzel: string; schluessel: string; nr: number; kopf: string }): string {
  const t = findeBerichtStelle(text, s)
  if (!t) return text
  const zeilen = text.split('\n')
  let bis = t.bis
  while (bis < zeilen.length && zeilen[bis].trim() === '') bis++
  // eine Leerzeile vor der nächsten Überschrift bleibt
  const rest = bis < zeilen.length && t.von > 0 && zeilen[t.von - 1].trim() !== ''
  zeilen.splice(t.von, bis - t.von, ...(rest ? [''] : []))
  return zeilen.join('\n').replace(/\n*$/, '\n')
}

/** Links auf einen Bericht im Journal (`[[Projekt-ID#bericht=<Schlüssel>|Titel]]`) werden wieder normaler Text */
export function loeseBerichtLinksAuf(text: string, projektId: string, schluessel: string): string {
  let out = ''
  let pos = 0
  for (const l of findeLinks(text)) {
    if (l.einbettung || l.ziel !== projektId || !l.anker?.startsWith('bericht=')) continue
    let k = l.anker.slice(8)
    try {
      k = decodeURIComponent(k)
    } catch {
      // ungültig kodiert: so vergleichen, wie es dasteht
    }
    if (k !== schluessel) continue
    out += text.slice(pos, l.von) + (l.anzeige ?? '').replace(/\\?\|/g, ' ').trim()
    pos = l.bis
  }
  return pos === 0 ? text : out + text.slice(pos)
}

/**
 * Bericht heute fortschreiben: Steht der Abschnitt schon im Journal, bleibt der Text gleich, sonst kommt
 * `## Titel` unter das Projekt (fehlt die H1, entsteht sie). Liefert den Text und die Zeile zum Weiterschreiben.
 */
export function berichtFortschreiben(text: string, kuerzel: string, titel: string): { text: string; zeile: number } {
  const schluessel = berichtSchluessel(titel)
  const finde = (t: string) => berichtStellen(t).filter((x) => x.kuerzel === kuerzel && x.schluessel === schluessel).pop()
  const da = finde(text)
  if (da) return { text, zeile: da.bis }
  const hatBlock = gliedere(text).bloecke.some((b) => b.kuerzel === kuerzel)
  const neu = haengeAn(text, kuerzel, [...(hatBlock ? [''] : []), `## ${titel}`, ''])
  const s = finde(neu)
  return { text: neu, zeile: s ? s.von + 1 : 0 }
}
