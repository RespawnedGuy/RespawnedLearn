import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import logo from './logo.png'
import { useDaten } from './daten/DatenKontext'

export interface MenueEintrag {
  titel: string
  ziel: string
  aktiv?: boolean
  zahl?: number | string
  /** fett, z. B. „Alle Projekte“ */
  betont?: boolean
  /** Zwischenüberschrift vor diesem Eintrag, z. B. „Letzte Tage“ */
  abschnitt?: string
}

export interface MenueGruppe {
  titel: string
  eintraege: MenueEintrag[]
  /** Reiter-Modus: der Reiter, in dem man gerade ist */
  aktiv?: boolean
  /** Reiter-Modus: steht statt des Titels auf dem aktiven Reiter, z. B. der Projektname */
  ort?: string
  /** Reiter-Modus: kürzere Beschriftung am Handy, z. B. „…“ für „Mehr“ */
  kurz?: string
}

function lies(schluessel: string): boolean {
  try {
    return localStorage.getItem(schluessel) === '1'
  } catch {
    return false
  }
}

/**
 * Das eine Menü oben, auf allen Seiten gleich (keine Seitenleiste, Nils ist Linkshänder).
 * Eingeklappt zeigt es nur den Ort; aufgeklappt alle Ziele; fixiert bleibt es als schmale Leiste offen.
 */
export function Kopf({
  reiter = false,
  ...rest
}: {
  app: string
  ort: string
  gruppen: MenueGruppe[]
  mitte?: ReactNode
  rechts?: ReactNode
  /** jede Gruppe wird ein eigener Reiter, der beim Klick sein Menü aufklappt */
  reiter?: boolean
}) {
  return reiter ? <ReiterKopf app={rest.app} gruppen={rest.gruppen} rechts={rest.rechts} /> : <MenueKopf {...rest} />
}

function MenueKopf({ app, ort, gruppen, mitte, rechts }: { app: string; ort: string; gruppen: MenueGruppe[]; mitte?: ReactNode; rechts?: ReactNode }) {
  const schluessel = `rvx-${app}-menue-fixiert`
  const [fixiert, setFixiert] = useState(() => lies(schluessel))
  const [offen, setOffen] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!offen || fixiert) return
    const zu = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOffen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    addEventListener('pointerdown', zu)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', zu)
      removeEventListener('keydown', esc)
    }
  }, [offen, fixiert])

  // Nach einem Klick auf ein Ziel klappt das Menü wieder zu, außer es ist fixiert
  useEffect(() => {
    const f = () => setOffen(false)
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])

  useKopfHoehe(ref)

  const nadel = () => {
    const neu = !fixiert
    setFixiert(neu)
    setOffen(false)
    try {
      localStorage.setItem(schluessel, neu ? '1' : '0')
    } catch {
      /* ohne Speicher eben nur für diese Sitzung */
    }
  }

  const sichtbar = fixiert || offen
  return (
    <header className="kopf" ref={ref}>
      <div className="kopf-zeile">
        <div className="kopf-links">
          <img className="kopf-logo" src={logo} alt="RespawnedNotes" />
          <AppSchalter app={app} />
          <button type="button" className="kopf-ort" aria-expanded={sichtbar} onClick={() => (fixiert ? nadel() : setOffen(!offen))}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ort}</span>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flex: 'none', transform: sichtbar ? 'rotate(180deg)' : undefined }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        {mitte && <div className="kopf-mitte">{mitte}</div>}
        <div className="kopf-rechts">
          {rechts}
          <SyncAnzeige />
          <Version />
        </div>
      </div>
      {sichtbar && (
        <nav className={`kopf-menue${fixiert ? ' fixiert' : ''}`} aria-label="Hauptmenü">
          {gruppen.map((g) => (
            <div className="kopf-gruppe" key={g.titel}>
              <div className="kopf-gruppe-titel">{g.titel}</div>
              {g.eintraege.map((e) => (
                <a key={e.ziel + e.titel} className={`kopf-eintrag${e.aktiv ? ' aktiv' : ''}${e.betont ? ' betont' : ''}`} href={e.ziel}>
                  <span>{e.titel}</span>
                  {e.zahl !== undefined && e.zahl !== 0 && <span className="zahl">{e.zahl}</span>}
                </a>
              ))}
            </div>
          ))}
          <button type="button" className="knopf still klein kopf-nadel" onClick={nadel} title={fixiert ? 'Menü lösen' : 'Menü fixieren'}>
            {fixiert ? 'Lösen' : 'Fixieren'}
          </button>
        </nav>
      )}
    </header>
  )
}

/** Höhe des Kopfs für alles, was darunter kleben bleiben soll (--kopf-hoehe) */
function useKopfHoehe(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--kopf-hoehe', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
}

