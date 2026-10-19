// ULID nach https://github.com/ulid/spec: 48 Bit Zeit + 80 Bit Zufall, Crockford-Base32.
// Sortiert zeitlich und braucht keine Abstimmung zwischen Geräten.
const ZEICHEN = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function zufall(n: number): Uint8Array {
  const b = new Uint8Array(n)
  globalThis.crypto.getRandomValues(b)
  return b
}

export function ulid(zeit = Date.now()): string {
  let t = ''
  let rest = zeit
  for (let i = 0; i < 10; i++) {
    t = ZEICHEN[rest % 32] + t
    rest = Math.floor(rest / 32)
  }
  let r = ''
  for (const b of zufall(16)) r += ZEICHEN[b % 32]
  return t + r
}

/** Kurze Kennung für Anker und Markierungen (`^a7k2c9`), eindeutig innerhalb einer Datei */
export function kurzId(laenge = 6): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789'
  let s = ''
  for (const b of zufall(laenge)) s += abc[b % abc.length]
  return s
}
