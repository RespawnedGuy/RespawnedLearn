import { Component, type ErrorInfo, type ReactNode } from 'react'
import { melde } from './Meldung'

// Fehlergrenze: Stürzt eine Ansicht beim Zeichnen ab, zeigt nur sie eine Meldung. Kopf, Daumenleiste und die
// anderen Ansichten bleiben bedienbar. Die Daten liegen im Speicher und auf dem Server, ein Absturz der Anzeige
// ändert daran nichts; das Journal sichert seinen offenen Text beim Abbauen (Journal.tsx, Aufräumen von `sichern`).
//
// `ort` ist der Schlüssel der Ansicht (z. B. die Hash-Route). Wechselt er, versucht die Grenze es von selbst neu,
// so führt jeder Tipp in Reiter oder Leiste aus der Meldung heraus. Ohne Fehler wird dabei nichts neu aufgebaut.
// `leise`: für Fenster und Leisten über der Ansicht (Name des Fensters). Sie verschwinden mit einer kurzen Meldung
// unten, statt die Seite zu verdecken. `ganz`: äußerste Grenze um die ganze App, falls Kopf oder Leiste selbst abstürzen.

interface Props {
  children: ReactNode
  ort?: string
  leise?: string
  ganz?: boolean
  /** Für Tests und Protokoll: wird mit dem Fehler aufgerufen */
  beiFehler?: (fehler: unknown) => void
}

interface Zustand {
  fehler: unknown
  ort?: string
}

export class Fehlergrenze extends Component<Props, Zustand> {
  state: Zustand = { fehler: null, ort: this.props.ort }

  static getDerivedStateFromError(fehler: unknown): Partial<Zustand> {
    return { fehler: fehler ?? new Error('Unbekannter Fehler') }
  }

  static getDerivedStateFromProps(props: Props, zustand: Zustand): Partial<Zustand> | null {
    // Andere Ansicht gewählt: neuer Versuch
    if (props.ort !== zustand.ort) return { ort: props.ort, fehler: null }
    return null
  }

  componentDidCatch(fehler: unknown, info: ErrorInfo) {
    console.error('Ansicht abgestürzt', fehler, info.componentStack)
    this.props.beiFehler?.(fehler)
    if (this.props.leise) melde(`${this.props.leise} ließ sich nicht öffnen.`)
  }

  nochmal = () => this.setState({ fehler: null })

  render() {
    const { fehler } = this.state
    if (!fehler) return this.props.children
    if (this.props.leise) return null
    const text = fehler instanceof Error ? `${fehler.name}: ${fehler.message}` : String(fehler)
    return (
      <main className="fehlergrenze" role="alert">
        <h2>Diese Ansicht lässt sich gerade nicht anzeigen.</h2>
        <p>
          {this.props.ganz
            ? 'Deine Einträge sind davon nicht betroffen. Lade die App neu.'
            : 'Deine Einträge sind davon nicht betroffen, alle anderen Bereiche funktionieren weiter.'}
        </p>
        <div className="fehlergrenze-knoepfe">
          <button type="button" className="knopf haupt" onClick={this.nochmal}>Nochmal versuchen</button>
          <button type="button" className="knopf" onClick={() => location.reload()}>App neu laden</button>
        </div>
        <details>
          <summary>Technische Angabe</summary>
          <code>{text}</code>
        </details>
      </main>
    )
  }
}
