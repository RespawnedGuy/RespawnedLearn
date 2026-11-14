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
