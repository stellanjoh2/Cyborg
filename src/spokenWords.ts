export interface SpokenPart {
  text: string
  wordIndex: number | null
}

export function splitSpokenParts(text: string): SpokenPart[] {
  const tokens = text.match(/\S+|\s+/g) ?? []
  const parts: SpokenPart[] = []
  let wordIndex = 0

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      parts.push({ text: token, wordIndex: null })
      continue
    }

    parts.push({ text: token, wordIndex })
    wordIndex += 1
  }

  return parts
}

export function spokenWordWeight(word: string): number {
  const core = word.replace(/[^\w']/g, '')
  let weight = /^\d+$/.test(core)
    ? Math.max(4, core.length * 5)
    : Math.max(2, core.length)

  if (/[.!?]$/.test(word)) {
    weight += 4
  } else if (/,$/.test(word)) {
    weight += 2
  }

  return weight
}

export function spokenWordWeights(parts: SpokenPart[]): number[] {
  return parts
    .filter((part) => part.wordIndex !== null)
    .map((part) => spokenWordWeight(part.text))
}

export function wordIndexAtProgress(
  weights: number[],
  progress: number,
): number {
  if (weights.length === 0) {
    return 0
  }

  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) {
    return 0
  }

  const target = Math.min(1, Math.max(0, progress)) * total
  let acc = 0

  for (let index = 0; index < weights.length; index += 1) {
    acc += weights[index]
    if (target < acc) {
      return index
    }
  }

  return weights.length - 1
}
