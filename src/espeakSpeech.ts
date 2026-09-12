import { decodeWavToSpeechSamples } from './decodeWavSamples'
import {
  DEFAULT_ESPEAK_VOICE,
  type EspeakVoiceId,
  readEspeakVoice,
} from './espeakVoices'

const INPUT_PATH = '/lx01-in.txt'
const OUTPUT_PATH = '/lx01-out.wav'

let readyPromise: Promise<void> | null = null

type EspeakFactory = typeof import('espeak-ng').default

async function loadEspeak(): Promise<{ default: EspeakFactory }> {
  const url = new URL(
    'vendor/voice-runtime/espeak-ng.js',
    document.baseURI,
  ).href
  return import(/* @vite-ignore */ url) as Promise<{ default: EspeakFactory }>
}

async function synthesizeToWav(
  text: string,
  voiceId: EspeakVoiceId,
): Promise<Uint8Array> {
  const { default: ESpeakNg } = await loadEspeak()
  const module = await ESpeakNg({
    preRun: [
      (instance) => {
        instance.FS.writeFile(INPUT_PATH, text)
      },
    ],
    arguments: ['-w', OUTPUT_PATH, '-v', voiceId, '-f', INPUT_PATH],
  })
  return module.FS.readFile(OUTPUT_PATH)
}

/** Prefetch / warm the eSpeak-NG WASM runtime. */
export async function ensureEspeakReady(
  voiceId: EspeakVoiceId = readEspeakVoice(),
): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await synthesizeToWav('.', voiceId)
    })().catch((error) => {
      readyPromise = null
      throw error
    })
  }
  await readyPromise
}

/** Formant eSpeak-NG TTS — classic robotic speech in the browser. */
export async function renderEspeakSamples(
  text: string,
  voiceId: EspeakVoiceId = DEFAULT_ESPEAK_VOICE,
): Promise<Float32Array | null> {
  try {
    if (readyPromise) {
      await readyPromise
    }

    const wav = await synthesizeToWav(text, voiceId)

    if (!readyPromise) {
      readyPromise = Promise.resolve()
    }

    return decodeWavToSpeechSamples(wav)
  } catch {
    return null
  }
}
