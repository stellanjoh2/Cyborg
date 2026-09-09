const GRAIN_KEY = 'lx01-grain'
const GLOW_KEY = 'lx01-glow'
const LEGACY_PERF_KEY = 'lx01-performance'

function readLegacyHigh(): boolean | null {
  try {
    const raw = localStorage.getItem(LEGACY_PERF_KEY)
    if (raw === 'high') return true
    if (raw === 'low') return false
  } catch {
    // ignore
  }
  return null
}

function readToggle(key: string, legacyDefault: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === 'on') return true
    if (raw === 'off') return false
  } catch {
    // ignore
  }
  return legacyDefault
}

function writeToggle(key: string, enabled: boolean) {
  try {
    localStorage.setItem(key, enabled ? 'on' : 'off')
  } catch {
    // ignore
  }
}

/** Defaults match former Performance Low when no preference is stored. */
function legacyOrOff(): boolean {
  return readLegacyHigh() ?? false
}

export function readGrainEnabled(): boolean {
  return readToggle(GRAIN_KEY, legacyOrOff())
}

export function readGlowEnabled(): boolean {
  return readToggle(GLOW_KEY, legacyOrOff())
}

export function applyGrainEnabled(enabled: boolean) {
  document.documentElement.classList.toggle('grain-off', !enabled)
  writeToggle(GRAIN_KEY, enabled)
}

export function applyGlowEnabled(enabled: boolean) {
  document.documentElement.classList.toggle('glow-off', !enabled)
  writeToggle(GLOW_KEY, enabled)
}

export function applyVisualFx() {
  applyGrainEnabled(readGrainEnabled())
  applyGlowEnabled(readGlowEnabled())
}
