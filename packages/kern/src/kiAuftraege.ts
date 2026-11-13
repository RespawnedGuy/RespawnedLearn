// Was neben der Anweisung an die KI geht: das Material einer Aufgabe, in Tags eingefasst und gekürzt
// (übernommen aus RespawnedNotes VX, server/kihilfe.mjs). Bilder gehen getrennt als Bild an den Anbieter.

export interface ChatSchritt {
  von: 'ki' | 'ich'
  text: string
}

const kurz = (s: unknown, n: number) => String(s ?? '').slice(0, n)

export function vorschlagAuftrag(a: { art?: 'buch' | 'mitschrift'; buch: string; seite?: number; abschnitt?: string; stelle: string }): string {
  const wo =
    a.art === 'mitschrift'
      ? `Mitschrift: ${kurz(a.buch, 200)}${a.abschnitt ? `, Abschnitt: ${kurz(a.abschnitt, 300)}` : ''}`
      : `Buch: ${kurz(a.buch, 200)}, Seite ${Number(a.seite) || '?'}`
  return `${wo}\n<stelle>\n${kurz(a.stelle, 4000)}\n</stelle>`
}

export function erklaerAuftrag(a: { buch: string; seite: number; stelle: string; kontext: string; verlauf: ChatSchritt[] }): string {
  const bisher = a.verlauf
    .slice(-12)
    .map((v) => `${v.von === 'ich' ? 'Ich' : 'KI'}: ${kurz(v.text, 2000).trim()}`)
    .filter((z) => !/^(Ich|KI): $/.test(z))
  return `Buch: ${kurz(a.buch, 200)}, Seite ${Number(a.seite) || '?'}
<stelle>
${kurz(a.stelle, 4000).trim()}
</stelle>
<seite>
${kurz(a.kontext, 6000).trim()}
</seite>${bisher.length ? `\n<verlauf>\n${bisher.join('\n\n')}\n</verlauf>\nBeantworte die letzte Rückfrage.` : '\nErkläre die Stelle.'}`
}

const ARTEN: Record<string, string> = { verstaendnis: 'Verständnisfrage', sokratisch: 'sokratische Frage', rechnen: 'Rechenaufgabe', karte: 'Lernkarte' }

export function rueckmeldungAuftrag(a: { art: string; frage: string; muster: string; antwort: string; mitBild: boolean }): string {
  const getippt = kurz(a.antwort, 4000).trim()
  return `Art: ${ARTEN[a.art] ?? ARTEN.karte}
<aufgabe>
${kurz(a.frage, 4000)}
</aufgabe>
<muster>
${kurz(a.muster, 6000)}
</muster>${getippt ? `\n<antwort>\n${getippt}\n</antwort>` : ''}${a.mitBild ? '\nDie handschriftliche Antwort steht im beiliegenden Bild.' : ''}`
}

export const korrekturAuftrag = (text: string) => `<text>\n${kurz(text, 2000)}\n</text>`

/** Sicherheitsnetz der Rechtschreibkorrektur: weicht der Text stark ab, war es keine reine Korrektur */
export function korrekturAnnehmen(alt: string, neu: string): string | null {
  const a = alt.trim()
  const n = neu.trim()
  if (!n || n === a) return null
  return Math.abs(n.length - a.length) > Math.max(8, a.length * 0.3) ? null : n
}
