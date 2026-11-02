import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { bleibAktuell, DatenAnbieter, Fehlergrenze } from '@rvx/oberflaeche'
import '@rvx/oberflaeche/src/stil.css'
import 'katex/dist/katex.min.css'
import './lernen.css'
import { App } from './App'

bleibAktuell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fehlergrenze ganz>
      {/* Die Lern-App kennt keine Projekte: arbeit/ wird gar nicht erst abgeglichen */}
      <DatenAnbieter optionen={{ app: 'lernen', filter: (p) => !p.startsWith('arbeit/') && !p.startsWith('gemeinsam/kontakte/') }}>
        <App />
      </DatenAnbieter>
    </Fehlergrenze>
  </StrictMode>
)
