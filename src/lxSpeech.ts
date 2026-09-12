import {
  prepareArpabetTokens,
  type ArpabetToken,
} from './cmuPronunciation'
import {
  LX_PHONEMES,
  type LxFormant,
  type LxPhoneme,
} from './lxPhonemes'

export const LX_SAMPLE_RATE = 22050
const LX_CLARITY_BOOST = 1.25

export interface LxSpeechOptions {
  text: string
  speed: number
  pitch: number
  metallic: number
}

interface ResonatorState {
  y1: number
  y2: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resonator(
  input: number,
  frequency: number,
  bandwidth: number,
  state: ResonatorState,
): number {
  const hz = clamp(frequency, 40, LX_SAMPLE_RATE * 0.46)
  const radius = Math.exp((-Math.PI * Math.max(30, bandwidth)) / LX_SAMPLE_RATE)
  const coefficient = 2 * radius * Math.cos((2 * Math.PI * hz) / LX_SAMPLE_RATE)
  const output =
    input * (1 - radius) + coefficient * state.y1 - radius * radius * state.y2
  state.y2 = state.y1
  state.y1 = output
  return output
}

function interpolateFormant(
  current: LxFormant,
  adjacent: LxFormant | undefined,
  amount: number,
): LxFormant {
  if (!adjacent || amount <= 0) return current
  return {
    frequency:
      current.frequency + (adjacent.frequency - current.frequency) * amount,
    bandwidth:
      current.bandwidth + (adjacent.bandwidth - current.bandwidth) * amount,
    gain: current.gain + (adjacent.gain - current.gain) * amount,
  }
}

function adjacentDefinition(
  tokens: ArpabetToken[],
  index: number,
  direction: -1 | 1,
): LxPhoneme | undefined {
  for (let cursor = index + direction; cursor >= 0 && cursor < tokens.length; cursor += direction) {
    const token = tokens[cursor]
    if (token.kind === 'pause') return undefined
    const definition = LX_PHONEMES[token.phoneme]
    if (definition) return definition
  }
  return undefined
}

function phonemeEnvelope(
  progress: number,
  definition: LxPhoneme,
): number {
  if (definition.transient) {
    if (progress < 0.55) return 0.025
    const burst = (progress - 0.55) / 0.45
    return Math.sin(Math.PI * clamp(burst, 0, 1)) ** 0.55
  }
  const attack = Math.min(1, progress / 0.08)
  const release = Math.min(1, (1 - progress) / 0.1)
  return Math.sin((Math.PI / 2) * attack) * Math.sin((Math.PI / 2) * release)
}

function durationSamples(token: ArpabetToken, speed: number): number {
  const speedFactor = 0.62 + clamp(speed, 0, 2) * 0.48
  const durationMs = token.kind === 'pause'
    ? token.durationMs
    : (LX_PHONEMES[token.phoneme]?.durationMs ?? 85)
      * (token.stress === 1 ? 1.16 : token.stress === 2 ? 1.08 : 1)
  return Math.max(1, Math.round((durationMs / speedFactor / 1000) * LX_SAMPLE_RATE))
}

function makeExcitation(
  phase: number,
  subPhase: number,
  metallic: number,
): number {
  const saw = phase * 2 - 1
  const pulseWidth = 0.16 - metallic * 0.09
  const pulse = phase < pulseWidth ? 1 : -pulseWidth / (1 - pulseWidth)
  const sub = subPhase < 0.5 ? 1 : -1
  return saw * (0.66 - metallic * 0.31)
    + pulse * (0.2 + metallic * 0.52)
    + sub * (0.14 + metallic * 0.08)
}

function clarifyAndNormalize(samples: Float32Array): Float32Array {
  let previousInput = 0
  let previousOutput = 0
  let previousBlocked = 0
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) {
    const input = samples[index]
    const blocked = input - previousInput + 0.995 * previousOutput
    const output = blocked - 0.45 * previousBlocked
    samples[index] = output
    previousInput = input
    previousOutput = blocked
    previousBlocked = blocked
    peak = Math.max(peak, Math.abs(output))
  }

