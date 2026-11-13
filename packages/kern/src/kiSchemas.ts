// Antwortformate der KI-Aufgaben als JSON-Schema und die Prüfung der Antwort dagegen. Die Anbieter erzwingen das
// Schema meist selbst (strukturierte Ausgabe); die App prüft trotzdem, weil kleinere oder lokale Modelle sich nicht
// immer daran halten. Nur der Teil von JSON-Schema, den die Aufgaben brauchen: type, properties, required,
// additionalProperties, items, enum.

export interface Schema {
  type: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean'
  properties?: Record<string, Schema>
  required?: string[]
  additionalProperties?: boolean
  items?: Schema
  enum?: string[]
  description?: string
}

const LISTE: Schema = { type: 'array', items: { type: 'string' } }
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const KAPITEL_FRAGE = obj({
  art: { type: 'string', enum: ['verstaendnis', 'sokratisch'] },
  frage: { type: 'string' },
  antwort: { type: 'string' },
  seite: { type: 'integer' }
})

export const SCHEMAS = {
  frage: obj({ frage: { type: 'string' } }),
  text: obj({ text: { type: 'string' } }),
  erklaerung: obj({ antwort: { type: 'string' }, begriff: { type: 'string' } }),
  urteil: obj({
    urteil: { type: 'string', enum: ['richtig', 'teilweise', 'falsch', 'leer'] },
    gelesen: { type: 'string' },
    richtig: LISTE,
    fehlt: LISTE,
    fehler: LISTE,
    tipp: { type: 'string' }
  }),
  /** Verbindungstest in den Einstellungen */
  pruefung: obj({ ok: { type: 'boolean' } }),
  /** Kapitelfragen (Vertrag 5.7): ein Stück von wenigen Seiten */
  stueck: obj({ kern: { type: 'string', description: '2 bis 4 Sätze: worum es in diesem Abschnitt geht' }, fragen: { type: 'array', items: KAPITEL_FRAGE } }),
  /** Kapitelfragen: offene Fragen zum ganzen Kapitel */
  kapitel: obj({ fragen: { type: 'array', items: KAPITEL_FRAGE } }),
  /** Kapitelfragen: Rechenaufgaben zu einem Abschnitt */
  rechnen: obj({
    aufgaben: {
      type: 'array',
      items: obj({
        frage: { type: 'string' },
        ergebnis: { type: 'string' },
        seite: { type: 'integer' },
        tipps: LISTE,
        schritte: { type: 'array', items: obj({ ziel: { type: 'string' }, rechnung: { type: 'string' }, ergebnis: { type: 'string' } }) },
        wege: { type: 'string' }
      })
    }
  }),
  /** Vorfragen (Vertrag 5.8) */
  vorfragen: obj({ fragen: { type: 'array', items: obj({ anhang: { type: 'string' }, frage: { type: 'string' }, antwort: { type: 'string' }, seite: { type: 'integer' } }) } })
} satisfies Record<string, Schema>

/**
 * Prüft `wert` gegen `schema`. Liefert den bereinigten Wert (unbekannte Felder entfernt, wo das Schema sie
 * verbietet) oder wirft mit einer Beschreibung der ersten Abweichung.
 */
export function pruefeAntwort<T = unknown>(wert: unknown, schema: Schema, wo = 'Antwort'): T {
  return pruefe(wert, schema, wo) as T
}

function pruefe(w: unknown, s: Schema, wo: string): unknown {
  const falsch = (erwartet: string) => new Error(`${wo}: ${erwartet} erwartet`)
  switch (s.type) {
    case 'string':
      if (typeof w !== 'string') throw falsch('Text')
      if (s.enum && !s.enum.includes(w)) throw new Error(`${wo}: „${w}“ ist keiner von ${s.enum.join(', ')}`)
      return w
    case 'integer':
      // manche Modelle schreiben 13.0 oder "13"
      if (typeof w === 'string' && /^\s*-?\d+(\.0+)?\s*$/.test(w)) return Math.round(Number(w))
      if (typeof w !== 'number' || !Number.isFinite(w) || Math.round(w) !== w) throw falsch('ganze Zahl')
      return w
    case 'number':
      if (typeof w !== 'number' || !Number.isFinite(w)) throw falsch('Zahl')
      return w
    case 'boolean':
      if (typeof w !== 'boolean') throw falsch('wahr/falsch')
      return w
    case 'array':
      if (!Array.isArray(w)) throw falsch('Liste')
      return s.items ? w.map((x, i) => pruefe(x, s.items!, `${wo}[${i}]`)) : w
    case 'object': {
      if (!w || typeof w !== 'object' || Array.isArray(w)) throw falsch('Objekt')
      const o = w as Record<string, unknown>
      for (const r of s.required ?? []) if (!(r in o) || o[r] === null || o[r] === undefined) throw new Error(`${wo}: Feld „${r}“ fehlt`)
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(o)) {
        const ks = s.properties?.[k]
        if (ks) out[k] = v === null && !s.required?.includes(k) ? v : pruefe(v, ks, `${wo}.${k}`)
        else if (s.additionalProperties !== false) out[k] = v
      }
      return out
    }
  }
}

/**
 * JSON aus einer Modellantwort lesen. Kleine Modelle umgeben das JSON manchmal mit ```json-Zäunen oder einem Satz
 * davor; dann gilt das erste vollständige Objekt im Text.
 */
export function jsonAusText(text: string): unknown {
  const t = text.trim()
  try {
    return JSON.parse(t)
  } catch {
    /* weiter unten suchen */
  }
  const zaun = /```(?:json)?\s*([\s\S]*?)```/.exec(t)
  if (zaun) {
    try {
      return JSON.parse(zaun[1])
    } catch {
      /* weiter */
    }
  }
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(t.slice(a, b + 1))
    } catch {
      /* gibt auf */
    }
  }
  throw new Error('Die Antwort enthält kein lesbares JSON')
}
