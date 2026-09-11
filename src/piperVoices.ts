export type PiperVoiceId =
  | 'en_US-amy-low'
  | 'en_US-danny-low'
  | 'en_US-lessac-medium'
  | 'en_US-ryan-medium'
  | 'en_US-hfc_male-medium'
  | 'en_US-hfc_female-medium'
  | 'en_US-joe-medium'
  | 'en_US-kristin-medium'
  | 'en_US-kusal-medium'
  | 'en_US-ljspeech-medium'
  | 'en_GB-alan-medium'
  | 'en_GB-alba-medium'
  | 'en_GB-cori-medium'
  | 'en_GB-jenny_dioco-medium'
  | 'en_GB-northern_english_male-medium'

export const PIPER_VOICE_OPTIONS: {
  value: PiperVoiceId
  label: string
}[] = [
  { value: 'en_US-amy-low', label: 'Amy' },
  { value: 'en_US-danny-low', label: 'Danny' },
  { value: 'en_US-lessac-medium', label: 'Lessac' },
  { value: 'en_US-ryan-medium', label: 'Ryan' },
  { value: 'en_US-hfc_male-medium', label: 'HFC Male' },
  { value: 'en_US-hfc_female-medium', label: 'HFC Female' },
  { value: 'en_US-joe-medium', label: 'Joe' },
  { value: 'en_US-kristin-medium', label: 'Kristin' },
  { value: 'en_US-kusal-medium', label: 'Kusal' },
  { value: 'en_US-ljspeech-medium', label: 'LJ Speech' },
  { value: 'en_GB-alan-medium', label: 'Alan' },
  { value: 'en_GB-alba-medium', label: 'Alba' },
  { value: 'en_GB-cori-medium', label: 'Cori' },
  { value: 'en_GB-jenny_dioco-medium', label: 'Jenny Dioco' },
  { value: 'en_GB-northern_english_male-medium', label: 'Northern Male' },
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
