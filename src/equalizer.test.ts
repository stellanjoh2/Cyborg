import { describe, expect, it } from 'vitest'
import {
  cloneEqualizer,
  DEFAULT_EQUALIZER,
  equalizerMatchesDefault,
  equalizerResponseDb,
  frequencyToPosition,
  positionToFrequency,
} from './equalizer'

describe('equalizer', () => {
  it('maps the logarithmic frequency range in both directions', () => {
    for (const frequency of [20, 100, 1_000, 10_000, 20_000]) {
      expect(positionToFrequency(frequencyToPosition(frequency))).toBeCloseTo(
        frequency,
        8,
      )
    }
  })

  it('has a flat default response', () => {
    for (const frequency of [20, 100, 1_000, 5_000, 20_000]) {
      expect(equalizerResponseDb(DEFAULT_EQUALIZER, frequency)).toBeCloseTo(0, 8)
    }
  })

  it('reports edits and bypasses the response', () => {
    const equalizer = cloneEqualizer()
    equalizer.bands[2]!.gain = 9

    expect(equalizerMatchesDefault(equalizer)).toBe(false)
    expect(equalizerResponseDb(equalizer, equalizer.bands[2]!.frequency)).toBeGreaterThan(8)

    equalizer.enabled = false
    expect(equalizerResponseDb(equalizer, 1_200)).toBe(0)
  })
})
