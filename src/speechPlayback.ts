export type ChunkMode = 'single' | 'segment' | 'word'

export interface SpeakOptions {
  text: string
  rate: number
  pitch: number
  voice: SpeechSynthesisVoice | null
  chunkMode: ChunkMode
  onEnd?: () => void
  onError?: (message: string) => void
}

let cancelled = false

function splitText(text: string, mode: ChunkMode): string[] {
  switch (mode) {
    case 'word':
      return text.split(/\s+/).filter(Boolean)
    case 'segment':
      return text
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
    case 'single':
    default:
      return [text]
  }
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) {
    return Promise.resolve(existing)
  }

  return new Promise((resolve) => {
    const handleVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
  })
}

export function cancelSpeechPlayback() {
  cancelled = true
  window.speechSynthesis.cancel()
}

export async function speakText(options: SpeakOptions) {
  cancelled = false
  window.speechSynthesis.cancel()

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume()
  }

  await waitForVoices()

  const chunks = splitText(options.text, options.chunkMode)
  let index = 0

  const finish = () => {
    if (!cancelled) {
      options.onEnd?.()
    }
  }

  const speakNext = () => {
    if (cancelled || index >= chunks.length) {
      finish()
      return
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index])
    utterance.lang = 'en-US'
    utterance.rate = Math.min(Math.max(options.rate, 0.1), 10)
    utterance.pitch = Math.min(Math.max(options.pitch, 0), 2)

    if (options.voice) {
      utterance.voice = options.voice
    }

    utterance.onend = () => {
      if (cancelled) {
        return
      }
      index += 1
      speakNext()
    }

    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        options.onError?.('Speech synthesis failed.')
      }
      finish()
    }

    window.speechSynthesis.speak(utterance)
  }

  // Browsers often drop speak() if it runs in the same tick as cancel().
  window.setTimeout(speakNext, 0)
}
