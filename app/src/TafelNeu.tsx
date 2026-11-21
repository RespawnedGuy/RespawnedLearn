// „Neu n“ im Tafelwerk (Vertrag Lernen 1.13): jeden benannten Baustein einmal anbieten. Tab antippen legt ihn mit
// ✦-Verweis ans Ende des Tabs, „Nein“ merkt sich das Gerät (gilt für alle Geräte), „Später“ lässt ihn stehen.
import { useState } from 'react'
import { bausteinSchluessel, tabVorschlag, type Baustein } from '@rl/kern'
import { useDaten } from '@rl/oberflaeche'
import { Ausschnitt } from './Inhalt'
import { insTafelwerk, nichtInsTafelwerk, useTafelwerk } from './tafelwerkDaten'

/** So viele Karten auf einmal; der Rest kommt nach, wenn diese entschieden sind */
const AUF_EINMAL = 12

export function TafelNeu({ neu, onZu }: { neu: Baustein[]; onZu: () => void }) {
  const [spaeter, setSpaeter] = useState<Set<string>>(() => new Set())
  const zeige = neu.filter((b) => !spaeter.has(bausteinSchluessel(b.anhang, b.marke.id)))
  return (
    <section className="bausteine" aria-label="Neue Bausteine fürs Tafelwerk">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 className="passt-titel" style={{ flex: 1 }}>
          Ins Tafelwerk?
        </h2>
        <button type="button" className="knopf still klein" onClick={onZu}>
          Fertig
        </button>
      </div>
      {!zeige.length ? (
        <div className="leer">Über alles entschieden. Neue Bausteine erscheinen hier, sobald du sie benennst.</div>
      ) : (
        <>
          <p className="klein-leise">Tippe den Tab an, in den der Baustein gehört. Er kommt ans Ende des Tabs, dort verschiebst du ihn frei. „Nein“ fragt nie wieder.</p>
          <div className="baustein-liste">
            {zeige.slice(0, AUF_EINMAL).map((b) => (
              <NeuKarte key={bausteinSchluessel(b.anhang, b.marke.id)} b={b} onSpaeter={() => setSpaeter((s) => new Set(s).add(bausteinSchluessel(b.anhang, b.marke.id)))} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function NeuKarte({ b, onSpaeter }: { b: Baustein; onSpaeter: () => void }) {
  const { speicher, bestand } = useDaten()
  const tw = useTafelwerk()
  const [laeuft, setLaeuft] = useState(false)
  const doc = bestand.dokumente.get(b.anhang)
  const stelle = `${doc?.titel ?? 'Skript'}, S. ${b.marke.seite}`
  const reihe = tabVorschlag(b, tw.tabs, tw.drin)
  const titel = (id: string) => tw.tabs.find((t) => t.id === id)?.titel ?? 'Tab'
  const lege = async (tab: string) => {
    setLaeuft(true)
    try {
      await insTafelwerk(speicher, bestand, b, tab)
    } finally {
      setLaeuft(false)
    }
  }
  return (
    <article className="karte baustein">
      <Ausschnitt anhangId={b.anhang} seite={b.marke.seite} markeId={b.marke.id} breite={480} titel={stelle} />
      <div className="baustein-name">
        <span className="eintrag-titel">{b.titel}</span>
        {b.schlagworte.length > 0 && (
          <span className="reihe">
            {b.schlagworte.map((w) => (
              <span key={w} className="chip">
                #{w}
              </span>
            ))}
          </span>
        )}
        {reihe.length ? (
          <div className="reihe tafel-wahl" role="group" aria-label={`${b.titel} in welchen Tab?`}>
            {reihe.map((id, i) => (
              <button key={id} type="button" className={`knopf klein${i === 0 ? ' haupt' : ''}`} disabled={laeuft} onClick={() => void lege(id)}>
                {titel(id)}
              </button>
            ))}
          </div>
        ) : (
          <span className="klein-leise">Lege oben zuerst einen Tab an.</span>
        )}
        <div className="reihe">
          <button type="button" className="knopf still klein" disabled={laeuft} onClick={() => void nichtInsTafelwerk(speicher, b)} title="Nicht ins Tafelwerk; wird nicht mehr angeboten">
            Nein
          </button>
          <button type="button" className="knopf still klein" onClick={onSpaeter} title="Jetzt nicht, beim nächsten Öffnen wieder">
            Später
          </button>
        </div>
      </div>
      <span className="klein-leise">{stelle}</span>
    </article>
  )
}
