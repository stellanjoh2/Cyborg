import type { VoiceId } from '@diffusionstudio/vits-web'
import { decodeWavBlobToSpeechSamples } from './decodeWavSamples'

/** Compact US English Piper voice (downloaded on first use). */
export const PIPER_VOICE_ID = 'en_US-amy-low' as VoiceId

let downloadPromise: Promise<void> | null = null

async function loadPiper() {
  return import('@diffusionstudio/vits-web')
}

export async function ensurePiperReady(): Promise<void> {
  if (!downloadPromise) {
    downloadPromise = (async () => {
      const tts = await loadPiper()
      const stored = await tts.stored()
      if (!stored.includes(PIPER_VOICE_ID)) {
        await tts.download(PIPER_VOICE_ID)
      }
    })().catch((error) => {
      downloadPromise = null
      throw error
    })
  }
  await downloadPromise
}

/** Neural Piper TTS — strongest English of the three engines. */
export async function renderPiperSamples(text: string): Promise<Float32Array | null> {
  try {
    await ensurePiperReady()
    const tts = await loadPiper()
    const wav = await tts.predict({
      text,
      voiceId: PIPER_VOICE_ID,
    })
    return decodeWavBlobToSpeechSamples(wav)
  } catch {
    return null
  }
}
