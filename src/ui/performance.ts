const STORAGE_KEY = 'lx01-performance'

export type PerformanceMode = 'low' | 'high'

function isPerformanceMode(value: unknown): value is PerformanceMode {
  return value === 'low' || value === 'high'
}

export function readPerformanceMode(): PerformanceMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (isPerformanceMode(raw)) return raw
  } catch {
    // ignore
  }
  return 'low'
}

export function applyPerformanceMode(mode: PerformanceMode) {
  document.documentElement.classList.toggle('perf-low', mode === 'low')
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}
