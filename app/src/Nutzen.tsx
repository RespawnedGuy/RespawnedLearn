import { useState } from 'react'
import { abschnittAn, kurzDatum, linkZiel, notizZiele, stelleVon, zeileVonAnker, type Bestand, type Eintrag } from '@rl/kern'
import { geheZu, ortLink, useDaten } from '@rl/oberflaeche'
import { Ausschnitt, Inhalt } from './Inhalt'
import { Bearbeiten } from './Bearbeiten'
import { Eintraege, standText } from './Eintraege'
import { TYPNAME, alleEintraege, lernstaende, setzeThema, spuren, suche, verknuepft } from './wissen'
import { kartenImModul, modulVonEintrag } from './modulkarten'

const FARBNAME: Record<string, string> = { wichtig: 'Wichtig', ergaenzung: 'Ergänzung' }

/**
 * Nutzen: Wissen wiederfinden, mit eigenen Worten, Formel, Spuren ins Skript und Verknüpfungen.
 * Ohne Suche steht hier alles Vorhandene, jeder Eintrag lässt sich öffnen und bearbeiten.
 */
export function Nutzen({ id }: { id?: string }) {
  const { bestand } = useDaten()
  const gewaehlt = id ? bestand.dokumente.get(id) : undefined
  const [q, setQ] = useState(gewaehlt?.titel ?? '')
  const [modul, setModul] = useState<string | null>(() => liesModul())
  const module = bestand.nachTyp('modul').sort((x, y) => x.titel.localeCompare(y.titel, 'de'))
  const aktiv = modul && module.some((m) => m.id === modul) ? modul : null
  // Mit Modul: nur dessen Wissen (Mitschriften, Karten, Erklärungen aus seinen PDFs)
  const treffer = suche(bestand, q).filter((e) => !aktiv || modulVonEintrag(bestand, e) === aktiv)
  const zeige = gewaehlt ?? treffer[0]
  const waehle = (m: string | null) => {
    setModul(m)
    merkeModul(m)
    if (id) geheZu('nutzen')
  }
  return (
    <div className="nutzen-seite">
      <h1 className="nur-vorleser">Nutzen</h1>
      <div className="nutzen-suche">
        <label htmlFor="suche" className="unsichtbar">
          In deinem Wissen suchen
        </label>
        <input
          id="suche"
          type="search"
          className="suchfeld"
          placeholder="Was suchst du? (z. B. Elementarladung)"
          value={q}
          autoFocus={!id}
          onChange={(e) => {
            setQ(e.target.value)
            if (id) geheZu('nutzen')
          }}
        />
        {module.length > 0 && (
          <select className="chip chip-wahl nutzen-modul" aria-label="Modul" value={aktiv ?? ''} onChange={(ev) => waehle(ev.target.value || null)}>
            <option value="">Alle Module</option>
            {module.map((m) => (
              <option key={m.id} value={m.id}>
                {m.titel}
              </option>
            ))}
          </select>
        )}
      </div>
      {zeige ? (
        <Karte key={zeige.id} e={zeige} weitere={treffer.filter((t) => t.id !== zeige.id).slice(0, 12)} />
      ) : (
        q && <div className="leer">Nichts gefunden{aktiv ? ' in diesem Modul' : ''}.</div>
      )}
      {!q && !zeige && <div className="nutzen-alle">{aktiv ? <ModulWissen modulId={aktiv} /> : <Eintraege />}</div>}
    </div>
  )
}

const MODUL_SCHLUESSEL = 'rvx-nutzen-modul'
function liesModul(): string | null {
  try {
    return localStorage.getItem(MODUL_SCHLUESSEL)
  } catch {
    return null
  }
}
function merkeModul(m: string | null) {
  try {
    if (m) localStorage.setItem(MODUL_SCHLUESSEL, m)
    else localStorage.removeItem(MODUL_SCHLUESSEL)
  } catch {
    /* privates Fenster: dann eben nicht gemerkt */
  }
}

