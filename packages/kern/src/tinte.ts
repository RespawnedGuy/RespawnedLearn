// Handschrift pro Seite als SVG (Seitenbreite 1000), wie in RespawnedNotes: ein <path> pro Strich als
// gefüllter Umriss, dazu die Rohpunkte mit Druck, damit sich Striche später neu glätten oder erkennen lassen.

export const FARBEN = {
  alltag: '#2E5BD8',
  alltag_schwarz: '#1F2227',
  wichtig: '#E0443A',
  ergaenzung: '#2F9E5B'
} as const
export type Farbe = keyof typeof FARBEN

export const FARB_NAMEN: Record<Farbe, string> = {
  alltag: 'Alltag',
  alltag_schwarz: 'Alltag',
  wichtig: 'Wichtig',
  ergaenzung: 'Ergänzung'
}

export interface Strich {
  farbe: Farbe
  breite: number
  /** x y druck, in Seitenkoordinaten (Breite 1000) */
  punkte: [number, number, number][]
  /** fertiger Umriss als SVG-Pfad */
  d: string
}

export const SEITE_BREITE = 1000

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function tinteSvg(striche: Strich[], hoehe: number): string {
  const pfade = striche.map(
    (s) =>
      `  <path d="${esc(s.d)}" fill="${FARBEN[s.farbe]}" data-farbe="${s.farbe}" data-w="${s.breite}" data-pts="${s.punkte
        .map((p) => `${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10} ${Math.round(p[2] * 100) / 100}`)
        .join(',')}"/>`
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SEITE_BREITE} ${Math.round(hoehe)}">\n${pfade.join('\n')}\n</svg>\n`
}

export function liesTinte(svg: string): Strich[] {
  const out: Strich[] = []
  for (const m of svg.matchAll(/<path\b([^>]*)\/?>/g)) {
    const attr = (n: string) => new RegExp(`\\b${n}="([^"]*)"`).exec(m[1])?.[1] ?? ''
    const farbe = (attr('data-farbe') || 'alltag') as Farbe
    const punkte = attr('data-pts')
      .split(',')
      .filter(Boolean)
      .map((p) => p.trim().split(/\s+/).map(Number) as [number, number, number])
      .map((p) => [p[0], p[1], Number.isFinite(p[2]) ? p[2] : 0.5] as [number, number, number])
    out.push({ farbe: farbe in FARBEN ? farbe : 'alltag', breite: Number(attr('data-w')) || 3, punkte, d: attr('d').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&') })
  }
  return out
}

/** Striche, die den Radierer-Punkt (Seitenkoordinaten) berühren */
export function getroffen(striche: Strich[], x: number, y: number, radius: number): number[] {
  const r2 = radius * radius
  const out: number[] = []
  striche.forEach((s, i) => {
    if (s.punkte.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 <= r2 + s.breite * s.breite)) out.push(i)
  })
  return out
}
