import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  isMobileDevice,
  MobileUnavailable,
} from './components/MobileUnavailable'
import { ScaleViewport } from './components/ScaleViewport'
import {
  applyColorTheme,
  getThemeById,
  readStoredThemeId,
} from './colorThemes'
import './index.css'
import App from './App.tsx'
import { applyVisualFx } from './ui/visualFx'
import { initUiSounds } from './ui/sounds'

applyColorTheme(getThemeById(readStoredThemeId()))
applyVisualFx()
initUiSounds()

const mobile = isMobileDevice()

if (mobile) {
  // Skip splash void so the default theme background shows.
  document.documentElement.classList.remove('is-splash-void')
}

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
    {mobile ? (
      <MobileUnavailable />
    ) : (
      <ScaleViewport>
        <App />
      </ScaleViewport>
    )}
  </StrictMode>,
)
