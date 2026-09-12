import { describe, expect, it } from 'vitest'
import { LX_PHONEMES, STANDARD_ARPABET_PHONEMES } from './lxPhonemes'
import { renderLxSamples } from './lxSpeech'
import { renderSamSamples } from './samSpeech'

const BASE_OPTIONS = {
  text: 'Machines have a voice.',
  speed: 1,
  pitch: 0.5,
  metallic: 0.78,
}

function rms(samples: Float32Array): number {
  let energy = 0
  for (const sample of samples) {
    energy += sample * sample
  }
  return Math.sqrt(energy / samples.length)
}

describe('LX phoneme source', () => {
  it('covers the standard ARPAbet inventory', () => {
    for (const phoneme of STANDARD_ARPABET_PHONEMES) {
      expect(LX_PHONEMES[phoneme], phoneme).toBeDefined()
    }
  })

  it('returns null for text without speech', async () => {
    await expect(renderLxSamples({ ...BASE_OPTIONS, text: '... ?!' })).resolves.toBeNull()
  })

  it('renders deterministic, bounded finite PCM', async () => {
    const first = await renderLxSamples(BASE_OPTIONS)
    const second = await renderLxSamples(BASE_OPTIONS)

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(first).toEqual(second)

    let peak = 0
    let energy = 0
    for (const sample of first ?? []) {
      expect(Number.isFinite(sample)).toBe(true)
      peak = Math.max(peak, Math.abs(sample))
      energy += sample * sample
    }
    expect(peak).toBeGreaterThan(0.1)
    expect(peak).toBeLessThanOrEqual(0.95)
    expect(Math.sqrt(energy / (first?.length ?? 1))).toBeGreaterThan(0.005)
  })

  it('shortens speech as speed increases', async () => {
    const slow = await renderLxSamples({ ...BASE_OPTIONS, speed: 0.45 })
    const fast = await renderLxSamples({ ...BASE_OPTIONS, speed: 1.6 })

    expect(slow).not.toBeNull()
    expect(fast).not.toBeNull()
    expect(fast!.length).toBeLessThan(slow!.length * 0.72)
  })

  it('changes source timbre with the robot control', async () => {
    const soft = await renderLxSamples({ ...BASE_OPTIONS, metallic: 0 })
    const hard = await renderLxSamples({ ...BASE_OPTIONS, metallic: 1 })

    expect(soft).not.toBeNull()
    expect(hard).not.toBeNull()
    expect(soft).not.toEqual(hard)
  })

  it('routes through the shared fourth-engine entry point', async () => {
    const samples = await renderSamSamples({
      ...BASE_OPTIONS,
      engine: 'lx',
    })

    expect(samples).toBeInstanceOf(Float32Array)
    expect(samples!.length).toBeGreaterThan(2205)
  })

  it('stays near SAM source level for the same phrase', async () => {
    const lx = await renderLxSamples(BASE_OPTIONS)
    const sam = await renderSamSamples({ ...BASE_OPTIONS, engine: 'sam' })

    expect(lx).not.toBeNull()
    expect(sam).not.toBeNull()
    expect(rms(lx!) / rms(sam!)).toBeGreaterThanOrEqual(0.8)
    expect(rms(lx!) / rms(sam!)).toBeLessThanOrEqual(1.25)
  })
})
