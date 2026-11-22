// Tafelwerk in „Nutzen“ (Vertrag Lernen 1.13): oben die Tabs, darunter die Seiten des gewählten Tabs, beschrieben und
// bedient wie jedes Notizbuch. „Neu n“ bietet jeden benannten Baustein einmal an; „Weggelegt n“ holt Tabs zurück.
// Die Suche (Lernen 1.14) springt in den Tab an die Stelle.
import { useState } from 'react'
import { neuFuerTafelwerk, type Farbe } from '@rl/kern'
import { Werkzeugleiste, geheZu, melde, ortLink, useDaten, type Werkzeug } from '@rl/oberflaeche'
import { AnsichtKopf } from './Blaetter'
import { BuchAnsicht, benenneNotizbuch, lineaturVon, setzeBuchLineatur, type BuchSprung } from './Buch'
import { NameFeld } from './NameFeld'
import { useBausteine } from './Bausteine'
import { useAblage } from './ablage'
import { fuegeEinPerKnopf } from './kopieren'
import { legeTabWeg, neuerTab, useTafelwerk, weggelegteTabs } from './tafelwerkDaten'
import { TafelNeu } from './TafelNeu'
import { TafelSuche } from './TafelSuche'

const TAB_SCHLUESSEL = 'rl-tafelwerk-tab'
const liesTab = () => {
  try {
    return localStorage.getItem(TAB_SCHLUESSEL)
  } catch {
    return null
  }
}
const merkeTab = (id: string) => {
  try {
    localStorage.setItem(TAB_SCHLUESSEL, id)
  } catch {
    /* privates Fenster: dann eben nicht gemerkt */
  }
}

/** Umschalter oben in „Nutzen“: suchen oder im Tafelwerk nachschlagen */
export function NutzenWahl({ aktiv }: { aktiv: 'suchen' | 'tafelwerk' }) {
  return (
    <div className="segmente klein nutzen-wahl" role="tablist" aria-label="Nutzen">
      <button type="button" role="tab" aria-selected={aktiv === 'suchen'} className={aktiv === 'suchen' ? 'aktiv' : ''} onClick={() => aktiv !== 'suchen' && geheZu('nutzen')}>
        Suchen
      </button>
      <button type="button" role="tab" aria-selected={aktiv === 'tafelwerk'} className={aktiv === 'tafelwerk' ? 'aktiv' : ''} onClick={() => aktiv !== 'tafelwerk' && geheZu('nutzen', 'tafelwerk')}>
        Tafelwerk
      </button>
    </div>
  )
}

