// Neue Version ohne Zutun: Der Service Worker holt sie im Hintergrund, aber ein offener Tab (am Handy oft tagelang)
// zeigt sonst weiter die alte. Neu geladen wird nur, wenn gerade niemand tippt, sonst beim nächsten Wegwechseln.

function tipptGerade() {
  const el = document.activeElement
  return el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
}

export function bleibAktuell() {
  if (!('serviceWorker' in navigator)) return
  // Beim allerersten Besuch übernimmt der Service Worker ohne neue Version, das ist kein Grund zum Neuladen
  const hatteVersion = !!navigator.serviceWorker.controller
  let neu = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteVersion) return
    neu = true
    if (!tipptGerade()) setTimeout(() => location.reload(), 800)
  })
  const pruefe = () => void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {})
  document.addEventListener('visibilitychange', () => {
    // Kurz warten: Erst sichern die Seiten beim Wegwechseln, was noch offen ist
    if (document.visibilityState === 'hidden' && neu) setTimeout(() => location.reload(), 800)
    else if (document.visibilityState === 'visible') pruefe()
  })
  setInterval(pruefe, 30 * 60_000)
}
