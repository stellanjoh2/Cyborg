import {
  analogCarrierHz,
  analysisCenterHz,
  mapBandLevel,
  mapBandPan,
  mapCarrierCutoffHz,
  mapCarrierResonanceQ,
  mapEfSenseToSmoothingHz,
  mapResonanceToQ,
  synthesisCenterHz,
  VOCODER_BAND_COUNT,
  type VocoderParams,
} from './vocoderParams'

const SAW_LEVEL = 0.85
const SQUARE_LEVEL = 0.7
const OSC_MAKEUP = 2.4
const DRY_BLEND = 0.22
const OUTPUT_MAKEUP = 2
const UNVOICE_GAIN_MAX = 0.55
const UNVOICE_DETECT_HZ = 5200
const UNVOICE_NOISE_HZ = 3800
const UNVOICE_ENV_HZ = 28

const ABS_CURVE = createAbsCurve()
const FX_ENGAGE = 0.01

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

export interface UnvoiceGraph {
  detectFilter: BiquadFilterNode
  rectifier: WaveShaperNode
  envSmooth: BiquadFilterNode
  noise: AudioBufferSourceNode
  noiseFilter: BiquadFilterNode
  envGain: GainNode
  amountGain: GainNode
}

export interface VocoderBankGraph {
  input: GainNode
  output: GainNode
  dryBlend: GainNode
  carrierBus: GainNode
  bands: VocoderBandGraph[]
  carrier: AnalogCarrierGraph
  unvoice: UnvoiceGraph
  /** Unvoice detect + noise path wired into the bank. */
  unvoiceEngaged: boolean
  /** Analog osc carrier wired into carrierBus (speech path stays). */
  carrierOscEngaged: boolean
}

function forceMono(node: AudioNode) {
  node.channelCount = 1
  node.channelCountMode = 'explicit'
  node.channelInterpretation = 'speakers'
}

function tryDisconnect(from: AudioNode, to: AudioNode) {
  try {
    from.disconnect(to)
  } catch {
    // Already disconnected.
  }
}

function createAbsCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(65536)
  for (let i = 0; i < 65536; i += 1) {
    const x = (i - 32768) / 32768
    curve[i] = Math.abs(x)
  }
  return curve
}

