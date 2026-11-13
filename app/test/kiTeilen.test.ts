// Gemeinsamer KI-Zugang (Vertrag Lernen 1.2, 5.8) gegen den echten Speicher auf einem Ordner im Arbeitsspeicher.
// Die Verschlüsselung selbst prüft Rust (tresor.rs, cargo test); hier ist der Tresor ein Schein mit denselben Regeln:
// Kennung je Datenschlüssel, Passwort nötig zum Beitreten, fremde Kennung lässt sich nicht öffnen.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pfade } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { einarbeiten, tresorFehlerText, verdeckt, zusammenfuehren, type Tresor } from '../src/kianbieter/teilen'
import {
  ladeZugang,
  passwortAendern,
  speichereZugang,
  teilenBeenden,
  teilenBeitreten,
  teilenEinschalten,
  teilenStand,
  verbindeOrdner,
  zeigeVerdeckt,
  zugangFuerTest,
  zugangVerarbeitet,
  type KiZugang
} from '../src/kianbieter/zugang'

const PFAD = pfade.kiZugang()
let nr = 0

function scheinTresor(): Tresor & { eigene: () => string | null } {
  let eigene: string | null = null
  const lies = (datei: string) => JSON.parse(datei) as { kennung: string; pw: string; inhalt: string }
  return {
    eigene: () => eigene,
    kennung: async () => eigene,
    async anlegen(pw, klartext) {
      if (pw.length < 8) throw new Error('zu-kurz')
      eigene = (++nr).toString(16).padStart(32, '0')
      return JSON.stringify({ schema: 1, verfahren: 'schein', kennung: eigene, pw, inhalt: klartext })
    },
    async beitreten(datei, pw) {
      const d = lies(datei)
      if (d.pw !== pw) throw new Error('passwort')
      eigene = d.kennung
      return d.inhalt
    },
    async oeffnen(datei) {
      const d = lies(datei)
      if (d.kennung !== eigene) throw new Error('kennung')
      return d.inhalt
    },
    async schreiben(datei, klartext) {
      const d = lies(datei)
      if (d.kennung !== eigene) throw new Error('kennung')
      return JSON.stringify({ ...d, inhalt: klartext })
    },
    async vergessen() {
      eigene = null
    }
  }
}

const offen: (() => Promise<void> | void)[] = []
afterEach(async () => {
  for (const f of offen.splice(0).reverse()) await f()
})

/** Konfigordner des Geräts als Schein */
let lokal: unknown = null
beforeEach(() => {
  lokal = null
})

async function geraet(platte: Platte, eigenerZugang: KiZugang | null) {
  lokal = eigenerZugang
  // wie nach dem Lesen des Konfigordners beim Start
  zugangFuerTest(eigenerZugang, {
    lesen: async () => lokal,
    setzen: async (z) => {
      lokal = z
    }
  })
  const s = new Speicher({ ablage: ablageImSpeicher(platte), wartezeit: 10 })
  await s.oeffne()
  offen.push(() => s.schliesse())
  const tresor = scheinTresor()
  offen.push(verbindeOrdner(s, tresor))
  await bis(() => true)
  return { s, tresor }
}

async function bis(f: () => boolean, ms = 2000) {
  const ende = Date.now() + ms
  for (;;) {
    await new Promise((r) => setTimeout(r, 15))
    await zugangVerarbeitet()
    if (f() || Date.now() > ende) return
  }
}

const anthropic = (schluessel: string): KiZugang => ({ anbieter: 'anthropic', zugaenge: { anthropic: { schluessel, modell: 'claude-opus-5-5' } } })

/** Ein anderes Gerät legt eine Datei an (eigener Tresor, schreibt wie Syncthing direkt auf die Platte) */
async function anderesGeraet(platte: Platte, z: KiZugang, pw = 'ein langer Satz') {
  const t = scheinTresor()
  platte.schreibe(PFAD, await t.anlegen(pw, JSON.stringify(z)))
  return t
}

