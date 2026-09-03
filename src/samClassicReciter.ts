import { TextToPhonemes } from 'sam-reciter'

const classicCache = new Map<string, string>()

/** sam-js reciter reads process.env; browsers do not define process. */
function ensureProcessEnv() {
  const root = globalThis as typeof globalThis & {
    process?: { env?: Record<string, unknown> }
  }
  if (root.process === undefined) {
    root.process = { env: {} }
  } else if (root.process.env === undefined) {
    root.process.env = {}
  }
}

/** Fallback to SAM's built-in 1982 English rules for unknown words. */
export function classicWordToPhonemes(word: string): string {
  const key = word.toUpperCase()
  const cached = classicCache.get(key)
  if (cached) {
    return cached
  }

  ensureProcessEnv()
  const result = TextToPhonemes(key)
  if (typeof result !== 'string' || !result.trim()) {
    classicCache.set(key, key)
    return key
  }

  const phonemes = result.trim()
  classicCache.set(key, phonemes)
  return phonemes
}

export function classicTextToPhonemes(text: string): string {
  ensureProcessEnv()
  const result = TextToPhonemes(text)
  return typeof result === 'string' ? result.trim() : text
}
