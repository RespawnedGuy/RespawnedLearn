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
}

const ZEILE = /^- S\. (\d+)(?: · (.*?))? %%rn ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) (\d{4}-\d{2}-\d{2})(?: (\w+))?%% \^([a-z0-9]+)\s*$/

export function liesMarken(text: string): Marke[] {
  const out: Marke[] = []
  text.split('\n').forEach((z, zeile) => {
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

const r = (n: number) => Math.min(1, Math.max(0, n)).toFixed(3)

export function markenZeile(m: Omit<Marke, 'zeile'>): string {
  const text = m.text.replace(/\s+/g, ' ').trim()
  const { x, y, b, h } = m.bereich
  return `- S. ${m.seite}${text ? ` · ${text}` : ''} %%rn ${r(x)} ${r(y)} ${r(b)} ${r(h)} ${m.datum}${m.farbe ? ` ${m.farbe}` : ''}%% ^${m.id}`
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
