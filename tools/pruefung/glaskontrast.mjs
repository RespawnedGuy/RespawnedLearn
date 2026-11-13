// Kontrast auf Glas messen (glas.css): axe misst gegen den Hintergrund, den es sieht, Glas ist aber durchsichtig.
// Hier wird jede Schrift auf Kopf, Daumenmenü und Werkzeugleiste gegen den ungünstigsten Grund gerechnet:
// Glasfarbe über reinem Schwarz und über reinem Weiß (die Unschärfe mittelt den Inhalt, schlimmer wird es nicht).
// Liegt zwischen Schrift und Glas eine deckende Fläche (Chip, aktiver Knopf), zählt die.
// Aufruf in der Seite: page.evaluate(glasKontrast) → [{ ort, text, schwarz, weiss }]

export function glasKontrast() {
  const farbe = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return [r, g, b, a]
  }
  const ueber = (oben, unten) => {
    const a = oben[3]
    return [0, 1, 2].map((i) => oben[i] * a + unten[i] * (1 - a)).concat(1)
  }
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const hell = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const kontrast = (a, b) => {
    const x = hell(a), y = hell(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }
  const ergebnis = []
  for (const wurzel of document.querySelectorAll('.kopf, .daumen-zeile, .werkzeug')) {
    if (!wurzel.getClientRects().length) continue
    const elemente = [...wurzel.querySelectorAll('*')].filter((el) => {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden' || Number(getComputedStyle(el).opacity) === 0) return false
      return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || el.matches('svg:not(.kontur)')
    })
    for (const el of elemente) {
      // Flächen zwischen Schrift und Glas sammeln, von innen nach außen
      const schichten = []
      for (let e = el; e; e = e.parentElement) {
        const f = farbe(getComputedStyle(e).backgroundColor)
        if (f && f[3] > 0) schichten.push(f)
        if (e === wurzel || (f && f[3] >= 1)) break
      }
      const grund = (basis) => schichten.reduceRight((u, o) => ueber(o, u), basis)
      const text = farbe(getComputedStyle(el).color)
      const s = grund([0, 0, 0, 1]), w = grund([255, 255, 255, 1])
      ergebnis.push({
        ort: wurzel.className.split(' ')[0],
        text: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24),
        schwarz: Math.round(kontrast(ueber(text, s), s) * 100) / 100,
        weiss: Math.round(kontrast(ueber(text, w), w) * 100) / 100
      })
    }
  }
  return ergebnis
}
