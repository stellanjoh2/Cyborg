import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ScaleViewport } from './components/ScaleViewport'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScaleViewport>
      <App />
    </ScaleViewport>
  </StrictMode>,
)
