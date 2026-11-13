// Baut ein Init-Skript, das __TAURI_INTERNALS__ mit einem Datenordner im Browser nachstellt
// (Ordner im Arbeitsspeicher der Seite, Stempel wie in ordner.rs). Nur für Prüfungen im Browser.
// Datenordner: Umgebungsvariable DATEN (Standard ./daten, angelegt mit beispieldaten.mjs).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const wurzel = path.resolve(process.env.DATEN || 'daten')
const nimm = (rel) => rel.startsWith('lernen/') || rel.includes('SKRIPET1') || rel.includes('ripet1') || rel.includes('FOTO01') || rel.includes('foto01')

function alle(dir, pre = '') {
  const out = []
  for (const n of readdirSync(dir)) {
    const abs = path.join(dir, n), rel = pre ? `${pre}/${n}` : n
    if (statSync(abs).isDirectory()) out.push(...alle(abs, rel))
    else if (nimm(rel)) out.push([rel, readFileSync(abs).toString('base64')])
  }
  return out
}

export function initSkript({ konflikt = true, plattform = 'windows', ordner = "'/daten'" } = {}) {
  const dateien = alle(wurzel)
  if (konflikt) {
    const orig = 'lernen/karten/01JBEISPIEL0000KARTERUF001.md'
    const t = Buffer.from(dateien.find(([p]) => p === orig)[1], 'base64').toString()
    const neu = t.replace('sofort melden.', 'sofort optisch und akustisch melden.').replace('2026-11-04T08:00', '2026-11-12T18:30')
    dateien.push(['lernen/karten/01JBEISPIEL0000KARTERUF001.sync-conflict-20261112-183012-HANDY01.md', Buffer.from(neu).toString('base64')])
  }
  return `(() => {
    const roh = ${JSON.stringify(dateien)};
    const platte = new Map();
    let nr = 0;
    const b64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    for (const [p, d] of roh) platte.set(p, { inhalt: b64(d), geaendert: Date.now() - 3600e3, nr: ++nr });
    const stempel = (p) => { const d = platte.get(p); return d ? d.inhalt.length + ':' + d.nr : null };
    const cbs = new Map(); let cbn = 1;
    const dec = new TextDecoder();
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      plugins: {},
      transformCallback(cb, once) { const id = cbn++; cbs.set(id, cb); return id },
      unregisterCallback(id) { cbs.delete(id) },
      convertFileSrc(p) { return p },
      async invoke(cmd, args, opts) {
        switch (cmd) {
          case 'stand': return { ordner: ${ordner}, plattform: '${plattform}' };
          case 'dateien': return [...platte].map(([pfad, d]) => ({ pfad, groesse: d.inhalt.length, geaendert: d.geaendert })).sort((a,b)=>a.pfad.localeCompare(b.pfad));
          case 'texte_lesen': return args.pfade.filter(p => platte.has(p)).map(p => { const d = platte.get(p); return { pfad: p, groesse: d.inhalt.length, geaendert: d.geaendert, stempel: stempel(p), text: dec.decode(d.inhalt) } });
          case 'datei_lesen': { const d = platte.get(args.pfad); if (!d) throw args.pfad + ': nicht gefunden'; return d.inhalt.slice().buffer }
          case 'datei_schreiben_wenn': {
            const pfad = decodeURIComponent(opts.headers.pfad); const erw = opts.headers.erwartet ?? null;
            if (stempel(pfad) !== erw) return { art: 'geaendert' };
            const inhalt = args instanceof Uint8Array ? args : new Uint8Array(args);
            platte.set(pfad, { inhalt, geaendert: Date.now(), nr: ++nr });
            return { art: 'ok', groesse: inhalt.length, geaendert: Date.now(), stempel: stempel(pfad) };
          }
          case 'konflikt_loeschen': platte.delete(args.pfad); return null;
          case 'ordner_setzen': return null;
          case 'ordner_waehlen': return true;
          case 'tresor_kennung': return null;
          case 'ki_zugang_lesen': return null;
          case 'ki_zugang_setzen': return null;
          // Updates: eine erfundene neuere Version, damit Hinweis und Einstellungen sichtbar sind
          case 'aktualisierung_eingerichtet': return true;
          case 'aktualisierung_abrufen': return JSON.stringify({ version: '9.9.9', notes: 'Probe: neue Funktionen und Fehlerbehebungen.', pub_date: '2026-11-13T20:00:00Z', platforms: { 'windows-x86_64': { signature: '', url: 'https://github.com/RespawnedGuy/RespawnedLearn/releases/download/v9.9.9/RespawnedLearn_9.9.9_x64-setup.exe' }, 'android-aarch64': { signature: '', url: 'https://github.com/RespawnedGuy/RespawnedLearn/releases/download/v9.9.9/RespawnedLearn_9.9.9_arm64.apk' } } });
          case 'aktualisierung_installieren': return null;
          case 'plugin:event|listen': return 1;
          case 'plugin:event|unlisten': return null;
          default: console.warn('mock: unbekannt', cmd); return null;
        }
      }
    };
  })();`
}
