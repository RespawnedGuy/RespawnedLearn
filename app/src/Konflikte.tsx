import { useEffect, useState, useSyncExternalStore, type ReactElement } from 'react'
import { istText, konfliktBeschreibung, konfliktHerkunft, lesbareZeilen, pfade, zeilenVergleich, zeitLesbar, zerlege, type Herkunft } from '@rl/kern'
import { zeigeVerdeckt } from './kianbieter/zugang'
import { useDaten } from '@rl/oberflaeche'
import { entscheidungenFuer, FRIST_MS, type Entscheidungen, type Wahl } from './konfliktEntscheid'

/**
 * Ein Sync-Programm (oder diese App) hat zwei Fassungen derselben Datei angelegt. Beide stehen nebeneinander, Unterschiede sind
 * mit + / − und durchgestrichen bzw. unterstrichen markiert (nicht nur über Farbe). Ein Mensch entscheidet, welche Fassung
 * bleibt; gelöscht wird erst nach einer Frist, bis dahin lässt sich alles rückgängig machen.
 */
export function Konflikte() {
  const { speicher } = useDaten()
  const ent = entscheidungenFuer(speicher)
  useSyncExternalStore(
    (f) => ent.abonniere(f),
    () => ent.stand
  )
  const kopien = speicher.konflikte()
  const probleme = speicher.syncProbleme()
  const erledigt = speicher.automatischErledigt
  const aufgeraeumt = erledigt > 0 && (
    <p className="klein-leise">
      {erledigt === 1 ? 'Eine doppelte Fassung hat' : `${erledigt} doppelte Fassungen hat`} die App selbst aufgeräumt, weil dabei
      nichts verloren ging.
    </p>
  )
  if (!kopien.length && !probleme.length && !speicher.hinweis)
    return (
      <div className="leer">
        Keine Konflikte.
        {aufgeraeumt}
      </div>
    )
  return (
    <div className="seite konflikte">
      <h1 className="nur-vorleser">Konflikte</h1>
      <SyncHinweis />
      {kopien.length > 0 && (
        <p className="klein-leise">
          Diese Dateien wurden auf zwei Geräten geändert, bevor sie sich abgleichen konnten. Wähle je Datei die Fassung, die
          bleiben soll. Die andere wird nach {FRIST_MS / 1000} Sekunden gelöscht, bis dahin kannst du es rückgängig machen.
        </p>
      )}
      {aufgeraeumt}
      {kopien.map((k) => (
        <Konflikt key={k} kopie={k} ent={ent} />
      ))}
      {probleme.length > 0 && (
        <section className="karte konflikt" aria-labelledby="sync-probleme">
          <div>
            <h2 id="sync-probleme">Unvollständige Dateien</h2>
            <p className="klein-leise konflikt-herkunft">
              Leer oder beschädigt, meist weil das Sync-Programm sie noch nicht ganz übertragen hat. Sie bleiben, wie sie sind.
              Ändert die App eine davon, hebt sie den alten Inhalt vorher als zweite Fassung auf.
            </p>
          </div>
          {probleme.map((p) => {
            const { art, titel } = konfliktBeschreibung(p.pfad)
            return (
              <p key={p.pfad}>
                {art}: {titel}
                <br />
                <span className="klein-leise">{p.grund}.</span>
              </p>
            )
          })}
        </section>
      )}
    </div>
  )
}

/** Ordner plötzlich leer oder viele Dateien weg: Das Sync-Programm prüfen, die App überschreibt nichts */
function SyncHinweis() {
  const { speicher } = useDaten()
  const h = speicher.hinweis
  if (!h) return null
  return (
    <div className="karte konflikt-frist" role="alert">
      <span>
        {h.art === 'leer'
          ? 'Der Datenordner ist plötzlich leer. Vielleicht ist das Laufwerk getrennt oder dein Sync-Programm hat die Dateien entfernt. Die App schreibt nichts, bis die Dateien zurück sind.'
          : `${h.anzahl} Dateien sind auf einmal verschwunden. Sieh in deinem Sync-Programm nach (Papierkorb, frühere Versionen). Die App legt sie nicht von sich aus neu an.`}
      </span>
      <button type="button" className="knopf" onClick={() => speicher.hinweisWeg()}>
        {h.art === 'leer' ? 'Der Ordner ist richtig so' : 'Verstanden'}
      </button>
    </div>
  )
}

