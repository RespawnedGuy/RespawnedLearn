// Neue Version ohne Zutun: Der Service Worker holt sie im Hintergrund, aber ein offener Tab (am Handy oft tagelang)
// zeigt sonst weiter die alte. Neu geladen wird nur, wenn gerade niemand tippt, sonst beim nächsten Wegwechseln.
// Lädt das Gerät gerade ein PDF hoch, wartet das Neuladen, bis es oben ist (sonst beginnt der Upload immer von vorn).
import { laedtHoch } from './daten/speicher'

function tipptGerade() {
  const el = document.activeElement
  return el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
}

/** Neu laden, sobald kein Upload mehr läuft */
function neuLaden() {
  if (laedtHoch()) return void setTimeout(neuLaden, 2000)
  location.reload()
}

export function bleibAktuell() {
  if (!('serviceWorker' in navigator)) return
  // Beim allerersten Besuch übernimmt der Service Worker ohne neue Version, das ist kein Grund zum Neuladen
  const hatteVersion = !!navigator.serviceWorker.controller
  let neu = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteVersion) return
    neu = true
    if (!tipptGerade()) setTimeout(neuLaden, 800)
  })
  const pruefe = () => void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {})
  document.addEventListener('visibilitychange', () => {
    // Kurz warten: Erst sichern die Seiten beim Wegwechseln, was noch offen ist
    if (document.visibilityState === 'hidden' && neu) setTimeout(neuLaden, 800)
    else if (document.visibilityState === 'visible') pruefe()
  })
  setInterval(pruefe, 30 * 60_000)
}
