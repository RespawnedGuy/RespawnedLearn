import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
// @ts-expect-error reines Node-Skript ohne Typen
import { symboleKopieren } from '../android-symbole.mjs'

const quelle = path.resolve('app/src-tauri/icons/android')
const dichten: [string, number, number][] = [
  // Ordner, Kantenlänge Startsymbol (48 dp), Vordergrund (108 dp)
  ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
]

/** Kleiner PNG-Leser für 8-Bit-RGBA ohne Interlacing (so schreibt tauri icon und unser Vordergrund). */
function pngLesen(datei: string) {
  const b = fs.readFileSync(datei)
  const breite = b.readUInt32BE(16), hoehe = b.readUInt32BE(20), tiefe = b[24], farbtyp = b[25], interlace = b[28]
  const teile: Buffer[] = []
  for (let o = 8; o < b.length;) {
    const laenge = b.readUInt32BE(o), typ = b.toString('ascii', o + 4, o + 8)
    if (typ === 'IDAT') teile.push(b.subarray(o + 8, o + 8 + laenge))
    o += 12 + laenge
  }
  if (tiefe !== 8 || farbtyp !== 6 || interlace !== 0) return { breite, hoehe, alpha: null }
  const roh = zlib.inflateSync(Buffer.concat(teile)), zeile = breite * 4
  const px = Buffer.alloc(zeile * hoehe)
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)]
    for (let x = 0; x < zeile; x++) {
      const r = roh[y * (zeile + 1) + 1 + x]
      const a = x >= 4 ? px[y * zeile + x - 4] : 0, o = y > 0 ? px[(y - 1) * zeile + x] : 0
      const c = x >= 4 && y > 0 ? px[(y - 1) * zeile + x - 4] : 0
      const p = a + o - c, pa = Math.abs(p - a), pb = Math.abs(p - o), pc = Math.abs(p - c)
      const vorh = [0, a, o, (a + o) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? o : c][filter]
      px[y * zeile + x] = (r + vorh) & 255
    }
  }
  return { breite, hoehe, alpha: (x: number, y: number) => px[(y * breite + x) * 4 + 3] }
}

describe('Android-Symbole', () => {
  it('kopiert unsere Symbole über die Vorlage von tauri android init', () => {
    const ziel = fs.mkdtempSync(path.join(os.tmpdir(), 'res-'))
    fs.mkdirSync(path.join(ziel, 'mipmap-mdpi'))
    fs.writeFileSync(path.join(ziel, 'mipmap-mdpi', 'ic_launcher.png'), 'Tauri-Standardsymbol')
    const kopiert: string[] = symboleKopieren(quelle, ziel)
    expect(kopiert).toContain(path.join('mipmap-anydpi-v26', 'ic_launcher.xml'))
    expect(kopiert).toContain(path.join('values', 'ic_launcher_background.xml'))
    expect(fs.readFileSync(path.join(ziel, 'mipmap-mdpi', 'ic_launcher.png')))
      .toEqual(fs.readFileSync(path.join(quelle, 'mipmap-mdpi', 'ic_launcher.png')))
  })

  it('bricht ab, wenn keine Symbole da sind', () => {
    const leer = fs.mkdtempSync(path.join(os.tmpdir(), 'leer-'))
    expect(() => symboleKopieren(leer, leer)).toThrow(/Keine Android-Symbole/)
  })

  it('adaptives Symbol: Vordergrund und Hintergrundfarbe sind vorhanden', () => {
    const xml = fs.readFileSync(path.join(quelle, 'mipmap-anydpi-v26', 'ic_launcher.xml'), 'utf8')
    expect(xml).toContain('@mipmap/ic_launcher_foreground')
    expect(xml).toContain('@color/ic_launcher_background')
    // Creme der Kachel, nicht Weiß: sonst sieht man den Rand des Motivs
    expect(fs.readFileSync(path.join(quelle, 'values', 'ic_launcher_background.xml'), 'utf8')).toContain('#F8F6F3')
  })

  it.each(dichten)('%s: richtige Größen, Vordergrund nur das Motiv in der sicheren Zone', (ordner, start, vorder) => {
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
      const { breite, hoehe } = pngLesen(path.join(quelle, `mipmap-${ordner}`, name))
      expect([breite, hoehe]).toEqual([start, start])
    }
    const v = pngLesen(path.join(quelle, `mipmap-${ordner}`, 'ic_launcher_foreground.png'))
    expect([v.breite, v.hoehe]).toEqual([vorder, vorder])
    expect(v.alpha).not.toBeNull()
    // Android schneidet auf 72 von 108 dp zu (Kreis bis Radius 36 dp): außerhalb davon darf nichts liegen.
    // Lag früher die ganze Kachel im Vordergrund, war genau dieser Ring sichtbar gefüllt.
    const mitte = vorder / 2, grenze = (vorder * 36) / 108
    let draussen = 0
    for (let y = 0; y < vorder; y++) for (let x = 0; x < vorder; x++) {
      if (Math.hypot(x + 0.5 - mitte, y + 0.5 - mitte) > grenze && v.alpha!(x, y) > 8) draussen++
    }
    expect(draussen).toBe(0)
  })
})
