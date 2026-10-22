import { useState } from 'react'
import { kurzDatum, linkZiel, notizZiele, type Eintrag } from '@rvx/kern'
import { geheZu, ortLink, useDaten } from '@rvx/oberflaeche'
import { Ausschnitt, Inhalt } from './Inhalt'
import { Bearbeiten } from './Bearbeiten'
import { Eintraege } from './Eintraege'
import { TYPNAME, lernstaende, setzeThema, spuren, suche, verknuepft } from './wissen'

const FARBNAME: Record<string, string> = { wichtig: 'Wichtig', ergaenzung: 'Ergänzung' }

/**
 * Nutzen: Wissen wiederfinden, mit eigenen Worten, Formel, Spuren ins Skript und Verknüpfungen.
 * Ohne Suche steht hier alles Vorhandene, jeder Eintrag lässt sich öffnen und bearbeiten.
 */
export function Nutzen({ id }: { id?: string }) {
  const { bestand } = useDaten()
  const gewaehlt = id ? bestand.dokumente.get(id) : undefined
  const [q, setQ] = useState(gewaehlt?.titel ?? '')
  const treffer = suche(bestand, q)
  const zeige = gewaehlt ?? treffer[0]
  return (
    <div className="nutzen-seite">
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
      </div>
      {zeige ? (
        <Karte key={zeige.id} e={zeige} weitere={treffer.filter((t) => t.id !== zeige.id).slice(0, 12)} />
      ) : (
        q && <div className="leer">Nichts gefunden.</div>
      )}
      {!q && !zeige && (
        <div className="nutzen-alle">
          <Eintraege />
        </div>
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
              <span className="klein-leise" style={{ color: sitzt ? 'var(--gut)' : '#a3261d', fontWeight: 600 }}>
                {sitzt ? 'sitzt' : 'wieder fällig'} · zuletzt {vorTagen(stand.zuletzt)} geübt
              </span>
            )}
          </div>
          {e.rumpf.trim() ? <Inhalt text={e.rumpf} /> : <span className="klein-leise">Noch kein Text. Über „Bearbeiten“ in eigenen Worten ergänzen.</span>}
          {sp.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="passt-titel">Deine Spuren</div>
              {sp.map((s) => (
                <div key={s.markeId} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Ausschnitt anhangId={s.quelle.id} seite={s.seite} markeId={s.markeId} breite={280} />
                  <a href={ortLink('sammeln', s.quelle.id, s.seite)} style={{ fontSize: 14 }}>
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
              <a key={w.id} href={ortLink('nutzen', w.id)} style={{ fontSize: 14 }}>
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
