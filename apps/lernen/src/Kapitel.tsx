import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { inhaltText, inhaltVon, kapitelBei, pfade, setzeKapitel, type Eintrag, type Inhalt, type Kapitel } from '@rvx/kern'
import { Dialog, geheZu, ortLink, sichereInhalt, useDaten } from '@rvx/oberflaeche'

/** Inhaltsverzeichnis eines PDFs; liest es beim ersten Öffnen einmal aus dem PDF */
export function useInhalt(quelle: Eintrag): { inhalt: Inhalt | null; liest: boolean } {
  const { speicher, bestand } = useDaten()
  const text = bestand.texte.get(pfade.inhalt(quelle.id))
  const [liest, setLiest] = useState(false)
  const datei = String(quelle.felder.datei ?? '')
  useEffect(() => {
    let weg = false
    setLiest(true)
    sichereInhalt(speicher, quelle.id, datei, text)
      .catch(() => undefined)
      .finally(() => !weg && setLiest(false))
    return () => {
      weg = true
    }
    // nur beim Öffnen eines PDFs, nicht bei jeder Änderung des Verzeichnisses
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speicher, quelle.id, datei])
  return { inhalt: inhaltVon(bestand, quelle.id), liest }
}

/** Kurzform für Leisten und Kacheln: „2.3 Spannungsteiler“ */
export function kapitelKurz(k: Kapitel, max = 42): string {
  return k.titel.length > max ? `${k.titel.slice(0, max - 1).trimEnd()}…` : k.titel
}

/** Knopf in der Leiste des Übungsplatzes: zeigt das aktuelle Kapitel, öffnet das Verzeichnis */
export function InhaltKnopf({ quelle, seite, kompakt }: { quelle: Eintrag; seite: number; kompakt?: boolean }) {
  const { inhalt, liest } = useInhalt(quelle)
  const [offen, setOffen] = useState(false)
  const aktuell = inhalt ? kapitelBei(inhalt.kapitel, seite) : null
  return (
    <>
      {kompakt ? (
        <button type="button" onClick={() => setOffen(true)} title={aktuell ? `Inhalt · ${aktuell.titel}` : 'Inhalt'} aria-label="Inhalt">
          ☰
        </button>
      ) : (
        <button type="button" className="knopf klein inhalt-knopf" onClick={() => setOffen(true)} title="Inhaltsverzeichnis">
          <span aria-hidden="true">☰</span>
          <span className="inhalt-knopf-text">{aktuell ? kapitelKurz(aktuell, 34) : 'Inhalt'}</span>
        </button>
      )}
      {/* eigene Ebene, damit die Knöpfe der Vollbild-Steuerung nicht auf den Dialog abfärben */}
      {offen && createPortal(<Verzeichnis quelle={quelle} seite={seite} inhalt={inhalt} liest={liest} onZu={() => setOffen(false)} />, document.body)}
    </>
  )
}

