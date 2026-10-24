import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import logo from './logo.png'
import { useDaten } from './daten/DatenKontext'
import { laedtHoch } from './daten/speicher'
import { kannZurueck, zurueck } from './ort'

export interface MenueEintrag {
  titel: string
  ziel: string
  aktiv?: boolean
  zahl?: number | string
  /** fett, z. B. „Alle Projekte“ */
  betont?: boolean
}

export interface MenueGruppe {
  titel: string
  eintraege: MenueEintrag[]
}

/** Ein festes Ziel im Kopf (am Handy in der Daumenleiste) */
export interface KopfZiel {
  titel: string
  ziel: string
  aktiv?: boolean
  /** Zähler, nur gezeigt wenn größer 0 */
  zahl?: number
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
  ziele,
  ...rest
}: {
  app: string
  ort: string
  gruppen?: MenueGruppe[]
  mitte?: ReactNode
  rechts?: ReactNode
  /** feste Ziele statt Menü: je eines ein Reiter, ein Klick springt hin */
  ziele?: KopfZiel[]
  /** übergeordnete Ansicht für „Zurück“, wenn es keinen Verlauf gibt (null = ganz oben) */
  oben?: string | null
}) {
  return ziele ? <ZielKopf app={rest.app} ziele={ziele} rechts={rest.rechts} oben={rest.oben} /> : <MenueKopf {...rest} gruppen={rest.gruppen ?? []} />
}

function MenueKopf({ app, ort, gruppen, mitte, rechts, oben }: { app: string; ort: string; gruppen: MenueGruppe[]; mitte?: ReactNode; rechts?: ReactNode; oben?: string | null }) {
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
          <ZurueckPfeil oben={oben} />
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

/**
 * Kopf mit festen Zielen (Arbeits-App): Jeder Reiter springt mit einem Klick an sein Ziel, nichts klappt auf.
 * Am Handy sitzen die Ziele stattdessen unten in der Daumenleiste; oben bleiben nur Zurück, App, Lupe und Zahnrad.
 */
function ZielKopf({ app, ziele, rechts, oben }: { app: string; ziele: KopfZiel[]; rechts?: ReactNode; oben?: string | null }) {
  const ref = useRef<HTMLElement>(null)
  useKopfHoehe(ref)
  return (
    <header className="kopf" ref={ref}>
      <div className="kopf-zeile">
        <div className="kopf-links">
          <ZurueckPfeil oben={oben} />
          <img className="kopf-logo" src={logo} alt="RespawnedNotes" />
          <AppSchalter app={app} />
          <nav className="kopf-reiter nur-breit" aria-label="Hauptmenü">
            {ziele.map((z) => (
              <a key={z.ziel} className={`kopf-reiter-knopf${z.aktiv ? ' aktiv' : ''}`} href={z.ziel} aria-current={z.aktiv ? 'page' : undefined}>
                <span className="kopf-reiter-text">{z.titel}</span>
                {!!z.zahl && <span className="kopf-zahl">{z.zahl}</span>}
              </a>
            ))}
          </nav>
        </div>
        <div className="kopf-rechts">
          {rechts}
          <SyncAnzeige />
          <Version />
        </div>
      </div>
    </header>
  )
}

/**
 * Zurück-Pfeil, in beiden Apps und allen Ansichten ganz links oben (Linkshänder: Daumen und Hand verdecken nichts).
 * Ganz oben bleibt sein Platz frei, damit nichts daneben springt.
 */
export function ZurueckPfeil({ oben, schwebend, vorher }: { oben?: string | null; schwebend?: boolean; vorher?: () => void }) {
  const geht = kannZurueck(oben)
  return (
    <button
      type="button"
      className={`zurueck-pfeil${schwebend ? ' schwebend' : ''}`}
      onClick={() => {
        vorher?.()
        zurueck(oben)
      }}
      disabled={!geht}
      aria-hidden={!geht || undefined}
      tabIndex={geht ? undefined : -1}
      aria-label="Zurück"
      title="Zurück"
    >
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  )
}

/** Wechsel zwischen den Bereichen, immer sichtbar oben links. Organisation wohnt in der Arbeits-App (#/organisation). */
function AppSchalter({ app }: { app: string }) {
  return (
    <nav className="app-schalter" aria-label="App wechseln">
      <a href="/#/" className={app === 'arbeit' ? 'aktiv' : ''} aria-current={app === 'arbeit' ? 'page' : undefined}>
        Arbeiten
      </a>
      <a href="/lernen/" className={app === 'lernen' ? 'aktiv' : ''} aria-current={app === 'lernen' ? 'page' : undefined}>
        Lernen
      </a>
      <a href="/#/organisation" className={app === 'organisation' ? 'aktiv' : ''} aria-current={app === 'organisation' ? 'page' : undefined}>
        <span className="nur-breit">Organisation</span>
        <span className="nur-schmal">Orga</span>
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
    z === 'laeuft' ? (laedtHoch() ? 'lädt Datei hoch' : 'gleicht ab') : z === 'offline' ? (n ? `offline · ${n} lokal` : 'offline') : z === 'fehler' ? 'Server nicht erreichbar' : n ? `${n} lokal` : 'gesichert'
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
