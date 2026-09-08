import { downloadBlob } from './wavEncode'
import {
  DEFAULT_VOCODER_UI,
  type VocoderUiState,
} from './vocoderParams'

export const LXVOICE_EXTENSION = '.lxvoice'
export const LXVOICE_FORMAT = 'lxvoice' as const
export const LXVOICE_VERSION = 1 as const

export type LxVoicePreset = {
  speed: number
  pitch: number
  humanRobot: number
  formant: number
  vocoder: VocoderUiState
}

export type LxVoiceFile = {
  format: typeof LXVOICE_FORMAT
  version: typeof LXVOICE_VERSION
  name?: string
} & LxVoicePreset

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseVocoder(raw: unknown): VocoderUiState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid .lxvoice file: missing vocoder settings.')
  }

  const vocoder = raw as Record<string, unknown>
  const next = { ...DEFAULT_VOCODER_UI }

  for (const key of Object.keys(DEFAULT_VOCODER_UI) as (keyof VocoderUiState)[]) {
    const value = vocoder[key]
    if (!isFiniteNumber(value)) {
      throw new Error(`Invalid .lxvoice file: bad vocoder.${key}.`)
    }
    next[key] = value
  }

  return next
}

export function buildLxVoiceFile(
  preset: LxVoicePreset,
  name?: string,
): LxVoiceFile {
  return {
    format: LXVOICE_FORMAT,
    version: LXVOICE_VERSION,
    ...(name ? { name } : {}),
    speed: preset.speed,
    pitch: preset.pitch,
    humanRobot: preset.humanRobot,
    formant: preset.formant,
    vocoder: { ...DEFAULT_VOCODER_UI, ...preset.vocoder },
  }
}

export function parseLxVoiceFile(text: string): LxVoiceFile {
  let data: unknown
  try {
    data = JSON.parse(text) as unknown
  } catch {
    throw new Error('Invalid .lxvoice file: not valid JSON.')
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid .lxvoice file.')
  }

  const file = data as Record<string, unknown>
  if (file.format !== LXVOICE_FORMAT) {
    throw new Error('Invalid .lxvoice file: wrong format.')
  }
  if (file.version !== LXVOICE_VERSION) {
    throw new Error('Unsupported .lxvoice version.')
  }
  if (
    !isFiniteNumber(file.speed) ||
    !isFiniteNumber(file.pitch) ||
    !isFiniteNumber(file.humanRobot) ||
    !isFiniteNumber(file.formant)
  ) {
    throw new Error('Invalid .lxvoice file: bad voice parameters.')
  }

  const name =
    typeof file.name === 'string' && file.name.trim()
      ? file.name.trim()
      : undefined

  return buildLxVoiceFile(
    {
      speed: file.speed,
      pitch: file.pitch,
      humanRobot: file.humanRobot,
      formant: file.formant,
      vocoder: parseVocoder(file.vocoder),
    },
    name,
  )
}

export function makeLxVoiceFilename(name?: string): string {
  const slug = (name ?? 'voice')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  return `${slug || 'voice'}${LXVOICE_EXTENSION}`
}

export function saveLxVoiceFile(file: LxVoiceFile): void {
  const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], {
    type: 'application/json',
  })
  downloadBlob(blob, makeLxVoiceFilename(file.name))
}
