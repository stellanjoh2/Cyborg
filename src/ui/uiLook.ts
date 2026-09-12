const UI_LOOK_KEY = 'lx01-ui-look'

export type UiLook = 'soft' | 'hard'

const HARD_RADIUS_PX = 12

export function readUiLook(): UiLook {
  try {
    const raw = localStorage.getItem(UI_LOOK_KEY)
    if (raw === 'hard') return 'hard'
    if (raw === 'soft') return 'soft'
  } catch {
    // ignore
  }
  return 'soft'
}

export function applyUiLook(look: UiLook) {
  const root = document.documentElement
  if (look === 'hard') {
    root.style.setProperty('--radius-panel', `${HARD_RADIUS_PX}px`)
    root.style.setProperty('--radius-floating', `${HARD_RADIUS_PX}px`)
  } else {
    root.style.removeProperty('--radius-panel')
    root.style.removeProperty('--radius-floating')
  }
  try {
    localStorage.setItem(UI_LOOK_KEY, look)
  } catch {
    // ignore
  }
}
