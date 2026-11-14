// @vitest-environment happy-dom
// Skript und Notizbuch umbenennen gegen den echten Speicher: nur der Name ändert sich, alle Verweise bleiben byte-gleich
import { afterEach, describe, expect, it } from 'vitest'
import { Bestand, buchDokument, felder, pfade, zerlege } from '@rl/kern'
import { Speicher } from '../../packages/oberflaeche/src/daten/speicher'
import { Platte, ablageImSpeicher } from '../../packages/oberflaeche/src/daten/ablageImSpeicher'
import { benenneSkript } from '../src/wissen'
import { benenneNotizbuch } from '../src/Buch'

const offen: Speicher[] = []
afterEach(async () => {
  for (const s of offen.splice(0)) await s.schliesse()
})

const A = '01JTESTSKRIPT0000000000001'
const M = '01JTESTMODUL00000000000001'
const B = '01JTESTBUCH000000000000001'
const K = '01JTESTKARTE00000000000001'
const SIDECAR = `---
id: ${A}
typ: anhang
titel: ET2_Skript_WS26
datei: anhaenge/2026/11/ET2_Skript_WS26.pdf
sha256: abc
art: skript
---
`
const PFAD_SIDECAR = 'gemeinsam/anhaenge/2026/11/ET2_Skript_WS26.pdf.md'

// Alles, was auf Skript oder Buch zeigt: Markierungen, Karte, Buchseite, Anordnung, Lesestand, Lernzeit
const verweise: Record<string, string> = {
  [pfade.marken('lernen', A)]: `---\nanhang: "[[${A}]]"\n---\n- S. 12 · Spannungsteiler #et2 %%rt 2026-11-14%% ^mk0001\n`,
  [pfade.marken('lernen', B)]: `---\nbuch: "[[${B}]]"\n---\n- S. 1 · Eigene Herleitung %%rt 2026-11-14%% ^mk0002\n`,
  [`lernen/wissen/${K}.md`]: `---\nid: ${K}\ntyp: frage\ntitel: Was ist ein Spannungsteiler?\n---\n?? Was ist ein Spannungsteiler?\n:: Zwei Widerstände\n\nAus [[${A}#seite=12|ET2_Skript_WS26, S. 12]]\n`,
  [pfade.buchSeite(B, 1)]: JSON.stringify({ bilder: [], verweise: [{ id: 'v1', y: 0, anhang: A, seite: 12 }] }),
  [`lernen/blaetter/${A}/anordnung.json`]: JSON.stringify({ schema: 2, ansichten: [{ art: 'pdf', id: 'pdf', breite: 2 }, { art: 'buch', id: B, breite: 1 }] }),
  ['lernen/stand/pc.json']: JSON.stringify({ [A]: { seite: 12, am: '2026-11-14T10:00:00Z' } }),
  ['lernen/zeit/2026-11.pc.jsonl']: JSON.stringify({ ziel: M, art: 'sammeln', am: '2026-11-14T08:00:00.000Z', bis: '2026-11-14T08:42:00.000Z', quelle: A, seiten: [12, 19] }) + '\n'
}

const modul = (titel: string, quellen: string[], id = M) => `---\nid: ${id}\ntyp: modul\ntitel: ${titel}\nquellen: [${quellen.map((q) => `"[[${q}]]"`).join(', ')}]\n---\n`

async function geraet(modulText = modul('ET2_Skript_WS26', [A])) {
  const p = new Platte()
  p.schreibe(PFAD_SIDECAR, SIDECAR)
  p.schreibe(pfade.modul(M), modulText)
  p.schreibe(pfade.buch(B), buchDokument({ id: B, titel: 'Notizen ET2', lineatur: 'kariert', modul: M, erstellt: '2026-11-14T10:00:00+01:00' }))
  for (const [pfad, text] of Object.entries(verweise)) p.schreibe(pfad, text)
  const s = new Speicher({ ablage: ablageImSpeicher(p, { stumm: true }), wartezeit: 10 })
  await s.oeffne()
  offen.push(s)
  return s
}

const bestand = (s: Speicher) => new Bestand(s.alleTexte())
const unveraendert = (s: Speicher) => {
  for (const [pfad, text] of Object.entries(verweise)) expect(s.text(pfad), pfad).toBe(text)
}

describe('Skript umbenennen', () => {
  it('setzt nur `name` im Sidecar, das Buch heißt mit, alle Verweise bleiben byte-gleich', async () => {
    const s = await geraet()
    await benenneSkript(s, bestand(s), A, 'Elektrotechnik 2')
    expect(s.text(PFAD_SIDECAR)).toBe(SIDECAR.replace('art: skript\n', 'art: skript\nname: Elektrotechnik 2\n'))
    const b = bestand(s)
    expect(b.dokumente.get(A)!.titel).toBe('Elektrotechnik 2')
    expect(b.dokumente.get(M)!.titel).toBe('Elektrotechnik 2')
    expect(s.pfade()).not.toContain('gemeinsam/anhaenge/2026/11/Elektrotechnik 2.pdf.md')
    unveraendert(s)
  })

  it('leer bringt den Dateinamen zurück, auch im Buch', async () => {
    const s = await geraet()
    await benenneSkript(s, bestand(s), A, 'Elektrotechnik 2')
    await benenneSkript(s, bestand(s), A, '  ')
    expect(s.text(PFAD_SIDECAR)).toBe(SIDECAR)
    expect(bestand(s).dokumente.get(M)!.titel).toBe('ET2_Skript_WS26')
    unveraendert(s)
  })

  it('ein Modul mit eigenem Namen oder mehreren PDFs bleibt, wie es ist', async () => {
    const s = await geraet(modul('Elektrotechnik', [A]))
    const vorher = s.text(pfade.modul(M))
    await benenneSkript(s, bestand(s), A, 'ET2 Skript')
    expect(s.text(pfade.modul(M))).toBe(vorher)
    const s2 = await geraet(modul('ET2_Skript_WS26', [A, '01JTESTANDERES000000000001']))
    const vorher2 = s2.text(pfade.modul(M))
    await benenneSkript(s2, bestand(s2), A, 'ET2 Skript')
    expect(s2.text(pfade.modul(M))).toBe(vorher2)
  })
})

describe('Notizbuch umbenennen', () => {
  it('ändert nur `titel` und `geaendert`, Seiten und Markierungen bleiben byte-gleich', async () => {
    const s = await geraet()
    const vorher = felder(zerlege(s.text(pfade.buch(B))!).kopf)
    await benenneNotizbuch(s, B, 'Übungen Kapitel 3')
    const nachher = felder(zerlege(s.text(pfade.buch(B))!).kopf)
    expect(nachher.titel).toBe('Übungen Kapitel 3')
    expect({ ...nachher, titel: vorher.titel, geaendert: vorher.geaendert }).toEqual(vorher)
    expect(bestand(s).dokumente.get(B)!.titel).toBe('Übungen Kapitel 3')
    unveraendert(s)
  })

  it('ein leerer Name ändert nichts', async () => {
    const s = await geraet()
    const vorher = s.text(pfade.buch(B))
    await benenneNotizbuch(s, B, ' ')
    expect(s.text(pfade.buch(B))).toBe(vorher)
  })
})
