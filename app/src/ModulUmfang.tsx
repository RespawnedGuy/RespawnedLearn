// Umfang, Termin und Fortschritt eines Moduls (Vertrag Lernen 1.7): ECTS oder Stunden, Termin, Stunden pro Woche,
// darunter eine Zeile mit gemessener Zeit, Prognose und ob es bis zum Termin reicht. Alles optional.
import { planRestMinuten, stundenText, zeitplan, type Modul, type Wert } from '@rl/kern'
import { useDaten } from '@rl/oberflaeche'
import { setzeModulFeld } from './wissen'
import { tagKurz, type ModulPlan } from './lernplanDaten'

/** Zahl aus einem Eingabefeld, auch mit Komma; leer oder Unsinn = Feld entfernen */
export function zahlAus(text: string): number | undefined {
  const n = Number(text.trim().replace(',', '.'))
  return text.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined
}

const komma = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

export function ModulUmfang({ m, p }: { m: Modul; p: ModulPlan }) {
  const { speicher } = useDaten()
  const setze = (feld: string, wert: Wert | undefined) => void setzeModulFeld(speicher, m, feld, wert)
  const zahlFeld = (feld: 'ects' | 'stunden' | 'stundenProWoche', name: string, platzhalter: string) => (
    <label className="feld umfang-feld">
      {name}
      <input
        key={`${feld}-${m[feld] ?? ''}`}
        className="eingabe"
        inputMode="decimal"
        defaultValue={m[feld] !== null ? komma(m[feld]!) : ''}
        placeholder={platzhalter}
        onBlur={(e) => {
          const n = zahlAus(e.target.value)
          if (n !== (m[feld] ?? undefined)) setze(feld, n)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  )
  return (
    <div className="umfang">
      <div className="umfang-felder">
        {zahlFeld('ects', 'ECTS', 'z. B. 5')}
        {zahlFeld('stunden', 'oder Stunden', p.umfang && !m.stunden ? `${komma(p.umfang)} aus ECTS` : 'z. B. 40')}
        <label className="feld umfang-feld">
          Termin
          <input
            key={`termin-${m.termin ?? ''}`}
            className="eingabe"
            type="date"
            defaultValue={m.termin ?? ''}
            onBlur={(e) => {
              const t = /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : undefined
              if (t !== (m.termin ?? undefined)) setze('termin', t)
            }}
          />
        </label>
        {zahlFeld('stundenProWoche', 'Stunden pro Woche', 'optional')}
      </div>
      <Fortschritt m={m} p={p} />
    </div>
  )
}

function Fortschritt({ m, p }: { m: Modul; p: ModulPlan }) {
  const rest = planRestMinuten(p.plan, p.stand)
  const teile: string[] = []
  teile.push(p.umfang ? `${stundenText(p.zeit)} von ${komma(p.umfang)} h gelernt` : `${stundenText(p.zeit)} gelernt`)
  if (rest > 0) teile.push(`${p.tempo ? 'bei deinem Tempo' : 'geschätzt'} noch etwa ${stundenText(rest * 60_000)} Lesen`)
  let termin: string | null = null
  if (m.termin) {
    const heute = new Date().toISOString().slice(0, 10)
    const z = zeitplan({ restMinuten: rest, heute, termin: m.termin, stundenProWoche: m.stundenProWoche })
    if (m.termin < heute) termin = `Termin war am ${tagKurz(m.termin)}`
    else if (z.noetigJeWoche === null) termin = rest > 0 ? 'Bis zum Termin bleibt nur noch die Wiederholungswoche.' : `Ab ${tagKurz(z.wiederholungAb)} Wiederholung.`
    else if (z.reicht === false) termin = `Bei ${komma(m.stundenProWoche!)} h pro Woche fehlen bis zur Wiederholung ab ${tagKurz(z.wiederholungAb)} etwa ${komma(z.fehlen)} h.`
    else {
      const noetig = z.noetigJeWoche < 1 ? 'Weniger als 1 h' : `Etwa ${komma(z.noetigJeWoche)} h`
      termin = m.stundenProWoche
        ? `Mit ${komma(m.stundenProWoche)} h pro Woche bist du vor der Wiederholung ab ${tagKurz(z.wiederholungAb)} durch.`
        : `${noetig} pro Woche reichen bis zur Wiederholung ab ${tagKurz(z.wiederholungAb)}`
    }
  }
  return (
    <div className="umfang-stand" aria-live="polite">
      <div>{teile.join(' · ')}</div>
      {termin && <div className={m.termin && m.stundenProWoche && termin.startsWith('Bei ') ? 'umfang-warnung' : 'klein-leise'}>{termin}</div>}
      {!p.tempo && rest > 0 && <div className="klein-leise">Bis 20 Seiten gelesen sind, rechnet die App mit 5 Minuten je Seite, danach mit deinem Tempo.</div>}
    </div>
  )
}
