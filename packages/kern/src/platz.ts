// Platz einfügen auf einer Buchseite (Vertrag Lernen 1.14, 5.3): ab einer Höhe rückt alles nach unten, die Seite wird
// bei Bedarf länger. Kein neues Format, nur andere Koordinaten in Tinte, Seiten-JSON und Markierungen des Buchs.
// Rein: liefert die neuen Texte; was sich nicht ändert, kommt als null zurück und wird nicht geschrieben.
import { A4, blattFormat } from './blaetter'
import { buchSeiteJson, liesBuchSeite } from './buecher'
import { liesMarken, setzeMarke } from './marken'
import { SEITE_BREITE, liesTinte, tinteSvg, type Strich } from './tinte'

/** Abstand unter dem untersten Element zum Seitenende, wenn die Seite wächst */
const RAND = 24
/** Angenommene Höhe eines Textfelds je Zeile (die echte Höhe kennt erst die Anzeige) */
export const TEXT_ZEILE = 40

export interface PlatzVorher {
  /** Tinte der Seite (SVG) oder null, wenn es noch keine gibt */
  tinte: string | null
  /** Seiten-JSON oder null */
  seite: string | null
  /** Markierungen des Buchs (`lernen/markierungen/<buch-id>.md`) oder null */
  marken: string | null
  /** Nummer der Buchseite (für die Markierungen) */
  nr: number
}

export interface PlatzNachher {
  /** neue Texte; null = unverändert */
  tinte: string | null
  seite: string | null
  marken: string | null
  /** Höhe/Breite der Seite danach */
  format: number
  /** wie viel gerückt wurde (Striche, Bilder, Textfelder, Verweise, Markierungen) */
  gerueckt: number
}

/**
 * Verschiebt einen SVG-Pfad senkrecht. Absolute Befehle (M L T C S Q als Paare, V als y) rücken, H und relative
 * Befehle nicht, außer einem relativen `m` am Anfang (das gilt als absolut). Neue Werte behalten die Nachkommastellen.
 */
export function verschiebePfad(d: string, dy: number): string {
  if (!dy) return d
  const neu = (alt: string) => {
    const v = Number(alt) + dy
    const stellen = alt.includes('.') ? Math.min(3, alt.length - alt.indexOf('.') - 1) : 0
    return v.toFixed(stellen)
  }
  let erster = true
  return d.replace(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g, (_, cmd: string, args: string) => {
    const absolut = cmd === cmd.toUpperCase() || (erster && cmd === 'm')
    erster = false
    if (!absolut || cmd === 'Z' || cmd === 'z' || cmd === 'H' || cmd === 'A') return cmd + args
    // Zahlen an Ort und Stelle ersetzen, Trenner und x-Werte bleiben, wie sie waren
    let i = 0
    return cmd + args.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (z) => {
      const n = i++
      // beim relativen `m` am Anfang ist nur das erste Paar absolut
      if (cmd === 'm' && n > 1) return z
      return cmd === 'V' || n % 2 === 1 ? neu(z) : z
    })
  })
}

/** Oberster und unterster Punkt eines Strichs */
function spanne(s: Strich): { oben: number; unten: number } {
  let oben = Infinity
  let unten = -Infinity
  for (const p of s.punkte) {
    if (p[1] < oben) oben = p[1]
    if (p[1] > unten) unten = p[1]
  }
  return { oben, unten: unten + s.breite }
}

/**
 * Platz einfügen: alles, was nicht über `ab` beginnt, rückt um `um` nach unten (Seitenkoordinaten, Breite 1000).
 * Striche zählen mit ihrem obersten Punkt, Bilder, Textfelder und Verweise mit `y`, Markierungen dieser Seite mit dem
 * oberen Rand ihres Bereichs (in Seitenbreiten, 5.4). Reicht die Seite nicht mehr, wird sie so viel länger wie nötig.
 */
export function fuegePlatzEin(vorher: PlatzVorher, ab: number, um: number): PlatzNachher {
  const format = blattFormat(vorher.tinte)
  const unveraendert: PlatzNachher = { tinte: null, seite: null, marken: null, format, gerueckt: 0 }
  um = Math.round(um)
  if (!(um > 0) || !Number.isFinite(ab)) return unveraendert
  const darunter = (y: number) => y >= ab - 0.05
  let gerueckt = 0
  let unten = 0

  // Tinte
  const striche = liesTinte(vorher.tinte ?? '')
  let tinteNeu = false
  const neueStriche = striche.map((s) => {
    const sp = spanne(s)
    if (!s.punkte.length || !darunter(sp.oben)) {
      unten = Math.max(unten, sp.unten)
      return s
    }
    tinteNeu = true
    gerueckt++
    unten = Math.max(unten, sp.unten + um)
    return { ...s, punkte: s.punkte.map(([x, y, p]) => [x, y + um, p] as [number, number, number]), d: verschiebePfad(s.d, um) }
  })

  // Seiten-JSON: Bilder, Textfelder, Verweise
  let seiteText: string | null = null
  if (vorher.seite !== null) {
    const s = liesBuchSeite(vorher.seite)
    let neu = false
    const bilder = s.bilder.map((b) => {
      if (!darunter(b.y)) {
        unten = Math.max(unten, b.y + b.h)
        return b
      }
      neu = true
      gerueckt++
      unten = Math.max(unten, b.y + um + b.h)
      return { ...b, y: b.y + um }
    })
    const texte = (s.texte ?? []).map((t) => {
      const h = TEXT_ZEILE * Math.max(1, t.text.split('\n').length)
      if (!darunter(t.y)) {
        unten = Math.max(unten, t.y + h)
        return t
      }
      neu = true
      gerueckt++
      unten = Math.max(unten, t.y + um + h)
      return { ...t, y: t.y + um }
    })
    const verweise = s.verweise.map((v) => {
      // Verweise ganz oben (y = 0) gehören zur ganzen Seite (z. B. aus dem Anheben) und bleiben
      if (v.y <= 0 || !darunter(v.y)) return v
      neu = true
      gerueckt++
      return { ...v, y: v.y + um }
    })
    if (neu) seiteText = buchSeiteJson({ ...s, bilder, texte, verweise })
  }

  // Markierungen dieser Seite (Maße in Seitenbreiten)
  let markenText: string | null = null
  if (vorher.marken !== null) {
    let t = vorher.marken
    for (const m of liesMarken(vorher.marken)) {
      if (m.anker !== undefined || m.seite !== vorher.nr) continue
      const y = m.bereich.y * SEITE_BREITE
      if (!darunter(y)) {
        unten = Math.max(unten, (m.bereich.y + m.bereich.h) * SEITE_BREITE)
        continue
      }
      gerueckt++
      unten = Math.max(unten, (m.bereich.y + m.bereich.h) * SEITE_BREITE + um)
      t = setzeMarke(t, { ...m, bereich: { ...m.bereich, y: m.bereich.y + um / SEITE_BREITE } })
    }
    if (t !== vorher.marken) markenText = t
  }

  if (!gerueckt) return unveraendert
  const hoehe = SEITE_BREITE * format
  const noetig = unten + RAND
  const neueHoehe = noetig > hoehe ? Math.ceil(noetig) : hoehe
  const neuesFormat = Math.max(A4, neueHoehe / SEITE_BREITE)
  const tinte = tinteNeu || neueHoehe > hoehe ? tinteSvg(neueStriche, neueHoehe) : null
  return { tinte, seite: seiteText, marken: markenText, format: neuesFormat, gerueckt }
}
