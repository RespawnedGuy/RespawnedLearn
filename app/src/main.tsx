import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DatenAnbieter, Fehlergrenze } from '@rl/oberflaeche'
import '@rl/oberflaeche/src/stil.css'
import 'katex/dist/katex.min.css'
import './lernen.css'
import { App } from './App'
import { OrdnerWahl } from './OrdnerWahl'

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
