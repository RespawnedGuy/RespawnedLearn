import { ortLink, useDaten, Version } from '@rl/oberflaeche'
import { Datenordner } from './OrdnerWechsel'
import { EinstellungenKi } from './EinstellungenKi'
import { EinstellungenPrompts } from './EinstellungenPrompts'
import { setzeSchreibhand, useSchreibhand } from './schreibhand'
import { LEISTEN_LAGEN, setzeLeistenLage, useLeistenLage } from './leistenLage'
import { EinstellungenAktualisierung } from './Aktualisierung'
import { EinstellungenNetz } from './EinstellungenNetz'
import { EinstellungenPomodoro } from './EinstellungenPomodoro'
import { EinstellungenLernzeit } from './EinstellungenLernzeit'
import { setzeStartort, useStartort } from './startort'

/** `#/einstellungen`: Datenordner, Start, Schreibhand, Pomodoro, Lernzeit, KI-Zugang dieses Geräts, Anweisungen an die KI */
export function Einstellungen() {
  return (
    <div className="lernen-seite einstellungen">
      <h1>Einstellungen</h1>
      <KonfliktHinweis />
      <Datenordner />
      <Start />
      <Schreiben />
      <EinstellungenPomodoro />
      <EinstellungenLernzeit />
      <EinstellungenKi />
      <EinstellungenPrompts />
      <EinstellungenAktualisierung />
      <EinstellungenNetz />
      <section className="einstellungen-teil">
        <h2>Über die App</h2>
        <p className="klein-leise">
          RespawnedLearn <Version />. Freie Software unter der AGPL-3.0, läuft ohne Server; deine Daten liegen nur in deinem Ordner.
        </p>
      </section>
    </div>
  )
}

/** Am Handy steht neben den Tabs nur ein roter Punkt am Zahnrad; hier steht, was er meint, mit dem Weg dorthin */
function KonfliktHinweis() {
  const { speicher } = useDaten()
  const k = speicher.konflikte().length + speicher.syncProbleme().length
  const h = speicher.hinweis
  if (!k && !h) return null
  return (
    <section className="einstellungen-teil">
      <a className="knopf haupt" href={ortLink('konflikte')}>
        {h ? 'Sync prüfen' : `${k} Konflikt${k > 1 ? 'e' : ''} ansehen`}
      </a>
    </section>
  )
}

/** Geräte-Einstellung: womit die App startet (Nils 14.11.) */
function Start() {
  const s = useStartort()
  return (
    <section className="einstellungen-teil">
      <h2>Beim Öffnen</h2>
      <div className="segmente klein" role="radiogroup" aria-label="Beim Öffnen zeigen">
        {(['uebersicht', 'skript'] as const).map((o) => (
          <button key={o} type="button" role="radio" aria-checked={s === o} className={s === o ? 'aktiv' : ''} onClick={() => setzeStartort(o)}>
            {o === 'uebersicht' ? 'Übersicht' : 'Zuletzt offenes Skript'}
          </button>
        ))}
      </div>
      <p className="klein-leise">Mit „Zuletzt offenes Skript“ geht es gleich an der Stelle weiter, an der du aufgehört hast; ohne gelesene Stelle startet die Übersicht. Gilt nur für dieses Gerät.</p>
    </section>
  )
}

/** Geräte-Einstellungen: mit welcher Hand geschrieben wird (die Randmarken im Notizbuch stehen gegenüber) und
    wo die Werkzeugleiste am PC und Tablet steht */
function Schreiben() {
  const hand = useSchreibhand()
  const lage = useLeistenLage()
  return (
    <section className="einstellungen-teil">
      <h2>Schreiben</h2>
      <div className="segmente klein" role="radiogroup" aria-label="Schreibhand">
        {(['rechts', 'links'] as const).map((h) => (
          <button key={h} type="button" role="radio" aria-checked={hand === h} className={hand === h ? 'aktiv' : ''} onClick={() => setzeSchreibhand(h)}>
            {h === 'rechts' ? 'Rechte Hand' : 'Linke Hand'}
          </button>
        ))}
      </div>
      <p className="klein-leise">Die Verweise aufs Skript stehen im Notizbuch auf der anderen Seite, damit die Hand sie beim Schreiben nicht verdeckt. Gilt nur für dieses Gerät.</p>
      <h3 id="leiste-lage">Werkzeugleiste</h3>
      <div className="segmente klein" role="radiogroup" aria-labelledby="leiste-lage">
        {LEISTEN_LAGEN.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={lage === l} className={lage === l ? 'aktiv' : ''} onClick={() => setzeLeistenLage(l)}>
            {l === 'oben' ? 'Oben' : l === 'links' ? 'Links' : 'Rechts'}
          </button>
        ))}
      </div>
      <p className="klein-leise">Oben steht sie zwischen Inhaltsverzeichnis und Seitenzahl, im Vollbild oben in der Mitte. Links oder rechts rückt der Inhalt so weit ein, dass nichts darunter liegt. Am Handy bleibt sie unten. Gilt nur für dieses Gerät.</p>
    </section>
  )
}

