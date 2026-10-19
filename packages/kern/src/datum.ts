// Datumshilfen in lokaler Zeit. Das Journal gehört zum Kalendertag des Geräts, nicht zu UTC.

const zwei = (n: number) => String(n).padStart(2, '0')

export function tag(d = new Date()): string {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`
}

/** ISO 8601 mit Zeitzone, wie der Vertrag es verlangt (2026-10-19T15:32:34+02:00) */
export function zeitstempel(d = new Date()): string {
  const off = -d.getTimezoneOffset()
  const vz = off >= 0 ? '+' : '-'
  const a = Math.abs(off)
  return `${tag(d)}T${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}${vz}${zwei(Math.floor(a / 60))}:${zwei(a % 60)}`
}

export function plusTage(t: string, n: number): string {
  const [j, m, d] = t.split('-').map(Number)
  return tag(new Date(j, m - 1, d + n))
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/** 2026-10-19 → „Mo 19.10.“ */
export function kurzDatum(t: string, mitJahr = false): string {
  const [j, m, d] = t.split('-').map(Number)
  const w = WOCHENTAG[new Date(j, m - 1, d).getDay()]
  return `${w} ${zwei(d)}.${zwei(m)}.${mitJahr ? j : ''}`
}
