import { cloneEqualizer, type EqualizerState } from './equalizer'
import type { PostProcessUiState } from './postProcess'
import type { VocoderUiState } from './vocoderParams'
import type { VoiceId } from './voicePresets'

export const PATCH_HISTORY_LIMIT = 30
/** Coalesce continuous knob/EQ drags into one undo step. */
export const PATCH_HISTORY_COALESCE_MS = 450

export type PatchSnapshot = {
  voiceId: VoiceId
  speed: number
  pitch: number
  humanRobot: number
  formant: number
  vocoder: VocoderUiState
  postProcess: PostProcessUiState
  equalizer: EqualizerState
  masterVolume: number
  masterGain: number
}

export type PatchHistoryEntry = {
  label: string
  snapshot: PatchSnapshot
}

export function clonePatchSnapshot(snapshot: PatchSnapshot): PatchSnapshot {
  return {
    voiceId: snapshot.voiceId,
    speed: snapshot.speed,
    pitch: snapshot.pitch,
    humanRobot: snapshot.humanRobot,
    formant: snapshot.formant,
    vocoder: { ...snapshot.vocoder },
    postProcess: { ...snapshot.postProcess },
    equalizer: cloneEqualizer(snapshot.equalizer),
    masterVolume: snapshot.masterVolume,
    masterGain: snapshot.masterGain,
  }
}

export function patchSnapshotsEqual(a: PatchSnapshot, b: PatchSnapshot): boolean {
  if (
    a.voiceId !== b.voiceId ||
    a.speed !== b.speed ||
    a.pitch !== b.pitch ||
    a.humanRobot !== b.humanRobot ||
    a.formant !== b.formant ||
    a.masterVolume !== b.masterVolume ||
    a.masterGain !== b.masterGain
  ) {
    return false
  }

  for (const key of Object.keys(a.vocoder) as (keyof VocoderUiState)[]) {
    if (a.vocoder[key] !== b.vocoder[key]) return false
  }
  for (const key of Object.keys(a.postProcess) as (keyof PostProcessUiState)[]) {
    if (a.postProcess[key] !== b.postProcess[key]) return false
  }

  if (a.equalizer.enabled !== b.equalizer.enabled) return false
  if (a.equalizer.bands.length !== b.equalizer.bands.length) return false
  for (let i = 0; i < a.equalizer.bands.length; i++) {
    const left = a.equalizer.bands[i]
    const right = b.equalizer.bands[i]
    if (
      left.type !== right.type ||
      left.frequency !== right.frequency ||
      left.gain !== right.gain ||
      left.q !== right.q
    ) {
      return false
    }
  }

  return true
}

export const VOCODER_HISTORY_LABELS: Record<keyof VocoderUiState, string> = {
  cutoff: 'Cutoff',
  resonance: 'Resonance',
  efSense: 'E.F. sense',
  unvoice: 'Unvoice',
  carrierAmount: 'Carrier amount',
  carrierMix: 'SAW/SQR',
  carrierCutoff: 'Carrier tone',
  carrierResonance: 'Carrier reso',
}

export const POST_HISTORY_LABELS: Record<keyof PostProcessUiState, string> = {
  noiseAmount: 'White noise',
  noisePitch: 'Noise pitch',
  noiseTone: 'Noise tone',
  bitcrushAmount: 'Bitcrush',
  bitcrushBits: 'Bitcrush bits',
  bitcrushRate: 'Bitcrush rate',
  reverbAmount: 'Reverb',
  reverbRoomSize: 'Reverb size',
  reverbDecay: 'Reverb decay',
  delayAmount: 'Delay',
  delayLength: 'Delay length',
  delayFeedback: 'Delay feedback',
  radioAmount: 'Radio',
  radioTone: 'Radio tone',
  radioGrit: 'Radio grit',
  chorusAmount: 'Chorus',
  chorusRate: 'Chorus rate',
  chorusDepth: 'Chorus depth',
  compressorAmount: 'Compressor',
  compressorAttack: 'Comp attack',
  compressorRelease: 'Comp release',
  distortionAmount: 'Distortion',
  distortionDrive: 'Distortion drive',
  distortionTone: 'Distortion tone',
}
