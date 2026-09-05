import { DEFAULT_VOCODER_UI, type VocoderUiState } from './vocoderParams'

export type VoiceId = 'default' | 'robot' | 'fast' | 'deep' | 'custom'

export interface VoicePreset {
  id: Exclude<VoiceId, 'custom'>
  label: string
  speed: number
  pitch: number
  /** 0 = human, 100 = robot. */
  humanRobot: number
  /** 0–100; 50 = neutral. Shifts vocoder filter-bank formants. */
  formant: number
  vocoder: VocoderUiState
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'default',
    label: 'Default',
    speed: 1,
    pitch: 1,
    humanRobot: 0,
    formant: 50,
    vocoder: DEFAULT_VOCODER_UI,
  },
  {
    id: 'robot',
    label: 'Robot',
    speed: 0.9,
    pitch: 0.55,
    humanRobot: 82,
    formant: 76,
    vocoder: {
      ...DEFAULT_VOCODER_UI,
      cutoff: 78,
      resonance: 96,
      efSense: 108,
      unvoice: 36,
      carrierMix: 58,
      carrierCutoff: 72,
      carrierResonance: 48,
    },
  },
  {
    id: 'fast',
    label: 'Fast',
    speed: 1.45,
    pitch: 1.12,
    humanRobot: 12,
    formant: 48,
    vocoder: {
      ...DEFAULT_VOCODER_UI,
      cutoff: 90,
      resonance: 28,
      efSense: 96,
      unvoice: 22,
      carrierMix: 16,
      carrierCutoff: 82,
      carrierResonance: 18,
    },
  },
  {
    id: 'deep',
    label: 'Deep',
    speed: 0.72,
    pitch: 0.42,
    humanRobot: 18,
    formant: 62,
    vocoder: {
      ...DEFAULT_VOCODER_UI,
      cutoff: 34,
      resonance: 74,
      efSense: 40,
      unvoice: 12,
      carrierMix: 42,
      carrierCutoff: 36,
      carrierResonance: 58,
    },
  },
]

export function getPresetById(id: Exclude<VoiceId, 'custom'>): VoicePreset {
  return VOICE_PRESETS.find((preset) => preset.id === id)!
}

function cloneVocoder(vocoder: VocoderUiState): VocoderUiState {
  return {
    ...DEFAULT_VOCODER_UI,
    ...vocoder,
  }
}

export function clonePresetVocoder(preset: VoicePreset): VocoderUiState {
  return cloneVocoder(preset.vocoder)
}

export function voiceMatches(
  preset: VoicePreset,
  state: { speed: number; pitch: number; humanRobot: number; formant: number },
): boolean {
  return (
    state.speed === preset.speed &&
    state.pitch === preset.pitch &&
    state.humanRobot === preset.humanRobot &&
    state.formant === preset.formant
  )
}

export function vocoderMatches(
  preset: VoicePreset,
  vocoder: VocoderUiState,
): boolean {
  const expected = cloneVocoder(preset.vocoder)
  return (
    vocoder.cutoff === expected.cutoff &&
    vocoder.resonance === expected.resonance &&
    vocoder.efSense === expected.efSense &&
    vocoder.unvoice === expected.unvoice
  )
}

export function carrierMatches(
  preset: VoicePreset,
  vocoder: VocoderUiState,
): boolean {
  const expected = cloneVocoder(preset.vocoder)
  return (
    vocoder.carrierAmount === expected.carrierAmount &&
    vocoder.carrierMix === expected.carrierMix &&
    vocoder.carrierCutoff === expected.carrierCutoff &&
    vocoder.carrierResonance === expected.carrierResonance
  )
}

export function presetMatches(
  preset: VoicePreset,
  state: {
    speed: number
    pitch: number
    humanRobot: number
    formant: number
    vocoder: VocoderUiState
  },
): boolean {
  return (
    voiceMatches(preset, state) &&
    vocoderMatches(preset, state.vocoder) &&
    carrierMatches(preset, state.vocoder)
  )
}
