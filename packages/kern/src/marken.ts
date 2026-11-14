// Markierungen auf PDFs (Pläne in der Arbeits-App, Skripte in der Lern-App), wie in RespawnedNotes bewährt:
// eine Begleitdatei pro PDF, eine Zeile pro Stelle. Der Bereich steht als unsichtbarer Kommentar,
// relativ zur Seite (0..1), damit er bei jeder Zoomstufe passt.
//
//   - S. 1 · Datenschrank fehlt %%rn 0.120 0.300 0.430 0.080 2026-10-19%% ^a7k2c9
//   - S. 31 · [[01JB…|Spannung]] %%rn 0.100 0.500 0.600 0.120 2026-10-19 wichtig%% ^b8m3d0
//
// Verweis aus dem Journal: `![[<anhang-id>#seite=1&marke=a7k2c9|EG Grundriss, S. 1]]`

export interface Bereich {
  x: number
  y: number
  b: number
  h: number
}

export interface Marke {
  id: string
  seite: number
  text: string
  bereich: Bereich
  datum: string
  /** benannte Farbe (alltag | wichtig | ergaenzung), optional */
  farbe: string | null
  zeile: number
  /** Stelle in einer Mitschrift (Text, ab Lernen 1.10): Blockkennung der Zeile statt Seite und Bereich */
  anker?: string
}

const ZEILE = /^- S\. (\d+)(?: · (.*?))? %%rn ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) (\d{4}-\d{2}-\d{2})(?: (\w+))?%% \^([a-z0-9]+)\s*$/
// Textstelle einer Mitschrift (Lernen 1.10): `- ^anker · Name %%rt 2026-11-14%% ^id`
const TEXTZEILE = /^- \^([a-z0-9-]+)(?: · (.*?))? %%rt (\d{4}-\d{2}-\d{2})(?: (\w+))?%% \^([a-z0-9]+)\s*$/
const KEIN_BEREICH: Bereich = { x: 0, y: 0, b: 0, h: 0 }

export function liesMarken(text: string): Marke[] {
  const out: Marke[] = []
  text.split('\n').forEach((z, zeile) => {
    const t = TEXTZEILE.exec(z)
    if (t) {
      out.push({ id: t[5], seite: 0, text: (t[2] ?? '').trim(), bereich: KEIN_BEREICH, datum: t[3], farbe: t[4] ?? null, zeile, anker: t[1] })
      return
    }
    const m = ZEILE.exec(z)
    if (!m) return
    out.push({
      id: m[9],
      seite: Number(m[1]),
      text: (m[2] ?? '').trim(),
      bereich: { x: Number(m[3]), y: Number(m[4]), b: Number(m[5]), h: Number(m[6]) },
      datum: m[7],
      farbe: m[8] ?? null,
      zeile
    })
  })
  return out
}

// x und Breite liegen immer zwischen 0 und 1. y und Höhe auf PDF-Seiten auch; in Notizbüchern (Lernen 1.9) stehen sie in
// Seitenbreiten, weil Buchseiten nach unten wachsen, und dürfen größer als 1 sein.
const r = (n: number, grenze = 1) => Math.min(grenze, Math.max(0, n)).toFixed(3)
const HOCH = 99

export function markenZeile(m: Omit<Marke, 'zeile'>): string {
  const text = m.text.replace(/\s+/g, ' ').trim()
  if (m.anker) return `- ^${m.anker}${text ? ` · ${text}` : ''} %%rt ${m.datum}${m.farbe ? ` ${m.farbe}` : ''}%% ^${m.id}`
  const { x, y, b, h } = m.bereich
  return `- S. ${m.seite}${text ? ` · ${text}` : ''} %%rn ${r(x)} ${r(y, HOCH)} ${r(b)} ${r(h, HOCH)} ${m.datum}${m.farbe ? ` ${m.farbe}` : ''}%% ^${m.id}`
}

/** Fügt eine Marke hinzu oder ersetzt die mit derselben ID. Andere Zeilen bleiben unberührt. */
export function setzeMarke(text: string, m: Omit<Marke, 'zeile'>): string {
  const zeilen = text.replace(/\n+$/, '').split('\n')
  const alt = liesMarken(text).find((x) => x.id === m.id)
  if (alt) zeilen[alt.zeile] = markenZeile(m)
  else zeilen.push(markenZeile(m))
  return zeilen.join('\n') + '\n'
}

