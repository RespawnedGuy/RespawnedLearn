import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Modales Fenster über natives `<dialog>` mit showModal(): Der Fokus bleibt im Fenster (Tab läuft nicht in die Seite
 * dahinter), die Seite dahinter ist für Bildschirmleser stumm, Esc schließt. Beim Schließen kehrt der Fokus zum Knopf
 * zurück, der das Fenster geöffnet hat (Design-Prüfung Kl8).
 */
export function Dialog({ titel, children, onZu, breit }: { titel: string; children: ReactNode; onZu: () => void; breit?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (d && !d.open) {
      try {
        d.showModal()
      } catch {
        d.setAttribute('open', '')
      }
    }
    return () => {
      if (d?.open) d.close()
      if (vorher?.isConnected) vorher.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="dialog-huelle"
      aria-label={titel}
      onCancel={(e) => {
        e.preventDefault()
        onZu()
      }}
      onPointerDown={(e) => e.target === e.currentTarget && onZu()}
    >
      <div className={breit ? 'dialog breit' : 'dialog'}>
        <h2>{titel}</h2>
        {children}
      </div>
    </dialog>
  )
}
