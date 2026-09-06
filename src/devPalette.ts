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
  fill: '#121212',
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

export type BevelEmboss = {
  highlightColor: string
  shadowColor: string
  radius: number
  offset: number
  topOpacity: number
  bottomOpacity: number
  leftOpacity: number
  rightOpacity: number
  glowColor: string
  glowOpacity: number
  glowRadius: number
}

export const DEFAULT_BEVEL_EMBOSS: BevelEmboss = {
  highlightColor: '#ffffff',
  shadowColor: '#000000',
  radius: 3,
  offset: 1,
  topOpacity: 0.13,
  bottomOpacity: 1,
  leftOpacity: 0,
  rightOpacity: 0.34,
  glowColor: '#ffffff',
  glowOpacity: 0.03,
  glowRadius: 10,
}

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

function clampPx(value: number, max: number) {
  return Math.min(max, Math.max(0, value))
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

export function applyBevelEmboss(settings: BevelEmboss) {
  const root = document.documentElement
  const highlight = isHexColor(settings.highlightColor)
    ? settings.highlightColor
    : DEFAULT_BEVEL_EMBOSS.highlightColor
  const shadow = isHexColor(settings.shadowColor)
    ? settings.shadowColor
    : DEFAULT_BEVEL_EMBOSS.shadowColor
  const glow = isHexColor(settings.glowColor)
    ? settings.glowColor
    : DEFAULT_BEVEL_EMBOSS.glowColor

  root.style.setProperty('--bevel-highlight-color', highlight)
  root.style.setProperty('--bevel-shadow-color', shadow)
  root.style.setProperty('--bevel-radius', `${clampPx(settings.radius, 12)}px`)
  root.style.setProperty('--bevel-offset', `${clampPx(settings.offset, 8)}px`)
  root.style.setProperty(
    '--bevel-top-opacity',
    String(clampOpacity(settings.topOpacity)),
  )
  root.style.setProperty(
    '--bevel-bottom-opacity',
    String(clampOpacity(settings.bottomOpacity)),
  )
  root.style.setProperty(
    '--bevel-left-opacity',
    String(clampOpacity(settings.leftOpacity)),
  )
  root.style.setProperty(
    '--bevel-right-opacity',
    String(clampOpacity(settings.rightOpacity)),
  )
  root.style.setProperty('--emboss-glow-color', glow)
  root.style.setProperty(
    '--emboss-glow-opacity',
    String(clampOpacity(settings.glowOpacity)),
  )
  root.style.setProperty(
    '--emboss-glow-radius',
    `${clampPx(settings.glowRadius, 80)}px`,
  )
}

export function formatPalette(
  palette: Palette,
  strokeOpacity = DEFAULT_STROKE_OPACITY,
  grainOpacity = DEFAULT_GRAIN_OPACITY,
  wallpaperOpacity = DEFAULT_WALLPAPER_OPACITY,
  wallpaperBlendMode: WallpaperBlendMode = DEFAULT_WALLPAPER_BLEND_MODE,
  bevelEmboss: BevelEmboss = DEFAULT_BEVEL_EMBOSS,
): string {
  return [
    ...PALETTE_KEYS.map((key) => `--${key}: ${palette[key]};`),
    `--section-stroke-opacity: ${strokeOpacity};`,
    `--grain-opacity: ${grainOpacity};`,
    `--wallpaper-opacity: ${wallpaperOpacity};`,
    `--wallpaper-blend-mode: ${wallpaperBlendMode};`,
    `--bevel-highlight-color: ${bevelEmboss.highlightColor};`,
    `--bevel-shadow-color: ${bevelEmboss.shadowColor};`,
    `--bevel-radius: ${bevelEmboss.radius}px;`,
    `--bevel-offset: ${bevelEmboss.offset}px;`,
    `--bevel-top-opacity: ${bevelEmboss.topOpacity};`,
    `--bevel-bottom-opacity: ${bevelEmboss.bottomOpacity};`,
    `--bevel-left-opacity: ${bevelEmboss.leftOpacity};`,
    `--bevel-right-opacity: ${bevelEmboss.rightOpacity};`,
    `--emboss-glow-color: ${bevelEmboss.glowColor};`,
    `--emboss-glow-opacity: ${bevelEmboss.glowOpacity};`,
    `--emboss-glow-radius: ${bevelEmboss.glowRadius}px;`,
  ].join('\n')
}