describe('Gemeinsamer KI-Zugang', () => {
  it('erstes Gerät: eigener Zugang wird verschlüsselt in den Ordner gelegt', async () => {
    const platte = new Platte()
    const { s } = await geraet(platte, anthropic('sk-ant-pc-1234'))
    expect(teilenStand()).toBe('aus')
    await expect(teilenEinschalten('kurz')).rejects.toThrow('zu-kurz')
    await teilenEinschalten('ein langer Satz')
    await s.speichereAlles()
    expect(teilenStand()).toBe('an')
    const datei = JSON.parse(platte.text(PFAD)!)
    expect(JSON.parse(datei.inhalt).zugaenge.anthropic.schluessel).toBe('sk-ant-pc-1234')
  })

  it('weiteres Gerät: Datei gilt, nur hier bekannte Anbieter kommen dazu', async () => {
    const platte = new Platte()
    await anderesGeraet(platte, anthropic('sk-ant-pc-1234'))
    const { s } = await geraet(platte, { anbieter: 'openai', zugaenge: { anthropic: { schluessel: 'sk-ant-alt-0000', modell: 'x' }, openai: { schluessel: 'sk-oa-handy-5678', modell: 'gpt' } } })
    await bis(() => teilenStand() === 'angeboten')
    expect(teilenStand()).toBe('angeboten')
    await expect(teilenBeitreten('falsch')).rejects.toThrow('passwort')
    expect(teilenStand()).toBe('angeboten')
    await teilenBeitreten('ein langer Satz')
    await s.speichereAlles()
    const z = await ladeZugang()
    expect(z.anbieter).toBe('anthropic')
    expect(z.zugaenge.anthropic?.schluessel).toBe('sk-ant-pc-1234')
    expect(z.zugaenge.openai?.schluessel).toBe('sk-oa-handy-5678')
    // auch in der Datei, damit der PC den Schlüssel vom Handy bekommt, und als Kopie im Konfigordner
    expect(JSON.parse(JSON.parse(platte.text(PFAD)!).inhalt).zugaenge.openai.schluessel).toBe('sk-oa-handy-5678')
    expect((lokal as KiZugang).zugaenge.openai?.schluessel).toBe('sk-oa-handy-5678')
  })

  it('neuer Schlüssel auf einem anderen Gerät gilt hier ohne Neustart', async () => {
    const platte = new Platte()
    const pc = await anderesGeraet(platte, anthropic('sk-ant-alt-1111'))
    await geraet(platte, null)
    await bis(() => teilenStand() === 'angeboten')
    await teilenBeitreten('ein langer Satz')
    expect((await ladeZugang()).zugaenge.anthropic?.schluessel).toBe('sk-ant-alt-1111')
    // Der PC erneuert den Schlüssel (er verfällt jährlich); Syncthing bringt die Datei
    platte.schreibe(PFAD, await pc.schreiben(platte.text(PFAD)!, JSON.stringify(anthropic('sk-ant-neu-2222'))))
    await bis(() => lokal !== null && (lokal as KiZugang).zugaenge.anthropic?.schluessel === 'sk-ant-neu-2222')
    expect((await ladeZugang()).zugaenge.anthropic?.schluessel).toBe('sk-ant-neu-2222')
    expect(teilenStand()).toBe('an')
  })

  it('eigene Änderung geht verschlüsselt in den Ordner, das andere Gerät liest sie', async () => {
    const platte = new Platte()
    const pc = await anderesGeraet(platte, anthropic('sk-ant-alt-1111'))
    const { s } = await geraet(platte, null)
    await bis(() => teilenStand() === 'angeboten')
    await teilenBeitreten('ein langer Satz')
    await speichereZugang(anthropic('sk-ant-handy-3333'))
    await s.speichereAlles()
    expect(JSON.parse(await pc.oeffnen(platte.text(PFAD)!)).zugaenge.anthropic.schluessel).toBe('sk-ant-handy-3333')
  })

  it('Passwort auf anderem Gerät geändert: letzter Stand gilt weiter, neues Passwort ohne Zusammenführen', async () => {
    const platte = new Platte()
    await anderesGeraet(platte, { anbieter: 'anthropic', zugaenge: { anthropic: { schluessel: 'sk-ant-1111', modell: 'm' }, openai: { schluessel: 'sk-oa-9999', modell: 'g' } } })
    await geraet(platte, null)
    await bis(() => teilenStand() === 'angeboten')
    await teilenBeitreten('ein langer Satz')
    // Der PC entfernt OpenAI und ändert das Passwort
    await anderesGeraet(platte, anthropic('sk-ant-1111'), 'ganz neues Passwort')
    await bis(() => teilenStand() === 'neues-passwort')
    expect(teilenStand()).toBe('neues-passwort')
    expect((await ladeZugang()).zugaenge.openai?.schluessel).toBe('sk-oa-9999')
    await expect(teilenBeitreten('ein langer Satz')).rejects.toThrow('passwort')
    await teilenBeitreten('ganz neues Passwort')
    expect(teilenStand()).toBe('an')
    // der entfernte Schlüssel kommt nicht zurück
    expect((await ladeZugang()).zugaenge.openai).toBeUndefined()
  })

  it('Passwort ändern legt neue Kennung an, nicht mehr teilen behält den Zugang', async () => {
    const platte = new Platte()
    const { s, tresor } = await geraet(platte, anthropic('sk-ant-pc-1234'))
    await teilenEinschalten('ein langer Satz')
    const alt = tresor.eigene()
    await passwortAendern('ganz neues Passwort')
    await s.speichereAlles()
    expect(tresor.eigene()).not.toBe(alt)
    expect(JSON.parse(platte.text(PFAD)!).pw).toBe('ganz neues Passwort')
    await teilenBeenden()
    expect(teilenStand()).toBe('angeboten')
    expect((await ladeZugang()).zugaenge.anthropic?.schluessel).toBe('sk-ant-pc-1234')
    expect(platte.text(PFAD)).toBeDefined()
  })

  it('Konfliktansicht zeigt Schlüssel nur verdeckt, fremde Kennung als nicht lesbar', async () => {
    const platte = new Platte()
    const { tresor } = await geraet(platte, anthropic('sk-ant-geheim-abcd'))
    await teilenEinschalten('ein langer Satz')
    const zeilen = await zeigeVerdeckt(await tresor.schreiben(platte.text(PFAD) ?? (await tresor.anlegen('ein langer Satz', '{}')), JSON.stringify(anthropic('sk-ant-geheim-abcd'))))
    expect(zeilen).toEqual(['Anthropic (aktiv) · Schlüssel …abcd · Modell claude-opus-5-5'])
    expect(zeilen!.join()).not.toContain('geheim')
    const fremd = await scheinTresor().anlegen('anderes Passwort', '{}')
    expect(await zeigeVerdeckt(fremd)).toBeNull()
  })
})

