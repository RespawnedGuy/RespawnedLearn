// Screenshots der Lern-App im Browser (Handy 390 px, PC 1366 px, hell und dunkel) mit nachgestelltem
// Tauri-Ordner (mock.mjs). Meldet Konsolenfehler, seitliches Überlaufen und, falls axe-core da ist,
// WCAG-Verstöße. Ablauf und Voraussetzungen: README.md in diesem Ordner.
//
// Aufruf: node tools/pruefung/ansehen.mjs [ansicht,ansicht …]   (ohne Angabe: alle)
// Umgebung: URL (Standard http://localhost:1420/), AUS (Standard ./ansehen), DATEN (siehe mock.mjs),
//           PLAYWRIGHT (Pfad zum Paket, falls `playwright` nicht auflösbar ist), AXE (Pfad zu axe.min.js).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { initSkript } from './mock.mjs'
import { glasKontrast } from './glaskontrast.mjs'

const require = createRequire(import.meta.url)
function ladePlaywright() {
  for (const kandidat of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!kandidat) continue
    try { return require(kandidat) } catch {}
  }
  throw new Error('Playwright nicht gefunden: PLAYWRIGHT=<pfad zum Paket> setzen')
}
const { chromium } = ladePlaywright()

const URL = process.env.URL || 'http://localhost:1420/'
const AUS = path.resolve(process.env.AUS || 'ansehen')
mkdirSync(AUS, { recursive: true })
const axePfad = process.env.AXE || 'node_modules/axe-core/axe.min.js'
const axe = existsSync(axePfad) ? readFileSync(axePfad, 'utf8') : null

// IDs aus beispieldaten.mjs
const ANSICHTEN = {
  uebersicht: '#/uebersicht',
  start: '#/sammeln',
  modul: '#/sammeln/modul/01JBEISPIEL0000MODULRUF01',
  studium: '#/sammeln/modul/01JBEISPIEL0000MODULET1001',
  uebungsplatz: '#/sammeln/01JBEISPIEL0000000SKRIPET1/1',
  lernen: '#/lernen',
  nutzen: '#/nutzen',
  einstellungen: '#/einstellungen',
  konflikte: '#/konflikte'
}
const GERAETE = {
  handy: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  pc: { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 }
}
const nur = process.argv[2]?.split(',')

const browser = await chromium.launch()
const ergebnis = {}
let fehler = 0
for (const [gname, g] of Object.entries(GERAETE)) {
  for (const schema of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...g, colorScheme: schema, locale: 'de-DE' })
    await ctx.addInitScript(initSkript())
    const page = await ctx.newPage()
    const konsole = []
    page.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => konsole.push('pageerror ' + e.message))
    page.on('response', (r) => { if (r.status() >= 400) konsole.push(`${r.status()} ${r.url().replace(URL, '/')}`) })
    for (const [aname, hash] of Object.entries(ANSICHTEN)) {
      if (nur && !nur.includes(aname)) continue
      await page.goto(URL + hash)
      await page.waitForTimeout(aname === 'uebungsplatz' ? 3500 : 1500)
      const datei = `${aname}-${gname}-${schema === 'light' ? 'hell' : 'dunkel'}.png`
      await page.screenshot({ path: path.join(AUS, datei), fullPage: gname === 'handy' && aname !== 'uebungsplatz' })
      let ax = null
      if (axe) {
        await page.addScriptTag({ content: axe })
        ax = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
          return r.violations.map((v) => ({ id: v.id, impact: v.impact, hilfe: v.help, anzahl: v.nodes.length, ziele: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))
        })
      }
      const ueberlauf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      // Schrift auf Glas über Schwarz und Weiß: unter 4,5:1 zählt als Fehler
      const glas = await page.evaluate(glasKontrast)
      const schwach = glas.filter((g) => Math.min(g.schwarz, g.weiss) < 4.5)
      const glasMin = glas.length ? Math.min(...glas.map((g) => Math.min(g.schwarz, g.weiss))) : null
      fehler += schwach.length
      ergebnis[`${aname}|${gname}|${schema}`] = { axe: ax, ueberlauf, glasMin, glasSchwach: schwach }
      console.log(datei, 'überlauf', ueberlauf, 'glas min', glasMin, schwach.length ? 'ZU SCHWACH: ' + schwach.map((g) => `${g.ort}/${g.text} ${g.schwarz}|${g.weiss}`).join(', ') : '', ax ? 'axe: ' + (ax.map((v) => `${v.id}(${v.anzahl})`).join(' ') || '–') : '')
    }
    const k = [...new Set(konsole)]
    ergebnis[`konsole|${gname}|${schema}`] = k
    fehler += k.length
    for (const z of k) console.log(`konsole ${gname}/${schema}:`, z)
    await ctx.close()
  }
}
// Systemeinstellungen: „Bewegung reduzieren“ und „Transparenz reduzieren“ (die zweite kennt Playwright nur über CDP)
if (!nur || nur.includes('lernen')) {
  const ctx = await browser.newContext({ ...GERAETE.handy, reducedMotion: 'reduce', locale: 'de-DE' })
  await ctx.addInitScript(initSkript())
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
  await page.goto(URL + ANSICHTEN.lernen)
  await page.waitForTimeout(1200)
  const st = await page.evaluate(() => {
    const z = getComputedStyle(document.querySelector('.funktionsleiste'))
    return { backdrop: z.backdropFilter, grund: z.backgroundColor, linie: getComputedStyle(document.querySelector('.fl-fn.aktiv'), '::before').animationName }
  })
  const deckend = st.backdrop === 'none' && !/rgba\(.*,\s*0?\.\d+\)/.test(st.grund)
  const ruhig = st.linie === 'none'
  if (!deckend || !ruhig) fehler++
  ergebnis['reduziert|handy'] = { ...st, deckend, ruhig }
  console.log('reduziert: Glas deckend', deckend, '· Linie ohne Bewegung', ruhig, JSON.stringify(st))
  await page.screenshot({ path: path.join(AUS, 'lernen-handy-reduziert.png') })
  await ctx.close()
}
writeFileSync(path.join(AUS, 'ergebnis.json'), JSON.stringify(ergebnis, null, 1))
await browser.close()
console.log(fehler ? `${fehler} Konsolenfehler` : 'keine Konsolenfehler', '→', AUS)
process.exitCode = fehler ? 1 : 0