/** Wissen eines Moduls, gegliedert wie seine Mitschrift; danach, was sonst dazugehört */
function ModulWissen({ modulId }: { modulId: string }) {
  const { bestand } = useDaten()
  const st = lernstaende(bestand)
  const karten = kartenImModul(bestand, modulId)
  const sonst = alleEintraege(bestand).filter((e) => e.typ !== 'frage' && modulVonEintrag(bestand, e) === modulId)
  const gruppen: { titel: string; karten: typeof karten }[] = []
  for (const k of karten) {
    const titel = k.ort.abschnitt[0] ?? (k.ort.mitschrift ? 'Ohne Überschrift' : 'Aus den PDFs und weitere')
    const g = gruppen[gruppen.length - 1]
    if (g?.titel === titel) g.karten.push(k)
    else gruppen.push({ titel, karten: [k] })
  }
  if (!karten.length && !sonst.length) return <div className="leer">In diesem Modul gibt es noch nichts. Lernkarten entstehen in der Mitschrift über „Lernkarte“.</div>
  return (
    <div className="eintraege">
      {gruppen.map((g, i) => (
        <section key={i}>
          <h2 className="lern-gruppe-titel">{g.titel}</h2>
          <div className="eintraege-liste karte">
            {g.karten.map((k) => {
              const s = standText(st.get(k.e.id))
              return (
                <a key={k.e.id} className="eintrag-zeile" href={ortLink('nutzen', k.e.id)}>
                  <span className="eintrag-titel">{k.e.titel || k.frage}</span>
                  {k.ort.abschnitt.length > 1 && <span className="klein-leise">{k.ort.abschnitt.slice(1).join(' › ')}</span>}
                  <span className={`chip${s.art ? ` ${s.art}` : ''}`}>{s.text}</span>
                </a>
              )
            })}
          </div>
        </section>
      ))}
      {sonst.length > 0 && (
        <section>
          <h2 className="lern-gruppe-titel">Mitschriften und Notizen</h2>
          <div className="eintraege-liste karte">
            {sonst.map((e) => (
              <a key={e.id} className="eintrag-zeile" href={e.typ === 'notiz' && linkZiel(e.felder.thema) === modulId ? ortLink('sammeln', 'mitschrift', e.id) : ortLink('nutzen', e.id)}>
                <span className="eintrag-titel">{e.titel || 'Ohne Titel'}</span>
                <span className="chip">{e.typ === 'notiz' && linkZiel(e.felder.thema) === modulId ? 'Mitschrift' : (TYPNAME[e.typ] ?? e.typ)}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Lernen ist gerichtet: Eine Notiz gehört zu einem Thema oder Modul */
function ThemaWahl({ e }: { e: Eintrag }) {
  const { bestand, speicher } = useDaten()
  const ziele = notizZiele(bestand).filter((z) => z.id !== e.id)
  return (
    <select
      className="chip chip-wahl"
      aria-label="Thema"
      value={linkZiel(e.felder.thema) ?? ''}
      onChange={(ev) => void setzeThema(speicher, e, ev.target.value || null)}
    >
      <option value="">Ohne Thema</option>
      {ziele.map((z) => (
        <option key={z.id} value={z.id}>
          {z.typ === 'modul' ? 'Modul: ' : ''}
          {z.titel}
        </option>
      ))}
    </select>
  )
}

/** Stelle in der Mitschrift, auf die eine Lernkarte zeigt (Titel, Überschriften darüber, Link genau dorthin) */
export function mitschriftSpur(b: Bestand, e: Eintrag): { titel: string; abschnitt: string[]; link: string } | null {
  const s = stelleVon(e)
  const m = s ? b.dokumente.get(s.notiz) : undefined
  if (!s || !m) return null
  const zeile = zeileVonAnker(m.rumpf, s.anker)
  return { titel: m.titel, abschnitt: zeile >= 0 ? abschnittAn(m.rumpf, zeile) : [], link: ortLink('sammeln', 'mitschrift', m.id, s.anker) }
}

function vorTagen(iso: string): string {
  const t = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return t <= 0 ? 'heute' : t === 1 ? 'gestern' : `vor ${t} Tagen`
}

function Karte({ e, weitere }: { e: Eintrag; weitere: Eintrag[] }) {
  const { bestand } = useDaten()
  const [bearbeiten, setBearbeiten] = useState(false)
  const st = lernstaende(bestand)
  const eigen = st.get(e.id)
  // Lernstand der Karte selbst oder ihrer Lernkarten
  const fragen = bestand.nachTyp('frage').filter((f) => String(f.felder.thema ?? '').includes(e.id))
  const stand = eigen ?? fragen.map((f) => st.get(f.id)).find(Boolean)
  const sitzt = stand && stand.karte.due.getTime() > Date.now()
  const sp = spuren(bestand, e.id)
  const ms = mitschriftSpur(bestand, e)
  const alsMitschrift = e.typ === 'notiz' && bestand.dokumente.get(linkZiel(e.felder.thema) ?? '')?.typ === 'modul'
  const vk = verknuepft(bestand, e)
  return (
    <div className="nutzen-raster">
      {bearbeiten ? (
        <article className="karte nutzen-karte">
          <Bearbeiten e={e} onFertig={() => setBearbeiten(false)} />
        </article>
      ) : (
        <article className="karte nutzen-karte">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="chip">{TYPNAME[e.typ] ?? e.typ}</span>
            {e.typ === 'notiz' && <ThemaWahl e={e} />}
            <span style={{ flex: 1 }} />
            {alsMitschrift && (
              <a className="knopf klein" href={ortLink('sammeln', 'mitschrift', e.id)}>
                Als Mitschrift öffnen
              </a>
            )}
            <a className="knopf still klein" href={ortLink('nutzen')}>
              Alle Einträge
            </a>
            <button type="button" className="knopf klein" onClick={() => setBearbeiten(true)}>
              Bearbeiten
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1>{e.titel}</h1>
            {stand?.zuletzt && (
              <span className="klein-leise" style={{ color: sitzt ? 'var(--gut)' : 'var(--rot-text)', fontWeight: 600 }}>
                {sitzt ? 'sitzt' : 'wieder fällig'} · zuletzt {vorTagen(stand.zuletzt)} geübt
              </span>
            )}
          </div>
          {e.rumpf.trim() ? <Inhalt text={e.rumpf} /> : <span className="klein-leise">Noch kein Text. Über „Bearbeiten“ in eigenen Worten ergänzen.</span>}
          {ms && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="passt-titel">Aus deiner Mitschrift</div>
              <a href={ms.link} style={{ fontSize: '0.875rem' }}>
                {ms.titel}
                {ms.abschnitt.length ? ` › ${ms.abschnitt.join(' › ')}` : ''}
              </a>
            </div>
          )}
          {sp.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="passt-titel">Deine Spuren</div>
              {sp.map((s) => (
                <div key={s.markeId} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Ausschnitt anhangId={s.quelle.id} seite={s.seite} markeId={s.markeId} breite={280} />
                  <a href={ortLink('sammeln', s.quelle.id, s.seite)} style={{ fontSize: '0.875rem' }}>
                    {s.quelle.titel}, S. {s.seite} · markiert am {kurzDatum(s.datum)}
                    {s.farbe && FARBNAME[s.farbe] ? ` · ${FARBNAME[s.farbe]}` : ''}
                  </a>
                </div>
              ))}
            </div>
          )}
        </article>
      )}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="karte" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="passt-titel">Verknüpft</div>
          {!vk.length && <span className="klein-leise">Noch keine Verknüpfungen.</span>}
          {vk.map((v) => (
            <div key={v.e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <a href={v.e.typ === 'modul' ? ortLink('sammeln', 'modul', v.e.id) : ortLink('nutzen', v.e.id)}>{v.e.titel}</a>
              <span className="klein-leise">{v.wie}</span>
            </div>
          ))}
        </div>
        {weitere.length > 0 && (
          <div
            className="karte"
            style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.6)', boxShadow: 'none' }}
          >
            <div className="passt-titel">Auch gefunden</div>
            {weitere.map((w) => (
              <a key={w.id} href={ortLink('nutzen', w.id)} style={{ fontSize: '0.875rem' }}>
                {w.typ === 'frage' ? 'Lernkarte: ' : ''}
                {w.titel}
              </a>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