function Verzeichnis({ quelle, seite, inhalt, liest, onZu }: { quelle: Eintrag; seite: number; inhalt: Inhalt | null; liest: boolean; onZu: () => void }) {
  const { speicher } = useDaten()
  const [suche, setSuche] = useState('')
  const [bearbeiten, setBearbeiten] = useState(false)
  const [neu, setNeu] = useState<string | null>(null)
  const aktuellRef = useRef<HTMLButtonElement>(null)
  const kapitel = inhalt?.kapitel ?? []
  const aktuell = kapitelBei(kapitel, seite)
  const w = suche.trim().toLowerCase()
  const liste = w ? kapitel.filter((k) => k.titel.toLowerCase().includes(w)) : kapitel

  useEffect(() => {
    aktuellRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const speichere = (f: (k: Kapitel[]) => Kapitel[]) => speicher.aendere(pfade.inhalt(quelle.id), () => inhaltText(setzeKapitel(inhalt, f)))
  const anlegen = async () => {
    const titel = neu?.trim()
    if (!titel) return
    const ebene = aktuell && aktuell.seite === seite ? aktuell.ebene : 1
    await speichere((k) => [...k, { titel, seite, ebene }])
    setNeu(null)
  }

  return (
    <Dialog titel="Inhalt" onZu={onZu}>
      {kapitel.length > 15 && <input className="eingabe" type="search" placeholder="Kapitel suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />}
      {liest && !inhalt && <div className="klein-leise">Inhaltsverzeichnis wird aus dem PDF gelesen …</div>}
      {!liest && !kapitel.length && (
        <div className="klein-leise">
          Dieses PDF hat kein Inhaltsverzeichnis, das sich lesen lässt (zum Beispiel ein Scan). Blättere zum Anfang eines Kapitels und tippe „Kapitel beginnt hier“.
        </div>
      )}
      {kapitel.length > 0 && (
        <div className="inhalt-liste">
          {liste.map((k, i) => (
            <div key={`${k.seite}-${i}-${k.titel}`} className="inhalt-zeile" style={{ paddingLeft: (Math.min(k.ebene, 4) - 1) * 16 }}>
              <button
                type="button"
                ref={k === aktuell ? aktuellRef : undefined}
                className={`inhalt-eintrag${k === aktuell ? ' aktuell' : ''}${k.ebene === 1 ? ' oben' : ''}`}
                onClick={() => {
                  geheZu('sammeln', quelle.id, k.seite)
                  onZu()
                }}
              >
                <span className="inhalt-titel">{k.titel}</span>
                <span className="klein-leise">S. {k.seite}</span>
              </button>
              {bearbeiten && (
                <input
                  className="eingabe inhalt-seite"
                  type="number"
                  min={1}
                  defaultValue={k.seite}
                  aria-label={`Seite von ${k.titel}`}
                  onBlur={(e) => {
                    const s = Math.round(Number(e.target.value))
                    if (s >= 1 && s !== k.seite) void speichere((alle) => alle.map((x) => (x === k ? { ...x, seite: s } : x)))
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              )}
              {bearbeiten && (
                <button type="button" className="knopf still klein symbol" aria-label={`${k.titel} entfernen`} onClick={() => void speichere((alle) => alle.filter((x) => x !== k))}>
                  ×
                </button>
              )}
            </div>
          ))}
          {w && !liste.length && <div className="klein-leise">Nichts gefunden.</div>}
        </div>
      )}
      {inhalt?.herkunft === 'gedruckt' && !inhalt.eigen && <div className="klein-leise">Aus den Inhaltsseiten des PDFs gelesen. Stimmt eine Seite nicht, korrigiere sie unter „Bearbeiten“.</div>}
      {neu !== null ? (
        <div className="reihe">
          <input
            className="eingabe"
            autoFocus
            placeholder={`Kapitel ab S. ${seite}`}
            value={neu}
            onChange={(e) => setNeu(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void anlegen()
              if (e.key === 'Escape') {
                e.stopPropagation()
                setNeu(null)
              }
            }}
          />
          <button type="button" className="knopf haupt klein" disabled={!neu.trim()} onClick={() => void anlegen()}>
            Anlegen
          </button>
        </div>
      ) : (
        <div className="dialog-knoepfe">
          {kapitel.length > 0 && (
            <button type="button" className="knopf still" onClick={() => setBearbeiten(!bearbeiten)}>
              {bearbeiten ? 'Fertig' : 'Bearbeiten'}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="knopf" onClick={() => setNeu('')}>
            Kapitel beginnt hier (S. {seite})
          </button>
        </div>
      )}
    </Dialog>
  )
}

/** Kapitel eines PDFs in der Modulübersicht (aufklappbar), das aktuelle hervorgehoben */
export function KapitelUebersicht({ quelle, seite }: { quelle: Eintrag; seite?: number }) {
  const { bestand } = useDaten()
  const inhalt = inhaltVon(bestand, quelle.id)
  if (!inhalt?.kapitel.length) return null
  const oben = inhalt.kapitel.filter((k) => k.ebene === 1)
  // Bücher mit nur einem Teil auf oberster Ebene: eine Ebene tiefer zeigen
  const tiefe = oben.length < 3 ? 2 : 1
  const liste = inhalt.kapitel.filter((k) => k.ebene <= tiefe)
  const aktuell = seite ? kapitelBei(liste, seite) : null
  return (
    <details className="modul-kapitel">
      <summary className="klein-leise">
        {liste.length} Kapitel
        {aktuell ? ` · gerade in ${kapitelKurz(aktuell)}` : ''}
      </summary>
      <ol>
        {liste.map((k, i) => (
          <li key={`${k.seite}-${i}`} className={k === aktuell ? 'aktuell' : undefined} style={{ paddingLeft: (k.ebene - 1) * 14 }}>
            <a href={ortLink('sammeln', quelle.id, k.seite)}>{k.titel}</a>
            <span className="klein-leise"> S. {k.seite}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}