/** Woher die zweite Fassung kommt, in Worten: Überschrift der Spalte und Zeile unter dem Titel */
function woher(h: Herkunft | null, kopie: string): { spalte: string; zeile: string } {
  const zeit = h?.zeit ? `, ${zeitLesbar(h.zeit)}` : ''
  if (h?.programm === 'Syncthing') return { spalte: `Fassung von Gerät ${h.geraet}`, zeile: `zweite Fassung von Gerät ${h.geraet}${zeit}` }
  if (h?.programm) return { spalte: `Fassung von ${h.programm}`, zeile: `zweite Fassung von ${h.programm}${h.geraet ? ` (${h.geraet})` : ''}${zeit}` }
  return { spalte: 'Zweite Fassung', zeile: `zweite Fassung von einem Sync-Programm: „${kopie.slice(kopie.lastIndexOf('/') + 1)}“` }
}

function Konflikt({ kopie, ent }: { kopie: string; ent: Entscheidungen }) {
  const { speicher } = useDaten()
  const k = speicher.kopien().get(kopie)
  const original = k?.original ?? kopie
  const text = istText(kopie)
  const links = speicher.text(original)
  const rechts = speicher.text(kopie)
  const { spalte: zweite, zeile } = woher(k ? konfliktHerkunft(k) : null, kopie)
  const { art, titel } = konfliktBeschreibung(original, links ?? rechts)
  const erste = links === undefined ? 'Datei (fehlt)' : 'Aktuelle Datei'
  const offen = ent.offen(kopie)
  const fehler = ent.fehler(kopie)
  const behalten = (wahl: Wahl, wer: string) => (
    <button type="button" className="knopf" onClick={() => ent.waehle(kopie, wahl)} aria-label={`Diese Fassung behalten: ${wer}`}>
      Diese Fassung behalten
    </button>
  )
  return (
    <section className="karte konflikt" aria-labelledby={`k-${kopie}`}>
      <div>
        <h2 id={`k-${kopie}`}>{titel}</h2>
        <p className="klein-leise konflikt-herkunft">
          {art} · {zeile}
        </p>
      </div>
      {offen ? (
        <Frist wahl={offen.wahl === 'datei' ? erste : zweite} bis={offen.bis} onZurueck={() => ent.rueckgaengig(kopie)} />
      ) : original === pfade.kiZugang() ? (
        <ZugangFassungen links={links} rechts={rechts} erste={erste} zweite={zweite} knopf={behalten} />
      ) : text ? (
        <Fassungen links={links ?? ''} rechts={rechts ?? ''} erste={erste} zweite={zweite} knopf={behalten} />
      ) : (
        <div className="konflikt-fassungen">
          <div className="konflikt-fassung">
            <h3 className="klein-leise">{erste}</h3>
            {behalten('datei', erste)}
          </div>
          <div className="konflikt-fassung">
            <h3 className="klein-leise">{zweite}</h3>
            <p className="klein-leise">{kopie.slice(kopie.lastIndexOf('/') + 1)}</p>
            {behalten('kopie', zweite)}
          </div>
        </div>
      )}
      {fehler && (
        <p className="ordner-fehler" role="alert">
          {fehler}
        </p>
      )}
    </section>
  )
}

