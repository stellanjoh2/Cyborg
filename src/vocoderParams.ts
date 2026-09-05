export interface VocoderBandParams {
  level: number
  pan: number
}

export interface VocoderParams {
  /** 0–1; 0.5 = neutral. Shifts synthesis filters vs analysis. */
  formant: number
  cutoff: number
  resonance: number
  efSense: number
  unvoice: number
  carrierAmount: number
  carrierMix: number
  carrierCutoff: number
  carrierResonance: number
  bands: VocoderBandParams[]
}

export interface VocoderUiState {
  cutoff: number
  resonance: number
  efSense: number
  unvoice: number
  carrierAmount: number
  carrierMix: number
  carrierCutoff: number
  carrierResonance: number
}

export const VOCODER_BAND_COUNT = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const DEFAULT_VOCODER_UI: VocoderUiState = {
  cutoff: 63,
  resonance: 48,
  efSense: 72,
  unvoice: 0,
  carrierAmount: 50,
  carrierMix: 28,
  carrierCutoff: 58,
  carrierResonance: 32,
}

export function formatSigned63(value: number): string {
  const signed = Math.round(value - 63)
  return signed > 0 ? `+${signed}` : `${signed}`
}

export function mapUiToVocoder(
  ui: VocoderUiState,
  formant = 50,
): VocoderParams {
  return {
    formant: clamp(formant, 0, 100) / 100,
    cutoff: ui.cutoff - 63,
    resonance: clamp(ui.resonance, 0, 127),
    efSense: clamp(ui.efSense, 0, 126),
    unvoice: clamp(ui.unvoice, 0, 100) / 100,
    carrierAmount: clamp(ui.carrierAmount, 0, 100) / 100,
    carrierMix: clamp(ui.carrierMix, 0, 100) / 100,
    carrierCutoff: clamp(ui.carrierCutoff, 0, 100) / 100,
    carrierResonance: clamp(ui.carrierResonance, 0, 100) / 100,
    bands: Array.from({ length: VOCODER_BAND_COUNT }, () => ({
      level: 100,
      pan: 0,
    })),
  }
}

export const DEFAULT_VOCODER_PARAMS: VocoderParams = mapUiToVocoder(
  DEFAULT_VOCODER_UI,
)

export function mapResonanceToQ(resonance: number): number {
  return 0.8 + (clamp(resonance, 0, 127) / 127) * 14
}

export function mapEfSenseToSmoothingHz(efSense: number): number {
  const t = clamp(efSense, 0, 126) / 126
  return 4 + t * 38
}

export const BASE_BAND_HZ = [180, 280, 520, 900, 1500, 2600, 3800, 5800]

const MIN_BAND_HZ = 55
const MAX_BAND_HZ = 16000

function clampBandHz(hz: number): number {
  return clamp(hz, MIN_BAND_HZ, MAX_BAND_HZ)
}

/**
 * Cutoff shifts the analysis bank (~0.5×…2×). Formant shifts synthesis
 * independently from the same base. Relative mismatch is what you hear —
 * synthesis must not track analysis or Cutoff disappears.
 */
export function analysisCenterHz(
  bandIndex: number,
  params: VocoderParams,
): number {
  const base = BASE_BAND_HZ[bandIndex] ?? 1000
  const shift = (clamp(params.cutoff, -63, 63) / 63) * 1.0
  return clampBandHz(base * 2 ** shift)
}

/** Formant shifts synthesis (~0.35×…2.8×) off the unshifted base. */
export function synthesisCenterHz(
  bandIndex: number,
  params: VocoderParams,
): number {
  const base = BASE_BAND_HZ[bandIndex] ?? 1000
  const coarse = (clamp(params.formant, 0, 1) - 0.5) * 2
  return clampBandHz(base * 2 ** (coarse * 1.5))
}

export function bandCenterHz(
  bandIndex: number,
  params: VocoderParams,
): number {
  return synthesisCenterHz(bandIndex, params)
}

export function mapBandLevel(level: number): number {
  return (clamp(level, 0, 127) / 127) * 1.15
}

export function mapBandPan(pan: number): number {
  return clamp(pan, -63, 63) / 63
}

export function analogCarrierHz(pitch: number): number {
  return 55 * 2 ** clamp(pitch, 0, 2)
}

export function mapCarrierCutoffHz(amount: number): number {
  return 120 * 2 ** (clamp(amount, 0, 1) * 6)
}

export function mapCarrierResonanceQ(amount: number): number {
  return 0.5 + clamp(amount, 0, 1) * 11.5
}

export function formatCarrierMix(value: number): string {
  const square = Math.round(clamp(value, 0, 100))
  if (square <= 4) {
    return 'Saw'
  }
  if (square >= 96) {
    return 'Square'
  }
  return `${100 - square}/${square}`
}

export function formatCarrierCutoff(value: number): string {
  const hz = Math.round(mapCarrierCutoffHz(value / 100))
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`
  }
  return `${hz} Hz`
}

export function formatCarrierResonance(value: number): string {
  return mapCarrierResonanceQ(value / 100).toFixed(1)
}
