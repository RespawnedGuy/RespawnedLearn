import { useEffect, type ReactNode } from 'react'

export function Dialog({ titel, children, onZu }: { titel: string; children: ReactNode; onZu: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onZu()
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [onZu])
  return (
    <div className="dialog-huelle" onPointerDown={(e) => e.target === e.currentTarget && onZu()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={titel}>
        <h2>{titel}</h2>
        {children}
      </div>
    </div>
  )
}
