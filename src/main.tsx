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
import {
  applyPerformanceMode,
  readPerformanceMode,
} from './ui/performance'
import { initUiSounds } from './ui/sounds'

applyColorTheme(getThemeById(readStoredThemeId()))
applyPerformanceMode(readPerformanceMode())
initUiSounds()

// Soft-light SVG grain is expensive / glitchy on Safari — keep it elsewhere.
{
  const ua = navigator.userAgent
  if (
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Firefox|FxiOS/i.test(ua)
  ) {
    document.documentElement.classList.add('is-safari')
  }
}

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