export function entferneMarke(text: string, id: string): string {
  const alt = liesMarken(text).find((x) => x.id === id)
  if (!alt) return text
  const zeilen = text.split('\n')
  zeilen.splice(alt.zeile, 1)
  return zeilen.join('\n')
}

/** Verweis auf eine Stelle, für Journal und Lernkarten */
export function stellenLink(anhangId: string, seite: number, markeId: string, anzeige: string): string {
  return `![[${anhangId}#seite=${seite}&marke=${markeId}|${anzeige}]]`
}

/**
 * Bereich auf einer Buchseite (Vertrag Lernen 1.9, 5.4): Die Tinte liefert ihn relativ zur Höhe der Seite. Gespeichert
 * wird er in Seitenbreiten, damit er an seiner Stelle bleibt, wenn die Seite nach unten wächst. `format` = Höhe / Breite.
 */
export function inSeitenbreiten(b: Bereich, format: number): Bereich {
  return { x: b.x, y: b.y * format, b: b.b, h: b.h * format }
}

/** Gegenstück zu `inSeitenbreiten`: Bereich relativ zur jetzigen Höhe der Buchseite, zum Anzeigen */
export function ausSeitenbreiten(b: Bereich, format: number): Bereich {
  return { x: b.x, y: b.y / format, b: b.b, h: b.h / format }
}

/** Woran eine gewählte Markierung gezogen wird: die Fläche (verschieben) oder eine Ecke (Größe) */
export type Griff = 'mitte' | 'lo' | 'ro' | 'lu' | 'ru'

/** Kleinste Markierung, die sich noch antippen lässt (Anteile der Seite) */
export const KLEINSTER_BEREICH = { b: 0.03, h: 0.015 }

const zwischen = (n: number, von: number, bis: number) => Math.min(bis, Math.max(von, n))

/**
 * Markierung verschieben oder an einer Ecke größer/kleiner ziehen (Lernen 1.10, 5.4). Alles in Anteilen der
 * angezeigten Seite (0 bis 1); die Markierung bleibt ganz auf der Seite und nie kleiner als `KLEINSTER_BEREICH`.
 * Die gegenüberliegende Ecke bleibt beim Ziehen an einer Ecke stehen.
 */
export function rueckeBereich(b: Bereich, griff: Griff, dx: number, dy: number, min = KLEINSTER_BEREICH): Bereich {
  if (griff === 'mitte') return { x: zwischen(b.x + dx, 0, 1 - b.b), y: zwischen(b.y + dy, 0, 1 - b.h), b: b.b, h: b.h }
  let l = b.x
  let r = b.x + b.b
  let o = b.y
  let u = b.y + b.h
  if (griff === 'lo' || griff === 'lu') l = zwischen(l + dx, 0, r - min.b)
  else r = zwischen(r + dx, l + min.b, 1)
  if (griff === 'lo' || griff === 'ro') o = zwischen(o + dy, 0, u - min.h)
  else u = zwischen(u + dy, o + min.h, 1)
  return { x: l, y: o, b: r - l, h: u - o }
}

/**
 * Welche Markierung liegt unter dem Finger? `p` in Anteilen der angezeigten Seite; die zuletzt gesetzte gewinnt. Mit 1 %
 * Zugabe, damit schmale Markierungen auch mit dem Finger zu treffen sind. Mit `format` (Notizbuch) stehen die Maße in
 * Seitenbreiten; zurück kommt der Bereich, wie er angezeigt wird.
 */
export function markeAn(marken: Marke[], p: { x: number; y: number }, format?: number): { marke: Marke; bereich: Bereich } | null {
  for (let i = marken.length - 1; i >= 0; i--) {
    if (marken[i].anker) continue
    const b = format ? ausSeitenbreiten(marken[i].bereich, format) : marken[i].bereich
    if (p.x >= b.x - 0.01 && p.x <= b.x + b.b + 0.01 && p.y >= b.y - 0.01 && p.y <= b.y + b.h + 0.01) return { marke: marken[i], bereich: b }
  }
  return null
}
