export const PALETTE_KEYS = [
  'ega-black',
  'ega-blue',
  'ega-cyan',
  'ega-red',
  'ega-magenta',
  'ega-gray',
  'ega-bright-magenta',
  'ega-yellow',
  'ega-white',
] as const

export type PaletteKey = (typeof PALETTE_KEYS)[number]
export type Palette = Record<PaletteKey, string>

export const DEFAULT_PALETTE: Palette = {
  'ega-black': '#000000',
  'ega-blue': '#0000aa',
  'ega-cyan': '#00aaaa',
  'ega-red': '#aa0000',
  'ega-magenta': '#aa00aa',
  'ega-gray': '#aaaaaa',
  'ega-bright-magenta': '#ff55ff',
  'ega-yellow': '#ffff55',
  'ega-white': '#ffffff',
}

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  'ega-black': 'black',
  'ega-blue': 'blue',
  'ega-cyan': 'cyan',
  'ega-red': 'red',
  'ega-magenta': 'magenta',
  'ega-gray': 'gray',
  'ega-bright-magenta': 'bright magenta',
  'ega-yellow': 'yellow',
  'ega-white': 'white',
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: string): boolean {
  return HEX.test(value)
}

export function applyPalette(palette: Palette) {
  const root = document.documentElement
  for (const key of PALETTE_KEYS) {
    root.style.setProperty(`--${key}`, palette[key])
  }
}

export function formatPalette(palette: Palette): string {
  return PALETTE_KEYS.map((key) => `--${key}: ${palette[key]};`).join('\n')
}
