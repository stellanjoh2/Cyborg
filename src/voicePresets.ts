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
      bandLevels: [72, 82, 98, 112, 120, 118, 104, 86],
      bandPans: [40, 86, 34, 92, 30, 96, 44, 82],
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
      bandLevels: [52, 68, 86, 104, 116, 122, 118, 110],
      bandPans: [54, 72, 50, 76, 48, 78, 56, 70],
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
      bandLevels: [124, 118, 108, 96, 78, 58, 42, 28],
      bandPans: [58, 68, 60, 66, 63, 63, 63, 63],
    },
    stSpeed: 118,
    stPitch: 98,
  },
]

export function getPresetById(id: Exclude<VoiceId, 'custom'>): VoicePreset {
  return VOICE_PRESETS.find((preset) => preset.id === id)!
}
