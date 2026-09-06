export const PALETTE_KEYS = [
  'text',
  'muted',
  'black',
  'fill',
  'stroke',
  'lime',
  'vu',
  'purple',
  'blue',
  'error',
] as const

export type PaletteKey = (typeof PALETTE_KEYS)[number]
export type Palette = Record<PaletteKey, string>

export const DEFAULT_PALETTE: Palette = {
  text: '#ffdbb3',
  muted: '#6E6E6E',
  black: '#0a0a0a',
  fill: '#171717',
  stroke: '#FFFFFF',
  lime: '#ff8800',
  vu: '#00ffe1',
  purple: '#3B00FF',
  blue: '#00C4FF',
  error: '#ff2a00',
}

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  text: 'text primary',
  muted: 'text secondary',
  black: 'background',
  fill: 'surface',
  stroke: 'border',
  lime: 'accent',
  vu: 'vu meter',
  purple: 'accent secondary',
  blue: 'accent tertiary',
  error: 'error',
}

export const DEFAULT_STROKE_OPACITY = 0.1
export const DEFAULT_GRAIN_OPACITY = 0.48
export const DEFAULT_WALLPAPER_OPACITY = 0.16
export const DEFAULT_WALLPAPER_BLEND_MODE = 'screen'

export const WALLPAPER_BLEND_MODES = [
  'screen',
  'soft-light',
  'overlay',
  'multiply',
  'lighten',
  'normal',
  'hard-light',
  'color-dodge',
] as const

export type WallpaperBlendMode = (typeof WALLPAPER_BLEND_MODES)[number]

const HEX = /^#[0-9a-fA-F]{6}$/

function clampOpacity(opacity: number) {
  return Math.min(1, Math.max(0, opacity))
}

export function isHexColor(value: string): boolean {
  return HEX.test(value)
}

export function applyPalette(palette: Palette) {
  const root = document.documentElement
  for (const key of PALETTE_KEYS) {
    root.style.setProperty(`--${key}`, palette[key])
  }
  root.style.setProperty('--muted-solid', palette.muted)
}

export function applyStrokeOpacity(opacity: number) {
  document.documentElement.style.setProperty(
    '--section-stroke-opacity',
    String(clampOpacity(opacity)),
  )
}

export function applyGrainOpacity(opacity: number) {
  document.documentElement.style.setProperty(
    '--grain-opacity',
    String(clampOpacity(opacity)),
  )
}

export function applyWallpaperOpacity(opacity: number) {
  document.documentElement.style.setProperty(
    '--wallpaper-opacity',
    String(clampOpacity(opacity)),
  )
}

export function applyWallpaperBlendMode(mode: WallpaperBlendMode) {
  document.documentElement.style.setProperty('--wallpaper-blend-mode', mode)
}

export function formatPalette(
  palette: Palette,
  strokeOpacity = DEFAULT_STROKE_OPACITY,
  grainOpacity = DEFAULT_GRAIN_OPACITY,
  wallpaperOpacity = DEFAULT_WALLPAPER_OPACITY,
  wallpaperBlendMode: WallpaperBlendMode = DEFAULT_WALLPAPER_BLEND_MODE,
): string {
  return [
    ...PALETTE_KEYS.map((key) => `--${key}: ${palette[key]};`),
    `--section-stroke-opacity: ${strokeOpacity};`,
    `--grain-opacity: ${grainOpacity};`,
    `--wallpaper-opacity: ${wallpaperOpacity};`,
    `--wallpaper-blend-mode: ${wallpaperBlendMode};`,
  ].join('\n')
}