/** Nach der Wahl: was bleibt, Countdown und Rückgängig. role=status sagt es dem Bildschirmleser an. */
function Frist({ wahl, bis, onZurueck }: { wahl: string; bis: number; onZurueck: () => void }) {
  const [jetzt, setJetzt] = useState(Date.now())
  useEffect(() => {
    const u = setInterval(() => setJetzt(Date.now()), 500)
    return () => clearInterval(u)
  }, [])
  const rest = Math.max(0, Math.ceil((bis - jetzt) / 1000))
  return (
    <div className="konflikt-frist" role="status">
      <span>
        „{wahl}“ bleibt. Die andere Fassung wird {rest > 0 ? `in ${rest} s` : 'jetzt'} gelöscht.
      </span>
      <button type="button" className="knopf haupt" onClick={onZurueck}>
        Rückgängig
      </button>
    </div>
  )
}

type Knopf = (wahl: Wahl, wer: string) => ReactElement

function Fassungen({ links, rechts, erste, zweite, knopf }: { links: string; rechts: string; erste: string; zweite: string; knopf: Knopf }) {
  const a = zerlege(links)
  const b = zerlege(rechts)
  const rumpf = zeilenVergleich(lesbareZeilen(a.rumpf), lesbareZeilen(b.rumpf))
  const kopf = a.kopf !== null || b.kopf !== null ? zeilenVergleich((a.kopf ?? '').split('\n'), (b.kopf ?? '').split('\n')) : null
  const kopfAnders = !!kopf?.some((z) => z.art !== 'gleich')
  return (
    <div className="konflikt-fassungen">
      <Spalte titel={erste} seite="weg" rumpf={rumpf} kopf={kopf} kopfAnders={kopfAnders} knopf={knopf('datei', erste)} />
      <Spalte titel={zweite} seite="neu" rumpf={rumpf} kopf={kopf} kopfAnders={kopfAnders} knopf={knopf('kopie', zweite)} />
    </div>
  )
}

type Vergleich = ReturnType<typeof zeilenVergleich>

function Spalte(p: { titel: string; seite: 'weg' | 'neu'; rumpf: Vergleich; kopf: Vergleich | null; kopfAnders: boolean; knopf: ReactElement }) {
  return (
    <div className="konflikt-fassung">
      <h3 className="klein-leise">{p.titel}</h3>
      <Zeilen v={p.rumpf} seite={p.seite} />
      {p.kopf && (
        <details className="konflikt-kopf">
          <summary>Weitere Angaben{p.kopfAnders ? ' (unterschiedlich)' : ''}</summary>
          <Zeilen v={p.kopf} seite={p.seite} />
        </details>
      )}
      {p.knopf}
    </div>
  )
}

/** Eine Fassung: gemeinsame Zeilen schlicht, eigene mit Zeichen, Strich und unsichtbarem Hinweis für den Bildschirmleser */
function Zeilen({ v, seite }: { v: Vergleich; seite: 'weg' | 'neu' }) {
  const Marke = seite === 'weg' ? 'del' : 'ins'
  return (
    <pre>
      {v
        .filter((z) => z.art === 'gleich' || z.art === seite)
        .map((z, i) =>
          z.art === 'gleich' ? (
            <span key={i}>
              {z.text || ' '}
              {'\n'}
            </span>
          ) : (
            <Marke key={i} className="nur-hier">
              <span aria-hidden="true">{seite === 'weg' ? '− ' : '+ '}</span>
              <span className="unsichtbar">nur in dieser Fassung: </span>
              {z.text || ' '}
              {'\n'}
            </Marke>
          )
        )}
    </pre>
  )
}

/** Der gemeinsame KI-Zugang ist verschlüsselt: beide Fassungen entschlüsselt, Schlüssel nur mit den letzten Zeichen */
function ZugangFassungen({ links, rechts, erste, zweite, knopf }: { links?: string; rechts?: string; erste: string; zweite: string; knopf: Knopf }) {
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
  return <Fassungen links={zeile(z[0])} rechts={zeile(z[1])} erste={erste} zweite={zweite} knopf={knopf} />
}
