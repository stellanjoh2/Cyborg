import { classicWordToPhonemes } from './samClassicReciter'
import {
  isNumericToken,
  loadCmuDictionary,
  lookupCmuPronunciation,
  numberToEnglishWords,
  tokenizePronunciationText,
  type CmuDictionary,
} from './cmuPronunciation'

function cmuToSamPhonemes(cmu: string): string {
  return cmu
    .replace(/HH/gi, '/H')
    .replace(/JH/gi, 'J')
    .replace(/\s/g, '')
    .replace(/1/g, '4')
    .replace(/2/g, '')
    .replace(/0/g, '')
}

function numberToPhonemes(token: string, dict: CmuDictionary): string {
  const spoken = numberToEnglishWords(token)
  const parts: string[] = []

  for (const word of spoken.split(/\s+/)) {
    const cmu = lookupCmuPronunciation(dict, word)
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

export async function prepareSamPhoneticText(text: string): Promise<string> {
  const dict = await loadCmuDictionary()
  const parts: string[] = []

  for (const token of tokenizePronunciationText(text)) {
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

    const cmu = lookupCmuPronunciation(dict, token)
    if (cmu) {
      parts.push(cmuToSamPhonemes(cmu))
      continue
    }

    parts.push(classicWordToPhonemes(token))
  }

  return parts.join('').replace(/\s+/g, ' ').trim()
}
