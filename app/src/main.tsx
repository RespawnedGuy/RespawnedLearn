import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DatenAnbieter, Fehlergrenze, beobachteStift, beobachteTastatur } from '@rl/oberflaeche'
import '@rl/oberflaeche/src/stil.css'
import 'katex/dist/katex.min.css'
import './lernen.css'
// Glas und Bewegung zuletzt: legen sich über Kopf und Funktionsleiste aus stil.css und lernen.css
import '@rl/oberflaeche/src/glas.css'
import '@rl/oberflaeche/src/bewegung.css'
import { App } from './App'
import { OrdnerWahl } from './OrdnerWahl'
import { wendeSchreibhandAn } from './schreibhand'
import { wendeLeistenLageAn } from './leistenLage'

wendeSchreibhandAn()
wendeLeistenLageAn()
// Stift am PC und Tablet: Werkzeugleiste am Rand durchlässig, solange er schreibt
beobachteStift()
// Bildschirmtastatur: --tastatur und --sichtbar für alles, was unten fest sitzt, nicht nur im Editor
beobachteTastatur()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fehlergrenze ganz>
      <OrdnerWahl>
        {/* Liest und schreibt den gewählten Datenordner (im Browser ohne Tauri: Vorschau im Arbeitsspeicher) */}
        <DatenAnbieter>
          <App />
        </DatenAnbieter>
      </OrdnerWahl>
    </Fehlergrenze>
  </StrictMode>
)
