export type EqualizerBandType = 'lowshelf' | 'peaking' | 'highshelf'

export interface EqualizerBand {
  id: string
  label: string
  type: EqualizerBandType
  frequency: number
  gain: number
  q: number
}

export interface EqualizerState {
  enabled: boolean
  bands: EqualizerBand[]
}

export const EQ_MIN_FREQUENCY = 20
export const EQ_MAX_FREQUENCY = 20_000
export const EQ_MIN_GAIN = -12
export const EQ_MAX_GAIN = 12
export const EQ_MIN_Q = 0.25
export const EQ_MAX_Q = 8

export const DEFAULT_EQUALIZER: EqualizerState = {
  enabled: true,
  bands: [
    { id: 'low', label: 'Low', type: 'lowshelf', frequency: 100, gain: 0, q: 0.7 },
    { id: 'low-mid', label: 'Low mid', type: 'peaking', frequency: 350, gain: 0, q: 1 },
    { id: 'mid', label: 'Mid', type: 'peaking', frequency: 1_200, gain: 0, q: 1 },
    { id: 'high-mid', label: 'High mid', type: 'peaking', frequency: 4_000, gain: 0, q: 1 },
    { id: 'high', label: 'High', type: 'highshelf', frequency: 10_000, gain: 0, q: 0.7 },
  ],
}

export function cloneEqualizer(equalizer = DEFAULT_EQUALIZER): EqualizerState {
  return {
    enabled: equalizer.enabled,
    bands: equalizer.bands.map((band) => ({ ...band })),
  }
}

export function mergeEqualizer(
  base: EqualizerState,
  overlay?: Partial<EqualizerState>,
): EqualizerState {
  return {
    enabled: overlay?.enabled ?? base.enabled,
    bands: overlay?.bands
      ? base.bands.map((band, index) => ({ ...band, ...overlay.bands?.[index] }))
      : base.bands.map((band) => ({ ...band })),
  }
}

export function equalizerMatchesDefault(equalizer: EqualizerState): boolean {
  return (
    equalizer.enabled === DEFAULT_EQUALIZER.enabled &&
    equalizer.bands.length === DEFAULT_EQUALIZER.bands.length &&
    equalizer.bands.every((band, index) => {
      const original = DEFAULT_EQUALIZER.bands[index]
      return (
        original != null &&
        band.frequency === original.frequency &&
        band.gain === original.gain &&
        band.q === original.q
      )
    })
  )
}

export function frequencyToPosition(frequency: number): number {
  const clamped = Math.min(EQ_MAX_FREQUENCY, Math.max(EQ_MIN_FREQUENCY, frequency))
  return (
    Math.log(clamped / EQ_MIN_FREQUENCY) /
    Math.log(EQ_MAX_FREQUENCY / EQ_MIN_FREQUENCY)
  )
}

export function positionToFrequency(position: number): number {
  const clamped = Math.min(1, Math.max(0, position))
  return EQ_MIN_FREQUENCY * (EQ_MAX_FREQUENCY / EQ_MIN_FREQUENCY) ** clamped
}

type Coefficients = {
  b0: number
  b1: number
  b2: number
  a0: number
  a1: number
  a2: number
}

function coefficientsForBand(
  band: EqualizerBand,
  sampleRate: number,
): Coefficients {
  const frequency = Math.min(sampleRate * 0.495, Math.max(1, band.frequency))
  const omega = (2 * Math.PI * frequency) / sampleRate
  const cos = Math.cos(omega)
  const sin = Math.sin(omega)
  const a = 10 ** (band.gain / 40)

  if (band.type === 'peaking') {
    const alpha = sin / (2 * Math.max(EQ_MIN_Q, band.q))
    return {
      b0: 1 + alpha * a,
      b1: -2 * cos,
      b2: 1 - alpha * a,
      a0: 1 + alpha / a,
      a1: -2 * cos,
      a2: 1 - alpha / a,
    }
  }

  const alpha = sin / Math.SQRT2
  const beta = 2 * Math.sqrt(a) * alpha
  if (band.type === 'lowshelf') {
    return {
      b0: a * ((a + 1) - (a - 1) * cos + beta),
      b1: 2 * a * ((a - 1) - (a + 1) * cos),
      b2: a * ((a + 1) - (a - 1) * cos - beta),
      a0: (a + 1) + (a - 1) * cos + beta,
      a1: -2 * ((a - 1) + (a + 1) * cos),
      a2: (a + 1) + (a - 1) * cos - beta,
    }
  }

  return {
    b0: a * ((a + 1) + (a - 1) * cos + beta),
    b1: -2 * a * ((a - 1) + (a + 1) * cos),
    b2: a * ((a + 1) + (a - 1) * cos - beta),
    a0: (a + 1) - (a - 1) * cos + beta,
    a1: 2 * ((a - 1) - (a + 1) * cos),
    a2: (a + 1) - (a - 1) * cos - beta,
  }
}

function magnitudeAt(
  coefficients: Coefficients,
  frequency: number,
  sampleRate: number,
): number {
  const omega = (2 * Math.PI * frequency) / sampleRate
  const cos = Math.cos(omega)
  const sin = Math.sin(omega)
  const cos2 = Math.cos(omega * 2)
  const sin2 = Math.sin(omega * 2)
  const numeratorReal =
    coefficients.b0 + coefficients.b1 * cos + coefficients.b2 * cos2
  const numeratorImag = -coefficients.b1 * sin - coefficients.b2 * sin2
  const denominatorReal =
    coefficients.a0 + coefficients.a1 * cos + coefficients.a2 * cos2
  const denominatorImag = -coefficients.a1 * sin - coefficients.a2 * sin2
  return Math.sqrt(
    (numeratorReal ** 2 + numeratorImag ** 2) /
      (denominatorReal ** 2 + denominatorImag ** 2),
  )
}

export function equalizerResponseDb(
  equalizer: EqualizerState,
  frequency: number,
  sampleRate = 48_000,
): number {
  if (!equalizer.enabled) return 0
  const magnitude = equalizer.bands.reduce(
    (total, band) =>
      total * magnitudeAt(coefficientsForBand(band, sampleRate), frequency, sampleRate),
    1,
  )
  return 20 * Math.log10(Math.max(1e-8, magnitude))
}
