export type PiperVoiceId =
  | 'en_US-amy-low'
  | 'en_US-danny-low'
  | 'en_US-lessac-medium'
  | 'en_US-ryan-medium'
  | 'en_US-hfc_male-medium'

export const PIPER_VOICE_OPTIONS: {
  value: PiperVoiceId
  label: string
}[] = [
  { value: 'en_US-amy-low', label: 'Amy' },
  { value: 'en_US-danny-low', label: 'Danny' },
  { value: 'en_US-lessac-medium', label: 'Lessac' },
  { value: 'en_US-ryan-medium', label: 'Ryan' },
  { value: 'en_US-hfc_male-medium', label: 'HFC Male' },
]

export const DEFAULT_PIPER_VOICE: PiperVoiceId = 'en_US-amy-low'

const STORAGE_KEY = 'lx01-piper-voice'

export function isPiperVoiceId(value: string): value is PiperVoiceId {
  return PIPER_VOICE_OPTIONS.some((option) => option.value === value)
}

export function readPiperVoice(): PiperVoiceId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isPiperVoiceId(stored)) {
      return stored
    }
  } catch {
    // ignore
  }
  return DEFAULT_PIPER_VOICE
}

export function writePiperVoice(voice: PiperVoiceId) {
  try {
    localStorage.setItem(STORAGE_KEY, voice)
  } catch {
    // ignore
  }
}
