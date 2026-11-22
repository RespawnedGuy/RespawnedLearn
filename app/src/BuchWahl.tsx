// „+ Buch“ im Übungsplatz: Notizbuch wählen oder neu anlegen (Konzept Notizbücher, Skizze „Buch wählen“).
// Oben die Bücher, die schon auf dieses Skript verweisen, dann die des Moduls, dann die übrigen.
import { useEffect, useRef, useState } from 'react'
import { LINEATUREN, tafeln, type Eintrag, type Lineatur } from '@rl/kern'
import { useDaten, type Speicher } from '@rl/oberflaeche'
import { LineaturBild } from './Blaetter'
import { modulVonBuch, neuesBuch, notizbuecher, seitenText, seitenVon } from './Buch'

/** Verweist irgendeine Seite des Buchs auf dieses Skript? (schneller Blick in die Seitendateien) */
function verweistAuf(speicher: Speicher, buch: string, anhang: string): boolean {
  const vorne = `lernen/buecher/${buch}/`
  return speicher.pfade().some((p) => p.startsWith(vorne) && p.endsWith('.json') && (speicher.text(p) ?? '').includes(`"anhang":"${anhang}"`))
}

export function BuchWahl({ quelle, modul, offen: schonDa, onWahl }: { quelle: Eintrag; modul: string | null; offen: string[]; onWahl: (id: string) => void }) {
  const { speicher, bestand } = useDaten()
  const [auf, setAuf] = useState(false)
  const [neu, setNeu] = useState(false)
  const [titel, setTitel] = useState('')
  const [lineatur, setLineatur] = useState<Lineatur>('kariert')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!auf) return
    const weg = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setAuf(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAuf(false)
    addEventListener('pointerdown', weg, true)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', weg, true)
      removeEventListener('keydown', esc)
    }
  }, [auf])

  const alle = auf ? notizbuecher(bestand.dokumente.values()).filter((b) => !schonDa.includes(b.id)) : []
  const neueste = (a: Eintrag, b: Eintrag) => String(b.felder.geaendert ?? '').localeCompare(String(a.felder.geaendert ?? ''))
  const hier = alle.filter((b) => verweistAuf(speicher, b.id, quelle.id)).sort(neueste)
  const imModul = alle.filter((b) => !hier.includes(b) && modul && modulVonBuch(b) === modul).sort(neueste)
  const weitere = alle.filter((b) => !hier.includes(b) && !imModul.includes(b)).sort(neueste)
  // Tabs des Tafelwerks (Lernen 1.13): stehen wie ein Buch neben dem Skript, bekommen aber nie von selbst etwas
  const tabs = auf ? tafeln(bestand.dokumente.values()).filter((b) => !schonDa.includes(b.id)) : []
  const waehle = (id: string) => {
    onWahl(id)
    setAuf(false)
    setNeu(false)
  }
  const anlegen = async () => {
    const t = titel.trim()
    if (!t) return
    waehle(await neuesBuch(speicher, { titel: t, lineatur, modul }))
    setTitel('')
  }
  const zeile = (b: Eintrag) => (
    <button key={b.id} type="button" role="menuitem" className="buch-zeile" onClick={() => waehle(b.id)}>
      <span className="buch-ruecken" aria-hidden="true" />
      <span>
        {b.titel}
        <small>{seitenText(seitenVon(speicher, b.id).length - 1)}</small>
      </span>
    </button>
  )
  return (
    <div className="blatt-menue-huelle" ref={ref}>
      <button type="button" className="knopf klein" aria-expanded={auf} onClick={() => setAuf(!auf)}>
        + Buch
      </button>
      {auf && (
        <div className="blatt-menue buch-menue" role="menu">
          {hier.length > 0 && <div className="klein-leise">Zu diesem Skript</div>}
          {hier.map(zeile)}
          {imModul.length > 0 && <div className="klein-leise">Weitere im Modul</div>}
          {imModul.map(zeile)}
          {weitere.length > 0 && <div className="klein-leise">{hier.length || imModul.length ? 'Weitere' : 'Notizbücher'}</div>}
          {weitere.slice(0, 8).map(zeile)}
          {tabs.length > 0 && <div className="klein-leise">Tafelwerk</div>}
          {tabs.map(zeile)}
          {!neu ? (
            <button type="button" role="menuitem" className="knopf still klein buch-neu" onClick={() => setNeu(true)}>
              + Neues Buch …
            </button>
          ) : (
            <>
              <input className="eingabe" autoFocus placeholder="Name, z. B. Übungen Kapitel 3" value={titel} onChange={(e) => setTitel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void anlegen()} />
              <div className="lineatur-knoepfe">
                {LINEATUREN.map((l) => (
                  <button key={l.art} type="button" className={`lineatur-knopf${lineatur === l.art ? ' gewaehlt' : ''}`} aria-pressed={lineatur === l.art} onClick={() => setLineatur(l.art)}>
                    <span className="lineatur-probe">
                      <LineaturBild art={l.art} format={0.5} breite={300} />
                    </span>
                    {l.name}
                  </button>
                ))}
              </div>
              <button type="button" className="knopf haupt klein" disabled={!titel.trim()} onClick={() => void anlegen()}>
                Anlegen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
