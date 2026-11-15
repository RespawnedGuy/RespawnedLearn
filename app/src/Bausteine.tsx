// Bausteine in „Nutzen“ (Vertrag Lernen 1.8, 5.4): Jede Markierung ist ein Baustein. Die Suche findet sie in allen
// Skripten; „Offen“ fragt nach denen ohne Namen: benennen oder weglegen. „Weggelegt“ holt zurück, was weggelegt oder
// mit dem Radierer gelöscht wurde (Lernen 1.11). Ein benannter Baustein wird nie gelöscht.
import { useMemo, useState } from 'react'
import { absatzAmAnker, alleBausteine, eingabeVon, linkZiel, modulVon, offeneBausteine, sucheBausteine, type Baustein, type Bestand } from '@rl/kern'
import { melde, ortLink, useDaten } from '@rl/oberflaeche'
import { Ausschnitt } from './Inhalt'
import { benenneBaustein, legeBausteinWeg } from './wissen'

export function useBausteine(): Baustein[] {
  const { bestand } = useDaten()
  return useMemo(() => alleBausteine(bestand.texte), [bestand])
}

function imModul(bestand: Bestand, b: Baustein, modul: string | null) {
  if (!modul) return true
  // Ein Notizbuch gehört über sein Feld `modul` zum Modul, ein Skript über die Quellen des Moduls
  const doc = bestand.dokumente.get(b.anhang)
  const von = doc?.typ === 'notizbuch' ? linkZiel(doc.felder.modul) : doc?.typ === 'notiz' ? linkZiel(doc.felder.thema) : modulVon(bestand, b.anhang)?.id
  return von === modul
}

export function anzahlOffen(alle: Baustein[], bestand: Bestand, modul: string | null) {
  return alle.filter((b) => b.offen && bestand.dokumente.has(b.anhang) && imModul(bestand, b, modul)).length
}

/** Passende Bausteine zur Suche, aus allen Skripten (mit Modul: nur aus dessen Skripten) */
export function findeBausteine(alle: Baustein[], bestand: Bestand, q: string, modul: string | null): Baustein[] {
  const titel = (a: string) => bestand.dokumente.get(a)?.titel ?? ''
  return sucheBausteine(alle, q, titel).filter((b) => bestand.dokumente.has(b.anhang) && imModul(bestand, b, modul))
}

export function BausteinTreffer({ treffer }: { treffer: Baustein[] }) {
  if (!treffer.length) return null
  return (
    <section className="bausteine" aria-label="Bausteine">
      <h2 className="passt-titel">Bausteine{treffer.length > 12 ? ` (12 von ${treffer.length})` : ''}</h2>
      <div className="baustein-liste">
        {treffer.slice(0, 12).map((b) => (
          <BausteinKarte key={`${b.anhang}:${b.marke.id}`} b={b} />
        ))}
      </div>
    </section>
  )
}

export function anzahlWeggelegt(alle: Baustein[], bestand: Bestand, modul: string | null) {
  return alle.filter((b) => b.archiviert && bestand.dokumente.has(b.anhang) && imModul(bestand, b, modul)).length
}

