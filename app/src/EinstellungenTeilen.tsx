import { useState } from 'react'
import { PASSWORT_MINDESTENS, tresorFehlerText } from './kianbieter/teilen'
import { neuAnfangen, passwortAendern, teilenBeenden, teilenBeitreten, teilenEinschalten, useTeilen } from './kianbieter/zugang'

/**
 * Einstellungen › KI › Auf allen Geräten: derselbe Zugang auf allen eigenen Geräten, verschlüsselt mit einem Passwort
 * im Datenordner (Vertrag Lernen 1.2, 5.8). Je nach Stand nur das eine, was gerade zu tun ist.
 */
export function EinstellungenTeilen() {
  const stand = useTeilen()
  const [modus, setModus] = useState<'' | 'neu' | 'aendern' | 'vergessen'>('')
  if (!stand) return null
  // Nach Erfolg zurück zur Übersicht
  const fertig = (f: (p: string) => Promise<void>) => async (p: string) => {
    await f(p)
    setModus('')
  }

  return (
    <div className="ki-teilen karte">
      <h3>Auf allen Geräten</h3>
      {stand === 'aus' &&
        (modus === 'neu' ? (
          <NeuesPasswort knopf="Verschlüsseln und teilen" onFertig={fertig(teilenEinschalten)} onAbbrechen={() => setModus('')} />
        ) : (
          <>
            <p className="klein-leise">
              Lege den Zugang mit einem Passwort verschlüsselt in deinen Datenordner. Auf deinen anderen Geräten gibst du dann nur einmal das Passwort ein, und
              ein neuer Schlüssel gilt überall.
            </p>
            <button type="button" className="knopf klein" onClick={() => setModus('neu')}>
              Einrichten
            </button>
          </>
        ))}

      {(stand === 'angeboten' || stand === 'neues-passwort') &&
        (modus === 'vergessen' ? (
          <>
            <p className="meldung-schlecht">
              Ohne das alte Passwort lässt sich der gemeinsame Zugang nicht öffnen. Du kannst ihn mit dem Zugang dieses Geräts und einem neuen Passwort ersetzen.
              Deine anderen Geräte fragen dann nach dem neuen Passwort.
            </p>
            <NeuesPasswort knopf="Ersetzen" onFertig={fertig(neuAnfangen)} onAbbrechen={() => setModus('')} />
          </>
        ) : (
          <>
            <p className="klein-leise">
              {stand === 'angeboten'
                ? 'In deinem Datenordner liegt ein gemeinsamer KI-Zugang von einem anderen Gerät. Mit dem Passwort gilt er auch hier.'
                : 'Das Passwort wurde auf einem anderen Gerät geändert. Bis du das neue eingibst, nutzt dieses Gerät den letzten bekannten Zugang.'}
            </p>
            <Passwort onFertig={teilenBeitreten} />
            <button type="button" className="knopf klein still" onClick={() => setModus('vergessen')}>
              Passwort vergessen?
            </button>
          </>
        ))}

      {stand === 'an' &&
        (modus === 'aendern' ? (
          <>
            <p className="klein-leise">Deine anderen Geräte fragen danach einmal nach dem neuen Passwort. Das ist auch der Weg, wenn ein Gerät verloren gegangen ist.</p>
            <NeuesPasswort knopf="Passwort ändern" onFertig={fertig(passwortAendern)} onAbbrechen={() => setModus('')} />
          </>
        ) : (
          <>
            <p className="meldung-gut">Dieser Zugang gilt auf allen deinen Geräten. Änderungen hier kommen über den Datenordner überall an.</p>
            <div className="anbieter-knoepfe">
              <button type="button" className="knopf klein" onClick={() => setModus('aendern')}>
                Passwort ändern
              </button>
              <button type="button" className="knopf klein still" onClick={() => void teilenBeenden()}>
                Auf diesem Gerät nicht mehr teilen
              </button>
            </div>
          </>
        ))}

      {stand === 'kaputt' &&
        (modus === 'vergessen' ? (
          <NeuesPasswort knopf="Ersetzen" onFertig={fertig(neuAnfangen)} onAbbrechen={() => setModus('')} />
        ) : (
          <>
            <p className="meldung-schlecht">Die Datei mit dem gemeinsamen Zugang ist beschädigt oder stammt von einer neueren App-Version. Dieses Gerät nutzt seinen eigenen Zugang.</p>
            <button type="button" className="knopf klein" onClick={() => setModus('vergessen')}>
              Mit diesem Gerät neu anlegen
            </button>
          </>
        ))}
    </div>
  )
}

function useAusfuehren(f: () => Promise<void>) {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const los = async () => {
    setLaeuft(true)
    setFehler('')
    try {
      await f()
    } catch (e) {
      setFehler(tresorFehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }
  return { laeuft, fehler, los }
}

function Passwort({ onFertig }: { onFertig: (p: string) => Promise<void> }) {
  const [p, setP] = useState('')
  const { laeuft, fehler, los } = useAusfuehren(() => onFertig(p))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void los()
      }}
    >
      <label className="feld">
        Passwort
        <input className="eingabe" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" spellCheck={false} autoCapitalize="off" />
      </label>
      <div className="anbieter-knoepfe">
        <button type="submit" className="knopf haupt klein" disabled={laeuft || !p}>
          {laeuft ? 'Prüft …' : 'Übernehmen'}
        </button>
      </div>
      {fehler && <p className="meldung-schlecht" role="alert">{fehler}</p>}
    </form>
  )
}

function NeuesPasswort({ knopf, onFertig, onAbbrechen }: { knopf: string; onFertig: (p: string) => Promise<void>; onAbbrechen: () => void }) {
  const [p, setP] = useState('')
  const [w, setW] = useState('')
  const { laeuft, fehler, los } = useAusfuehren(() => onFertig(p))
  const zuKurz = p.length < PASSWORT_MINDESTENS
  const ungleich = !!w && w !== p
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!zuKurz && !ungleich && w) void los()
      }}
    >
      <p className="klein-leise">
        Am besten ein Satz aus mehreren Wörtern, mindestens {PASSWORT_MINDESTENS} Zeichen. Das Passwort steht nirgends und lässt sich nicht wiederherstellen; heb
        es in deinem Passwortmanager auf.
      </p>
      <label className="feld">
        Neues Passwort
        <input className="eingabe" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="new-password" spellCheck={false} autoCapitalize="off" />
      </label>
      <label className="feld">
        Noch einmal
        <input className="eingabe" type="password" value={w} onChange={(e) => setW(e.target.value)} autoComplete="new-password" spellCheck={false} autoCapitalize="off" />
      </label>
      {ungleich && <p className="meldung-schlecht">Die beiden Eingaben sind verschieden.</p>}
      <div className="anbieter-knoepfe">
        <button type="submit" className="knopf haupt klein" disabled={laeuft || zuKurz || ungleich || !w}>
          {laeuft ? 'Verschlüsselt …' : knopf}
        </button>
        <button type="button" className="knopf klein still" disabled={laeuft} onClick={onAbbrechen}>
          Abbrechen
        </button>
      </div>
      {fehler && <p className="meldung-schlecht" role="alert">{fehler}</p>}
    </form>
  )
}
