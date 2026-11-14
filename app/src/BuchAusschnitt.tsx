// Ausschnitt einer markierten Stelle im eigenen Notizbuch (Vertrag Lernen 1.9, 5.4): Tinte und Bilder der Buchseite,
// beschnitten auf den Bereich. Gezeichnet wird live aus den Dateien, ein Bild entsteht nicht.
import { blattFormat, liesBuchSeite, liesMarken, liesTinte, pfade, FARBEN, SEITE_BREITE } from '@rl/kern'
import { ortLink, useDaten } from '@rl/oberflaeche'
import { BildAufBlatt } from './Blaetter'

const nichts = () => {}

export function BuchAusschnitt({ buchId, seite, markeId, breite = 520, titel }: { buchId: string; seite: number; markeId: string; breite?: number; titel?: string }) {
  const { speicher, bestand } = useDaten()
  const m = liesMarken(bestand.texte.get(pfade.marken('lernen', buchId)) ?? '').find((x) => x.id === markeId)
  const link = ortLink('sammeln', 'buch', buchId, seite)
  if (!m || m.bereich.b <= 0 || m.bereich.h <= 0)
    return (
      <a className="ausschnitt" href={link} title={titel}>
        <span className="platz" />
      </a>
    )
  const tinte = speicher.text(pfade.buchTinte(buchId, seite)) ?? ''
  const format = blattFormat(tinte)
  const striche = liesTinte(tinte)
  const bilder = liesBuchSeite(speicher.text(pfade.buchSeite(buchId, seite))).bilder
  const { x, y, b, h } = m.bereich
  // höchstens 240 px hoch, wie die Ausschnitte aus Skripten
  const weite = Math.min(breite, (240 * b) / h)
  return (
    <a className="ausschnitt buch-ausschnitt" href={link} title={titel} aria-label={titel ?? 'Stelle im Notizbuch'} style={{ width: weite }}>
      <div className="buch-ausschnitt-fenster" style={{ aspectRatio: `${b} / ${h}` }}>
        <div className="blatt-flaeche" style={{ width: `${100 / b}%`, marginLeft: `${(-x / b) * 100}%`, marginTop: `${(-y / b) * 100}%`, aspectRatio: `1 / ${format}` }}>
          {bilder.map((bild) => (
            <BildAufBlatt key={bild.id} bild={{ ...bild, blatt: '' }} format={format} aktiv={false} gewaehlt={false} onWahl={nichts} onAendern={nichts} onEntfernen={nichts} />
          ))}
          <svg className="ebene" viewBox={`0 0 ${SEITE_BREITE} ${SEITE_BREITE * format}`} preserveAspectRatio="none" aria-hidden="true">
            {striche.map((s, i) => (
              <path key={i} d={s.d} fill={FARBEN[s.farbe]} />
            ))}
          </svg>
        </div>
      </div>
    </a>
  )
}
