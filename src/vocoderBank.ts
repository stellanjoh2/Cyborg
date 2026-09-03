import {
  analogCarrierHz,
  bandCenterHz,
  mapBandLevel,
  mapBandPan,
  mapCarrierCutoffHz,
  mapCarrierResonanceQ,
  mapEfSenseToSmoothingHz,
  mapResonanceToQ,
  VOCODER_BAND_COUNT,
  type VocoderParams,
} from './vocoderParams'

const SAW_LEVEL = 0.85
const SQUARE_LEVEL = 0.7
const OSC_MAKEUP = 2.4
const DRY_BLEND = 0.22

const ABS_CURVE = createAbsCurve()

export interface VocoderBandGraph {
  analysisFilter: BiquadFilterNode
  carrierFilter: BiquadFilterNode
  rectifier: WaveShaperNode
  envSmooth: BiquadFilterNode
  envGain: GainNode
  levelGain: GainNode
  panner: StereoPannerNode
}

export interface AnalogCarrierGraph {
  saw: OscillatorNode
  square: OscillatorNode
  sawGain: GainNode
  squareGain: GainNode
  filter: BiquadFilterNode
  oscGain: GainNode
  speechGain: GainNode
}

export interface VocoderBankGraph {
  input: GainNode
  output: GainNode
  dryBlend: GainNode
  bands: VocoderBandGraph[]
  carrier: AnalogCarrierGraph
}

function createAbsCurve(): Float32Array {
  const curve = new Float32Array(65536)
  for (let i = 0; i < 65536; i += 1) {
    const x = (i - 32768) / 32768
    curve[i] = Math.abs(x)
  }
  return curve
}

function createBandGraph(
  context: BaseAudioContext,
  modulator: AudioNode,
  carrier: AudioNode,
  output: GainNode,
): VocoderBandGraph {
  const analysisFilter = context.createBiquadFilter()
  analysisFilter.type = 'bandpass'

  const carrierFilter = context.createBiquadFilter()
  carrierFilter.type = 'bandpass'

  const rectifier = context.createWaveShaper()
  rectifier.curve = new Float32Array(ABS_CURVE)
  rectifier.oversample = 'none'

  const envSmooth = context.createBiquadFilter()
  envSmooth.type = 'lowpass'

  const envGain = context.createGain()
  envGain.gain.value = 0

  const levelGain = context.createGain()
  const panner = context.createStereoPanner()

  modulator.connect(analysisFilter)
  analysisFilter.connect(rectifier)
  rectifier.connect(envSmooth)
  envSmooth.connect(envGain.gain)

  carrier.connect(carrierFilter)
  carrierFilter.connect(envGain)
  envGain.connect(levelGain)
  levelGain.connect(panner)
  panner.connect(output)

  return {
    analysisFilter,
    carrierFilter,
    rectifier,
    envSmooth,
    envGain,
    levelGain,
    panner,
  }
}

export function buildVocoderBank(context: BaseAudioContext): VocoderBankGraph {
  const input = context.createGain()
  const output = context.createGain()
  const dryBlend = context.createGain()
  dryBlend.gain.value = 0.22

  input.connect(dryBlend)
  dryBlend.connect(output)

  const saw = context.createOscillator()
  saw.type = 'sawtooth'
  const square = context.createOscillator()
  square.type = 'square'
  square.detune.value = 8
  const sawGain = context.createGain()
  const squareGain = context.createGain()
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = mapCarrierResonanceQ(0.32)
  filter.frequency.value = mapCarrierCutoffHz(0.58)
  const oscGain = context.createGain()
  oscGain.gain.value = 0
  const speechGain = context.createGain()
  speechGain.gain.value = 1
  const carrierBus = context.createGain()

  saw.connect(sawGain)
  square.connect(squareGain)
  sawGain.connect(filter)
  squareGain.connect(filter)
  filter.connect(oscGain)
  oscGain.connect(carrierBus)
  input.connect(speechGain)
  speechGain.connect(carrierBus)

  const bands: VocoderBandGraph[] = []
  for (let i = 0; i < VOCODER_BAND_COUNT; i += 1) {
    bands.push(createBandGraph(context, input, carrierBus, output))
  }

  return {
    input,
    output,
    dryBlend,
    bands,
    carrier: {
      saw,
      square,
      sawGain,
      squareGain,
      filter,
      oscGain,
      speechGain,
    },
  }
}

export function applyVocoderParams(
  bank: VocoderBankGraph,
  params: VocoderParams,
  voicePitch = 1,
  rampSeconds = 0.03,
) {
  const context = bank.input.context
  const now = context.currentTime
  const q = mapResonanceToQ(params.resonance)
  const smoothingHz = mapEfSenseToSmoothingHz(params.efSense)
  const amount = Math.min(Math.max(params.carrierAmount, 0), 1)
  const mix = Math.min(Math.max(params.carrierMix, 0), 1)
  const carrierHz = analogCarrierHz(voicePitch)

  bank.dryBlend.gain.setTargetAtTime(DRY_BLEND * (1 - amount), now, rampSeconds)
  bank.carrier.speechGain.gain.setTargetAtTime(1 - amount, now, rampSeconds)
  bank.carrier.oscGain.gain.setTargetAtTime(amount * OSC_MAKEUP, now, rampSeconds)
  bank.carrier.sawGain.gain.setTargetAtTime((1 - mix) * SAW_LEVEL, now, rampSeconds)
  bank.carrier.squareGain.gain.setTargetAtTime(mix * SQUARE_LEVEL, now, rampSeconds)
  bank.carrier.filter.frequency.setTargetAtTime(
    mapCarrierCutoffHz(params.carrierCutoff),
    now,
    rampSeconds,
  )
  bank.carrier.filter.Q.setTargetAtTime(
    mapCarrierResonanceQ(params.carrierResonance),
    now,
    rampSeconds,
  )
  bank.carrier.saw.frequency.setTargetAtTime(carrierHz, now, rampSeconds)
  bank.carrier.square.frequency.setTargetAtTime(carrierHz, now, rampSeconds)

  for (let index = 0; index < bank.bands.length; index += 1) {
    const band = bank.bands[index]
    const center = bandCenterHz(index, params)
    const level = mapBandLevel(params.bands[index]?.level ?? 100)
    const pan = mapBandPan(params.bands[index]?.pan ?? 0)

    band.analysisFilter.frequency.setTargetAtTime(center, now, rampSeconds)
    band.analysisFilter.Q.setTargetAtTime(q, now, rampSeconds)
    band.carrierFilter.frequency.setTargetAtTime(center, now, rampSeconds)
    band.carrierFilter.Q.setTargetAtTime(q, now, rampSeconds)
    band.envSmooth.frequency.setTargetAtTime(smoothingHz, now, rampSeconds)
    band.levelGain.gain.setTargetAtTime(level, now, rampSeconds)
    band.panner.pan.setTargetAtTime(pan, now, rampSeconds)
  }
}
