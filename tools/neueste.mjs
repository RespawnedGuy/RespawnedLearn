// Baut und prüft `latest.json` für einen Release (docs/aktualisieren.md). Format wie es der Tauri-Updater liest
// (tauri-plugin-updater, RemoteRelease): version, notes, pub_date, platforms.<os>-<arch>[-<installer>].{url, signature}.
// Die Signaturen sind die .sig-Dateien, die `tauri build` (createUpdaterArtifacts) und `tauri signer sign` (APK) mit dem
// Update-Schlüssel schreiben. Rein bis auf die Befehle unten, Test: tools/test/neueste.test.ts gegen testdaten/latest.json.
//
//   node tools/neueste.mjs bau <ordner> <version> <owner/repo> <notizen>   schreibt <ordner>/latest.json, wenn es .sig gibt
//   node tools/neueste.mjs pruefe <ordner>                                 prüft latest.json gegen die Dateien im Ordner
//   node tools/neueste.mjs text <commit-nachricht>                         gibt den Release-Text aus (releaseText)
// Mit UPDATE_SCHLUESSEL (Inhalt der .pub) prüfen beide zusätzlich jede Signatur selbst nach (Ed25519, node:crypto).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Welche Datei unter welchen Schlüsseln steht; der Installer ohne Zusatz gilt auch für `windows-x86_64` */
const ZUORDNUNG = [
  { muster: /_x64-setup\.exe$/, schluessel: ['windows-x86_64-nsis', 'windows-x86_64'] },
  { muster: /_x64_[A-Za-z-]+\.msi$/, schluessel: ['windows-x86_64-msi'] },
  { muster: /_arm64\.apk$/, schluessel: ['android-aarch64'] }
]

/**
 * Lesbarer Release-Text aus der Nachricht des Commits, der auf main gelandet ist. Bei einem Merge-Commit von GitHub
 * („Merge pull request #10 from …“, Leerzeile, Titel des PRs) der Titel des PRs, sonst die erste Zeile. Eine führende
 * Versionsnummer („v0.20.4: …“) fällt weg, die App zeigt die Version ohnehin davor.
 * @param {string} nachricht
 */
export function releaseText(nachricht) {
  const zeilen = nachricht.split(/\r?\n/).map((z) => z.trim())
  let text = zeilen[0] ?? ''
  if (/^Merge pull request #\d+ from \S+$/.test(text)) text = zeilen.slice(1).find((z) => z) ?? ''
  return text.replace(/^v?\d+\.\d+\.\d+\s*:\s*/, '').trim()
}

/**
 * @param {{ version: string, notizen: string, datum: string, repo: string, dateien: Record<string, string | null> }} e
 *   dateien: Name → Inhalt der zugehörigen .sig (null = keine Signatur, Datei wird nicht angeboten)
 */
export function baueNeueste({ version, notizen, datum, repo, dateien }) {
  /** @type {Record<string, { signature: string, url: string }>} */
  const platforms = {}
  for (const name of Object.keys(dateien).sort()) {
    const sig = dateien[name]
    const z = ZUORDNUNG.find((x) => x.muster.test(name))
    if (!z || !sig) continue
    const url = `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(name)}`
    for (const s of z.schluessel) platforms[s] = { signature: sig.trim(), url }
  }
  return { version, notes: notizen.trim(), pub_date: datum, platforms }
}

/**
 * Gegenprobe nach dem Hochladen: jede Adresse zeigt auf eine Datei dieses Releases, die Signatur ist die ihrer .sig.
 * @param {any} neueste @param {Record<string, string | null>} dateien @returns {string[]} Fehler, leer = gut
 */
export function pruefeNeueste(neueste, dateien) {
  const fehler = []
  const plattformen = Object.entries(neueste?.platforms ?? {})
  if (!plattformen.length) fehler.push('latest.json nennt keine Plattform')
  for (const [schluessel, p] of plattformen) {
    const name = decodeURIComponent(String(p.url).split('/').pop() ?? '')
    if (!String(p.url).includes(`/releases/download/v${neueste.version}/`)) fehler.push(`${schluessel}: Adresse nicht im Release v${neueste.version}`)
    if (!(name in dateien)) fehler.push(`${schluessel}: ${name} fehlt im Release`)
    else if ((dateien[name] ?? '').trim() !== p.signature) fehler.push(`${schluessel}: Signatur passt nicht zu ${name}.sig`)
    if (!ZUORDNUNG.some((z) => z.muster.test(name) && z.schluessel.includes(schluessel))) fehler.push(`${schluessel}: falsche Datei ${name}`)
  }
  return fehler
}

/**
 * Prüft eine Update-Signatur unabhängig vom Updater (minisign-Format, wie es `tauri signer` schreibt): Die .sig und der
 * öffentliche Schlüssel sind je Base64 eines minisign-Texts. Signaturzeile = Algorithmus (2 Byte, „ED“ = BLAKE2b-512
 * vorab, „Ed“ = roh) + Schlüsselkennung (8) + Ed25519-Signatur (64); Schlüsselzeile = „Ed“ + Kennung (8) + Schlüssel (32).
 * @param {Buffer} daten @param {string} signatur Inhalt der .sig @param {string} schluessel Inhalt der .pub
 * @returns {'gut' | 'falscher-schluessel' | 'falsch' | 'unlesbar'}
 */
export function pruefeSignatur(daten, signatur, schluessel) {
  const zeile = (b64, n) => Buffer.from(Buffer.from(b64.trim(), 'base64').toString('utf8').split('\n')[n] ?? '', 'base64')
  const sig = zeile(signatur, 1)
  const pub = zeile(schluessel, 1)
  if (sig.length !== 74 || pub.length !== 42 || pub.subarray(0, 2).toString() !== 'Ed') return 'unlesbar'
  const art = sig.subarray(0, 2).toString()
  if (art !== 'ED' && art !== 'Ed') return 'unlesbar'
  if (!sig.subarray(2, 10).equals(pub.subarray(2, 10))) return 'falscher-schluessel'
  const nachricht = art === 'ED' ? crypto.createHash('blake2b512').update(daten).digest() : daten
  const schl = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: pub.subarray(10).toString('base64url') }, format: 'jwk' })
  return crypto.verify(null, nachricht, schl, sig.subarray(10)) ? 'gut' : 'falsch'
}

