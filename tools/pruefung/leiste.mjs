// Werkzeugleiste am PC (Nils 2026-11-17): In keiner Lage (oben, links, rechts, dazu Vollbild) darf sie Skript oder
// Buch verdecken. Gemessen wird die Schnittfläche der Leiste samt Kehlen mit den Seiten von Skript und Buch.
// Läuft im Browser (page.evaluate); Rückgabe in Quadratpixeln, 0 heißt: nichts verdeckt.
export function leisteVerdeckt() {
  const leiste = document.querySelector('.funktionsleiste.werkzeuge')
  if (!leiste) return { fehlt: true, flaeche: 0 }
  const teile = [leiste, ...leiste.querySelectorAll('.fl-kehle')].map((e) => e.getBoundingClientRect())
  const seiten = [...document.querySelectorAll('.pdf-seite, .buch-blatt')].map((e) => e.getBoundingClientRect())
  let flaeche = 0
  for (const t of teile)
    for (const s of seiten) {
      const w = Math.min(t.right, s.right) - Math.max(t.left, s.left)
      const h = Math.min(t.bottom, s.bottom) - Math.max(t.top, s.top)
      if (w > 0.5 && h > 0.5) flaeche += w * h
    }
  const r = leiste.getBoundingClientRect()
  return { flaeche: Math.round(flaeche), seiten: seiten.length, lage: [r.left, r.top, r.width, r.height].map(Math.round) }
}

export const LAGEN = ['oben', 'links', 'rechts']
