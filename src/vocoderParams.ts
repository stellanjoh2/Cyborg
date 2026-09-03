export type FormantShiftStep = -2 | -1 | 0 | 1 | 2

export interface VocoderBandParams {
  level: number
  pan: number
}

export interface VocoderParams {
  formantShift: FormantShiftStep
  cutoff: number
  resonance: number
  efSense: number
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
  carrierAmount: 80,
  carrierMix: 28,
  carrierCutoff: 58,
  carrierResonance: 32,
}

export function formatSigned63(value: number): string {
  const signed = Math.round(value - 63)
  return signed > 0 ? `+${signed}` : `${signed}`
}

export function mapUiToVocoder(ui: VocoderUiState): VocoderParams {
  return {
    formantShift: 0,
    cutoff: ui.cutoff - 63,
    resonance: clamp(ui.resonance, 0, 127),
    efSense: clamp(ui.efSense, 0, 126),
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

export function formantMultiplier(
  formantShift: FormantShiftStep,
  cutoff: number,
): number {
  const stepped = formantShift * 0.14
  const fine = (clamp(cutoff, -63, 63) / 63) * 0.18
  return 2 ** (stepped + fine)
}

export function mapResonanceToQ(resonance: number): number {
  return 0.8 + (clamp(resonance, 0, 127) / 127) * 14
}

export function mapEfSenseToSmoothingHz(efSense: number): number {
  const t = clamp(efSense, 0, 126) / 126
  return 4 + t * 38
}

export const BASE_BAND_HZ = [180, 280, 520, 900, 1500, 2600, 3800, 5800]

export function bandCenterHz(
  bandIndex: number,
  params: VocoderParams,
): number {
  const base = BASE_BAND_HZ[bandIndex] ?? 1000
  return base * formantMultiplier(params.formantShift, params.cutoff)
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
