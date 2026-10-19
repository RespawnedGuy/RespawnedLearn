import { useEffect, useRef, useState, type ReactNode } from 'react'
import logo from './logo.png'
import { useDaten } from './daten/DatenKontext'

export interface MenueEintrag {
  titel: string
  ziel: string
  aktiv?: boolean
  zahl?: number | string
}

export interface MenueGruppe {
  titel: string
  eintraege: MenueEintrag[]
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
export function Kopf({ app, ort, gruppen, mitte, rechts }: { app: string; ort: string; gruppen: MenueGruppe[]; mitte?: ReactNode; rechts?: ReactNode }) {
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
        </div>
      </div>
      {sichtbar && (
        <nav className={`kopf-menue${fixiert ? ' fixiert' : ''}`} aria-label="Hauptmenü">
          {gruppen.map((g) => (
            <div className="kopf-gruppe" key={g.titel}>
              <div className="kopf-gruppe-titel">{g.titel}</div>
              {g.eintraege.map((e) => (
                <a key={e.ziel + e.titel} className={`kopf-eintrag${e.aktiv ? ' aktiv' : ''}`} href={e.ziel}>
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
