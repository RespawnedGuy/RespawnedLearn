import { useEffect, useState, type ReactNode } from 'react'
import katex from 'katex'
import { ankerParameter, findeLinks, liesMarken, pfade, type Bestand } from '@rvx/kern'
import { ausschnitt, ortLink, useDaten } from '@rvx/oberflaeche'

/** Bild einer markierten Stelle im Skript */
export function Ausschnitt({ anhangId, seite, markeId, breite = 520, titel }: { anhangId: string; seite: number; markeId: string; breite?: number; titel?: string }) {
  const { speicher, bestand } = useDaten()
  const [url, setUrl] = useState<string | null>(null)
  const datei = bestand.dokumente.get(anhangId)?.felder.datei
  const m = liesMarken(bestand.texte.get(pfade.marken('lernen', anhangId)) ?? '').find((x) => x.id === markeId)
  const schluessel = m ? `${m.bereich.x}|${m.bereich.y}|${m.bereich.b}|${m.bereich.h}` : ''
  useEffect(() => {
    let weg = false
    if (typeof datei === 'string' && m) void ausschnitt(speicher, datei, seite, m.bereich, breite).then((u) => !weg && setUrl(u))
    return () => {
      weg = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speicher, datei, seite, schluessel, breite])
  return (
    <a className="ausschnitt" href={ortLink('sammeln', anhangId, seite)} title={titel}>
      {url ? <img src={url} alt={titel ?? 'Stelle im Skript'} /> : <span className="platz" />}
    </a>
  )
}

/** Text mit Formeln im Satz ($…$, zum Beispiel aus den KI-Fragen) */
function mitFormeln(text: string, schluessel: number): ReactNode[] {
  const teile = text.split(/\$([^$\n]+)\$/)
  return teile.map((t, i) =>
    i % 2 ? (
      <span key={`${schluessel}-${i}`} dangerouslySetInnerHTML={{ __html: katex.renderToString(t, { throwOnError: false }) }} />
    ) : (
      t
    )
  )
}

function zeileInline(text: string, bestand: Bestand): ReactNode[] {
  const out: ReactNode[] = []
  let pos = 0
  for (const l of findeLinks(text)) {
    if (l.von > pos) out.push(...mitFormeln(text.slice(pos, l.von), pos))
    const p = ankerParameter(l.anker)
    if (l.einbettung && p.marke) out.push(<Ausschnitt key={l.von} anhangId={l.ziel} seite={Number(p.seite) || 1} markeId={p.marke} titel={l.anzeige ?? undefined} />)
    else {
      const e = bestand.dokumente.get(l.ziel)
      out.push(
        <a key={l.von} href={ortLink('nutzen', l.ziel)}>
          {l.anzeige ?? e?.titel ?? 'nicht gefunden'}
        </a>
      )
    }
    pos = l.bis
  }
  if (pos < text.length) out.push(...mitFormeln(text.slice(pos), pos))
  return out
}

/** Schlichte Darstellung eines Karteninhalts: Absätze, Listen, Formeln ($$…$$ und $…$), Abrufblöcke, Links, Ausschnitte */
export function Inhalt({ text, abrufeZeigen = true }: { text: string; abrufeZeigen?: boolean }) {
  const { bestand } = useDaten()
  const bloecke: ReactNode[] = []
  const zeilen = text.replace(/\r/g, '').split('\n')
  let absatz: string[] = []
  let liste: string[] = []
  const absatzFertig = () => {
    if (absatz.length) bloecke.push(<p key={bloecke.length}>{zeileInline(absatz.join(' '), bestand)}</p>)
    absatz = []
  }
  const listeFertig = () => {
    if (liste.length)
      bloecke.push(
        <ul key={bloecke.length}>
          {liste.map((x, n) => (
            <li key={n}>{zeileInline(x, bestand)}</li>
          ))}
        </ul>
      )
    liste = []
  }
  const fertig = () => {
    absatzFertig()
    listeFertig()
  }
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]
    if (z.trim().startsWith('$$')) {
      fertig()
      let f = z.trim().slice(2)
      while (!f.trim().endsWith('$$') && i + 1 < zeilen.length) f += '\n' + zeilen[++i]
      bloecke.push(
        <div
          key={bloecke.length}
          className="formel"
          // KaTeX ohne trust: keine Links, kein HTML aus der Formel
          dangerouslySetInnerHTML={{ __html: katex.renderToString(f.replace(/\$\$\s*$/, '').trim(), { throwOnError: false, displayMode: true }) }}
        />
      )
    } else if (z.startsWith('?? ') || z.startsWith(':: ')) {
      fertig()
      if (!abrufeZeigen) continue
      bloecke.push(
        <div key={bloecke.length} className={z.startsWith('??') ? 'abruf-frage' : 'abruf-antwort'}>
          {zeileInline(z.slice(3), bestand)}
        </div>
      )
    } else if (/^#{1,6} /.test(z)) {
      fertig()
      bloecke.push(<h3 key={bloecke.length}>{zeileInline(z.replace(/^#+ /, ''), bestand)}</h3>)
    } else if (/^\s*[-*] /.test(z)) {
      absatzFertig()
      liste.push(z.replace(/^\s*[-*] /, ''))
    } else if (z.trim() === '') fertig()
    else {
      listeFertig()
      absatz.push(z)
    }
  }
  fertig()
  return <div className="inhalt">{bloecke}</div>
}
