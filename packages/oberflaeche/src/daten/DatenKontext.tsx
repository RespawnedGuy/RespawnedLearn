import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Bestand } from '@rl/kern'
import { Speicher, type SpeicherOptionen } from './speicher'

interface Daten {
  speicher: Speicher
  bestand: Bestand
  version: number
}

const Kontext = createContext<Daten | null>(null)

export function DatenAnbieter({ optionen, children }: { optionen: SpeicherOptionen; children: ReactNode }) {
  const [speicher] = useState(() => new Speicher(optionen))
  const [bereit, setBereit] = useState(false)
  const [fehler, setFehler] = useState('')
  useEffect(() => {
    speicher.oeffne().then(() => setBereit(true), (e) => setFehler(String(e?.message ?? e)))
  }, [speicher])
  const version = useSyncExternalStore(
    (f) => speicher.abonniere(f),
    () => speicher.version
  )
  // Der Index wird bei jeder Änderung neu gebaut: einfach und für einige tausend Dateien schnell genug
  const bestand = useMemo(() => new Bestand(speicher.alleTexte()), [speicher, version])
  if (fehler) return <div className="leer">Lokaler Speicher nicht verfügbar: {fehler}</div>
  if (!bereit) return null
  return <Kontext.Provider value={{ speicher, bestand, version }}>{children}</Kontext.Provider>
}

export function useDaten(): Daten {
  const d = useContext(Kontext)
  if (!d) throw new Error('DatenAnbieter fehlt')
  return d
}
