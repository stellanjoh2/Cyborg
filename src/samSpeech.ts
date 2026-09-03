import SamJs from 'sam-js'
import { classicTextToPhonemes } from './samClassicReciter'
import {
  cancelMetallicPlayback,
  DEFAULT_POST_PROCESS,
  mergePostProcess,
  renderSynthOffline,
  startSynthPlayback,
  setSynthLoop,
  stopSynthPlayback,
  updateLiveSynthParams,
  type LiveSynthParams,
  type PostProcessParams,
  type VocoderParams,
} from './speechSynthEngine'
import { DEFAULT_VOCODER_PARAMS } from './vocoderParams'
import { prepareSamPhoneticText } from './samPronunciation'
import {
  downloadBlob,
  encodeAudioBufferToWav,
  makeSpeechFilename,
} from './wavEncode'

export interface SamSynthOptions {
  text: string
  speed: number
  pitch: number
  metallic: number
  betterEnglish?: boolean
}

function mapUiSpeedToSam(speed: number): number {
  return Math.round(Math.min(255, Math.max(40, 50 + speed * 45)))
}

function mapUiPitchToSam(pitch: number): number {
  return Math.round(Math.min(200, Math.max(20, 25 + pitch * 75)))
}

function mapMetallicToFormants(metallic: number): { mouth: number; throat: number } {
  const natural = { mouth: 128, throat: 128 }
  const robotic = { mouth: 200, throat: 195 }
  return {
    mouth: Math.round(natural.mouth + metallic * (robotic.mouth - natural.mouth)),
    throat: Math.round(
      natural.throat + metallic * (robotic.throat - natural.throat),
    ),
  }
}

export async function renderSamSamples(
  options: SamSynthOptions,
): Promise<Float32Array | null> {
  const metallic = Math.min(Math.max(options.metallic, 0), 1)
  const pitch = Math.min(Math.max(options.pitch, 0), 2)
  const formants = mapMetallicToFormants(metallic)
  const useBetterEnglish = options.betterEnglish ?? true

  let phoneticText = options.text
  let phoneticMode = false

  if (useBetterEnglish) {
    try {
      phoneticText = await prepareSamPhoneticText(options.text)
      phoneticMode = true
    } catch {
      phoneticText = classicTextToPhonemes(options.text)
      phoneticMode = true
    }
  }

  const sam = new SamJs({
    speed: mapUiSpeedToSam(options.speed),
    pitch: mapUiPitchToSam(pitch),
    mouth: formants.mouth,
    throat: formants.throat,
  })

  const buffer = sam.buf32(phoneticText, phoneticMode)
  return buffer instanceof Float32Array ? buffer : null
}

export function cancelSamSpeech() {
  cancelMetallicPlayback()
}

export function setSamLoop(enabled: boolean) {
  setSynthLoop(enabled)
}

export function updateSamLiveParams(params: Partial<LiveSynthParams>) {
  updateLiveSynthParams(params)
}

export function stopSamSpeech() {
  stopSynthPlayback()
}

export interface SamSpeakOptions extends SamSynthOptions {
  vocoder?: VocoderParams
  postProcess?: PostProcessParams
  loop?: boolean
  onEnd?: () => void
  onError?: (message: string) => void
}

function normalizeVocoder(vocoder?: VocoderParams): VocoderParams {
  return {
    formantShift:
      vocoder?.formantShift ?? DEFAULT_VOCODER_PARAMS.formantShift,
    cutoff: vocoder?.cutoff ?? DEFAULT_VOCODER_PARAMS.cutoff,
    resonance: vocoder?.resonance ?? DEFAULT_VOCODER_PARAMS.resonance,
    efSense: vocoder?.efSense ?? DEFAULT_VOCODER_PARAMS.efSense,
    carrierAmount:
      vocoder?.carrierAmount ?? DEFAULT_VOCODER_PARAMS.carrierAmount,
    carrierMix: vocoder?.carrierMix ?? DEFAULT_VOCODER_PARAMS.carrierMix,
    carrierCutoff:
      vocoder?.carrierCutoff ?? DEFAULT_VOCODER_PARAMS.carrierCutoff,
    carrierResonance:
      vocoder?.carrierResonance ?? DEFAULT_VOCODER_PARAMS.carrierResonance,
    bands: (vocoder?.bands ?? DEFAULT_VOCODER_PARAMS.bands).map((band, index) => ({
      level: band.level ?? DEFAULT_VOCODER_PARAMS.bands[index]?.level ?? 100,
      pan: band.pan ?? DEFAULT_VOCODER_PARAMS.bands[index]?.pan ?? 0,
    })),
  }
}

function normalizePostProcess(
  postProcess?: PostProcessParams,
): PostProcessParams {
  return mergePostProcess(DEFAULT_POST_PROCESS, postProcess)
}

export async function exportSamWav(options: SamSpeakOptions): Promise<void> {
  const samples = await renderSamSamples(options)
  if (!samples) {
    throw new Error('Could not synthesize speech.')
  }

  const rendered = await renderSynthOffline(samples, {
    speed: options.speed,
    pitch: options.pitch,
    metallic: options.metallic,
    vocoder: normalizeVocoder(options.vocoder),
    postProcess: normalizePostProcess(options.postProcess),
  })

  const wav = encodeAudioBufferToWav(rendered)
  downloadBlob(wav, makeSpeechFilename(options.text))
}

export async function speakSam(options: SamSpeakOptions) {
  const samples = await renderSamSamples(options)
  if (!samples) {
    options.onError?.('Could not synthesize speech.')
    return
  }

  startSynthPlayback(
    samples,
    {
      speed: options.speed,
      pitch: options.pitch,
      metallic: options.metallic,
      vocoder: normalizeVocoder(options.vocoder),
      postProcess: normalizePostProcess(options.postProcess),
    },
    {
      loop: options.loop,
      onEnd: options.onEnd,
      onError: options.onError,
    },
  )
}