function Pfeil({ auf }: { auf: boolean }) {
  return (
    <svg className="kopf-reiter-pfeil" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flex: 'none', transform: auf ? 'rotate(180deg)' : undefined }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * Kopf mit Reitern (Arbeits-App): Journal, Projekte, Mehr stehen nebeneinander.
 * Ein Klick klappt nur das Menü dieses Reiters auf, ein zweiter Klick oder ein Klick daneben klappt es zu.
 * Fixiert bleibt das Menü des Reiters, in dem man gerade ist, als schmale Leiste offen.
 */
function ReiterKopf({ app, gruppen, rechts }: { app: string; gruppen: MenueGruppe[]; rechts?: ReactNode }) {
  const schluessel = `rvx-${app}-menue-fixiert`
  const [fixiert, setFixiert] = useState(() => lies(schluessel))
  const [offen, setOffen] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  useKopfHoehe(ref)

  useEffect(() => {
    if (!offen) return
    const zu = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOffen(null)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(null)
    addEventListener('pointerdown', zu)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', zu)
      removeEventListener('keydown', esc)
    }
  }, [offen])

  // Nach einem Klick auf ein Ziel klappt das Menü wieder zu
  useEffect(() => {
    const f = () => setOffen(null)
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])

  const nadel = () => {
    const neu = !fixiert
    setFixiert(neu)
    setOffen(null)
    try {
      localStorage.setItem(schluessel, neu ? '1' : '0')
    } catch {
      /* ohne Speicher eben nur für diese Sitzung */
    }
  }

  const aktiv = gruppen.find((g) => g.aktiv)?.titel ?? null
  const gezeigt = offen ?? (fixiert ? aktiv : null)
  const gruppe = gruppen.find((g) => g.titel === gezeigt)
  const leiste = fixiert && !offen

  return (
    <header className="kopf" ref={ref}>
      <div className="kopf-zeile">
        <div className="kopf-links">
          <img className="kopf-logo" src={logo} alt="RespawnedNotes" />
          <AppSchalter app={app} />
          <nav className="kopf-reiter" aria-label="Hauptmenü">
            {gruppen.map((g) => {
              const auf = gezeigt === g.titel
              return (
                <button
                  key={g.titel}
                  type="button"
                  className={`kopf-reiter-knopf${g.aktiv ? ' aktiv' : ''}${auf ? ' auf' : ''}`}
                  aria-expanded={auf}
                  onClick={() => setOffen(offen === g.titel ? null : g.titel)}
                  title={g.aktiv && g.ort ? g.ort : g.titel}
                >
                  <span className="kopf-reiter-text nur-breit">{g.aktiv && g.ort ? g.ort : g.titel}</span>
                  <span className="kopf-reiter-text nur-schmal" aria-label={g.titel}>
                    {g.kurz ?? g.titel}
                  </span>
                  <Pfeil auf={auf} />
                </button>
              )
            })}
          </nav>
        </div>
        <div className="kopf-rechts">
          {rechts}
          <SyncAnzeige />
          <Version />
        </div>
      </div>
      {gruppe && (
        <div className={`kopf-menue reiter${leiste ? ' fixiert' : ''}`}>
          <div className="kopf-gruppe">
            {gruppe.eintraege.map((e) => (
              <Fragment key={e.ziel + e.titel}>
                {e.abschnitt && !leiste && <div className="kopf-gruppe-titel">{e.abschnitt}</div>}
                <a className={`kopf-eintrag${e.aktiv ? ' aktiv' : ''}${e.betont ? ' betont' : ''}`} href={e.ziel}>
                  <span>{e.titel}</span>
                  {e.zahl !== undefined && e.zahl !== 0 && <span className="zahl">{e.zahl}</span>}
                </a>
              </Fragment>
            ))}
          </div>
          <button type="button" className="knopf still klein kopf-nadel" onClick={nadel} title={fixiert ? 'Menü lösen' : 'Menü des aktuellen Reiters immer zeigen'}>
            {fixiert ? 'Lösen' : 'Fixieren'}
          </button>
        </div>
      )}
    </header>
  )
}

/** Wechsel zwischen den beiden Apps, immer sichtbar oben links */
function AppSchalter({ app }: { app: string }) {
  return (
    <nav className="app-schalter" aria-label="App wechseln">
      <a href="/" className={app === 'arbeit' ? 'aktiv' : ''} aria-current={app === 'arbeit' ? 'page' : undefined}>
        Arbeiten
      </a>
      <a href="/lernen/" className={app === 'lernen' ? 'aktiv' : ''} aria-current={app === 'lernen' ? 'page' : undefined}>
        Lernen
      </a>
    </nav>
  )
}

export function SyncAnzeige() {
  const { speicher } = useDaten()
  const n = speicher.ungesichert()
  const k = speicher.konflikte().length
  const z = speicher.zustand
  const text =
    z === 'laeuft' ? 'gleicht ab' : z === 'offline' ? (n ? `offline · ${n} lokal` : 'offline') : z === 'fehler' ? 'Server nicht erreichbar' : n ? `${n} lokal` : 'gesichert'
  return (
    <span className={`sync ${z}${n ? ' ungesichert' : ''}`} title={speicher.letzterFehler || undefined}>
      <span className="nur-breit">{text}</span>
      {k > 0 && <span className="chip rot">{k} Konflikt{k > 1 ? 'e' : ''}</span>}
    </span>
  )
}

// Kommen beim Build aus vite.config.ts (define)
declare const __VERSION__: string
declare const __GEBAUT__: string

/** Versionsnummer und Build-Zeitpunkt, damit man sieht, ob der neue Stand schon angekommen ist */
export function Version() {
  const v = typeof __VERSION__ === 'string' ? __VERSION__ : '?'
  const g = typeof __GEBAUT__ === 'string' ? new Date(__GEBAUT__) : null
  const zwei = (n: number) => String(n).padStart(2, '0')
  const stand = g ? `${zwei(g.getDate())}.${zwei(g.getMonth() + 1)}. ${zwei(g.getHours())}:${zwei(g.getMinutes())}` : ''
  return (
    <span className="version" title={g ? `Version ${v}, gebaut am ${g.toLocaleString('de-DE')}` : `Version ${v}`}>
      v{v}
      {stand && <span className="nur-breit"> · {stand}</span>}
    </span>
  )
}
