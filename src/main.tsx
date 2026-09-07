import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ScaleViewport } from './components/ScaleViewport'
import {
  applyColorTheme,
  getThemeById,
  readStoredThemeId,
} from './colorThemes'
import './index.css'
import App from './App.tsx'
import { initUiSounds } from './ui/sounds'

applyColorTheme(getThemeById(readStoredThemeId()))
initUiSounds()

// Defer blend transitions until after the stored theme is painted.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.documentElement.classList.add('theme-blend')
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScaleViewport>
      <App />
    </ScaleViewport>
  </StrictMode>,
)