describe('Regeln des gemeinsamen Zugangs', () => {
  it('Einarbeiten behält Unbekanntes und entfernt gelöschte Anbieter und Felder', () => {
    const alt = { anbieter: 'anthropic', neu: 1, zugaenge: { anthropic: { schluessel: 'a', modell: 'm', extra: true }, openai: { schluessel: 'o' }, mistral: { schluessel: 'x' } } }
    const r = einarbeiten(alt, { anbieter: 'anthropic', zugaenge: { anthropic: { schluessel: 'b' } } })
    expect(r).toEqual({ anbieter: 'anthropic', neu: 1, zugaenge: { anthropic: { schluessel: 'b', extra: true }, mistral: { schluessel: 'x' } } })
  })

  it('Zusammenführen: Datei gewinnt, Anbieter nur hier kommen dazu, Wahl nur ohne Wahl in der Datei', () => {
    expect(zusammenfuehren({ anbieter: null, zugaenge: { anthropic: { schluessel: 'a' } } }, { anbieter: 'ollama', zugaenge: { anthropic: { schluessel: 'b' }, ollama: { adresse: 'http://x:11434' } } })).toEqual({
      anbieter: 'ollama',
      zugaenge: { anthropic: { schluessel: 'a' }, ollama: { adresse: 'http://x:11434' } }
    })
  })

  it('verdeckt zeigt nie mehr als vier Zeichen eines Schlüssels', () => {
    expect(verdeckt({ anbieter: null, zugaenge: { openai: { schluessel: 'kurz' } } })).toEqual(['OpenAI · Schlüssel …'])
    expect(verdeckt({ anbieter: null, zugaenge: {} })).toEqual(['Kein Anbieter eingerichtet'])
  })

  it('Fehlerwörter aus Rust werden Sätze', () => {
    expect(tresorFehlerText('passwort')).toBe('Das Passwort stimmt nicht.')
    expect(tresorFehlerText(new Error('kennung'))).toContain('anderen Gerät geändert')
  })
})
