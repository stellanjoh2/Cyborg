export const PALETTE_KEYS = [
  'text',
  'muted',
  'black',
  'fill',
  'stroke',
  'lime',
  'purple',
  'blue',
  'pink',
] as const

export type PaletteKey = (typeof PALETTE_KEYS)[number]
export type Palette = Record<PaletteKey, string>

export const DEFAULT_PALETTE: Palette = {
  text: '#FFFFFF',
  muted: '#6E6E6E',
  black: '#0E0E0E',
  fill: '#131313',
  stroke: '#FFFFFF',
  lime: '#FFC800',
  purple: '#3B00FF',
  blue: '#00C4FF',
  pink: '#FF00C4',
}

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  text: 'text primary',
  muted: 'text secondary',
  black: 'background',
  fill: 'surface',
  stroke: 'border',
  lime: 'accent',
  purple: 'accent secondary',
  blue: 'accent tertiary',
  pink: 'error',
}

export const DEFAULT_STROKE_OPACITY = 0.1

const HEX = /^#[0-9a-fA-F]{6}$/

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
  const next = Math.min(1, Math.max(0, opacity))
  document.documentElement.style.setProperty(
    '--section-stroke-opacity',
    String(next),
  )
}

export function formatPalette(
  palette: Palette,
  strokeOpacity = DEFAULT_STROKE_OPACITY,
): string {
  return [
    ...PALETTE_KEYS.map((key) => `--${key}: ${palette[key]};`),
    `--section-stroke-opacity: ${strokeOpacity};`,
  ].join('\n')
}