export function Tafelwerk({ tab }: { tab?: string }) {
  const { speicher, bestand } = useDaten()
  const tw = useTafelwerk()
  const bausteine = useBausteine()
  const neu = neuFuerTafelwerk(bausteine, tw.drin, tw.nein, tw.alleTabs).filter((b) => bestand.dokumente.has(b.anhang))
  const weg = weggelegteTabs(bestand.dokumente.values())
  const [liste, setListe] = useState<'neu' | 'weg' | null>(null)
  const [anlegen, setAnlegen] = useState(false)
  const [titel, setTitel] = useState('')
  // Lesen: der Finger scrollt, der Stift schreibt (am Handy blättert man hier vor allem)
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('lesen')
  const [farbe, setFarbe] = useState<Farbe>('alltag')
  const kopie = useAblage()
  // Sprung aus der Suche: Tab, Seite, Höhe (die Stelle leuchtet kurz auf)
  const [sprung, setSprung] = useState<(BuchSprung & { tab: string }) | null>(null)
  const gemerkt = liesTab()
  const aktiv = tw.tabs.find((t) => t.id === tab) ?? tw.tabs.find((t) => t.id === gemerkt) ?? tw.tabs[0]
  if (aktiv && aktiv.id !== gemerkt) merkeTab(aktiv.id)

  const lege = async () => {
    const t = titel.trim()
    if (!t) return
    const id = await neuerTab(speicher, t)
    setTitel('')
    setAnlegen(false)
    setListe(null)
    geheZu('nutzen', 'tafelwerk', id)
  }
  const weglegen = (id: string, name: string) => {
    void legeTabWeg(speicher, id, true)
    melde(`Tab „${name}“ weggelegt`, () => void legeTabWeg(speicher, id, false))
  }

  return (
    <div className="tafelwerk">
      <h1 className="nur-vorleser">Tafelwerk</h1>
      <div className="plan-leiste">
        <NutzenWahl aktiv="tafelwerk" />
        <span className="plan-luecke" />
        {aktiv && !liste && (
          <Werkzeugleiste
            werkzeug={werkzeug}
            farbe={farbe}
            onWerkzeug={setWerkzeug}
            onFarbe={setFarbe}
            onEinfuegen={kopie ? () => void fuegeEinPerKnopf(speicher, [aktiv.id], kopie) : undefined}
          />
        )}
        <span className="plan-luecke" />
      </div>
      <div className="tafel-tabs" role="tablist" aria-label="Tabs des Tafelwerks">
        {tw.tabs.map((t) => (
          <a key={t.id} role="tab" aria-selected={!liste && t.id === aktiv?.id} className={`chip${!liste && t.id === aktiv?.id ? ' aktiv' : ''}`} href={ortLink('nutzen', 'tafelwerk', t.id)} onClick={() => setListe(null)}>
            {t.titel}
          </a>
        ))}
        {anlegen ? (
          <span className="tafel-neu-tab">
            <input
              className="eingabe"
              autoFocus
              enterKeyHint="done"
              placeholder="Name, z. B. Analysis"
              aria-label="Name des neuen Tabs"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              onBlur={() => !titel.trim() && setAnlegen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void lege()
                }
                if (e.key === 'Escape') setAnlegen(false)
              }}
            />
            <button type="button" className="knopf haupt klein" disabled={!titel.trim()} onMouseDown={(e) => e.preventDefault()} onClick={() => void lege()}>
              Anlegen
            </button>
          </span>
        ) : (
          <button type="button" className="chip" onClick={() => setAnlegen(true)} title="Neuen Tab anlegen">
            + Tab
          </button>
        )}
        <span className="plan-luecke" />
        {neu.length > 0 && (
          <button type="button" className={`chip${liste === 'neu' ? ' aktiv' : ''}`} aria-pressed={liste === 'neu'} onClick={() => setListe((l) => (l === 'neu' ? null : 'neu'))} title="Bausteine, über die du noch nicht entschieden hast: ins Tafelwerk oder nicht">
            Neu {neu.length}
          </button>
        )}
        {weg.length > 0 && (
          <button type="button" className={`chip${liste === 'weg' ? ' aktiv' : ''}`} aria-pressed={liste === 'weg'} onClick={() => setListe((l) => (l === 'weg' ? null : 'weg'))} title="Weggelegte Tabs zurückholen">
            Weggelegt {weg.length}
          </button>
        )}
      </div>
      {!liste && tw.tabs.length > 0 && (
        <TafelSuche
          tabs={tw.tabs}
          onSprung={(t) => {
            setSprung({ tab: t.tab, nr: t.nr, y: t.y, mal: Date.now() })
            if (t.tab !== aktiv?.id) geheZu('nutzen', 'tafelwerk', t.tab)
          }}
        />
      )}
      {liste === 'neu' ? (
        <TafelNeu neu={neu} onZu={() => setListe(null)} />
      ) : liste === 'weg' ? (
        <section className="bausteine" aria-label="Weggelegte Tabs">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="passt-titel" style={{ flex: 1 }}>
              Weggelegte Tabs
            </h2>
            <button type="button" className="knopf still klein" onClick={() => setListe(null)}>
              Fertig
            </button>
          </div>
          <div className="eintraege-liste karte">
            {weg.map((t) => (
              <div key={t.id} className="eintrag-zeile">
                <span className="eintrag-titel">{t.titel}</span>
                <button
                  type="button"
                  className="knopf haupt klein"
                  onClick={() => {
                    void legeTabWeg(speicher, t.id, false)
                    if (weg.length === 1) setListe(null)
                  }}
                >
                  Zurückholen
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : aktiv ? (
        <div className="buch-allein tafel-seiten">
          <AnsichtKopf
            ansicht={{ art: 'buch', id: aktiv.id, breite: 1 }}
            name={<NameFeld name={aktiv.titel} art="Tab" onName={(n) => void benenneNotizbuch(speicher, aktiv.id, n)} />}
            lineatur={lineaturVon(aktiv)}
            erste
            letzte
            allein
            onLineatur={(l) => void setzeBuchLineatur(speicher, aktiv.id, l)}
            onVerschiebe={() => {}}
            onSchliesse={() => {}}
          />
          <BuchAnsicht key={aktiv.id} id={aktiv.id} werkzeug={werkzeug} farbe={farbe} sprung={sprung?.tab === aktiv.id ? sprung : null} />
          <div className="reihe tafel-fuss">
            <button type="button" className="knopf still klein" onClick={() => weglegen(aktiv.id, aktiv.titel)} title="Tab aus der Liste nehmen; unter „Weggelegt“ holst du ihn zurück">
              Tab weglegen
            </button>
          </div>
        </div>
      ) : (
        <div className="leer tafel-leer">
          <p>Dein Tafelwerk ist noch leer. Lege einen Tab an, z. B. „Analysis“ oder „Elektrotechnik“.</p>
          <p className="klein-leise">Hinein kommen deine Bausteine: über „Neu“ hier oben, oder im Skript kopieren und hier einfügen. Jeder Ausschnitt führt mit ✦ zurück zum Original.</p>
          {!anlegen && (
            <button type="button" className="knopf haupt" onClick={() => setAnlegen(true)}>
              Ersten Tab anlegen
            </button>
          )}
        </div>
      )}
    </div>
  )
}
