// Links und Einbettungen nach Vertrag Abschnitt 4.

export interface Link {
  einbettung: boolean
  ziel: string
  /** Teil nach `#`: Überschrift-Slug oder Parameter wie `seite=1&marke=a7k2c9` */
  anker: string | null
  /** festgehaltener Stand bei `![[ID@JJJJ-MM-TT]]` */
  stand: string | null
  anzeige: string | null
  von: number
  bis: number
}

const LINK = /(!?)\[\[([^\]|#@\n]+)(?:@(\d{4}-\d{2}-\d{2}))?(?:#([^\]|\n]+))?(?:\|([^\]\n]+))?\]\]/g

export function findeLinks(text: string): Link[] {
  const out: Link[] = []
  for (const m of text.matchAll(LINK)) {
    out.push({
      einbettung: m[1] === '!',
      ziel: m[2].trim(),
      stand: m[3] ?? null,
      anker: m[4] ?? null,
      anzeige: m[5] ?? null,
      von: m.index!,
      bis: m.index! + m[0].length
    })
  }
  return out
}

/** `seite=1&marke=a7k2c9` → { seite: '1', marke: 'a7k2c9' } */
export function ankerParameter(anker: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!anker || !anker.includes('=')) return out
  for (const teil of anker.split('&')) {
    const [k, v] = teil.split('=')
    if (k) out[k] = v ?? ''
  }
  return out
}

export function link(id: string, anzeige?: string): string {
  return anzeige ? `[[${id}|${anzeige.replace(/[\]|]/g, '')}]]` : `[[${id}]]`
}
