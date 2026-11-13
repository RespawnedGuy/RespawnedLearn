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
        {/* Bis Schritt 2 gleicht der Speicher noch wie bisher ab; danach liest er den Ordner */}
        <DatenAnbieter optionen={{ app: 'lernen', filter: (p) => !p.startsWith('arbeit/') && !p.startsWith('gemeinsam/kontakte/') }}>
          <App />
        </DatenAnbieter>
      </OrdnerWahl>
    </Fehlergrenze>
  </StrictMode>
)
