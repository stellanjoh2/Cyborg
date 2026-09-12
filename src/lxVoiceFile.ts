import {
  cloneEqualizer,
  DEFAULT_EQUALIZER,
  mergeEqualizer,
  type EqualizerBand,
  type EqualizerBandType,
  type EqualizerState,
} from './equalizer'
import {
  DEFAULT_POST_PROCESS_UI,
  type PostProcessUiState,
} from './postProcess'
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
  postProcess: PostProcessUiState
  equalizer: EqualizerState
}

export type LxVoiceFile = {
  format: typeof LXVOICE_FORMAT
  version: typeof LXVOICE_VERSION
  name?: string
} & LxVoicePreset

const BAND_TYPES = new Set<EqualizerBandType>([
  'lowshelf',
  'peaking',
  'highshelf',
])

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseNumberMap<T extends Record<string, number>>(
  raw: unknown,
  defaults: T,
  label: string,
  options?: { optional?: boolean; requireAllKeys?: boolean },
): T {
  if (raw == null) {
    if (options?.optional) {
      return { ...defaults }
    }
    throw new Error(`Invalid .lxvoice file: missing ${label} settings.`)
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid .lxvoice file: missing ${label} settings.`)
  }

  const source = raw as Record<string, unknown>
  const next = { ...defaults }

  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = source[key as string]
    if (value === undefined) {
      if (options?.requireAllKeys) {
        throw new Error(`Invalid .lxvoice file: bad ${label}.${String(key)}.`)
      }
      continue
    }
    if (!isFiniteNumber(value)) {
      throw new Error(`Invalid .lxvoice file: bad ${label}.${String(key)}.`)
    }
    next[key] = value as T[keyof T]
  }

  return next
}

function parseVocoder(raw: unknown): VocoderUiState {
  return parseNumberMap(raw, DEFAULT_VOCODER_UI, 'vocoder', {
    requireAllKeys: true,
  })
}

function parsePostProcess(raw: unknown): PostProcessUiState {
  return parseNumberMap(raw, DEFAULT_POST_PROCESS_UI, 'postProcess', {
    optional: true,
  })
}

function parseEqualizerBand(
  raw: unknown,
  fallback: EqualizerBand,
  index: number,
): EqualizerBand {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid .lxvoice file: bad equalizer.bands[${index}].`)
  }

  const band = raw as Record<string, unknown>
  const type = band.type ?? fallback.type
  if (typeof type !== 'string' || !BAND_TYPES.has(type as EqualizerBandType)) {
    throw new Error(`Invalid .lxvoice file: bad equalizer.bands[${index}].type.`)
  }
  if (
    (band.frequency !== undefined && !isFiniteNumber(band.frequency)) ||
    (band.gain !== undefined && !isFiniteNumber(band.gain)) ||
    (band.q !== undefined && !isFiniteNumber(band.q))
  ) {
    throw new Error(`Invalid .lxvoice file: bad equalizer.bands[${index}].`)
  }

  return {
    ...fallback,
    type: type as EqualizerBandType,
    frequency: isFiniteNumber(band.frequency) ? band.frequency : fallback.frequency,
    gain: isFiniteNumber(band.gain) ? band.gain : fallback.gain,
    q: isFiniteNumber(band.q) ? band.q : fallback.q,
  }
}

function parseEqualizer(raw: unknown): EqualizerState {
  if (raw == null) {
    return cloneEqualizer()
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid .lxvoice file: missing equalizer settings.')
  }

  const source = raw as Record<string, unknown>
  if (source.enabled !== undefined && typeof source.enabled !== 'boolean') {
    throw new Error('Invalid .lxvoice file: bad equalizer.enabled.')
  }

  const bandsRaw = source.bands
  if (bandsRaw === undefined) {
    return mergeEqualizer(DEFAULT_EQUALIZER, {
      enabled:
        typeof source.enabled === 'boolean' ? source.enabled : undefined,
    })
  }
  if (!Array.isArray(bandsRaw) || bandsRaw.length !== DEFAULT_EQUALIZER.bands.length) {
    throw new Error('Invalid .lxvoice file: bad equalizer.bands.')
  }

  return {
    enabled:
      typeof source.enabled === 'boolean'
        ? source.enabled
        : DEFAULT_EQUALIZER.enabled,
    bands: DEFAULT_EQUALIZER.bands.map((fallback, index) =>
      parseEqualizerBand(bandsRaw[index], fallback, index),
    ),
  }
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
    postProcess: { ...DEFAULT_POST_PROCESS_UI, ...preset.postProcess },
    equalizer: cloneEqualizer(preset.equalizer),
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
      postProcess: parsePostProcess(file.postProcess),
      equalizer: parseEqualizer(file.equalizer),
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
