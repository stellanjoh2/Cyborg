import { ToWords } from 'to-words'
import { classicWordToPhonemes } from './samClassicReciter'
import { PRONUNCIATION_OVERRIDES } from './pronunciationOverrides'

type CmuDictionary = Record<string, string>

let dictionaryPromise: Promise<CmuDictionary> | null = null
const toWords = new ToWords()

function loadDictionary(): Promise<CmuDictionary> {
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

function lookupCmu(dict: CmuDictionary, word: string): string | null {
  const normalized = normalizeWord(word)
  if (!normalized) {
    return null
  }

  if (PRONUNCIATION_OVERRIDES[normalized]) {
    return PRONUNCIATION_OVERRIDES[normalized]
  }

  const direct =
    dict[normalized] ??
    dict[`${normalized}(2)`] ??
    dict[`${normalized}(3)`]

  if (direct) {
    return direct
  }

  const insensitiveKey = Object.keys(dict).find(
    (key) => key.toLowerCase() === normalized,
  )
  return insensitiveKey ? dict[insensitiveKey] : null
}

function cmuToSamPhonemes(cmu: string): string {
  return cmu
    .replace(/HH/gi, '/H')
    .replace(/JH/gi, 'J')
    .replace(/\s/g, '')
    .replace(/1/g, '4')
    .replace(/2/g, '')
    .replace(/0/g, '')
}

function isNumericToken(token: string): boolean {
  return token !== '' && !Number.isNaN(Number(token))
}

function numberToPhonemes(token: string, dict: CmuDictionary): string {
  const spoken = toWords.convert(Number(token))
  const parts: string[] = []

  for (const word of spoken.split(/\s+/)) {
    const cmu = lookupCmu(dict, word)
    parts.push(cmu ? cmuToSamPhonemes(cmu) : classicWordToPhonemes(word))
  }

  return parts.join(' ')
}

function mapPunctuation(token: string): string {
  if (token === '.') return '.'
  if (token === ',') return ','
  if (token === '!') return '!'
  if (token === '?') return '?'
  return ' '
}

function tokenize(text: string): string[] {
  return text.match(/[\w']+|[\d.-]+|[^\w\d\s]+|\s+/g) ?? [text]
}

export async function prepareSamPhoneticText(text: string): Promise<string> {
  const dict = await loadDictionary()
  const parts: string[] = []

  for (const token of tokenize(text)) {
    if (/^\s+$/.test(token)) {
      parts.push(' ')
      continue
    }

    if (/^[^\w\d\s]+$/.test(token)) {
      parts.push(mapPunctuation(token))
      continue
    }

    if (isNumericToken(token)) {
      parts.push(numberToPhonemes(token, dict))
      continue
    }

    const cmu = lookupCmu(dict, token)
    if (cmu) {
      parts.push(cmuToSamPhonemes(cmu))
      continue
    }

    parts.push(classicWordToPhonemes(token))
  }

  return parts.join('').replace(/\s+/g, ' ').trim()
}

export function preloadPronunciationDictionary() {
  void loadDictionary()
}
