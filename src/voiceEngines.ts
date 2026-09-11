export type VoiceEngineId = 'sam' | 'piper'

export const VOICE_ENGINE_OPTIONS: {
  value: VoiceEngineId
  label: string
}[] = [
  { value: 'sam', label: 'SAM' },
  { value: 'piper', label: 'Piper' },
]

export const DEFAULT_VOICE_ENGINE: VoiceEngineId = 'piper'

/** Per-engine pitch when you switch to that voice. */
export const DEFAULT_PITCH_BY_ENGINE: Record<VoiceEngineId, number> = {
  sam: 0.7,
  piper: 0.5,
}

const STORAGE_KEY = 'lx01-voice-engine'

export function isVoiceEngineId(value: string): value is VoiceEngineId {
  return VOICE_ENGINE_OPTIONS.some((option) => option.value === value)
}

export function readVoiceEngine(): VoiceEngineId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isVoiceEngineId(stored)) {
      return stored
    }
  } catch {
    // ignore
  }
  return DEFAULT_VOICE_ENGINE
}

export function writeVoiceEngine(engine: VoiceEngineId) {
  try {
    localStorage.setItem(STORAGE_KEY, engine)
  } catch {
    // ignore
  }
}