/** Prüft jede angebotene Datei im Ordner gegen den öffentlichen Schlüssel der App @returns {string[]} Fehler */
function pruefeAlleSignaturen(neueste, ordner, schluessel) {
  const fehler = []
  for (const [s, p] of Object.entries(neueste.platforms)) {
    const name = decodeURIComponent(String(p.url).split('/').pop() ?? '')
    const datei = path.join(ordner, name)
    if (!fs.existsSync(datei)) continue
    const e = pruefeSignatur(fs.readFileSync(datei), p.signature, schluessel)
    if (e !== 'gut') fehler.push(`${s}: Signatur von ${name} ist ${e} (passt TAURI_UPDATER_PUBKEY zu TAURI_SIGNING_PRIVATE_KEY?)`)
  }
  return fehler
}

/** Dateien eines Ordners mit dem Inhalt ihrer .sig (ohne die .sig selbst und ohne Prüfsummen) */
function liesOrdner(ordner) {
  /** @type {Record<string, string | null>} */
  const dateien = {}
  for (const name of fs.readdirSync(ordner)) {
    if (name.endsWith('.sig') || name === 'latest.json' || name === 'SHA256SUMS.txt') continue
    const sig = path.join(ordner, `${name}.sig`)
    dateien[name] = fs.existsSync(sig) ? fs.readFileSync(sig, 'utf8') : null
  }
  return dateien
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [befehl, ordner, version, repo, notizen = ''] = process.argv.slice(2)
  if (befehl === 'bau') {
    const dateien = liesOrdner(ordner)
    if (!Object.values(dateien).some(Boolean)) {
      console.log('Keine .sig-Dateien (Secret TAURI_SIGNING_PRIVATE_KEY fehlt): kein latest.json, keine Updates für diesen Release')
      process.exit(0)
    }
    const neueste = baueNeueste({ version, notizen, datum: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), repo, dateien })
    // vor dem Veröffentlichen: jede Signatur muss zum Schlüssel passen, der in der App steckt
    const fehler = process.env.UPDATE_SCHLUESSEL ? pruefeAlleSignaturen(neueste, ordner, process.env.UPDATE_SCHLUESSEL) : ['UPDATE_SCHLUESSEL fehlt (Variable TAURI_UPDATER_PUBKEY)']
    for (const f of fehler) console.error(`::error::${f}`)
    if (fehler.length) process.exit(1)
    fs.writeFileSync(path.join(ordner, 'latest.json'), JSON.stringify(neueste, null, 2) + '\n')
    console.log(JSON.stringify(neueste, null, 2))
  } else if (befehl === 'text') {
    console.log(releaseText(ordner ?? ''))
  } else if (befehl === 'pruefe') {
    const datei = path.join(ordner, 'latest.json')
    if (!fs.existsSync(datei)) {
      console.log('Kein latest.json in diesem Release')
      process.exit(0)
    }
    const neueste = JSON.parse(fs.readFileSync(datei, 'utf8'))
    const fehler = pruefeNeueste(neueste, liesOrdner(ordner))
    if (process.env.UPDATE_SCHLUESSEL) fehler.push(...pruefeAlleSignaturen(neueste, ordner, process.env.UPDATE_SCHLUESSEL))
    for (const f of fehler) console.error(`::error::${f}`)
    if (fehler.length) process.exit(1)
    console.log(`latest.json passt zu den Dateien und Signaturen des Releases${process.env.UPDATE_SCHLUESSEL ? ', jede Signatur nachgeprüft' : ''}`)
  } else {
    console.error('Aufruf: node tools/neueste.mjs bau <ordner> <version> <owner/repo> <notizen> | pruefe <ordner> | text <commit-nachricht>')
    process.exit(2)
  }
}