  if (peak < 1e-7) return samples
  const gain = 0.94 / peak
  const fadeSamples = Math.min(Math.round(LX_SAMPLE_RATE * 0.012), samples.length / 2)
  for (let index = 0; index < samples.length; index += 1) {
    const edge = Math.min(1, index / fadeSamples, (samples.length - 1 - index) / fadeSamples)
    samples[index] = Math.tanh(samples[index] * gain * 1.4) * 0.94 * edge
  }
  return samples
}

export async function renderLxSamples(
  options: LxSpeechOptions,
): Promise<Float32Array | null> {
  const tokens = await prepareArpabetTokens(options.text)
  if (!tokens.some((token) => token.kind === 'phoneme')) return null

  const speed = clamp(options.speed, 0, 2)
  const pitch = clamp(options.pitch, 0, 2)
  const metallic = clamp(options.metallic, 0, 1)
  // LX remains a machine voice at the Human end of the shared control.
  // The upper half adds harder pulse excitation and pitch quantization.
  const sourceMetallic = 0.5 + metallic * 0.5
  const lengths = tokens.map((token) => durationSamples(token, speed))
  const samples = new Float32Array(lengths.reduce((sum, length) => sum + length, 0))

  const formantStates: ResonatorState[] = Array.from(
    { length: 3 },
    () => ({ y1: 0, y2: 0 }),
  )
  const noiseState: ResonatorState = { y1: 0, y2: 0 }
  let phase = 0
  let subPhase = 0
  let outputIndex = 0

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    const length = lengths[tokenIndex]
    if (token.kind === 'pause') {
      for (const state of formantStates) {
        state.y1 = 0
        state.y2 = 0
      }
      noiseState.y1 = 0
      noiseState.y2 = 0
      outputIndex += length
      continue
    }

    const definition = LX_PHONEMES[token.phoneme]
    if (!definition) {
      outputIndex += length
      continue
    }
    const previous = adjacentDefinition(tokens, tokenIndex, -1)
    const next = adjacentDefinition(tokens, tokenIndex, 1)
    const stressPitch = token.stress === 1 ? 1.035 : token.stress === 2 ? 1.018 : 1

    for (let localIndex = 0; localIndex < length; localIndex += 1) {
      const progress = localIndex / Math.max(1, length - 1)
      const contour = 1 + (0.5 - progress) * 0.028 * (1 - sourceMetallic)
      // Match the shared vocoder carrier so LX's residual voiced path reinforces
      // the same harmonic series instead of producing an unrelated beating note.
      let fundamental = 55 * 2 ** pitch * stressPitch * contour
      if (sourceMetallic > 0.35) {
        const semitones = Math.round(12 * Math.log2(fundamental / 55))
        const quantized = 55 * 2 ** (semitones / 12)
        fundamental +=
          (quantized - fundamental) * ((sourceMetallic - 0.35) / 0.65)
      }

      phase = (phase + fundamental / LX_SAMPLE_RATE) % 1
      subPhase = (subPhase + fundamental / (2 * LX_SAMPLE_RATE)) % 1
      const excitation = makeExcitation(phase, subPhase, sourceMetallic)
      let voicedOutput = 0

      for (let formantIndex = 0; formantIndex < definition.formants.length; formantIndex += 1) {
        const target = definition.formants[formantIndex]
        let formant = target
        if (progress < 0.16 && previous?.formants.length) {
          formant = interpolateFormant(target, previous.formants[formantIndex], (0.16 - progress) / 0.16)
        } else if (progress > 0.78 && next?.formants.length) {
          formant = interpolateFormant(target, next.formants[formantIndex], (progress - 0.78) / 0.22)
        }
        voicedOutput += resonator(
          excitation,
          formant.frequency * 1.35,
          formant.bandwidth * (1 - sourceMetallic * 0.38),
          formantStates[formantIndex],
        ) * formant.gain * (formantIndex === 0 ? 1 : LX_CLARITY_BOOST)
      }

      let noiseOutput = 0
      if (definition.noise) {
        noiseOutput = resonator(
          excitation * 0.55,
          definition.noise.frequency,
          definition.noise.bandwidth,
          noiseState,
        ) * definition.noise.gain * LX_CLARITY_BOOST
      }

      const envelope = phonemeEnvelope(progress, definition)
      samples[outputIndex] =
        (voicedOutput * definition.voiced + noiseOutput) * definition.gain * envelope
      outputIndex += 1
    }
  }

  return clarifyAndNormalize(samples)
}
