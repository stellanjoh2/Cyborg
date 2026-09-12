import type { VoiceId } from '@diffusionstudio/vits-web'
import { decodeWavBlobToSpeechSamples } from './decodeWavSamples'
import {
  DEFAULT_PIPER_VOICE,
  type PiperVoiceId,
  readPiperVoice,
} from './piperVoices'

const readyPromises = new Map<PiperVoiceId, Promise<void>>()
let renderedCache:
  | { voiceId: PiperVoiceId; text: string; samples: Float32Array }
  | undefined

async function loadPiper() {
  return import('@diffusionstudio/vits-web')
}

/**
 * Prefetch / warm a Piper voice.
 *
 * Do not use vits-web's `download()` for this: it resolves when the HTTP fetch
 * finishes but does not await the OPFS write, so a following `predict` can read
 * a truncated model and fail. `predict` awaits the write before returning.
 */
export async function ensurePiperReady(
  voiceId: PiperVoiceId = readPiperVoice(),
): Promise<void> {
  let readyPromise = readyPromises.get(voiceId)
  if (!readyPromise) {
    readyPromise = (async () => {
      const tts = await loadPiper()
      await tts.predict({
        text: '.',
        voiceId: voiceId as VoiceId,
      })
    })().catch((error) => {
      readyPromises.delete(voiceId)
      throw error
    })
    readyPromises.set(voiceId, readyPromise)
  }
  await readyPromise
}

/** Neural Piper TTS — strongest natural English of the available engines. */
export async function renderPiperSamples(
  text: string,
  voiceId: PiperVoiceId = DEFAULT_PIPER_VOICE,
): Promise<Float32Array | null> {
  if (renderedCache?.voiceId === voiceId && renderedCache.text === text) {
    return renderedCache.samples
  }

  try {
    // Wait out any in-flight prefetch so we don't race OPFS writes.
    const readyPromise = readyPromises.get(voiceId)
    if (readyPromise) {
      await readyPromise
    }

    const tts = await loadPiper()
    const wav = await tts.predict({
      text,
      voiceId: voiceId as VoiceId,
    })

    if (!readyPromises.has(voiceId)) {
      readyPromises.set(voiceId, Promise.resolve())
    }

    const samples = await decodeWavBlobToSpeechSamples(wav)
    if (!samples) return null
    renderedCache = { voiceId, text, samples }
    return samples
  } catch {
    return null
  }
}
