// Lernzeit still messen (Vertrag Lernen 1.7): Die Ansicht sagt, was gerade offen ist (Lernziel, Art, Skriptseite),
// Eingaben auf der Seite zählen als „ich bin da“. Die Regeln (Leerlauf, Zwischenschreiben) stehen rein in
// `kern/lernzeit.ts`; hier nur Uhr, DOM-Ereignisse und Schreiben in die eigene Datei des Geräts.
import { useEffect } from 'react'
import { eingabe, lernzeitZeile, pfade, uhr, type LernAbschnitt, type LernKontext, type Messschritt, type Messung } from '@rl/kern'
import { geraet, useDaten, type Speicher } from '@rl/oberflaeche'

/** Eingaben werden höchstens so oft ausgewertet (Scrollen feuert sehr oft) */
const EINGABE_ABSTAND_MS = 5_000
const UHR_MS = 30_000

export interface Lernuhr {
  /** Was gerade offen ist; null = nichts, das zählt */
  setzeKontext(k: LernKontext | null): void
  eingabe(): void
  verdeckt(): void
  tick(): void
  /** offene Messung beenden und schreiben (App wird geschlossen) */
  beende(): void
}

/** Uhr ohne DOM, damit sie sich mit falscher Zeit testen lässt */
export function erstelleLernuhr(o: { jetzt: () => number; schreibe: (fertig: LernAbschnitt[]) => void }): Lernuhr {
  let messung: Messung | null = null
  let kontext: LernKontext | null = null
  let zuletzt = 0
  const schritt = (s: Messschritt) => {
    messung = s.messung
    if (s.fertig.length) o.schreibe(s.fertig)
  }
  return {
    setzeKontext(k) {
      kontext = k
      zuletzt = o.jetzt()
      schritt(eingabe(messung, k, zuletzt))
    },
    eingabe() {
      const t = o.jetzt()
      if (!kontext || t - zuletzt < EINGABE_ABSTAND_MS) return
      zuletzt = t
      schritt(eingabe(messung, kontext, t))
    },
    verdeckt() {
      schritt(eingabe(messung, null, o.jetzt()))
    },
    tick() {
      schritt(uhr(messung, o.jetzt()))
    },
    beende() {
      schritt(eingabe(messung, null, o.jetzt()))
      kontext = null
    }
  }
}

/** Fertige Abschnitte an die Monatsdatei dieses Geräts anhängen (jede Zeile in den Monat ihres Beginns) */
export function schreibeLernzeit(speicher: Speicher, fertig: LernAbschnitt[], g = geraet()): Promise<void>[] {
  const jeDatei = new Map<string, string>()
  for (const a of fertig) {
    const pfad = pfade.lernzeit(a.am.slice(0, 7), g)
    jeDatei.set(pfad, (jeDatei.get(pfad) ?? '') + lernzeitZeile(a))
  }
  return [...jeDatei].map(([pfad, zeilen]) => speicher.aendere(pfad, (alt) => (alt && !alt.endsWith('\n') ? alt + '\n' : alt) + zeilen))
}

let gemeinsam: { uhr: Lernuhr; speicher: Speicher } | null = null

function lernuhrFuer(speicher: Speicher): Lernuhr {
  if (gemeinsam?.speicher === speicher) return gemeinsam.uhr
  gemeinsam?.uhr.beende()
  const u = erstelleLernuhr({ jetzt: Date.now, schreibe: (f) => void Promise.all(schreibeLernzeit(speicher, f)).catch(() => {}) })
  gemeinsam = { uhr: u, speicher }
  const da = () => u.eingabe()
  for (const art of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(art, da, { passive: true, capture: true })
  addEventListener('scroll', da, { passive: true, capture: true })
  document.addEventListener('visibilitychange', () => (document.hidden ? u.verdeckt() : u.eingabe()))
  addEventListener('pagehide', () => u.beende())
  setInterval(() => u.tick(), UHR_MS)
  return u
}

/**
 * In der Ansicht aufrufen, die Lernzeit zählt: Skript/Notizbuch, Mitschrift, Lernrunde. Eine neue Seite im Skript
 * zählt als Eingabe. `null` (oder Verlassen der Ansicht) beendet die Messung.
 */
export function useLernzeit(k: LernKontext | null) {
  const { speicher } = useDaten()
  const wer = k ? `${k.ziel}|${k.art}|${k.quelle ?? ''}` : ''
  const seite = k?.seite ?? 0
  // Ein anderes Lernziel oder eine andere Ansicht beendet den Abschnitt …
  useEffect(() => {
    const u = lernuhrFuer(speicher)
    if (!wer) return
    u.setzeKontext(kontextAus(wer, 0))
    return () => u.setzeKontext(null)
  }, [speicher, wer])
  // … eine neue Seite im selben Skript nicht, sie zählt als Eingabe
  useEffect(() => {
    if (wer && seite) lernuhrFuer(speicher).setzeKontext(kontextAus(wer, seite))
  }, [speicher, wer, seite])
}

function kontextAus(wer: string, seite: number): LernKontext {
  const [ziel, art, quelle] = wer.split('|')
  return { ziel, art: art as LernKontext['art'], ...(quelle ? { quelle } : {}), ...(seite ? { seite } : {}) }
}
