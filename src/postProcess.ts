import type { PostProcessParams } from './speechSynthEngine'

export interface PostProcessUiState {
  noiseAmount: number
  noisePitch: number
  noiseTone: number
  reverbAmount: number
  reverbRoomSize: number
  reverbDecay: number
  delayAmount: number
  delayLength: number
  delayFeedback: number
  bitcrushAmount: number
  bitcrushBits: number
  bitcrushRate: number
  radioAmount: number
  radioTone: number
  radioGrit: number
  chorusAmount: number
  chorusRate: number
  chorusDepth: number
  compressorAmount: number
  compressorAttack: number
  compressorRelease: number
}

export const DEFAULT_POST_PROCESS_UI: PostProcessUiState = {
  noiseAmount: 0,
  noisePitch: 50,
  noiseTone: 55,
  reverbAmount: 0,
  reverbRoomSize: 45,
  reverbDecay: 50,
  delayAmount: 0,
  delayLength: 35,
  delayFeedback: 40,
  bitcrushAmount: 0,
  bitcrushBits: 45,
  bitcrushRate: 25,
  radioAmount: 0,
  radioTone: 55,
  radioGrit: 40,
  chorusAmount: 0,
  chorusRate: 35,
  chorusDepth: 45,
  compressorAmount: 0,
  compressorAttack: 25,
  compressorRelease: 40,
}

function slider(value: number): number {
  return Math.min(Math.max(value, 0), 100) / 100
}

export function mapUiToPostProcess(ui: PostProcessUiState): PostProcessParams {
  return {
    noise: {
      amount: slider(ui.noiseAmount),
      pitch: slider(ui.noisePitch),
      tone: slider(ui.noiseTone),
    },
    reverb: {
      amount: slider(ui.reverbAmount),
      roomSize: slider(ui.reverbRoomSize),
      decay: slider(ui.reverbDecay),
    },
    delay: {
      amount: slider(ui.delayAmount),
      length: slider(ui.delayLength),
      feedback: slider(ui.delayFeedback),
    },
    bitcrush: {
      amount: slider(ui.bitcrushAmount),
      bits: slider(ui.bitcrushBits),
      rate: slider(ui.bitcrushRate),
    },
    radio: {
      amount: slider(ui.radioAmount),
      tone: slider(ui.radioTone),
      grit: slider(ui.radioGrit),
    },
    chorus: {
      amount: slider(ui.chorusAmount),
      rate: slider(ui.chorusRate),
      depth: slider(ui.chorusDepth),
    },
    compressor: {
      amount: slider(ui.compressorAmount),
      attack: slider(ui.compressorAttack),
      release: slider(ui.compressorRelease),
    },
  }
}

export function formatNoisePitch(sliderValue: number): string {
  const rate = 0.35 + slider(sliderValue) * 2.15
  return `${rate.toFixed(2)}×`
}

export function formatNoiseTone(sliderValue: number): string {
  const hz = Math.round(250 * 2 ** (slider(sliderValue) * 4.2))
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`
  }
  return `${hz} Hz`
}

export function formatReverbRoomSize(sliderValue: number): string {
  const seconds = 0.35 + slider(sliderValue) * 3.65
  return `${seconds.toFixed(1)} s`
}

export function formatReverbDecay(sliderValue: number): string {
  const tailSeconds = 0.4 + slider(sliderValue) * 3.2
  return `${tailSeconds.toFixed(1)} s tail`
}

export function formatDelayLength(sliderValue: number): string {
  const ms = Math.round(40 + slider(sliderValue) ** 1.35 * 760)
  return `${ms} ms`
}

export function formatDelayFeedback(sliderValue: number): string {
  const percent = Math.round(slider(sliderValue) * 88)
  return `${percent}%`
}

export function formatBitcrushBits(sliderValue: number): string {
  const bits = 16 - slider(sliderValue) * 14
  return `${bits.toFixed(1)} bit`
}

export function formatBitcrushRate(sliderValue: number): string {
  const downsample = 1 + slider(sliderValue) ** 1.2 * 23
  return `${downsample.toFixed(1)}×`
}

export function formatChorusRate(sliderValue: number): string {
  const hz = 0.15 + slider(sliderValue) * 3.2
  return `${hz.toFixed(2)} Hz`
}

export function formatChorusDepth(sliderValue: number): string {
  return `${Math.round(slider(sliderValue) * 100)}%`
}

export function formatCompressorAttack(sliderValue: number): string {
  const ms = 1 + slider(sliderValue) ** 1.4 * 79
  return `${Math.round(ms)} ms`
}

export function formatCompressorRelease(sliderValue: number): string {
  const ms = 40 + slider(sliderValue) ** 1.2 * 560
  return `${Math.round(ms)} ms`
}