function createNoiseBuffer(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function createBandGraph(
  context: BaseAudioContext,
  modulator: AudioNode,
  carrier: AudioNode,
  output: GainNode,
): VocoderBandGraph {
  const analysisFilter = context.createBiquadFilter()
  analysisFilter.type = 'bandpass'
  forceMono(analysisFilter)

  const carrierFilter = context.createBiquadFilter()
  carrierFilter.type = 'bandpass'
  forceMono(carrierFilter)

  const rectifier = context.createWaveShaper()
  // Shared curve — WaveShaper copies on assign; avoid 8× 64k allocations.
  rectifier.curve = ABS_CURVE
  rectifier.oversample = 'none'
  forceMono(rectifier)

  const envSmooth = context.createBiquadFilter()
  envSmooth.type = 'lowpass'
  forceMono(envSmooth)

  const envGain = context.createGain()
  envGain.gain.value = 0
  forceMono(envGain)

  const levelGain = context.createGain()
  forceMono(levelGain)
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

function createUnvoiceGraph(
  context: BaseAudioContext,
  output: GainNode,
): UnvoiceGraph {
  const detectFilter = context.createBiquadFilter()
  detectFilter.type = 'highpass'
  detectFilter.frequency.value = UNVOICE_DETECT_HZ
  detectFilter.Q.value = 0.7
  forceMono(detectFilter)

  const rectifier = context.createWaveShaper()
  rectifier.curve = ABS_CURVE
  rectifier.oversample = 'none'
  forceMono(rectifier)

  const envSmooth = context.createBiquadFilter()
  envSmooth.type = 'lowpass'
  envSmooth.frequency.value = UNVOICE_ENV_HZ
  envSmooth.Q.value = 0.7
  forceMono(envSmooth)

  const noise = context.createBufferSource()
  noise.buffer = createNoiseBuffer(context)
  noise.loop = true

  const noiseFilter = context.createBiquadFilter()
  noiseFilter.type = 'highpass'
  noiseFilter.frequency.value = UNVOICE_NOISE_HZ
  noiseFilter.Q.value = 0.7
  forceMono(noiseFilter)

  const envGain = context.createGain()
  envGain.gain.value = 0
  forceMono(envGain)

  const amountGain = context.createGain()
  amountGain.gain.value = 0

  // Inputs stay disconnected until unvoice engages (default is off).
  detectFilter.connect(rectifier)
  rectifier.connect(envSmooth)
  envSmooth.connect(envGain.gain)

  noiseFilter.connect(envGain)
  envGain.connect(amountGain)
  amountGain.connect(output)

  return {
    detectFilter,
    rectifier,
    envSmooth,
    noise,
    noiseFilter,
    envGain,
    amountGain,
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

  const unvoice = createUnvoiceGraph(context, output)

  return {
    input,
    output,
    dryBlend,
    carrierBus,
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
    unvoice,
    unvoiceEngaged: false,
    carrierOscEngaged: true,
  }
}

function setBankParam(
  param: AudioParam,
  value: number,
  now: number,
  rampSeconds: number,
) {
  param.cancelScheduledValues(now)
  if (rampSeconds <= 0) {
    param.setValueAtTime(value, now)
    return
  }
  param.setValueAtTime(param.value, now)
  param.setTargetAtTime(value, now, rampSeconds)
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
  const unvoice = Math.min(Math.max(params.unvoice, 0), 1)
  const carrierHz = analogCarrierHz(voicePitch)

  setBankParam(bank.dryBlend.gain, DRY_BLEND * (1 - amount), now, rampSeconds)
  setBankParam(bank.carrier.speechGain.gain, 1 - amount, now, rampSeconds)
  setBankParam(
    bank.carrier.oscGain.gain,
    amount * OSC_MAKEUP,
    now,
    rampSeconds,
  )
  setBankParam(
    bank.output.gain,
    1 + amount * OUTPUT_MAKEUP,
    now,
    rampSeconds,
  )
  setBankParam(
    bank.carrier.sawGain.gain,
    (1 - mix) * SAW_LEVEL,
    now,
    rampSeconds,
  )
  setBankParam(
    bank.carrier.squareGain.gain,
    mix * SQUARE_LEVEL,
    now,
    rampSeconds,
  )
  setBankParam(
    bank.carrier.filter.frequency,
    mapCarrierCutoffHz(params.carrierCutoff),
    now,
    rampSeconds,
  )
  setBankParam(
    bank.carrier.filter.Q,
    mapCarrierResonanceQ(params.carrierResonance),
    now,
    rampSeconds,
  )
  setBankParam(bank.carrier.saw.frequency, carrierHz, now, rampSeconds)
  setBankParam(bank.carrier.square.frequency, carrierHz, now, rampSeconds)
  setBankParam(
    bank.unvoice.amountGain.gain,
    unvoice * UNVOICE_GAIN_MAX,
    now,
    rampSeconds,
  )

  const wantUnvoice = unvoice > FX_ENGAGE
  if (wantUnvoice !== bank.unvoiceEngaged) {
    if (wantUnvoice) {
      bank.input.connect(bank.unvoice.detectFilter)
      bank.unvoice.noise.connect(bank.unvoice.noiseFilter)
    } else {
      tryDisconnect(bank.input, bank.unvoice.detectFilter)
      tryDisconnect(bank.unvoice.noise, bank.unvoice.noiseFilter)
    }
    bank.unvoiceEngaged = wantUnvoice
  }

  const wantCarrierOsc = amount > FX_ENGAGE
  if (wantCarrierOsc !== bank.carrierOscEngaged) {
    if (wantCarrierOsc) {
      bank.carrier.oscGain.connect(bank.carrierBus)
    } else {
      tryDisconnect(bank.carrier.oscGain, bank.carrierBus)
    }
    bank.carrierOscEngaged = wantCarrierOsc
  }

  for (let index = 0; index < bank.bands.length; index += 1) {
    const band = bank.bands[index]
    const analysisHz = analysisCenterHz(index, params)
    const synthesisHz = synthesisCenterHz(index, params)
    const level = mapBandLevel(params.bands[index]?.level ?? 100)
    const pan = mapBandPan(params.bands[index]?.pan ?? 0)

    setBankParam(band.analysisFilter.frequency, analysisHz, now, rampSeconds)
    setBankParam(band.analysisFilter.Q, q, now, rampSeconds)
    setBankParam(band.carrierFilter.frequency, synthesisHz, now, rampSeconds)
    setBankParam(band.carrierFilter.Q, q, now, rampSeconds)
    setBankParam(band.envSmooth.frequency, smoothingHz, now, rampSeconds)
    setBankParam(band.levelGain.gain, level, now, rampSeconds)
    setBankParam(band.panner.pan, pan, now, rampSeconds)
  }
}
