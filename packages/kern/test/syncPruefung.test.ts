import { describe, expect, it } from 'vitest'
import { automatisch, merkeStelle, unlesbar } from '../src'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">\n<path d="M0 0L1 1"/>\n</svg>\n'
const karte = '---\nid: k1\ntyp: frage\n---\n?? Frage\n:: Antwort\n'

describe('unlesbar: was ein Sync-Fehler hinterlässt', () => {
  it('erkennt leere, halbe und kaputte Dateien', () => {
    expect(unlesbar('lernen/stand/pc.json', '')).toBe('Die Datei ist leer')
    expect(unlesbar('lernen/stand/pc.json', '{"A1": {"seite": 3')).toMatch(/unvollständig/)
    expect(unlesbar('lernen/tinte/A/S001.svg', svg.slice(0, 40))).toMatch(/bricht/)
    expect(unlesbar('lernen/karten/k.md', '---\nid: k1\ntyp: fr')).toMatch(/Kopfbereich/)
    expect(unlesbar('reviews/2026-11.pc.jsonl', '{"karte":"a","am":"x"}\n{"karte":"b","a')).toBe('Zeile 2 ist beschädigt')
  })
  it('lässt gültige Dateien in Ruhe, auch mit CRLF und BOM', () => {
    expect(unlesbar('lernen/stand/pc.json', '﻿{"A1":{"seite":3}}\r\n')).toBeNull()
    expect(unlesbar('lernen/tinte/A/S001.svg', svg)).toBeNull()
    expect(unlesbar('lernen/karten/k.md', karte.replace(/\n/g, '\r\n'))).toBeNull()
    expect(unlesbar('lernen/karten/k.md', 'Text ohne Kopf')).toBeNull()
    expect(unlesbar('reviews/2026-11.pc.jsonl', '')).toBeNull()
    expect(unlesbar('anhaenge/2026/11/x.pdf', '')).toBeNull()
  })
})

describe('automatisch: nur wo nichts verloren gehen kann', () => {
  it('gleicher Inhalt (auch nur andere Zeilenenden) → Kopie weg', () => {
    expect(automatisch('lernen/karten/k.md', karte, karte)).toEqual({ art: 'weg' })
    expect(automatisch('lernen/karten/k.md', karte, '﻿' + karte.replace(/\n/g, '\r\n'))).toEqual({ art: 'weg' })
  })
  it('eine Seite leer → die volle bleibt', () => {
    expect(automatisch('lernen/tinte/A/S001.svg', svg, '')).toEqual({ art: 'weg' })
    expect(automatisch('lernen/tinte/A/S001.svg', ' \n', svg)).toEqual({ art: 'uebernehmen' })
  })
  it('halb übertragene Seite, die der Anfang der vollen ist → die volle bleibt', () => {
    expect(automatisch('lernen/tinte/A/S001.svg', svg, svg.slice(0, 50))).toEqual({ art: 'weg' })
    expect(automatisch('lernen/tinte/A/S001.svg', svg.slice(0, 50), svg)).toEqual({ art: 'uebernehmen' })
  })
  it('gekürzte, aber lesbare Fassung ist eine echte Änderung → Mensch entscheidet', () => {
    const kurz = '---\nid: k1\ntyp: frage\n---\n?? Frage\n'
    expect(automatisch('lernen/karten/k.md', karte, kurz)).toBeNull()
    expect(automatisch('lernen/karten/k.md', karte, karte + 'mehr\n')).toBeNull()
  })
  it('Protokoll: Zeilen beider Fassungen vereint, nach Zeit, keine doppelt, keine verloren', () => {
    const a = '{"karte":"a","am":"2026-11-13T08:00:00Z","note":"gut"}\n{"karte":"b","am":"2026-11-13T10:00:00Z","note":"gut"}\n'
    const b = '{"karte":"a","am":"2026-11-13T08:00:00Z","note":"gut"}\n{"karte":"c","am":"2026-11-13T09:00:00Z","note":"schwer"}\n'
    expect(automatisch('reviews/2026-11.pc-ab12.jsonl', a, b)).toEqual({
      art: 'zusammen',
      text: '{"karte":"a","am":"2026-11-13T08:00:00Z","note":"gut"}\n{"karte":"c","am":"2026-11-13T09:00:00Z","note":"schwer"}\n{"karte":"b","am":"2026-11-13T10:00:00Z","note":"gut"}\n'
    })
    // Kopie enthält nichts Neues
    expect(automatisch('reviews/2026-11.pc-ab12.jsonl', a, a.split('\n')[0] + '\n')).toEqual({ art: 'weg' })
    // Lernzeit (Vertrag Lernen 1.7) wird genauso vereinigt
    expect(automatisch('lernen/zeit/2026-11.pc-ab12.jsonl', a, b)).toMatchObject({ art: 'zusammen' })
    // Nur Protokolle: ein anderes JSONL wird nicht still vereinigt
    expect(automatisch('lernen/x.jsonl', a, b)).toBeNull()
  })
  it('fehlt die Datei, entscheidet der Mensch', () => {
    expect(automatisch('lernen/karten/k.md', undefined, karte)).toBeNull()
  })
  it('merkeStelle auf kaputtem Lesestand ergibt neuen Inhalt, den der Speicher vorher sichert (siehe speicher.test.ts)', () => {
    expect(JSON.parse(merkeStelle('{"A1": {"seite": 3', 'A2', 1, 'x'))).toEqual({ A2: { seite: 1, am: 'x' } })
  })
})
