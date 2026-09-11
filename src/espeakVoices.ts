export type EspeakVoiceId =
  | 'en-us'
  | 'en-gb'
  | 'en-gb-x-rp'
  | 'en-gb-scotland'
  | 'en-us-nyc'
  | 'en-029'
  | 'en-us+f2'
  | 'en-us+m3'
  | 'en-gb+f2'
  | 'en-gb+m3'

export const ESPEAK_VOICE_OPTIONS: {
  value: EspeakVoiceId
  label: string
}[] = [
  { value: 'en-us', label: 'US English' },
  { value: 'en-gb', label: 'UK English' },
  { value: 'en-gb-x-rp', label: 'RP' },
  { value: 'en-gb-scotland', label: 'Scottish' },
  { value: 'en-us-nyc', label: 'New York' },
  { value: 'en-029', label: 'Caribbean' },
  { value: 'en-us+f2', label: 'US Female' },
  { value: 'en-us+m3', label: 'US Male' },
  { value: 'en-gb+f2', label: 'UK Female' },
  { value: 'en-gb+m3', label: 'UK Male' },
]

export const DEFAULT_ESPEAK_VOICE: EspeakVoiceId = 'en-us'

const STORAGE_KEY = 'lx01-espeak-voice'

export function isEspeakVoiceId(value: string): value is EspeakVoiceId {
  return ESPEAK_VOICE_OPTIONS.some((option) => option.value === value)
}

export function readEspeakVoice(): EspeakVoiceId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isEspeakVoiceId(stored)) {
      return stored
    }
  } catch {
    // ignore
  }
  return DEFAULT_ESPEAK_VOICE
}

export function writeEspeakVoice(voice: EspeakVoiceId) {
  try {
    localStorage.setItem(STORAGE_KEY, voice)
  } catch {
    // ignore
  }
}
