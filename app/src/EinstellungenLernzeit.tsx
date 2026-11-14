// Einstellungen › Lernzeit (Vertrag Lernen 1.7): Stunden je ECTS für alle Geräte (im Datenordner) und der eigene
// Schnitt aus abgeschlossenen Modulen. Die Lernzeit selbst misst die App still (lernzeitMessen.ts).
import { STUNDEN_JE_ECTS, STUNDEN_JE_ECTS_GRENZEN, alleLernzeiten, liesStundenJeEcts, module, pfade, schnitt, stundenJeEctsText, tempo } from '@rl/kern'
import { useDaten } from '@rl/oberflaeche'

const komma = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

export function EinstellungenLernzeit() {
  const { speicher, bestand } = useDaten()
  const pfad = pfade.lernzeitEinstellung()
  const wert = liesStundenJeEcts(bestand.texte.get(pfad))
  const zeiten = alleLernzeiten(bestand)
  const s = schnitt(zeiten, module(bestand))
  const t = tempo(zeiten)
  return (
    <section className="einstellungen-teil">
      <h2>Lernzeit</h2>
      <label className="feld pomodoro-feld">
        Stunden je ECTS
        <input
          key={wert}
          className="eingabe"
          type="number"
          inputMode="numeric"
          min={STUNDEN_JE_ECTS_GRENZEN.min}
          max={STUNDEN_JE_ECTS_GRENZEN.max}
          step={1}
          defaultValue={wert}
          onBlur={(e) => {
            const n = Math.round(Number(e.target.value))
            const neu = Number.isFinite(n) && n >= STUNDEN_JE_ECTS_GRENZEN.min && n <= STUNDEN_JE_ECTS_GRENZEN.max ? n : STUNDEN_JE_ECTS
            if (neu !== wert) void speicher.aendere(pfad, (alt) => stundenJeEctsText(alt, neu))
            else e.target.value = String(wert)
          }}
        />
      </label>
      <p className="klein-leise">
        Ein ECTS-Punkt steht für 25 bis 30 Stunden Arbeit (ECTS-Leitfaden der EU); die genaue Zahl nennt die Prüfungsordnung deiner Hochschule. Standard ist {STUNDEN_JE_ECTS}. Gilt auf allen
        Geräten.
      </p>
      <p>
        {s
          ? `Dein Schnitt aus ${s.module} abgeschlossenen Modulen: ${komma(s.stundenJeModul)} h je Modul${s.stundenJeEcts !== null ? `, ${komma(s.stundenJeEcts)} h je ECTS` : ''}.`
          : 'Deinen Schnitt zeigt die App, sobald zwei Module mit gemessener Zeit abgeschlossen sind.'}
        {t ? ` Im Skript brauchst du etwa ${komma(t.minutenJeSeite)} Minuten je Seite.` : ''}
      </p>
      <p className="klein-leise">
        Gemessen wird nur, während ein Skript, ein Notizbuch, eine Mitschrift oder eine Lernrunde offen ist und du in den letzten 5 Minuten etwas getan hast. Vorlesung und Prüfung zählen nicht mit,
        darum liegt dein Wert meist unter dem der ECTS.
      </p>
    </section>
  )
}
