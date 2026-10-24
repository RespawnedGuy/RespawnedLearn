// Kleine Symbole für Menüs, Kopf und Daumenleiste: Man erkennt den Eintrag, bevor man ihn liest.
// Neuer Eintrag in FEST (kern/vorlagen.ts) → hier eine Zeile mit derselben id; ohne eigene gilt VORLAGE.

const pfade: Record<string, string> = {
  aufgabe: 'M4 4h16v16H4z M8 12l3 3 5-6',
  plan: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14',
  aufnahme: 'M9 3h6v10a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v3',
  kamera: 'M3 8h4l2-3h6l2 3h4v11H3z M12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
  foto: 'M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M15.5 7.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  projekt: 'M9 3L7 21 M17 3l-2 18 M4 8h17 M3 16h17',
  vorlage: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5',
  stopp: 'M7 7h10v10H7z',
  zu: 'M6 6l12 12 M18 6L6 18',
  // Navigation (Kopf und Daumenleiste)
  journal: 'M6 3h12v18H6z M9 3v18 M12 8h3 M12 12h3',
  projekte: 'M3 6h6l2 2h10v11H3z',
  offen: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M8 12l3 3 5-6',
  zuordnen: 'M3 13l3-8h12l3 8v6H3z M3 13h5l1 2h6l1-2h5',
  termine: 'M4 5h16v15H4z M4 10h16 M8 3v4 M16 3v4',
  nachrichten: 'M3 5h18v14H3z M3 6l9 7 9-7',
  // Lern-App
  sammeln: 'M4 5a1 1 0 0 1 1-1h5a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z M20 5a1 1 0 0 0-1-1h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  lernen: 'M4 7h13v13H4z M7 4h13v13 M8 13l2 2 4-4',
  nutzen: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  lernkarte: 'M3 6h18v12H3z M7 10h10 M7 14h6',
  mitschrift: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8 M8 8h3',
  lupe: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z M15.5 15.5L20 20',
  zahnrad:
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  plus: 'M12 5v14 M5 12h14'
}

export function Symbol({ name, groesse = 18 }: { name: string; groesse?: number }) {
  return (
    <svg className="symbol-svg" width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={pfade[name] ?? pfade.vorlage} />
    </svg>
  )
}
