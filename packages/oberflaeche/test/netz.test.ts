import { afterEach, describe, expect, it } from 'vitest'
import { Speicher } from '../src/daten/speicher'
import { Platte, ablageImSpeicher } from '../src/daten/ablageImSpeicher'
import { beobachteStrom, netzAblage } from '../src/daten/netz'

// Zugang übers Netz: Die Oberfläche spricht per HTTP mit dem Server einer Desktop-App (app/src-tauri/src/netz/server.rs).
// Hier steht ein nachgebauter Server mit demselben Verhalten davor (Stempel, 409, Ereignisstrom, eigener Kopf); die
// Platte ist der Datenordner auf dem Rechner, der freigibt, `platte.schreibe` die Desktop-App oder Syncthing dort.

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function bis(f: () => boolean, ms = 2000) {
  for (let i = 0; i < ms / 10 && !f(); i++) await warte(10)
  expect(f()).toBe(true)
}

interface Nachbau {
  abruf: typeof fetch
  anfragen: { pfad: string; kopf: Headers }[]
  /** offene Ereignisströme beenden (Funkloch) */
  trenne(): void
}

function nachbau(platte: Platte): Nachbau {
  const ordner = ablageImSpeicher(platte)
  const anfragen: Nachbau['anfragen'] = []
  /** offene Ströme mit ihrem Abmelden */
  const stroeme = new Map<ReadableStreamDefaultController<Uint8Array>, () => void>()
  const abruf = (async (eingabe: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(eingabe), 'https://rechner.example')
    const kopf = new Headers(init?.headers)
    anfragen.push({ pfad: url.pathname, kopf })
    if (kopf.get('Rl-Anfrage') !== '1') return new Response('fremde Herkunft', { status: 403 })
    const methode = init?.method ?? 'GET'
    const pfad = url.searchParams.get('pfad') ?? ''
    switch (`${methode} ${url.pathname}`) {
      case 'GET /api/dateien':
        return Response.json(await ordner.dateien())
      case 'POST /api/texte':
        return Response.json(await ordner.texteLesen(JSON.parse(String(init?.body))))
      case 'GET /api/datei':
        try {
          return new Response(new Uint8Array(await ordner.leseDatei(pfad)))
        } catch (e) {
          return new Response(String(e), { status: 400 })
        }
      case 'PUT /api/datei': {
        const g = await ordner.schreibeWenn(pfad, init?.body as Uint8Array, kopf.get('Rl-Erwartet'))
        return Response.json(g, { status: g.art === 'ok' ? 200 : 409 })
      }
      case 'POST /api/konflikt-loeschen': {
        const k = JSON.parse(String(init?.body)) as { pfad: string; original: string }
        try {
          await ordner.konfliktLoeschen(k.pfad, k.original)
          return new Response(null, { status: 204 })
        } catch (e) {
          return new Response(String(e), { status: 400 })
        }
      }
      case 'GET /api/ereignisse': {
        let ab = () => {}
        const strom = new ReadableStream<Uint8Array>({
          start(c) {
            const weg = platte.hoere(() => {
              // die Platte meldet etwas später; der Strom kann bis dahin geschlossen sein
              if (stroeme.has(c)) c.enqueue(new TextEncoder().encode('event: geaendert\ndata: []\n\n'))
            })
            ab = () => (weg(), stroeme.delete(c))
            stroeme.set(c, ab)
            init?.signal?.addEventListener('abort', () => {
              ab()
              try {
                c.close()
              } catch {
                // schon zu
              }
            })
          },
          cancel: () => ab()
        })
        return new Response(strom, { headers: { 'content-type': 'text/event-stream' } })
      }
    }
    return new Response('unbekannt', { status: 404 })
  }) as typeof fetch
  return {
    abruf,
    anfragen,
    trenne() {
      for (const [c, ab] of [...stroeme]) {
        ab()
        c.close()
      }
    }
  }
}

const offen: Speicher[] = []
async function iphone(n: Nachbau) {
  const s = new Speicher({ ablage: netzAblage(n.abruf), wartezeit: 20 })
  await s.oeffne()
  offen.push(s)
  return s
}

afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

describe('Ablage über das Netz', () => {
  it('jede Anfrage trägt den eigenen Kopf, sonst lehnt der Server ab', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/a.md', 'A')
    const n = nachbau(p)
    const s = await iphone(n)
    expect(s.text('lernen/fragen/a.md')).toBe('A')
    await s.schreibe('lernen/fragen/b.md', 'B')
    await bis(() => p.text('lernen/fragen/b.md') === 'B')
    expect(n.anfragen.length).toBeGreaterThan(2)
    expect(n.anfragen.every((a) => a.kopf.get('Rl-Anfrage') === '1')).toBe(true)
  })

  it('eine Änderung auf dem Rechner kommt ohne Abfrage über den Ereignisstrom', async () => {
    const p = new Platte()
    const s = await iphone(nachbau(p))
    // Abfrage nur alle 60 s: Was in 2 s ankommt, kam über den Strom
    p.schreibe('lernen/fragen/neu.md', 'vom PC')
    await bis(() => s.text('lernen/fragen/neu.md') === 'vom PC')
  })

  it('gleichzeitige Änderung ergibt eine Konfliktkopie, nichts geht verloren', async () => {
    const p = new Platte()
    p.schreibe('lernen/fragen/k.md', 'alt')
    const s = await iphone(nachbau(p))
    await s.schreibe('lernen/fragen/k.md', 'vom iPhone')
    // die Desktop-App schreibt dazwischen, bevor das iPhone speichert
    p.schreibe('lernen/fragen/k.md', 'vom PC')
    await bis(() => [...p.dateien.keys()].some((k) => k.includes('.sync-conflict-')))
    const kopie = [...p.dateien.keys()].find((k) => k.includes('.sync-conflict-'))!
    expect([p.text('lernen/fragen/k.md'), p.text(kopie)].sort()).toEqual(['vom PC', 'vom iPhone'].sort())
  })

  it('Binärdateien kommen als Bytes, eine fehlende Datei als null', async () => {
    const p = new Platte()
    p.schreibe('anhaenge/s.pdf', '%PDF-1.7')
    const s = await iphone(nachbau(p))
    expect(await (await s.binaer('anhaenge/s.pdf'))?.text()).toBe('%PDF-1.7')
    expect(await s.binaer('anhaenge/fehlt.pdf')).toBeNull()
    await s.hochladen('anhaenge/foto.png', new Blob([new Uint8Array([137, 80, 78, 71])]))
    expect([...p.dateien.get('anhaenge/foto.png')!.inhalt]).toEqual([137, 80, 78, 71])
  })

  it('nach einem Funkloch verbindet der Strom neu und meldet einmal, damit nichts verpasst wird', async () => {
    const p = new Platte()
    const n = nachbau(p)
    let meldungen = 0
    const ab = beobachteStrom(() => meldungen++, { anfrage: (pfad, init) => netzAblageAnfrage(n, pfad, init), wartenMs: 20 })
    await bis(() => n.anfragen.filter((a) => a.pfad === '/api/ereignisse').length === 1)
    n.trenne()
    await bis(() => n.anfragen.filter((a) => a.pfad === '/api/ereignisse').length === 2)
    await bis(() => meldungen === 1)
    p.schreibe('x.md', 'x')
    await bis(() => meldungen === 2)
    ab()
  })
})

const netzAblageAnfrage = (n: Nachbau, pfad: string, init: RequestInit = {}) => n.abruf(pfad, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), 'Rl-Anfrage': '1' } })