/** „Weggelegt“: zurückholen, die zuletzt gesetzten zuerst */
export function WeggelegteBausteine({ modul, onZu }: { modul: string | null; onZu: () => void }) {
  const { bestand } = useDaten()
  const weg = useBausteine()
    .filter((b) => b.archiviert && bestand.dokumente.has(b.anhang) && imModul(bestand, b, modul))
    .sort((x, y) => y.marke.datum.localeCompare(x.marke.datum))
  return (
    <section className="bausteine" aria-label="Weggelegte Bausteine">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 className="passt-titel" style={{ flex: 1 }}>
          Weggelegt
        </h2>
        <button type="button" className="knopf still klein" onClick={onZu}>
          Fertig
        </button>
      </div>
      {!weg.length ? (
        <div className="leer">Nichts weggelegt.</div>
      ) : (
        <>
          <p className="klein-leise">Weggelegte Bausteine stehen nicht mehr auf der Seite und nicht in der Suche. Zurückholen bringt sie an ihre Stelle.</p>
          <div className="baustein-liste">
            {weg.slice(0, 60).map((b) => (
              <BausteinKarte key={`${b.anhang}:${b.marke.id}`} b={b} weggelegt />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** „Offen“: Bausteine ohne Namen, die ältesten zuerst */
export function OffeneBausteine({ modul, onZu }: { modul: string | null; onZu: () => void }) {
  const { bestand } = useDaten()
  const offen = offeneBausteine(useBausteine()).filter((b) => bestand.dokumente.has(b.anhang) && imModul(bestand, b, modul))
  return (
    <section className="bausteine" aria-label="Offene Bausteine">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 className="passt-titel" style={{ flex: 1 }}>
          Offen: Brauchst du das noch?
        </h2>
        <button type="button" className="knopf still klein" onClick={onZu}>
          Fertig
        </button>
      </div>
      {!offen.length ? (
        <div className="leer">Alles benannt. Neue Markierungen ohne Namen erscheinen hier.</div>
      ) : (
        <>
          <p className="klein-leise">Gib einen Namen (Schlagworte mit #), dann findest du die Stelle in jedem Skript wieder. Was du nicht mehr brauchst, legst du weg; unter „Weggelegt“ holst du es zurück.</p>
          <div className="baustein-liste">
            {offen.slice(0, 30).map((b) => (
              <BausteinKarte key={`${b.anhang}:${b.marke.id}`} b={b} offen />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function seit(datum: string): string {
  const tage = Math.round((Date.now() - new Date(`${datum}T12:00:00`).getTime()) / 86400000)
  if (!Number.isFinite(tage) || tage < 1) return 'von heute'
  if (tage === 1) return 'seit gestern'
  if (tage < 14) return `seit ${tage} Tagen`
  if (tage < 60) return `seit ${Math.round(tage / 7)} Wochen`
  return `seit ${Math.round(tage / 30)} Monaten`
}

function BausteinKarte({ b, offen = false, weggelegt = false }: { b: Baustein; offen?: boolean; weggelegt?: boolean }) {
  const { bestand, speicher } = useDaten()
  const [bearbeiten, setBearbeiten] = useState(offen)
  const [eingabe, setEingabe] = useState(() => eingabeVon(b))
  const doc = bestand.dokumente.get(b.anhang)
  const istBuch = doc?.typ === 'notizbuch'
  // Textstelle einer Mitschrift (Lernen 1.10): Blockkennung statt Seite
  const anker = b.marke.anker
  const quelle = doc?.titel ?? 'Skript'
  const stelle = anker ? quelle : `${quelle}, S. ${b.marke.seite}`
  const zurStelle = anker
    ? ortLink('sammeln', 'mitschrift', b.anhang, anker)
    : istBuch
      ? ortLink('sammeln', 'buch', b.anhang, b.marke.seite, b.marke.id)
      : ortLink('sammeln', b.anhang, b.marke.seite)
  const merken = () => {
    if (!eingabe.trim()) return
    void benenneBaustein(speicher, b.anhang, b.marke.id, eingabe)
    if (!offen) setBearbeiten(false)
  }
  const weg = () => {
    void legeBausteinWeg(speicher, b.anhang, b.marke.id, true)
    melde(`Weggelegt: ${b.titel || stelle}`, () => void legeBausteinWeg(speicher, b.anhang, b.marke.id, false))
  }
  const zurueckholen = () => {
    void legeBausteinWeg(speicher, b.anhang, b.marke.id, false)
    melde(`Zurückgeholt: ${b.titel || stelle}`, () => void legeBausteinWeg(speicher, b.anhang, b.marke.id, true))
  }
  return (
    <article className="karte baustein">
      {anker ? (
        <a className="ausschnitt mitschrift-ausschnitt" href={zurStelle} title={stelle}>
          {(doc && absatzAmAnker(doc.rumpf, anker)) ?? 'Die Stelle steht nicht mehr in der Mitschrift.'}
        </a>
      ) : (
        <Ausschnitt anhangId={b.anhang} seite={b.marke.seite} markeId={b.marke.id} breite={480} titel={stelle} />
      )}
      {bearbeiten ? (
        <div className="baustein-name">
          <label className="unsichtbar" htmlFor={`bs-${b.marke.id}`}>
            Name für {stelle}
          </label>
          <input
            id={`bs-${b.marke.id}`}
            className="eingabe"
            enterKeyHint="done"
            placeholder="Name, z. B. Potenzregel #integral"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') merken()
              if (e.key === 'Escape' && !offen) setBearbeiten(false)
            }}
          />
          <div className="reihe">
            <button type="button" className="knopf haupt klein" disabled={!eingabe.trim()} onClick={merken}>
              Merken
            </button>
            {offen ? (
              <button type="button" className="knopf still klein" onClick={weg} title="Aus „Offen“, der Suche und von der Seite nehmen; zurückholen unter „Weggelegt“">
                Weglegen
              </button>
            ) : (
              <button type="button" className="knopf still klein" onClick={() => setBearbeiten(false)}>
                Abbrechen
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="baustein-name">
          <span className="eintrag-titel">{b.titel || 'Ohne Namen'}</span>
          {b.schlagworte.length > 0 && (
            <span className="reihe">
              {b.schlagworte.map((w) => (
                <span key={w} className="chip">
                  #{w}
                </span>
              ))}
            </span>
          )}
          <div className="reihe">
            <a className="knopf klein" href={zurStelle}>
              Zur Stelle
            </a>
            <button type="button" className="knopf still klein" onClick={() => setBearbeiten(true)} aria-label={`${b.titel || stelle} umbenennen`}>
              Umbenennen
            </button>
            {weggelegt ? (
              <button type="button" className="knopf haupt klein" onClick={zurueckholen} title="Wieder auf die Seite und in die Suche">
                Zurückholen
              </button>
            ) : (
              <button type="button" className="knopf still klein" onClick={weg} title="Aus der Suche und von der Seite nehmen; zurückholen unter „Weggelegt“">
                Weglegen
              </button>
            )}
          </div>
        </div>
      )}
      <span className="klein-leise">
        {stelle}
        {offen ? ` · ${seit(b.marke.datum)}` : ''}
      </span>
    </article>
  )
}
