import { useEffect, useState } from 'react'
import { istText, konfliktOriginal, pfade } from '@rl/kern'
import { zeigeVerdeckt } from './kianbieter/zugang'
import { useDaten } from '@rl/oberflaeche'

/**
 * Syncthing (oder diese App) hat zwei Fassungen derselben Datei gefunden. Beide stehen nebeneinander, Zeilen, die nur
 * in einer Fassung vorkommen, sind markiert. Ein Mensch entscheidet; die App verwirft nie still eine Fassung.
 */
export function Konflikte() {
  const { speicher } = useDaten()
  const kopien = speicher.konflikte()
  if (!kopien.length) return <div className="leer">Keine Konflikte.</div>
  return (
    <div className="seite konflikte">
      <p className="klein-leise">
        Diese Dateien wurden auf zwei Geräten gleichzeitig geändert. Zuerst steht die Datei, danach die zweite Fassung.
      </p>
      {kopien.map((k) => (
        <Konflikt key={k} kopie={k} />
      ))}
    </div>
  )
}

function Konflikt({ kopie }: { kopie: string }) {
  const { speicher } = useDaten()
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const original = konfliktOriginal(kopie) ?? kopie
  const text = istText(kopie)
  const links = speicher.text(original)
  const rechts = speicher.text(kopie)
  const tu = (f: () => Promise<void>) => async () => {
    setLaeuft(true)
    setFehler('')
    try {
      await f()
    } catch (e) {
      setFehler(String((e as Error)?.message ?? e))
    } finally {
      setLaeuft(false)
    }
  }
  return (
    <section className="karte konflikt">
      <h2>{original}</h2>
      {original === pfade.kiZugang() ? (
        <ZugangFassungen links={links} rechts={rechts} />
      ) : text ? (
        <div className="konflikt-fassungen">
          <Fassung titel={links === undefined ? 'Datei (fehlt)' : 'Datei'} text={links ?? ''} andere={rechts ?? ''} />
          <Fassung titel="Zweite Fassung" text={rechts ?? ''} andere={links ?? ''} />
        </div>
      ) : (
        <p className="klein-leise">Zweite Fassung: {kopie.slice(kopie.lastIndexOf('/') + 1)}</p>
      )}
      <div className="konflikt-knoepfe">
        <button type="button" className="knopf" disabled={laeuft} onClick={tu(() => speicher.verwerfeKonflikt(kopie))}>
          Zweite Fassung verwerfen
        </button>
        <button type="button" className="knopf" disabled={laeuft} onClick={tu(() => speicher.uebernehmeKonflikt(kopie))}>
          Zweite Fassung übernehmen
        </button>
      </div>
      {fehler && <p className="ordner-fehler" role="alert">{fehler}</p>}
    </section>
  )
}

function Fassung({ titel, text, andere }: { titel: string; text: string; andere: string }) {
  const sonst = new Set(andere.split('\n'))
  return (
    <div className="konflikt-fassung">
      <h3 className="klein-leise">{titel}</h3>
      <pre>
        {text.split('\n').map((z, i) => (
          <span key={i} className={sonst.has(z) ? undefined : 'nur-hier'}>
            {z || ' '}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  )
}

/** Der gemeinsame KI-Zugang ist verschlüsselt: beide Fassungen entschlüsselt, Schlüssel nur mit den letzten Zeichen */
function ZugangFassungen({ links, rechts }: { links?: string; rechts?: string }) {
  const [z, setZ] = useState<[string[] | null, string[] | null] | null>(null)
  useEffect(() => {
    let weg = false
    void Promise.all([zeigeVerdeckt(links), zeigeVerdeckt(rechts)]).then((r) => !weg && setZ(r))
    return () => {
      weg = true
    }
  }, [links, rechts])
  const zeile = (x: string[] | null) => (x ? x.join('\n') : 'Mit einem anderen Passwort verschlüsselt, auf diesem Gerät nicht lesbar.')
  if (!z) return <p className="klein-leise">Entschlüsselt …</p>
  return (
    <div className="konflikt-fassungen">
      <Fassung titel="Gemeinsamer KI-Zugang" text={zeile(z[0])} andere={zeile(z[1])} />
      <Fassung titel="Zweite Fassung" text={zeile(z[1])} andere={zeile(z[0])} />
    </div>
  )
}
