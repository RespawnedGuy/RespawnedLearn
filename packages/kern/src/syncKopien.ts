// Konfliktkopien beliebiger Sync-Programme erkennen (Vertrag Lernen, Grundlagen 8). Zwei Stufen:
// A) Namensmuster, die eine Primärquelle belegt (Syncthing-Doku, Quellcode des Nextcloud-Clients, Dropbox-Hilfe);
//    dann ist das Programm bekannt. Die Testfälle stehen in `testdaten/syncnamen.json`, Rust prüft dieselben.
// B) Unabhängig vom Programm: Eine Datei, deren Name aus dem Namen einer vorhandenen Datei plus Zusatz besteht
//    (`S001 (1).svg`, `ki-prompts-LAPTOP.json`), aber keinen Namen hat, den die App selbst vergibt, ist eine Kopie.
//    Markdown erkennt die App sicherer an der ID: Zwei Dateien mit derselben `id` im selben Ordner sind Original und Kopie.

export type Programm = 'Syncthing' | 'Nextcloud' | 'Dropbox'

export interface SyncKopie {
  kopie: string
  /** Datei, von der die Kopie stammt; sie kann fehlen (z. B. Ändern gegen Löschen bei Syncthing) */
  original: string
  /** null: von einem unbekannten Programm (Stufe B) */
  programm: Programm | null
  /** Gerät oder Nutzer aus dem Namen, falls dort einer steht */
  geraet?: string
  /** Zeit aus dem Namen: `JJJJ-MM-TTTHH:MM` oder nur `JJJJ-MM-TT` (Ortszeit des Geräts, das die Kopie anlegte) */
  zeit?: string
}

type Treffer = Omit<SyncKopie, 'kopie' | 'original'> & { start: number; ende: number }

const zeit = (j: string, mo: string, t: string, h?: string, mi?: string) => (h ? `${j}-${mo}-${t}T${h}:${mi}` : `${j}-${mo}-${t}`)

