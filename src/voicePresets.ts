import type { ChunkMode } from './speechPlayback'
import type { VoiceTone } from './selectSystemVoice'
import { DEFAULT_VOCODER_UI, type VocoderUiState } from './vocoderParams'

export type VoiceId = 'default' | 'robot' | 'fast' | 'deep' | 'custom'

export interface VoicePreset {
  id: Exclude<VoiceId, 'custom'>
  label: string
  speed: number
  pitch: number
  tone: VoiceTone
  chunkMode: ChunkMode
  /** 0 = human, 100 = robot. */
  humanRobot: number
  vocoder: VocoderUiState
  /** ST Speech speed marker (%1–%127, lower is faster). */
  stSpeed: number
  /** ST Speech pitch marker (!60–!127, lower is higher pitched). */
  stPitch: number
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'default',
    label: 'Default',
    speed: 1,
    pitch: 1,
    tone: 'natural',
    chunkMode: 'single',
    humanRobot: 0,
    vocoder: DEFAULT_VOCODER_UI,
    stSpeed: 100,
    stPitch: 78,
  },
  {
    id: 'robot',
    label: 'Robot',
    speed: 0.9,
    pitch: 0.55,
    tone: 'natural',
    chunkMode: 'single',
    humanRobot: 82,
    vocoder: {
      ...DEFAULT_VOCODER_UI,
      cutoff: 78,
      resonance: 96,
      efSense: 108,
    },
    stSpeed: 112,
    stPitch: 92,
  },
  {
    id: 'fast',
    label: 'Fast',
    speed: 1.45,
    pitch: 1.12,
    tone: 'bright',
    chunkMode: 'single',
    humanRobot: 12,
    vocoder: {
      ...DEFAULT_VOCODER_UI,
      cutoff: 90,
      resonance: 28,
      efSense: 96,
    },
    stSpeed: 68,
    stPitch: 70,
  },
  {
    id: 'deep',
    label: 'Deep',
    speed: 0.72,
    pitch: 0.55,
    tone: 'deep',
    chunkMode: 'single',
    humanRobot: 18,
    vocoder: {
      ...DEFAULT_VOCODER_UI,
      cutoff: 34,
      resonance: 74,
      efSense: 40,
    },
    stSpeed: 118,
    stPitch: 98,
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
  state: { speed: number; pitch: number; humanRobot: number },
): boolean {
  return (
    state.speed === preset.speed &&
    state.pitch === preset.pitch &&
    state.humanRobot === preset.humanRobot
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
    vocoder.efSense === expected.efSense
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
    vocoder: VocoderUiState
  },
): boolean {
  return (
    voiceMatches(preset, state) &&
    vocoderMatches(preset, state.vocoder) &&
    carrierMatches(preset, state.vocoder)
  )
}
