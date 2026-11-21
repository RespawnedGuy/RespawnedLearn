// Name eines Skripts oder Notizbuchs: antippen, neuen Namen schreiben, Enter oder Wegtippen speichert, Esc verwirft.
// Gleich bedient für Skript und Buch (Nils' Grundsatz), wie der Name eines Moduls oder einer Mitschrift.
import { useState } from 'react'

export function NameFeld({ name, art, onName, leerErlaubt = false }: { name: string; art: 'Skript' | 'Notizbuch' | 'Tab'; onName: (neu: string) => void; leerErlaubt?: boolean }) {
  const [bearbeiten, setBearbeiten] = useState(false)
  if (!bearbeiten)
    return (
      <button type="button" className="name-feld" onClick={() => setBearbeiten(true)} title={`${art} umbenennen`} aria-label={`${name}, ${art} umbenennen`}>
        {name}
      </button>
    )
  return (
    <input
      className="name-feld eingabe"
      autoFocus
      defaultValue={name}
      aria-label={`Name des ${art === 'Skript' ? 'Skripts' : art === 'Tab' ? 'Tabs' : 'Notizbuchs'}`}
      placeholder={leerErlaubt ? 'leer = Dateiname' : undefined}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => {
        const t = e.currentTarget.value.replace(/\s+/g, ' ').trim()
        setBearbeiten(false)
        if (t !== name && (t || leerErlaubt)) onName(t)
      }}
      onKeyDown={(e) => {
        // Enter und Esc gehen nicht weiter an Editor oder Werkzeug-Kürzel
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          e.currentTarget.value = name
          e.currentTarget.blur()
        }
      }}
    />
  )
}
