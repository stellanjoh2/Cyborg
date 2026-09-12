import { ToWords } from 'to-words'
import { PRONUNCIATION_OVERRIDES } from './pronunciationOverrides'

export type CmuDictionary = Record<string, string>

export interface ArpabetPhonemeToken {
  kind: 'phoneme'
  phoneme: string
  stress: 0 | 1 | 2
}

export interface ArpabetPauseToken {
  kind: 'pause'
  durationMs: number
}

export type ArpabetToken = ArpabetPhonemeToken | ArpabetPauseToken

let dictionaryPromise: Promise<CmuDictionary> | null = null
const toWords = new ToWords({ localeCode: 'en-US' })

export function loadCmuDictionary(): Promise<CmuDictionary> {
  if (!dictionaryPromise) {
    dictionaryPromise = import('cmu-pronouncing-dictionary').then(
      (module) => module.dictionary,
    )
  }
  return dictionaryPromise
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '')
}

export function lookupCmuPronunciation(
  dict: CmuDictionary,
  word: string,
): string | null {
  const normalized = normalizeWord(word)
  if (!normalized) {
    return null
  }

  if (PRONUNCIATION_OVERRIDES[normalized]) {
    return PRONUNCIATION_OVERRIDES[normalized]
  }

  return (
    dict[normalized] ??
    dict[`${normalized}(2)`] ??
    dict[`${normalized}(3)`] ??
    null
  )
}

export function isNumericToken(token: string): boolean {
  return token !== '' && !Number.isNaN(Number(token))
}

export function numberToEnglishWords(token: string): string {
  return toWords.convert(Number(token))
}

export function tokenizePronunciationText(text: string): string[] {
  return text.match(/[\w']+|[\d.-]+|[^\w\d\s]+|\s+/g) ?? [text]
}

function parseArpabet(pronunciation: string): ArpabetPhonemeToken[] {
  const tokens: ArpabetPhonemeToken[] = []
  for (const raw of pronunciation.trim().toUpperCase().split(/\s+/)) {
    const match = /^([A-Z]+)([012])?$/.exec(raw)
    if (!match) continue
    tokens.push({
      kind: 'phoneme',
      phoneme: match[1],
      stress: Number(match[2] ?? 0) as 0 | 1 | 2,
    })
  }
  return tokens
}

function spellWithCmu(
  dict: CmuDictionary,
  word: string,
): ArpabetPhonemeToken[] {
  const tokens: ArpabetPhonemeToken[] = []
  for (const letter of normalizeWord(word).replace(/[^a-z]/g, '')) {
    const pronunciation = lookupCmuPronunciation(dict, letter)
    if (pronunciation) {
      tokens.push(...parseArpabet(pronunciation))
    }
  }
  return tokens
}

function punctuationPause(token: string): number {
  if (/[.!?]/.test(token)) return 190
  if (/[,;:]/.test(token)) return 105
  return 45
}

/**
 * CMU ARPAbet for project-authored speech engines. Unknown words are spelled
 * using CMU's letter pronunciations so this path never depends on another TTS.
 */
export async function prepareArpabetTokens(
  text: string,
): Promise<ArpabetToken[]> {
  const dict = await loadCmuDictionary()
  const tokens: ArpabetToken[] = []
  let pendingWordGap = false

  const appendWord = (pronunciation: string | null, raw: string) => {
    const phonemes = pronunciation
      ? parseArpabet(pronunciation)
      : spellWithCmu(dict, raw)
    if (phonemes.length === 0) return
    if (pendingWordGap && tokens.length > 0) {
      tokens.push({ kind: 'pause', durationMs: 22 })
    }
    tokens.push(...phonemes)
    pendingWordGap = true
  }

  for (const token of tokenizePronunciationText(text)) {
    if (/^\s+$/.test(token)) {
      continue
    }
    if (/^[^\w\d\s]+$/.test(token)) {
      if (tokens.length > 0) {
        tokens.push({ kind: 'pause', durationMs: punctuationPause(token) })
      }
      pendingWordGap = false
      continue
    }
    if (isNumericToken(token)) {
      const spoken = numberToEnglishWords(token)
      for (const word of spoken.split(/\s+/)) {
        appendWord(lookupCmuPronunciation(dict, word), word)
      }
      continue
    }
    appendWord(lookupCmuPronunciation(dict, token), token)
  }

  while (tokens.at(-1)?.kind === 'pause') {
    tokens.pop()
  }
  return tokens
}

export function preloadPronunciationDictionary() {
  void loadCmuDictionary()
}
