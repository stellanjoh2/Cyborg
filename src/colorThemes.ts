import {
  applyPalette,
  DEFAULT_PALETTE,
  type Palette,
} from './devPalette'

export type ColorTheme = {
  id: string
  label: string
  /** Flat monochrome shell — no elevation/glow drop-shadows. */
  minimal?: boolean
  palette: Palette
}

const STORAGE_KEY = 'lx01-color-theme'

/** TEMP: force this theme on boot while tuning intro; set null to restore. */
const TEMP_BOOT_THEME_ID: string | null = null

/**
 * UI themes named for classic robots (Metropolis → today).
 * Each palette leans into a visual cue from that machine.
 */
export const COLOR_THEMES: ColorTheme[] = [
  {
    // Default — warm peach accent on charcoal (VU cyan is meters-only)
    id: 'lx01',
    label: 'LX01',
    palette: { ...DEFAULT_PALETTE },
  },
  {
    // Maria (Metropolis, 1927) — Art Deco brass & midnight steel
    id: 'maria',
    label: 'Maria',
    palette: {
      text: '#FFFFFF',
      muted: '#6E6E7A',
      black: '#0E0E16',
      fill: '#15151E',
      stroke: '#FFFFFF',
      lime: '#EEEE77',
      vu: '#00CC55',
      'vu-yellow': '#EEEE77',
      purple: '#0000AA',
      error: '#880000',
    },
  },
  {
    // Robby (Forbidden Planet, 1956) — amber dome & electric blue
    id: 'robby',
    label: 'Robby',
    palette: {
      text: '#FFFCFF',
      muted: '#6E6E7A',
      black: '#0E0E16',
      fill: '#15151E',
      stroke: '#FFFCFF',
      lime: '#FAEA27',
      vu: '#00A720',
      'vu-yellow': '#FAEA27',
      purple: '#002DFF',
      error: '#FF3E00',
    },
  },
  {
    // Astro Boy (1963) — manga primaries: hero yellow & jet blue
    id: 'astro',
    label: 'Astro',
    palette: {
      text: '#F8F8F8',
      muted: '#6E6E7A',
      black: '#101018',
      fill: '#16161F',
      stroke: '#F8F8F8',
      lime: '#F8B800',
      vu: '#00B800',
      'vu-yellow': '#F8B800',
      purple: '#0000FC',
      error: '#F83800',
    },
  },
  {
    // HAL 9000 (2001, 1968) — red iris heat vision on void
    id: 'hal',
    label: 'HAL',
    palette: {
      text: '#FFEE00',
      muted: '#884466',
      black: '#0A0055',
      fill: '#1A0066',
      stroke: '#FFEE00',
      lime: '#FFEE00',
      vu: '#FF5500',
      'vu-yellow': '#FFEE00',
      purple: '#880033',
      error: '#EE0000',
    },
  },
  {
    // C-3PO (1977) — dark gray chassis, protocol gold & eye yellow
    id: 'c3po',
    label: 'C-3PO',
    palette: {
      text: '#E8D9A8',
      muted: '#6E6A62',
      black: '#1A1A1A',
      fill: '#2A2A2A',
      stroke: '#D4A84B',
      lime: '#D4A84B',
      vu: '#5B9BD5',
      'vu-yellow': '#FFE14A',
      purple: '#A88830',
      error: '#C44A3A',
    },
  },
  {
    // T-800 (1984) — Terminator HUD: dark steel, white reticle & crimson
    id: 't800',
    label: 'T-800',
    palette: {
      text: '#FFFFFF',
      muted: '#5A5A5A',
      black: '#000000',
      fill: '#0E0E0E',
      stroke: '#FFFFFF',
      lime: '#E01010',
      vu: '#FFFFFF',
      'vu-yellow': '#FFB000',
      purple: '#4A1010',
      error: '#E01010',
    },
  },
  {
    // Johnny 5 (Short Circuit, 1986) — surplus olive drab
    id: 'johnny5',
    label: 'Johnny 5',
    palette: {
      text: '#9BBC0F',
      muted: '#306230',
      black: '#071821',
      fill: '#0C2418',
      stroke: '#8BAC0F',
      lime: '#8BAC0F',
      vu: '#FFD400',
      'vu-yellow': '#FF9A00',
      purple: '#306230',
      error: '#0F380F',
    },
  },
  {
    // ED-209 (RoboCop, 1987) — cold steel hull & targeting neon green
    id: 'ed209',
    label: 'ED-209',
    palette: {
      text: '#E4E8EC',
      muted: '#6A727A',
      black: '#121417',
      fill: '#1A1E22',
      stroke: '#C8D0D8',
      lime: '#00FF9C',
      vu: '#FF9A00',
      'vu-yellow': '#FFE14A',
      purple: '#3A424A',
      error: '#E02020',
    },
  },
  {
    // Data (Star Trek TNG, 1987) — black yoke, ops gold jacket & lime eyes
    id: 'data',
    label: 'Data',
    palette: {
      text: '#E8E4D0',
      muted: '#6E6A5A',
      black: '#0A0A0A',
      fill: '#1A1A18',
      stroke: '#C4A035',
      lime: '#B8D84A',
      vu: '#C4A035',
      'vu-yellow': '#F0E6A8',
      purple: '#C4A035',
      error: '#C44A3A',
    },
  },
  {
    // WALL·E (2008) — rust chassis & hazard orange
    id: 'walle',
    label: 'WALL·E',
    palette: {
      text: '#FFFFFF',
      muted: '#6E6E7A',
      black: '#101014',
      fill: '#17171E',
      stroke: '#FFFFFF',
      lime: '#FF9C52',
      vu: '#39BD18',
      'vu-yellow': '#FF9C52',
      purple: '#524AFF',
      error: '#FF3908',
    },
  },
  {
    // EVE (2008) — soft white hull & probe cyan
    id: 'eve',
    label: 'EVE',
    palette: {
      text: '#FCFCFC',
      muted: '#6E7880',
      black: '#0E1214',
      fill: '#141A1C',
      stroke: '#FCFCFC',
      lime: '#B8F818',
      vu: '#3CBCFC',
      'vu-yellow': '#F5D060',
      purple: '#F878F8',
      error: '#F87858',
    },
  },
  {
    // Ultron (2015) — crimson neural net on violet void
    id: 'ultron',
    label: 'Ultron',
    palette: {
      text: '#DFFF00',
      muted: '#8A4A8A',
      black: '#1A001A',
      fill: '#3D0040',
      stroke: '#FF1493',
      lime: '#FF1493',
      vu: '#DFFF00',
      'vu-yellow': '#DFFF00',
      purple: '#6B006B',
      error: '#FF1493',
    },
  },
  {
    // Spot (Boston Dynamics, 2016) — safety yellow on matte black
    id: 'spot',
    label: 'Spot',
    palette: {
      text: '#F5F5F0',
      muted: '#6A6A62',
      black: '#0A0A0A',
      fill: '#1A1424',
      stroke: '#F5F5F0',
      lime: '#D4FF00',
      vu: '#FF5A00',
      'vu-yellow': '#F5F5F0',
      purple: '#9933FF',
      error: '#9933FF',
    },
  },
  // Flat / minimal — no elevation/glow shadows; grayscale trio last.
  {
    // R2-D2 (1977) — white hull plates on beige ground, panel blue
    id: 'r2d2',
    label: 'R2-D2',
    minimal: true,
    palette: {
      text: '#1A3A6E',
      muted: '#7A8494',
      black: '#EDE6DA',
      fill: '#FFFFFF',
      stroke: '#1B5AA8',
      lime: '#1B5AA8',
      vu: '#F0C420',
      'vu-yellow': '#E89420',
      purple: '#C4B8A4',
      error: '#D04040',
    },
  },
  {
    // Gort (The Day the Earth Stood Still, 1951) — polished silver monolith
    id: 'gort',
    label: 'Gort',
    minimal: true,
    palette: {
      text: '#FFFFFF',
      muted: '#808080',
      black: '#000000',
      fill: '#121212',
      stroke: '#FFFFFF',
      lime: '#FFFFFF',
      vu: '#00D4FF',
      'vu-yellow': '#C8C8C8',
      purple: '#404040',
      error: '#ff5938',
    },
  },
  {
    // Baymax (2014) — vinyl white carebot
    id: 'baymax',
    label: 'Baymax',
    minimal: true,
    palette: {
      text: '#000000',
      muted: '#808080',
      black: '#C8C8C8',
      fill: '#FFFFFF',
      stroke: '#000000',
      lime: '#000000',
      vu: '#0078D4',
      'vu-yellow': '#FF9A00',
      purple: '#404040',
      error: '#ff5938',
    },
  },
  {
    // TARS (Interstellar, 2014) — matte gunmetal utility slab
    id: 'tars',
    label: 'TARS',
    minimal: true,
    palette: {
      text: '#E8E8E8',
      muted: '#9A9A9A',
      black: '#5C5C5C',
      fill: '#787878',
      stroke: '#C0C0C0',
      lime: '#B0B0B0',
      vu: '#E8D48B',
      'vu-yellow': '#F5F5F0',
      purple: '#686868',
      error: '#ff5938',
    },
  },
]

