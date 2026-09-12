import SamJs from 'sam-js'
import { classicTextToPhonemes } from './samClassicReciter'
import {
  cancelMetallicPlayback,
  DEFAULT_MASTER_GAIN_DB,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_POST_PROCESS,
  mergePostProcess,
  renderSynthOffline,
  replaceSynthSamples,
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
  DEFAULT_VOICE_ENGINE,
  type VoiceEngineId,
} from './voiceEngines'
import type { EspeakVoiceId } from './espeakVoices'
import type { PiperVoiceId } from './piperVoices'
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
  engine?: VoiceEngineId
  piperVoice?: PiperVoiceId
  espeakVoice?: EspeakVoiceId
  betterEnglish?: boolean
}

function mapUiSpeedToSam(speed: number): number {
  return Math.round(Math.min(255, Math.max(40, 50 + speed * 45)))
}

function mapUiPitchToSam(pitch: number): number {
  return Math.round(Math.min(200, Math.max(20, 25 + pitch * 75)))
}

function mapMetallicToMouth(metallic: number): number {
  const natural = 128
  const robotic = 200
  return Math.round(natural + metallic * (robotic - natural))
}

async function renderSamEngineSamples(
  options: SamSynthOptions,
): Promise<Float32Array | null> {
  const metallic = Math.min(Math.max(options.metallic, 0), 1)
  const pitch = Math.min(Math.max(options.pitch, 0), 2)
  const mouth = mapMetallicToMouth(metallic)
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
    mouth,
    throat: 128,
  })

  const buffer = sam.buf32(phoneticText, phoneticMode)
  return buffer instanceof Float32Array ? buffer : null
}

export async function renderSamSamples(
  options: SamSynthOptions,
): Promise<Float32Array | null> {
  const engine = options.engine ?? DEFAULT_VOICE_ENGINE
  if (engine === 'piper') {
    const { renderPiperSamples } = await import('./piperSpeech')
    return renderPiperSamples(options.text, options.piperVoice)
  }
  if (engine === 'espeak') {
    const { renderEspeakSamples } = await import('./espeakSpeech')
    return renderEspeakSamples(options.text, options.espeakVoice)
  }
  if (engine === 'lx') {
    const { renderLxSamples } = await import('./lxSpeech')
    return renderLxSamples(options)
  }
  try {
    return await renderSamEngineSamples(options)
  } catch {
    return null
  }
}

let liveBakeEpoch = 0
let speakEpoch = 0

export function cancelSamSpeech() {
  speakEpoch += 1
  liveBakeEpoch += 1
  cancelMetallicPlayback()
}

export function setSamLoop(enabled: boolean) {
  setSynthLoop(enabled)
}

export function updateSamLiveParams(
  params: Partial<LiveSynthParams>,
  options?: { immediate?: boolean; applySourceRate?: boolean },
) {
  updateLiveSynthParams(params, options)
}

export function stopSamSpeech() {
  speakEpoch += 1
  liveBakeEpoch += 1
  stopSynthPlayback()
}

/** Re-synthesize SAM samples mid-playback so mouth/timbre match current voice params. */
export async function refreshSamLiveBuffer(options: SamSynthOptions) {
  const epoch = ++liveBakeEpoch
  const samples = await renderSamSamples(options)
  if (epoch !== liveBakeEpoch || !samples) {
    return
  }
  replaceSynthSamples(samples)
}

export interface SamSpeakOptions extends SamSynthOptions {
  vocoder?: VocoderParams
  postProcess?: PostProcessParams
  masterVolume?: number
  masterGainDb?: number
  loop?: boolean
  onStart?: () => void
  onEnd?: () => void
  onError?: (message: string) => void
}

function normalizeVocoder(vocoder?: VocoderParams): VocoderParams {
  return {
    formant: vocoder?.formant ?? DEFAULT_VOCODER_PARAMS.formant,
    cutoff: vocoder?.cutoff ?? DEFAULT_VOCODER_PARAMS.cutoff,
    resonance: vocoder?.resonance ?? DEFAULT_VOCODER_PARAMS.resonance,
    efSense: vocoder?.efSense ?? DEFAULT_VOCODER_PARAMS.efSense,
    unvoice: vocoder?.unvoice ?? DEFAULT_VOCODER_PARAMS.unvoice,
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

function isSafariBrowser(): boolean {
  const ua = navigator.userAgent
  return (
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Firefox|FxiOS/i.test(ua)
  )
}

function piperLoadFailedMessage(): string {
  if (isSafariBrowser()) {
    return [
      'Piper could not load in Safari.',
      '',
      'This voice downloads a model and needs browser storage Safari often lacks — especially before Safari 26, or in Private Browsing.',
      '',
      'Switch the engine to SAM in Settings (works offline, no download). Or try Chrome, Firefox, or Safari 26+. Leave Private Browsing, and check that Hugging Face and CDNs aren’t blocked.',
    ].join('\n')
  }
  return 'Piper voice failed to load. Check your network, then try again.'
}

function synthesisFailedMessage(engine: VoiceEngineId): string {
  if (engine === 'piper') {
    return piperLoadFailedMessage()
  }
  if (engine === 'espeak') {
    return 'eSpeak-NG failed to load. Try again, or switch to SAM in Settings.'
  }
  if (engine === 'lx') {
    return 'LARYNX could not synthesize that text. Please use some actual words that the machine can understand.'
  }
  return 'Could not synthesize speech. Please use some actual words that the machine can understand.'
}

export async function exportSamWav(options: SamSpeakOptions): Promise<void> {
  const samples = await renderSamSamples(options)
  if (!samples) {
    const engine = options.engine ?? DEFAULT_VOICE_ENGINE
    throw new Error(synthesisFailedMessage(engine))
  }

  const rendered = await renderSynthOffline(samples, {
    speed: options.speed,
    pitch: options.pitch,
    metallic: options.metallic,
    vocoder: normalizeVocoder(options.vocoder),
    postProcess: normalizePostProcess(options.postProcess),
    masterVolume: options.masterVolume ?? DEFAULT_MASTER_VOLUME,
    masterGainDb: options.masterGainDb ?? DEFAULT_MASTER_GAIN_DB,
  })

  const wav = encodeAudioBufferToWav(rendered)
  downloadBlob(wav, makeSpeechFilename(options.text))
}

export async function speakSam(options: SamSpeakOptions) {
  const epoch = ++speakEpoch
  const engine = options.engine ?? DEFAULT_VOICE_ENGINE
  let samples: Float32Array | null = null
  try {
    samples = await renderSamSamples(options)
  } catch (err) {
    if (epoch !== speakEpoch) {
      return
    }
    options.onError?.(
      err instanceof Error ? err.message : 'Speech synthesis failed.',
    )
    return
  }
  if (epoch !== speakEpoch) {
    return
  }
  if (!samples) {
    options.onError?.(synthesisFailedMessage(engine))
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
      masterVolume: options.masterVolume ?? DEFAULT_MASTER_VOLUME,
      masterGainDb: options.masterGainDb ?? DEFAULT_MASTER_GAIN_DB,
    },
    {
      loop: options.loop,
      onEnd: options.onEnd,
      onError: options.onError,
    },
  )
  options.onStart?.()
}
