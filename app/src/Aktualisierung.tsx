// Hinweis auf eine neue Version und der Teil „Updates“ in den Einstellungen (docs/aktualisieren.md)
import { useEffect } from 'react'
import { VERTRAG } from '@rl/kern'
import { inTauri, ortLink } from '@rl/oberflaeche'
import { eigeneVersion, hole, pruefenBeimStart, setzePruefenBeimStart, spaeter, suche, sucheBeimStart, useAktualisierung } from './aktualisierung'

/** Über dem Inhalt: neue Version (beim Start gefunden) und Warnung, wenn der Datenordner neuer ist als die App */
export function AppHinweise({ neuererVertrag, inEinstellungen }: { neuererVertrag: string | null; inEinstellungen: boolean }) {
  const lage = useAktualisierung()
  useEffect(() => sucheBeimStart(), [])
  // In den Einstellungen steht die neue Version im Teil „Updates“
  const neu = lage.art === 'neu' && !inEinstellungen ? lage : null
  if (!neu && !neuererVertrag) return null
  return (
    <div className="app-hinweise">
      {neuererVertrag && (
        <div className="karte app-hinweis warnung" role="alert">
          <p>
            <strong>Bitte zuerst die App aktualisieren.</strong> Ein anderes Gerät hat diesen Datenordner mit einer neueren Version
            eingerichtet (Datenvertrag {neuererVertrag}, diese App kennt {VERTRAG}). Bis dahin kann diese App neuere Einträge falsch lesen.
          </p>
          {!neu && (
            <div className="app-hinweis-knoepfe">
              <button type="button" className="knopf haupt klein" onClick={() => void suche(false)}>
                Nach Update suchen
              </button>
            </div>
          )}
        </div>
      )}
      {neu && (
        <div className="karte app-hinweis" role="status">
          <p>
            <strong>Version {neu.neuigkeit.version} ist da.</strong> {neu.neuigkeit.notizen}
          </p>
          <div className="app-hinweis-knoepfe">
            <HoleKnopf />
            <a className="knopf klein still" href={ortLink('einstellungen')}>
              Mehr
            </a>
            <button type="button" className="knopf klein still" onClick={() => spaeter(neu.neuigkeit)}>
              Später
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** „Installieren“ am PC, „Herunterladen“ unter Android; ohne eingebauten Update-Schlüssel nur ein Satz */
function HoleKnopf() {
  const lage = useAktualisierung()
  if (lage.art !== 'neu') return null
  const android = navigator.userAgent.includes('Android')
  if (!android && !lage.installierbar) return <span className="klein-leise">Dieser Bau kann sich nicht selbst aktualisieren.</span>
  return (
    <button type="button" className="knopf haupt klein" onClick={() => void hole(lage.neuigkeit)}>
      {android ? 'APK herunterladen' : 'Installieren und neu starten'}
    </button>
  )
}

export function EinstellungenAktualisierung() {
  const lage = useAktualisierung()
  if (!inTauri()) return null
  const android = navigator.userAgent.includes('Android')
  const an = pruefenBeimStart()
  return (
    <section className="einstellungen-teil">
      <h2>Updates</h2>
      <label className="schalter-zeile">
        <input type="checkbox" checked={an} onChange={(e) => setzePruefenBeimStart(e.target.checked)} />
        Beim Start nach neuen Versionen suchen
      </label>
      <p className="klein-leise">
        Die App fragt dafür nur die Versionsliste im neuesten Release auf GitHub ab. Sie sendet keine Kennung und keine Daten; GitHub sieht wie bei
        jedem Seitenaufruf deine IP-Adresse.{' '}
        {android
          ? 'Unter Android öffnet die App den Download der neuen APK; Android installiert sie nur, wenn sie mit demselben Schlüssel signiert ist.'
          : 'Am PC lädt die App den neuen Installer und startet ihn nur, wenn seine Signatur stimmt. Deine Daten im Ordner bleiben unberührt.'}
      </p>
      <div className="app-hinweis-knoepfe">
        <button type="button" className="knopf klein" disabled={lage.art === 'sucht' || lage.art === 'installiert'} onClick={() => void suche(false)}>
          {lage.art === 'sucht' ? 'Sucht …' : 'Jetzt suchen'}
        </button>
        <span className="klein-leise">Installiert: {eigeneVersion()}</span>
      </div>
      <p className="klein-leise" role="status" aria-live="polite">
        {lage.art === 'aktuell' && 'Du hast die neueste Version.'}
        {lage.art === 'installiert' && 'Die neue Version wird geladen und geprüft. Die App startet danach neu.'}
      </p>
      {lage.art === 'neu' && (
        <div className="karte app-hinweis">
          <p>
            <strong>Version {lage.neuigkeit.version}</strong>
            {lage.neuigkeit.datum && ` vom ${new Date(lage.neuigkeit.datum).toLocaleDateString('de-DE')}`}. {lage.neuigkeit.notizen}
          </p>
          <div className="app-hinweis-knoepfe">
            <HoleKnopf />
          </div>
        </div>
      )}
      {lage.art === 'fehler' && (
        <p className="meldung-schlecht" role="alert">
          {lage.text}
        </p>
      )}
    </section>
  )
}
