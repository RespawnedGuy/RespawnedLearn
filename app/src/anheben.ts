// Anheben der alten Zeichenblätter eines Skripts zu Notizbüchern (Vertrag Lernen 1.3, 5.3 „Anheben“).
// kern rechnet aus, was zu schreiben ist; hier wird es geschrieben: erst die Bücher, zuletzt die Anordnung. Bricht es
// mittendrin ab, beginnt der nächste Versuch von vorn und kommt auf dieselben Dateien (deterministisch).
import { hebeBlaetterAn, modulVon, pfade, type Bestand, type Eintrag } from '@rl/kern'
import type { Speicher } from '@rl/oberflaeche'

/** Hebt an, falls nötig. Liefert die Zahl der entstandenen Bücher (0 = nichts zu tun). */
export async function hebeAn(speicher: Speicher, bestand: Bestand, quelle: Eintrag): Promise<number> {
  const ordner = `lernen/blaetter/${quelle.id}/`
  const dateien = new Map<string, string>()
  for (const p of speicher.pfade()) {
    if (!p.startsWith(ordner) || p.endsWith('anordnung.json')) continue
    const t = speicher.text(p)
    if (t !== undefined) dateien.set(p, t)
  }
  const anordnung = speicher.text(pfade.blattAnordnung(quelle.id)) ?? null
  const jetzt = new Date().toISOString()
  const a = hebeBlaetterAn({
    anhangId: quelle.id,
    titel: quelle.titel,
    erstellt: String(quelle.felder.erstellt ?? jetzt),
    geaendert: String(quelle.felder.geaendert ?? quelle.felder.erstellt ?? jetzt),
    modul: modulVon(bestand, quelle.id)?.id ?? null,
    anordnung,
    dateien
  })
  if (!a) return 0
  for (const d of a.schreiben) {
    // Hat ein anderes Gerät schon angehoben, steht hier dasselbe; dann nichts schreiben
    if (speicher.text(d.pfad) === undefined) await speicher.schreibe(d.pfad, d.text)
  }
  await Promise.all(a.schreiben.map((d) => speicher.speichereJetzt(d.pfad)))
  await speicher.schreibe(pfade.blattAnordnung(quelle.id), a.anordnung)
  await speicher.speichereJetzt(pfade.blattAnordnung(quelle.id))
  return a.buecher.length
}