export function getThemeById(id: string): ColorTheme {
  return COLOR_THEMES.find((theme) => theme.id === id) ?? COLOR_THEMES[0]!
}

export function readStoredThemeId(): string {
  if (
    TEMP_BOOT_THEME_ID &&
    COLOR_THEMES.some((theme) => theme.id === TEMP_BOOT_THEME_ID)
  ) {
    return TEMP_BOOT_THEME_ID
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && COLOR_THEMES.some((theme) => theme.id === raw)) {
      return raw
    }
  } catch {
    // ignore
  }
  return COLOR_THEMES[0]!.id
}

export function writeStoredThemeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // ignore
  }
}

export function applyColorTheme(theme: ColorTheme) {
  applyPalette(theme.palette)
  const root = document.documentElement
  // Thumbnail / live sphere: accent (left) + section fill (right).
  root.style.setProperty('--theme-primary', theme.palette.lime)
  root.style.setProperty('--theme-secondary', theme.palette.fill)
  root.classList.toggle('theme-minimal', Boolean(theme.minimal))
  // Accent-filled chrome (play/loop active): contrast against lime/accent.
  if (theme.minimal) {
    root.style.setProperty(
      '--on-chrome',
      theme.id === 'baymax' || theme.id === 'r2d2' ? '#FFFFFF' : '#000000',
    )
  } else if (theme.id === 't800') {
    // Crimson accent fills need light glyphs.
    root.style.setProperty('--on-chrome', '#FFFFFF')
  } else {
    root.style.removeProperty('--on-chrome')
  }
  writeStoredThemeId(theme.id)
}
