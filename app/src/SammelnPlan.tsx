// Im Skript (Sammeln): das aktuelle Paket des Lernplans und, wenn ein Abschnitt fertig gelesen ist, ein stiller
// Knopf „Übung?“ (Nils 2026-11-14: keine Benachrichtigung, nur aus Vorhandenem, abschaltbar je Modul).
import { useState } from 'react'
import { abschnittFertig, aktuellePakete, lesestand, offeneFragen, type Eintrag, type Modul } from '@rl/kern'
import { ortLink, useDaten } from '@rl/oberflaeche'
import { kartenImModul } from './modulkarten'
import { seitenText, useModulPlan } from './lernplanDaten'

const weg = (schluessel: string) => {
  try {
    return localStorage.getItem(schluessel) === '1'
  } catch {
    return false
  }
}

export function SammelnPlan({ modul, quelle, seite }: { modul: Modul; quelle: Eintrag; seite: number }) {
  const { bestand } = useDaten()
  const quellen = modul.quellen.map((id) => bestand.dokumente.get(id)).filter((e): e is Eintrag => !!e)
  const p = useModulPlan(modul, quellen)
  const jetzt = { anhang: quelle.id, seite }
  const [, neu] = useState(0)
  const pakete = aktuellePakete(p.plan, p.stand, jetzt, 4)
  const paket = pakete[0]?.anhang === quelle.id && pakete[0].von <= seite && seite <= pakete[0].bis ? pakete[0] : null

  // Übung: nur nach einem fertig gelesenen Abschnitt, nur wenn es Fragen oder Karten gibt, bis man tippt oder wegklickt
  const fertig = modul.uebungen ? abschnittFertig(p.plan, jetzt) : null
  const schluessel = fertig ? `rl-uebung-${quelle.id}-${fertig.von}` : ''
  let uebung: string | null = null
  if (fertig && !weg(schluessel)) {
    const fragen = offeneFragen(bestand, lesestand(bestand)).filter((q) => q.anhang === quelle.id && q.seite >= fertig.von && q.seite <= fertig.bis)
    if (fragen.length) uebung = ortLink('lernen', 'fragen')
    else if (kartenImModul(bestand, modul.id).length) uebung = ortLink('lernen', 'modul', modul.id)
  }
  const wegklicken = () => {
    try {
      localStorage.setItem(schluessel, '1')
    } catch {
      // ohne Speicher erscheint er beim nächsten Öffnen wieder
    }
    neu((n) => n + 1)
  }

  return (
    <>
      {paket && (
        <span className="chip nur-breit" title={`Paket im Lernplan, etwa ${paket.minuten} min; danach ${pakete.length - 1} weitere`}>
          Paket {seitenText(paket.von, paket.bis)}
        </span>
      )}
      {uebung && fertig && (
        <span className="uebung-hinweis">
          <a className="knopf klein" href={uebung} onClick={wegklicken} title={`„${fertig.titel}“ ist gelesen`}>
            Übung?
          </a>
          <button type="button" className="knopf klein still" onClick={wegklicken} aria-label="Übungsvorschlag ausblenden">
            ✕
          </button>
        </span>
      )}
    </>
  )
}