/** Muster der Stufe A. Jedes liefert die Marke im Dateinamen, die weg muss, damit der Name des Originals übrig bleibt. */
const MUSTER: { re: RegExp; lies: (m: RegExpExecArray) => Omit<Treffer, 'start' | 'ende'> }[] = [
  // Syncthing und diese App: <name>.sync-conflict-<JJJJMMTT>-<HHMMSS>-<gerät>.<endung>
  {
    re: /\.sync-conflict-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-([^./]+)/g,
    lies: (m) => ({ programm: 'Syncthing', geraet: m[7], zeit: zeit(m[1], m[2], m[3], m[4], m[5]) })
  },
  // Nextcloud (makeConflictFileName): <name> (conflicted copy [<Nutzer> ]JJJJ-MM-TT HHMMSS).<endung>
  {
    re: / ?\(conflicted copy (?:([^()]*?) )?(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})(\d{2})\)/g,
    lies: (m) => ({ programm: 'Nextcloud', ...(m[1] ? { geraet: m[1] } : {}), zeit: zeit(m[2], m[3], m[4], m[5], m[6]) })
  },
  // Nextcloud und ownCloud, ältere Fassung: <name>_conflict-<JJJJMMTT>-<HHMMSS>.<endung>
  {
    re: /_conflict-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/g,
    lies: (m) => ({ programm: 'Nextcloud', zeit: zeit(m[1], m[2], m[3], m[4], m[5]) })
  },
  // Nextcloud, zwei Namen, die sich nur in Groß/klein unterscheiden: <name> (case clash from JJJJ-MM-TT HHMMSS)
  {
    re: / ?\(case clash from (\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})(\d{2})\)/g,
    lies: (m) => ({ programm: 'Nextcloud', zeit: zeit(m[1], m[2], m[3], m[4], m[5]) })
  },
  // Dropbox, englisch: <name> (<Nutzer>'s conflicted copy JJJJ-MM-TT)[ (n)]
  {
    re: / ?\(([^()]+?)(?:'s|’s)? conflicted copy(?: (\d{4})-(\d{2})-(\d{2}))?\)(?: \(\d+\))?/g,
    lies: (m) => ({ programm: 'Dropbox', geraet: m[1], ...(m[2] ? { zeit: zeit(m[2], m[3], m[4]) } : {}) })
  },
  // Dropbox, deutsch: <name> (<Nutzer> in Konflikt stehende Kopie JJJJ-MM-TT)[ (n)]
  {
    re: / ?\(([^()]+?) in Konflikt stehende Kopie(?: (\d{4})-(\d{2})-(\d{2}))?\)(?: \(\d+\))?/g,
    lies: (m) => ({ programm: 'Dropbox', geraet: m[1], ...(m[2] ? { zeit: zeit(m[2], m[3], m[4]) } : {}) })
  }
]

const name = (pfad: string) => pfad.slice(pfad.lastIndexOf('/') + 1)
const ordner = (pfad: string) => pfad.slice(0, pfad.lastIndexOf('/') + 1)

/** Stufe A: Konfliktkopie mit bekanntem Namensmuster; nur der Dateiname zählt. Bei Kopien von Kopien zählt die letzte Marke. */
export function bekannteKopie(pfad: string): SyncKopie | null {
  const n = name(pfad)
  let best: Treffer | null = null
  for (const { re, lies } of MUSTER) {
    re.lastIndex = 0
    for (let m = re.exec(n); m; m = re.exec(n)) {
      // Bei gleichem Anfang gewinnt das zuerst gelistete Muster (Nextcloud vor Dropbox)
      if (!best || m.index > best.start) best = { ...lies(m), start: m.index, ende: m.index + m[0].length }
    }
  }
  if (!best) return null
  const { start, ende, ...rest } = best
  return { kopie: pfad, original: ordner(pfad) + n.slice(0, start) + n.slice(ende), ...rest }
}

/** Namen, die die App selbst vergibt (Vertrag Lernen, Grundlagen 2). Sie sind nie eine Kopie nach Stufe B. */
const FESTE_NAMEN = [
  /^lernen\/tinte\/[^/]+\/S\d{3}\.svg$/,
  /^lernen\/buecher\/[^/]+\/S\d{3}\.(svg|json)$/,
  /^lernen\/blaetter\/[^/]+\/(S\d{3}(-[^/ ()]+)?\.svg|S\d{3}-bilder\.json|anordnung\.json)$/,
  /^lernen\/fragen\/[^/]+\/S\d{3}\.json$/,
  /^lernen\/vorfragen\/\d{4}-\d{2}-\d{2}\.json$/,
  /^lernen\/einstellungen\/(ki-prompts|ki-zugang\.verschluesselt)\.json$/,
  /^lernen\/(inhalt|stand|fragen-stand)\/[^/ ()]+\.json$/,
  /^reviews\/\d{4}-\d{2}\.[^/ ()]+\.jsonl$/
]

/** Ordner, deren Dateien die App liest; nur dort sucht sie nach Kopien unbekannter Programme */
export function inAppOrdner(pfad: string): boolean {
  return /^(lernen|reviews|gemeinsam\/(anhaenge|quellen|entitaeten)|anhaenge)\//.test(pfad)
}

/** Zusatz, den Sync-Programme an den Namen hängen: ` (1)`, ` 2`, `-RECHNERNAME` */
const ZUSATZ = /^(?: ?\([^()/]*\)| \d{1,3}|-[^\s()/.-][^\s()/.]*)$/

function teile(n: string): [string, string] {
  const p = n.lastIndexOf('.')
  return p > 0 ? [n.slice(0, p), n.slice(p).toLowerCase()] : [n, '']
}

/**
 * Stufe B, nur nach dem Namen: Ist `kopie` eine Kopie von `original`? Gleicher Ordner, gleiche Endung, und der Name ist
 * der des Originals plus ein Zusatz. Rust (`ordner::kopie_von`) prüft vor dem Löschen genau dasselbe.
 */
export function kopieVon(kopie: string, original: string): boolean {
  if (kopie === original || ordner(kopie) !== ordner(original)) return false
  const [sk, ek] = teile(name(kopie))
  const [so, eo] = teile(name(original))
  return ek === eo && sk.length > so.length && sk.startsWith(so) && ZUSATZ.test(sk.slice(so.length))
}

/** Zuletzt gelesene ID je Pfad; `syncKopien` läuft bei jeder Änderung über alle Karten, meist mit unverändertem Text */
const idMerker = new Map<string, { text: string; id: string | null }>()

function idVonPfad(pfad: string, text: string | undefined): string | null {
  if (text === undefined) return null
  const m = idMerker.get(pfad)
  if (m && m.text === text) return m.id
  const id = idVon(text)
  idMerker.set(pfad, { text, id })
  return id
}

/** `id` aus dem Kopfbereich, schnell und ohne den ganzen Kopf zu zerlegen */
function idVon(text: string | undefined): string | null {
  if (text === undefined) return null
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  if (!t.startsWith('---\n') && !t.startsWith('---\r\n')) return null
  const ende = t.search(/\n---[ \t]*\r?(\n|$)/)
  const kopf = ende < 0 ? t : t.slice(0, ende + 1)
  const m = /\nid:[ \t]*["']?([^"'\r\n]*?)["']?[ \t]*\r?\n/.exec(kopf)
  return m && m[1] ? m[1] : null
}

/**
 * Alle Konfliktkopien im Ordner (Stufe A und B). `text` liefert den Inhalt von Markdown-Dateien für den ID-Vergleich;
 * ohne ihn bleibt Markdown bei Stufe A.
 */
export function syncKopien(pfade: Iterable<string>, text?: (pfad: string) => string | undefined): Map<string, SyncKopie> {
  const out = new Map<string, SyncKopie>()
  const nachOrdner = new Map<string, string[]>()
  for (const p of pfade) {
    const a = bekannteKopie(p)
    if (a) out.set(p, a)
    else if (inAppOrdner(p)) {
      const o = ordner(p)
      const l = nachOrdner.get(o)
      if (l) l.push(p)
      else nachOrdner.set(o, [p])
    }
  }
  for (const liste of nachOrdner.values()) {
    // Markdown: gleiche ID im selben Ordner. Original ist `<id>.md`, sonst der kürzeste Name.
    if (text) {
      const nachId = new Map<string, string[]>()
      for (const p of liste) {
        if (!p.endsWith('.md')) continue
        const id = idVonPfad(p, text(p))
        if (!id) continue
        const l = nachId.get(id)
        if (l) l.push(p)
        else nachId.set(id, [p])
      }
      for (const [id, l] of nachId) {
        if (l.length < 2) continue
        const orig = l.find((p) => name(p) === `${id}.md`) ?? [...l].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
        for (const p of l) if (p !== orig) out.set(p, { kopie: p, original: orig, programm: null })
      }
    }
    // Andere Dateien: Name des Originals plus Zusatz. Gesucht wird das längste passende Original.
    const nachStamm = new Map<string, string>()
    for (const p of liste) if (!p.endsWith('.md')) nachStamm.set(teile(name(p)).join('\u0000'), p)
    for (const p of liste) {
      if (p.endsWith('.md') || FESTE_NAMEN.some((re) => re.test(p))) continue
      const [stamm, endung] = teile(name(p))
      for (let i = stamm.length - 1; i > 0; i--) {
        const c = stamm[i]
        if (c !== ' ' && c !== '-' && c !== '(') continue
        const orig = nachStamm.get(stamm.slice(0, i) + '\u0000' + endung)
        if (orig && orig !== p && kopieVon(p, orig)) {
          out.set(p, { kopie: p, original: orig, programm: null })
          break
        }
      }
    }
  }
  return out
}

/**
 * Darf die App `kopie` als Konfliktkopie von `original` löschen? Nur bekannte Muster, oder das Original ist da und die
 * Kopie heißt wie es plus Zusatz bzw. trägt als Markdown dieselbe ID. `lies` liefert den Inhalt (undefined = fehlt).
 * Die Ablagen (Rust `ordner::konflikt_loeschen`, `ablageImSpeicher`) prüfen das selbst noch einmal vor dem Löschen.
 */
export function loeschbareKopie(kopie: string, original: string | undefined, lies: (pfad: string) => string | undefined): boolean {
  if (bekannteKopie(kopie)) return true
  if (!original || kopie === original || ordner(kopie) !== ordner(original) || !inAppOrdner(kopie)) return false
  const o = lies(original)
  if (o === undefined) return false
  if (kopieVon(kopie, original)) return true
  if (!kopie.endsWith('.md') || !original.endsWith('.md')) return false
  const id = idVon(o)
  return id !== null && idVon(lies(kopie)) === id
}
