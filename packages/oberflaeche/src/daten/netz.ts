// Zugang übers Netz (docs/netz.md): Die Oberfläche kommt vom Server in der Desktop-App eines anderen Rechners
// (app/src-tauri/src/netz/server.rs), etwa in Safari am iPhone über `tailscale serve`. Der Datenordner liegt dort; diese
// Ablage spricht dieselben Befehle wie die Tauri-Brücke als HTTP. Wer fragt, sagt Tailscale dem Server, nicht die Seite.
import type { Ablage, Geschrieben, OrdnerEintrag, TextDatei } from './ordner'

/** Der Server setzt dieses Merkmal in die ausgelieferte Seite */
export const imNetz = () => typeof document !== 'undefined' && !!document.querySelector('meta[name="rl-netz"]')

export interface NetzStand {
  plattform: 'netz'
  /** Anzeigename aus Tailscale */
  name: string
}

/** Jede Anfrage trägt `Rl-Anfrage: 1`: Eine fremde Seite darf diesen Kopf nicht setzen, der Server lehnt sie ab (CSRF) */
export function netzAnfrage(pfad: string, init: RequestInit = {}, abruf: typeof fetch = fetch): Promise<Response> {
  const koepfe = new Headers(init.headers)
  koepfe.set('Rl-Anfrage', '1')
  return abruf(pfad, { ...init, headers: koepfe, credentials: 'same-origin', cache: 'no-store' })
}

async function pruefe(r: Response): Promise<Response> {
  if (!r.ok) throw new Error((await r.text().catch(() => '')) || `Server antwortet mit ${r.status}`)
  return r
}

const json = <T>(r: Response) => pruefe(r).then((r) => r.json() as Promise<T>)
const mitPfad = (pfad: string) => `/api/datei?pfad=${encodeURIComponent(pfad)}`

export const netzStand = () => netzAnfrage('/api/stand').then(json<NetzStand>)

/** Liest einen Ereignisstrom (Server-Sent Events) über fetch statt EventSource, damit der eigene Kopf mitgeht.
 * Liefert für jedes Ereignis `geaendert` einmal den Rückruf; endet der Strom, verbindet er nach `wartenMs` neu und
 * meldet dann ebenfalls, damit nichts verpasst wird, was in der Pause geschah. */
export function beobachteStrom(rueckruf: () => void, o: { anfrage?: (pfad: string, init?: RequestInit) => Promise<Response>; wartenMs?: number } = {}): () => void {
  const anfrage = o.anfrage ?? netzAnfrage
  const warten = o.wartenMs ?? 5000
  const ab = new AbortController()
  let erstes = true
  const lauf = async () => {
    while (!ab.signal.aborted) {
      try {
        const r = await anfrage('/api/ereignisse', { signal: ab.signal })
        if (!r.ok || !r.body) throw new Error(String(r.status))
        if (!erstes) rueckruf()
        erstes = false
        const leser = r.body.pipeThrough(new TextDecoderStream()).getReader()
        let puffer = ''
        for (;;) {
          const { value, done } = await leser.read()
          if (done) break
          puffer += value
          let ende: number
          while ((ende = puffer.indexOf('\n\n')) >= 0) {
            const block = puffer.slice(0, ende)
            puffer = puffer.slice(ende + 2)
            if (block.split('\n').some((z) => z === 'event: geaendert')) rueckruf()
          }
        }
      } catch {
        if (ab.signal.aborted) return
      }
      erstes = false
      await new Promise((ja) => setTimeout(ja, warten))
    }
  }
  void lauf()
  return () => ab.abort()
}

/** Der Datenordner auf dem Rechner, der freigibt; `abruf` nur für Tests */
export function netzAblage(abruf: typeof fetch = (...a) => fetch(...a)): Ablage {
  const anfrage = (pfad: string, init: RequestInit = {}) => netzAnfrage(pfad, init, abruf)
  return {
    dateien: () => anfrage('/api/dateien').then(json<OrdnerEintrag[]>),
    texteLesen: (pfade) =>
      pfade.length
        ? anfrage('/api/texte', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pfade) }).then(json<TextDatei[]>)
        : Promise.resolve([]),
    leseDatei: async (pfad) => new Uint8Array(await (await pruefe(await anfrage(mitPfad(pfad)))).arrayBuffer()),
    async schreibeWenn(pfad, inhalt, erwartet): Promise<Geschrieben> {
      const koepfe: Record<string, string> = { 'content-type': 'application/octet-stream' }
      if (erwartet !== null) koepfe['Rl-Erwartet'] = erwartet
      const r = await anfrage(mitPfad(pfad), { method: 'PUT', headers: koepfe, body: inhalt as BodyInit })
      // 409: Die Datei hat inzwischen einen anderen Stand (Desktop-App, Syncthing); der Speicher legt eine Konfliktkopie an
      if (r.status === 409) return { art: 'geaendert' }
      return json<Geschrieben>(r)
    },
    konfliktLoeschen: async (pfad, original) => {
      await pruefe(await anfrage('/api/konflikt-loeschen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pfad, original }) }))
    },
    beobachte: async (rueckruf) => beobachteStrom(rueckruf, { anfrage }),
    // Der Ereignisstrom meldet Änderungen sofort; die Abfrage fängt auf, was in einer Funkpause verloren ging
    abfrageMs: 60_000,
    dauerhaft: true
  }
}
