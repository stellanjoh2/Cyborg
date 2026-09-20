import type { Progress, VoiceId } from '@diffusionstudio/vits-web'
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

export type PiperInitEvent =
  | {
      type: 'progress'
      percent: number
      loadedBytes: number
      totalBytes: number
    }
  | { type: 'done' }

type PiperInitListener = (event: PiperInitEvent) => void

const initListeners = new Set<PiperInitListener>()
/**
 * Armed only when vits-web reports ONNX fetch progress.
 * OPFS / memory hits never call that callback — overlay stays closed.
 */
let initUiEnabled = false
let lastDownloadTotal = 0

export function subscribePiperInit(
  listener: PiperInitListener,
): () => void {
  initListeners.add(listener)
  return () => {
    initListeners.delete(listener)
  }
}

/** Hide the init overlay (e.g. user cancelled) without aborting the download. */
export function dismissPiperInitUi() {
  initUiEnabled = false
  emitInit({ type: 'done' })
}

function emitInit(event: PiperInitEvent) {
  if (event.type === 'progress' && !initUiEnabled) return
  for (const listener of initListeners) {
    listener(event)
  }
}

function emitProgress(
  percent: number,
  loadedBytes: number,
  totalBytes: number,
) {
  emitInit({
    type: 'progress',
    percent,
    loadedBytes,
    totalBytes,
  })
}

/** Only fires during a real HTTP fetch of the ONNX (not OPFS cache reads). */
function reportModelProgress(progress: Progress) {
  if (!(progress.total > 0)) return
  if (!initUiEnabled) {
    initUiEnabled = true
  }
  lastDownloadTotal = progress.total
  const modelFrac = Math.min(1, Math.max(0, progress.loaded / progress.total))
  emitProgress(Math.min(99, modelFrac * 100), progress.loaded, progress.total)
}

function finishInitUi() {
  if (initUiEnabled) {
    const total = lastDownloadTotal > 0 ? lastDownloadTotal : 1
    emitProgress(100, total, total)
  }
  initUiEnabled = false
  emitInit({ type: 'done' })
}

async function loadPiper() {
  return import('@diffusionstudio/vits-web')
}

async function warmPiperVoice(voiceId: PiperVoiceId): Promise<void> {
  initUiEnabled = false
  lastDownloadTotal = 0
  const tts = await loadPiper()
  await tts.predict(
    {
      text: '.',
      voiceId: voiceId as VoiceId,
    },
    reportModelProgress,
  )
  finishInitUi()
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
    readyPromise = warmPiperVoice(voiceId).catch((error) => {
      readyPromises.delete(voiceId)
      initUiEnabled = false
      emitInit({ type: 'done' })
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
    const needsWarmProgress = !readyPromises.has(voiceId)
    if (needsWarmProgress) {
      initUiEnabled = false
      lastDownloadTotal = 0
    }
    const wav = await tts.predict(
      {
        text,
        voiceId: voiceId as VoiceId,
      },
      needsWarmProgress ? reportModelProgress : undefined,
    )

    if (needsWarmProgress) {
      readyPromises.set(voiceId, Promise.resolve())
      finishInitUi()
    }

    const samples = await decodeWavBlobToSpeechSamples(wav)
    if (!samples) return null
    renderedCache = { voiceId, text, samples }
    return samples
  } catch {
    initUiEnabled = false
    emitInit({ type: 'done' })
    return null
  }
}
