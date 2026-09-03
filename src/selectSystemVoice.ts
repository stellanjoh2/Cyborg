export type VoiceTone = 'natural' | 'bright' | 'deep'

/** macOS novelty voices — they speak in singsong/musical ways, not normal speech. */
const NOVELTY_VOICE_PATTERNS = [
  /bad news/i,
  /cellos/i,
  /zarvox/i,
  /trinoids/i,
  /boing/i,
  /bubbles/i,
  /junior/i,
  /whisper/i,
  /albert/i,
  /hysterical/i,
  /pipe organ/i,
  /good news/i,
  /bahh/i,
  /bells/i,
  /deranged/i,
  /wobble/i,
]

const DEEP_VOICE_PATTERNS = [/daniel/i, /tom/i, /fred/i, /deep/i, /lee/i, /aaron/i]
const BRIGHT_VOICE_PATTERNS = [/zira/i, /samantha/i, /karen/i, /fiona/i, /victoria/i]

function isNoveltyVoice(voice: SpeechSynthesisVoice): boolean {
  return NOVELTY_VOICE_PATTERNS.some((pattern) => pattern.test(voice.name))
}

function pickByPatterns(
  voices: SpeechSynthesisVoice[],
  patterns: RegExp[],
): SpeechSynthesisVoice | null {
  for (const pattern of patterns) {
    const match = voices.find((voice) => pattern.test(voice.name))
    if (match) {
      return match
    }
  }
  return null
}

export function selectSystemVoice(
  voices: SpeechSynthesisVoice[],
  tone: VoiceTone,
): SpeechSynthesisVoice | null {
  if (!voices.length) {
    return null
  }

  const english = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('en'),
  )
  const speakingPool = (english.length ? english : voices).filter(
    (voice) => !isNoveltyVoice(voice),
  )
  const pool = speakingPool.length ? speakingPool : english.length ? english : voices
  const defaultVoice = pool.find((voice) => voice.default) ?? pool[0]

  switch (tone) {
    case 'deep':
      return pickByPatterns(pool, DEEP_VOICE_PATTERNS) ?? defaultVoice
    case 'bright':
      return pickByPatterns(pool, BRIGHT_VOICE_PATTERNS) ?? defaultVoice
    case 'natural':
    default:
      return defaultVoice
  }
}
