import {
  DEFAULT_VOCODER_PARAMS,
  type VocoderParams,
} from './vocoderParams'
import {
  applyVocoderParams,
  buildVocoderBank,
  type VocoderBankGraph,
} from './vocoderBank'

export type { VocoderParams } from './vocoderParams'

const SAM_SAMPLE_RATE = 22050
export const OFFLINE_SAMPLE_RATE = 44100
const EXPORT_TAIL_FLOOR_SECONDS = 0.12
const NOISE_GAIN_MAX = 0.12
const NOISE_ENVELOPE_POINTS = 512

export interface NoisePostParams {
  amount: number
  pitch: number
  tone: number
}

export interface ReverbPostParams {
  amount: number
  roomSize: number
  decay: number
}

export interface DelayPostParams {
  amount: number
  length: number
  feedback: number
}

export interface BitcrushPostParams {
  amount: number
  bits: number
  rate: number
}

export interface RadioPostParams {
  amount: number
  tone: number
  grit: number
}

export interface ChorusPostParams {
  amount: number
  rate: number
  depth: number
}

export interface CompressorPostParams {
  amount: number
  attack: number
  release: number
}

export interface DistortionPostParams {
  amount: number
  drive: number
  tone: number
}

export interface PostProcessParams {
  noise: NoisePostParams
  reverb: ReverbPostParams
  delay: DelayPostParams
  bitcrush: BitcrushPostParams
  radio: RadioPostParams
  chorus: ChorusPostParams
  compressor: CompressorPostParams
  distortion: DistortionPostParams
}

export interface LiveSynthParams {
  speed: number
  pitch: number
  metallic: number
  vocoder: VocoderParams
  postProcess: PostProcessParams
  masterVolume: number
  masterGainDb: number
}

export const DEFAULT_MASTER_VOLUME = 1
export const DEFAULT_MASTER_GAIN_DB = 0
export const MASTER_GAIN_MAX_DB = 12

export function mapMasterOutputGain(volume: number, gainDb: number): number {
  const boost = 10 ** (Math.min(MASTER_GAIN_MAX_DB, Math.max(0, gainDb)) / 20)
  return Math.min(1, Math.max(0, volume)) * boost
}

export const DEFAULT_POST_PROCESS: PostProcessParams = {
  noise: { amount: 0, pitch: 0.5, tone: 0.55 },
  reverb: { amount: 0, roomSize: 0.45, decay: 0.5 },
  delay: { amount: 0, length: 0.35, feedback: 0.4 },
  bitcrush: { amount: 0, bits: 0.45, rate: 0.25 },
  radio: { amount: 0, tone: 0.55, grit: 0.4 },
  chorus: { amount: 0, rate: 0.35, depth: 0.45 },
  compressor: { amount: 0, attack: 0.25, release: 0.4 },
  distortion: { amount: 0, drive: 0.45, tone: 0.55 },
}

export function mergePostProcess(
  base: PostProcessParams,
  overlay?: Partial<PostProcessParams>,
): PostProcessParams {
  return {
    noise: { ...base.noise, ...overlay?.noise },
    reverb: { ...base.reverb, ...overlay?.reverb },
    delay: { ...base.delay, ...overlay?.delay },
    bitcrush: { ...base.bitcrush, ...overlay?.bitcrush },
    radio: { ...base.radio, ...overlay?.radio },
    chorus: { ...base.chorus, ...overlay?.chorus },
    compressor: { ...base.compressor, ...overlay?.compressor },
    distortion: { ...base.distortion, ...overlay?.distortion },
  }
}

interface SynthGraph {
  context: BaseAudioContext
  dryGain: GainNode
  wetGain: GainNode
  combDry: GainNode
  combDelay: DelayNode
  combFeedback: GainNode
  combWet: GainNode
  highpass: BiquadFilterNode
  bandpass: BiquadFilterNode
  shaper: WaveShaperNode
  ringCarrier: GainNode
  ringOsc: OscillatorNode
  ringDepth: GainNode
  ringOffset: ConstantSourceNode
  amGain: GainNode
  amOsc: OscillatorNode
  amDepth: GainNode
  amOffset: ConstantSourceNode
  outputGain: GainNode
  combInput: GainNode
  combOutput: GainNode
  postInput: GainNode
  postDry: GainNode
  postMix: GainNode
  delayIn: GainNode
  delayNode: DelayNode
  delayFeedback: GainNode
  delayWet: GainNode
  reverbIn: GainNode
  convolver: ConvolverNode
  reverbWet: GainNode
  noiseGain: GainNode
  noiseToneFilter: BiquadFilterNode
  noiseSource: AudioBufferSourceNode
  lastReverbRoom: number
  lastReverbDecay: number
  lastCrushBits: number
  lastRadioGrit: number
  lastDistortionDrive: number
  vocoder: VocoderBankGraph
  bitcrushIn: GainNode
  bitcrushDry: GainNode
  bitcrushWet: GainNode
  bitcrushOut: GainNode
  bitcrushWorklet: AudioWorkletNode | null
  bitcrushShaper: WaveShaperNode
  bitcrushFilter: BiquadFilterNode
  radioIn: GainNode
  radioDry: GainNode
  radioWet: GainNode
  radioOut: GainNode
  radioHighpass: BiquadFilterNode
  radioLowpass: BiquadFilterNode
  radioShaper: WaveShaperNode
  chorusIn: GainNode
  chorusDry: GainNode
  chorusWet: GainNode
  chorusOut: GainNode
  chorusDelayL: DelayNode
  chorusDelayR: DelayNode
  chorusLfoL: OscillatorNode
  chorusLfoR: OscillatorNode
  chorusLfoGainL: GainNode
  chorusLfoGainR: GainNode
  chorusPanL: StereoPannerNode
  chorusPanR: StereoPannerNode
  compressorIn: GainNode
  compressorDry: GainNode
  compressorWet: GainNode
  compressorOut: GainNode
  compressorNode: DynamicsCompressorNode
  compressorMakeup: GainNode
  distortionIn: GainNode
  distortionDry: GainNode
  distortionWet: GainNode
  distortionOut: GainNode
  distortionShaper: WaveShaperNode
  distortionTone: BiquadFilterNode
  masterGain: GainNode
  analyser: AnalyserNode
}

let graph: SynthGraph | null = null
let activeSource: AudioBufferSourceNode | null = null
let audioBuffer: AudioBuffer | null = null
let speechSamples: Float32Array | null = null
let sourceStartTime = 0
let sourcePlaybackRate = 1
let sourceOffsetSeconds = 0
let lastPositionTime = 0
let loopEnabled = false
let cancelled = false
let playbackGeneration = 0
let playbackPaused = false
let onEndCallback: (() => void) | null = null
let graphReady: Promise<SynthGraph> | null = null
let currentParams: LiveSynthParams = {
  speed: 1,
  pitch: 1,
  metallic: 0,
  postProcess: mergePostProcess(DEFAULT_POST_PROCESS),
  vocoder: { ...DEFAULT_VOCODER_PARAMS, bands: DEFAULT_VOCODER_PARAMS.bands.map((b) => ({ ...b })) },
  masterVolume: DEFAULT_MASTER_VOLUME,
  masterGainDb: DEFAULT_MASTER_GAIN_DB,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function makeDistortionCurve(amount: number): Float32Array {
  const samples = 44100
  const curve = new Float32Array(samples)
  const deg = Math.PI / 180

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
  }

  return curve
}

function createReverbImpulse(
  context: BaseAudioContext,
  durationSeconds: number,
  decay: number,
): AudioBuffer {
  const sampleRate = context.sampleRate
  const length = Math.floor(sampleRate * durationSeconds)
  const impulse = context.createBuffer(2, length, sampleRate)

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const channelData = impulse.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      channelData[i] =
        (Math.random() * 2 - 1) * (1 - i / length) ** decay
    }
  }

  return impulse
}

function mapNoisePitch(pitch: number): number {
  return 0.35 + clamp(pitch, 0, 1) * 2.15
}

function mapNoiseToneCutoff(tone: number): number {
  return 250 * 2 ** (clamp(tone, 0, 1) * 4.2)
}

function mapReverbDuration(roomSize: number): number {
  return 0.35 + clamp(roomSize, 0, 1) * 1.65
}

function mapReverbDecayPower(decay: number): number {
  return 1.1 + clamp(decay, 0, 1) * 4.4
}

function mapDelayTimeMs(length: number): number {
  const t = clamp(length, 0, 1)
  return (40 + t ** 1.35 * 760) / 1000
}

function mapBitcrushBits(bits: number): number {
  return 16 - clamp(bits, 0, 1) * 14
}

function mapBitcrushDownsample(rate: number): number {
  return 1 + clamp(rate, 0, 1) ** 1.2 * 23
}

function mapRadioHighpass(tone: number): number {
  return 200 + clamp(tone, 0, 1) * 700
}

function mapRadioLowpass(tone: number): number {
  return 4500 - clamp(tone, 0, 1) * 2200
}

function mapChorusRateHz(rate: number): number {
  return 0.15 + clamp(rate, 0, 1) * 3.2
}

function mapChorusDepthSeconds(depth: number): number {
  return 0.0008 + clamp(depth, 0, 1) * 0.0075
}

function mapCompressorAttack(attack: number): number {
  return (1 + clamp(attack, 0, 1) ** 1.4 * 79) / 1000
}

function mapCompressorRelease(release: number): number {
  return (40 + clamp(release, 0, 1) ** 1.2 * 560) / 1000
}

function mapDistortionDrive(drive: number): number {
  return 40 + clamp(drive, 0, 1) * 760
}

function mapDistortionToneCutoff(tone: number): number {
  return 800 * 2 ** (clamp(tone, 0, 1) * 3.6)
}

function makeBitcrushCurve(bits: number): Float32Array {
  const samples = 65536
  const curve = new Float32Array(samples)
  const levels = Math.max(2, 2 ** (mapBitcrushBits(bits) - 1))

  for (let i = 0; i < samples; i += 1) {
    const x = i / (samples / 2) - 1
    curve[i] = Math.round(x * levels) / levels
  }

  return curve
}

async function loadBitcrusherWorklet(
  context: BaseAudioContext,
): Promise<boolean> {
  if (!context.audioWorklet) {
    return false
  }

  try {
    await context.audioWorklet.addModule(
      new URL('./bitcrusherWorklet.js', import.meta.url),
    )
    return true
  } catch {
    return false
  }
}

function buildSpeechNoiseEnvelope(
  samples: Float32Array,
  pointCount = NOISE_ENVELOPE_POINTS,
): Float32Array {
  const points = Math.max(2, Math.min(pointCount, 4096))
  const envelope = new Float32Array(points)
  const blockSize = Math.max(1, Math.floor(samples.length / points))
  const rmsValues = new Float32Array(points)
  let maxRms = 0

  for (let point = 0; point < points; point += 1) {
    const start = point * blockSize
    const end = Math.min(samples.length, start + blockSize)
    let sum = 0

    for (let i = start; i < end; i += 1) {
      sum += samples[i] * samples[i]
    }

    const rms = Math.sqrt(sum / Math.max(1, end - start))
    rmsValues[point] = rms
    maxRms = Math.max(maxRms, rms)
  }

  const floor = maxRms * 0.08
  const range = Math.max(maxRms - floor, 1e-6)

  for (let point = 0; point < points; point += 1) {
    const normalized = Math.max(0, (rmsValues[point] - floor) / range)
    envelope[point] = normalized ** 0.65
  }

  const smoothed = new Float32Array(points)
  for (let point = 0; point < points; point += 1) {
    const prev = envelope[Math.max(0, point - 1)]
    const next = envelope[Math.min(points - 1, point + 1)]
    smoothed[point] = (prev + envelope[point] * 2 + next) / 4
  }

  return smoothed
}

function scaleNoiseEnvelope(
  envelope: Float32Array,
  amount: number,
): Float32Array {
  const peak = clamp(amount, 0, 1) * NOISE_GAIN_MAX
  const scaled = new Float32Array(envelope.length)

  for (let i = 0; i < envelope.length; i += 1) {
    scaled[i] = envelope[i] * peak
  }

  return scaled
}

function scheduleSpeechGatedNoise(
  nodes: SynthGraph,
  samples: Float32Array,
  playbackRate: number,
  noise: NoisePostParams,
  startTime: number,
  offsetSeconds = 0,
) {
  const amount = clamp(noise.amount, 0, 1)
  const speechSeconds = samples.length / SAM_SAMPLE_RATE / playbackRate
  const remaining = speechSeconds - offsetSeconds
  const when = Math.max(startTime, nodes.context.currentTime)

  nodes.noiseSource.playbackRate.cancelScheduledValues(0)
  nodes.noiseSource.playbackRate.setValueAtTime(
    mapNoisePitch(noise.pitch),
    when,
  )
  nodes.noiseToneFilter.frequency.cancelScheduledValues(0)
  nodes.noiseToneFilter.frequency.setValueAtTime(
    mapNoiseToneCutoff(noise.tone),
    when,
  )
  nodes.noiseGain.gain.cancelScheduledValues(0)

  if (amount <= 0.01 || remaining <= 0.005) {
    nodes.noiseGain.gain.setValueAtTime(0, when)
    return
  }

  const envelope = buildSpeechNoiseEnvelope(samples)
  const offsetIndex = Math.min(
    envelope.length - 1,
    Math.floor((offsetSeconds / speechSeconds) * envelope.length),
  )
  const available = envelope.length - offsetIndex

  if (available < 2) {
    nodes.noiseGain.gain.setValueAtTime(0, when)
    return
  }

  const slice = envelope.subarray(offsetIndex)
  const curve = scaleNoiseEnvelope(slice, amount)
  curve[curve.length - 1] = 0

  nodes.noiseGain.gain.setValueAtTime(0, when)
  nodes.noiseGain.gain.setValueCurveAtTime(curve, when, remaining)
}

function estimatedNoiseWetMix(amount: number): number {
  return clamp(amount, 0, 1) * NOISE_GAIN_MAX * 0.42
}

function updateReverbImpulse(nodes: SynthGraph, roomSize: number, decay: number) {
  const room = clamp(roomSize, 0, 1)
  const dec = clamp(decay, 0, 1)
  const roomKey = Math.round(room * 100)
  const decayKey = Math.round(dec * 100)

  if (
    nodes.lastReverbRoom === roomKey &&
    nodes.lastReverbDecay === decayKey
  ) {
    return
  }

  nodes.lastReverbRoom = roomKey
  nodes.lastReverbDecay = decayKey
  nodes.convolver.buffer = createReverbImpulse(
    nodes.context,
    mapReverbDuration(room),
    mapReverbDecayPower(dec),
  )
}

/** Drop delay-line contents so a reset does not keep echoing prior audio. */
function flushDelayNode(nodes: SynthGraph) {
  const previous = nodes.delayNode
  const time = previous.delayTime.value
  try {
    nodes.delayIn.disconnect(previous)
  } catch {
    // Already disconnected.
  }
  previous.disconnect()
  nodes.delayFeedback.disconnect()

  const delayNode = nodes.context.createDelay(1)
  delayNode.delayTime.value = time
  nodes.delayIn.connect(delayNode)
  delayNode.connect(nodes.delayFeedback)
  nodes.delayFeedback.connect(delayNode)
  delayNode.connect(nodes.delayWet)
  nodes.delayNode = delayNode
}

function flushFxTails(nodes: SynthGraph, params: PostProcessParams) {
  if (params.delay.amount <= 0.01) {
    flushDelayNode(nodes)
  }
  if (params.reverb.amount <= 0.01) {
    nodes.lastReverbRoom = -1
    nodes.lastReverbDecay = -1
    nodes.convolver.buffer = null
  }
}

function setAudioParam(
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

function applyPostProcessToGraph(
  nodes: SynthGraph,
  params: PostProcessParams,
  rampSeconds = 0.03,
) {
  const now = nodes.context.currentTime
  const noise = params.noise
  const reverb = params.reverb
  const delay = params.delay
  const bitcrush = params.bitcrush
  const radio = params.radio
  const chorus = params.chorus
  const compressor = params.compressor
  const distortion = params.distortion

  if (rampSeconds <= 0) {
    flushFxTails(nodes, params)
  }

  setAudioParam(
    nodes.noiseSource.playbackRate,
    mapNoisePitch(noise.pitch),
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.noiseToneFilter.frequency,
    mapNoiseToneCutoff(noise.tone),
    now,
    rampSeconds,
  )

  if (!activeSource) {
    setAudioParam(nodes.noiseGain.gain, 0, now, rampSeconds)
  }

  updateReverbImpulse(nodes, reverb.roomSize, reverb.decay)
  setAudioParam(
    nodes.reverbIn.gain,
    reverb.amount > 0.01 ? 1 : 0,
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.reverbWet.gain,
    clamp(reverb.amount, 0, 1) * 0.34,
    now,
    rampSeconds,
  )

  setAudioParam(
    nodes.delayIn.gain,
    delay.amount > 0.01 ? 1 : 0,
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.delayNode.delayTime,
    mapDelayTimeMs(delay.length),
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.delayFeedback.gain,
    clamp(delay.feedback, 0, 1) * 0.88,
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.delayWet.gain,
    clamp(delay.amount, 0, 1) * 0.55,
    now,
    rampSeconds,
  )

  const crushAmount = clamp(bitcrush.amount, 0, 1)
  const crushBits = mapBitcrushBits(bitcrush.bits)
  const crushDown = mapBitcrushDownsample(bitcrush.rate)
  setAudioParam(nodes.bitcrushDry.gain, 1 - crushAmount, now, rampSeconds)
  setAudioParam(nodes.bitcrushWet.gain, crushAmount, now, rampSeconds)
  setAudioParam(
    nodes.bitcrushFilter.frequency,
    nodes.context.sampleRate / (2 * crushDown),
    now,
    rampSeconds,
  )
  if (nodes.bitcrushWorklet) {
    const bitsParam = nodes.bitcrushWorklet.parameters.get('bits')
    const downParam = nodes.bitcrushWorklet.parameters.get('downsample')
    if (bitsParam) {
      setAudioParam(bitsParam, crushBits, now, rampSeconds)
    }
    if (downParam) {
      setAudioParam(downParam, crushDown, now, rampSeconds)
    }
  } else {
    const bitsKey = Math.round(crushBits * 4)
    if (bitsKey !== nodes.lastCrushBits) {
      nodes.lastCrushBits = bitsKey
      nodes.bitcrushShaper.curve = new Float32Array(
        makeBitcrushCurve(bitcrush.bits),
      )
    }
  }

  const radioAmount = clamp(radio.amount, 0, 1)
  const radioGrit = clamp(radio.grit, 0, 1)
  setAudioParam(
    nodes.radioDry.gain,
    1 - radioAmount * 0.88,
    now,
    rampSeconds,
  )
  setAudioParam(nodes.radioWet.gain, radioAmount, now, rampSeconds)
  setAudioParam(
    nodes.radioHighpass.frequency,
    mapRadioHighpass(radio.tone),
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.radioLowpass.frequency,
    mapRadioLowpass(radio.tone),
    now,
    rampSeconds,
  )
  const gritKey = Math.round(radioGrit * 20)
  if (gritKey !== nodes.lastRadioGrit) {
    nodes.lastRadioGrit = gritKey
    nodes.radioShaper.curve = new Float32Array(
      makeDistortionCurve(20 + radioGrit * 480),
    )
  }

  const chorusAmount = clamp(chorus.amount, 0, 1)
  const chorusDepth = mapChorusDepthSeconds(chorus.depth)
  setAudioParam(
    nodes.chorusDry.gain,
    1 - chorusAmount * 0.4,
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.chorusWet.gain,
    chorusAmount * 0.55,
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.chorusLfoL.frequency,
    mapChorusRateHz(chorus.rate),
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.chorusLfoR.frequency,
    mapChorusRateHz(chorus.rate) * 1.13,
    now,
    rampSeconds,
  )
  setAudioParam(nodes.chorusLfoGainL.gain, chorusDepth, now, rampSeconds)
  setAudioParam(
    nodes.chorusLfoGainR.gain,
    chorusDepth * 0.92,
    now,
    rampSeconds,
  )

  const distAmount = clamp(distortion.amount, 0, 1)
  const distDrive = clamp(distortion.drive, 0, 1)
  setAudioParam(
    nodes.distortionDry.gain,
    1 - distAmount * 0.92,
    now,
    rampSeconds,
  )
  setAudioParam(nodes.distortionWet.gain, distAmount, now, rampSeconds)
  setAudioParam(
    nodes.distortionTone.frequency,
    mapDistortionToneCutoff(distortion.tone),
    now,
    rampSeconds,
  )
  const driveKey = Math.round(distDrive * 24)
  if (driveKey !== nodes.lastDistortionDrive) {
    nodes.lastDistortionDrive = driveKey
    nodes.distortionShaper.curve = new Float32Array(
      makeDistortionCurve(mapDistortionDrive(distDrive)),
    )
  }

  const compAmount = clamp(compressor.amount, 0, 1)
  setAudioParam(
    nodes.compressorDry.gain,
    1 - compAmount * 0.85,
    now,
    rampSeconds,
  )
  setAudioParam(nodes.compressorWet.gain, compAmount, now, rampSeconds)
  setAudioParam(
    nodes.compressorNode.threshold,
    -6 - compAmount * 30,
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.compressorNode.ratio,
    1.4 + compAmount * 10,
    now,
    rampSeconds,
  )
  setAudioParam(nodes.compressorNode.knee, 8, now, rampSeconds)
  setAudioParam(
    nodes.compressorNode.attack,
    mapCompressorAttack(compressor.attack),
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.compressorNode.release,
    mapCompressorRelease(compressor.release),
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.compressorMakeup.gain,
    10 ** ((compAmount * 9) / 20),
    now,
    rampSeconds,
  )

  const wetMix = Math.min(
    1,
    estimatedNoiseWetMix(noise.amount) +
      delay.amount * 0.55 +
      reverb.amount * 0.34,
  )
  setAudioParam(
    nodes.postDry.gain,
    Math.max(0.38, 1 - wetMix * 0.32),
    now,
    rampSeconds,
  )
}

function mapPlaybackRate(speed: number, pitch: number): number {
  const speedFactor = 0.55 + speed * 0.45
  const pitchFactor = 0.55 + pitch * 0.725
  return speedFactor * pitchFactor
}

function applyMasterOut(
  nodes: SynthGraph,
  volume: number,
  gainDb: number,
  rampSeconds = 0.03,
) {
  const gain = mapMasterOutputGain(volume, gainDb)
  const now = nodes.context.currentTime
  setAudioParam(nodes.masterGain.gain, gain, now, rampSeconds)
}

let meterBuffer: Float32Array<ArrayBuffer> | null = null

export function readMasterPeak(): number {
  if (!graph) {
    return 0
  }

  const analyser = graph.analyser
  if (!meterBuffer || meterBuffer.length !== analyser.fftSize) {
    meterBuffer = new Float32Array(analyser.fftSize)
  }

  analyser.getFloatTimeDomainData(meterBuffer)
  let peak = 0
  for (let i = 0; i < meterBuffer.length; i += 1) {
    const sample = Math.abs(meterBuffer[i] ?? 0)
    if (sample > peak) {
      peak = sample
    }
  }
  return peak
}

function applyIntensityToGraph(
  nodes: SynthGraph,
  intensity: number,
  rampSeconds = 0.03,
) {
  const context = nodes.context
  const now = context.currentTime
  const i = clamp(intensity, 0, 1) * 0.88

  setAudioParam(
    nodes.dryGain.gain,
    intensity < 0.02 ? 1 : Math.max(0.12, 1 - i * 0.88),
    now,
    rampSeconds,
  )
  setAudioParam(
    nodes.wetGain.gain,
    intensity < 0.02 ? 0 : i,
    now,
    rampSeconds,
  )

  setAudioParam(
    nodes.combDelay.delayTime,
    0.0015 + (1 - i) * 0.012,
    now,
    rampSeconds,
  )
  setAudioParam(nodes.combFeedback.gain, 0.12 + i * 0.52, now, rampSeconds)
  setAudioParam(nodes.combWet.gain, 0.18 + i * 0.48, now, rampSeconds)
  setAudioParam(nodes.combDry.gain, 0.5 + (1 - i) * 0.32, now, rampSeconds)

  setAudioParam(nodes.highpass.frequency, 180 + i * 200, now, rampSeconds)
  setAudioParam(nodes.bandpass.frequency, 650 + i * 1200, now, rampSeconds)
  setAudioParam(nodes.bandpass.Q, 2 + i * 10, now, rampSeconds)
  nodes.shaper.curve = new Float32Array(makeDistortionCurve(100 + i * 720))

  setAudioParam(nodes.ringOsc.frequency, 28 + i * 115, now, rampSeconds)
  setAudioParam(nodes.ringDepth.gain, 0.28 + i * 0.68, now, rampSeconds)

  setAudioParam(nodes.amOsc.frequency, 55 + i * 130, now, rampSeconds)
  setAudioParam(nodes.amDepth.gain, 0.08 + i * 0.38, now, rampSeconds)

  setAudioParam(nodes.outputGain.gain, 1.04 + i * 0.28, now, rampSeconds)
}

export function computeExportTailSeconds(postProcess: PostProcessParams): number {
  let tail = EXPORT_TAIL_FLOOR_SECONDS

  const reverb = postProcess.reverb
  if (reverb.amount > 0.01) {
    const roomSeconds = mapReverbDuration(reverb.roomSize)
    const decayFactor = 0.45 + reverb.decay * 0.85
    tail = Math.max(tail, roomSeconds * decayFactor)
  }

  const delay = postProcess.delay
  if (delay.amount > 0.01) {
    const delayTime = mapDelayTimeMs(delay.length)
    const feedback = clamp(delay.feedback, 0, 1) * 0.88

    if (feedback > 0.05) {
      const echoCount = Math.log(0.001) / Math.log(feedback)
      tail = Math.max(tail, delayTime * echoCount + delayTime)
    } else {
      tail = Math.max(tail, delayTime * 2)
    }
  }

  return tail + 0.08
}

function buildSynthGraph(
  context: BaseAudioContext,
  destination: AudioNode,
  useBitcrushWorklet: boolean,
): SynthGraph {
  const combInput = context.createGain()
  const combOutput = context.createGain()
  const combDry = context.createGain()
  const combDelay = context.createDelay(0.05)
  const combFeedback = context.createGain()
  const combWet = context.createGain()

  combInput.connect(combDry)
  combInput.connect(combDelay)
  combDelay.connect(combFeedback)
  combFeedback.connect(combDelay)
  combDelay.connect(combWet)
  combDry.connect(combOutput)
  combWet.connect(combOutput)

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  const bandpass = context.createBiquadFilter()
  bandpass.type = 'bandpass'
  const shaper = context.createWaveShaper()
  shaper.oversample = '4x'

  const ringCarrier = context.createGain()
  ringCarrier.gain.value = 0
  const ringOsc = context.createOscillator()
  ringOsc.type = 'sine'
  const ringDepth = context.createGain()
  const ringOffset = context.createConstantSource()
  ringOffset.offset.value = 0.55

  const amGain = context.createGain()
  amGain.gain.value = 1
  const amOsc = context.createOscillator()
  amOsc.type = 'square'
  const amDepth = context.createGain()
  const amOffset = context.createConstantSource()
  amOffset.offset.value = 0.75

  const dryGain = context.createGain()
  const wetGain = context.createGain()
  const outputGain = context.createGain()
  const vocoder = buildVocoderBank(context)

  vocoder.output.connect(dryGain)
  vocoder.output.connect(combInput)

  const postInput = context.createGain()
  const postDry = context.createGain()
  const postMix = context.createGain()
  const delayIn = context.createGain()
  const delayNode = context.createDelay(1)
  const delayFeedback = context.createGain()
  const delayWet = context.createGain()
  const reverbIn = context.createGain()
  const convolver = context.createConvolver()
  convolver.buffer = createReverbImpulse(context, 2.4, 2.2)
  convolver.normalize = false
  const reverbWet = context.createGain()
  const noiseGain = context.createGain()
  const noiseToneFilter = context.createBiquadFilter()
  noiseToneFilter.type = 'lowpass'
  noiseToneFilter.Q.value = 0.7

  const noiseBuffer = context.createBuffer(
    1,
    context.sampleRate * 2,
    context.sampleRate,
  )
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseData.length; i += 1) {
    noiseData[i] = Math.random() * 2 - 1
  }
  const noiseSource = context.createBufferSource()
  noiseSource.buffer = noiseBuffer
  noiseSource.loop = true
  noiseSource.playbackRate.value = mapNoisePitch(DEFAULT_POST_PROCESS.noise.pitch)

  const bitcrushIn = context.createGain()
  const bitcrushDry = context.createGain()
  const bitcrushWet = context.createGain()
  const bitcrushOut = context.createGain()
  const bitcrushShaper = context.createWaveShaper()
  bitcrushShaper.curve = new Float32Array(makeBitcrushCurve(DEFAULT_POST_PROCESS.bitcrush.bits))
  const bitcrushFilter = context.createBiquadFilter()
  bitcrushFilter.type = 'lowpass'
  bitcrushFilter.Q.value = 0.7
  let bitcrushWorklet: AudioWorkletNode | null = null
  if (useBitcrushWorklet) {
    try {
      bitcrushWorklet = new AudioWorkletNode(context, 'bitcrusher', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })
    } catch {
      bitcrushWorklet = null
    }
  }

  const radioIn = context.createGain()
  const radioDry = context.createGain()
  const radioWet = context.createGain()
  const radioOut = context.createGain()
  const radioHighpass = context.createBiquadFilter()
  radioHighpass.type = 'highpass'
  radioHighpass.Q.value = 0.8
  const radioLowpass = context.createBiquadFilter()
  radioLowpass.type = 'lowpass'
  radioLowpass.Q.value = 0.8
  const radioShaper = context.createWaveShaper()
  radioShaper.oversample = '2x'
  radioShaper.curve = new Float32Array(
    makeDistortionCurve(20 + DEFAULT_POST_PROCESS.radio.grit * 480),
  )

  const chorusIn = context.createGain()
  const chorusDry = context.createGain()
  const chorusWet = context.createGain()
  const chorusOut = context.createGain()
  const chorusDelayL = context.createDelay(0.08)
  const chorusDelayR = context.createDelay(0.08)
  chorusDelayL.delayTime.value = 0.017
  chorusDelayR.delayTime.value = 0.024
  const chorusLfoL = context.createOscillator()
  const chorusLfoR = context.createOscillator()
  chorusLfoL.type = 'sine'
  chorusLfoR.type = 'sine'
  const chorusLfoGainL = context.createGain()
  const chorusLfoGainR = context.createGain()
  const chorusPanL = context.createStereoPanner()
  const chorusPanR = context.createStereoPanner()
  chorusPanL.pan.value = -0.7
  chorusPanR.pan.value = 0.7

  const compressorIn = context.createGain()
  const compressorDry = context.createGain()
  const compressorWet = context.createGain()
  const compressorOut = context.createGain()
  const compressorNode = context.createDynamicsCompressor()
  const compressorMakeup = context.createGain()

  const distortionIn = context.createGain()
  const distortionDry = context.createGain()
  const distortionWet = context.createGain()
  const distortionOut = context.createGain()
  const distortionShaper = context.createWaveShaper()
  distortionShaper.oversample = '4x'
  distortionShaper.curve = new Float32Array(
    makeDistortionCurve(mapDistortionDrive(DEFAULT_POST_PROCESS.distortion.drive)),
  )
  const distortionTone = context.createBiquadFilter()
  distortionTone.type = 'lowpass'
  distortionTone.Q.value = 0.7
  distortionTone.frequency.value = mapDistortionToneCutoff(
    DEFAULT_POST_PROCESS.distortion.tone,
  )

  outputGain.connect(bitcrushIn)
  bitcrushIn.connect(bitcrushDry)
  bitcrushDry.connect(bitcrushOut)
  if (bitcrushWorklet) {
    bitcrushIn.connect(bitcrushWorklet)
    bitcrushWorklet.connect(bitcrushWet)
  } else {
    bitcrushIn.connect(bitcrushShaper)
    bitcrushShaper.connect(bitcrushFilter)
    bitcrushFilter.connect(bitcrushWet)
  }
  bitcrushWet.connect(bitcrushOut)
  bitcrushOut.connect(radioIn)

  radioIn.connect(radioDry)
  radioDry.connect(radioOut)
  radioIn.connect(radioHighpass)
  radioHighpass.connect(radioLowpass)
  radioLowpass.connect(radioShaper)
  radioShaper.connect(radioWet)
  radioWet.connect(radioOut)
  radioOut.connect(chorusIn)

  chorusIn.connect(chorusDry)
  chorusDry.connect(chorusOut)
  chorusIn.connect(chorusDelayL)
  chorusIn.connect(chorusDelayR)
  chorusDelayL.connect(chorusPanL)
  chorusDelayR.connect(chorusPanR)
  chorusPanL.connect(chorusWet)
  chorusPanR.connect(chorusWet)
  chorusWet.connect(chorusOut)
  chorusLfoL.connect(chorusLfoGainL)
  chorusLfoR.connect(chorusLfoGainR)
  chorusLfoGainL.connect(chorusDelayL.delayTime)
  chorusLfoGainR.connect(chorusDelayR.delayTime)
  chorusOut.connect(postInput)

  postInput.connect(postDry)
  postInput.connect(delayIn)
  delayIn.connect(delayNode)
  delayNode.connect(delayFeedback)
  delayFeedback.connect(delayNode)
  delayNode.connect(delayWet)
  postInput.connect(reverbIn)
  reverbIn.connect(convolver)
  convolver.connect(reverbWet)
  postDry.connect(postMix)
  delayWet.connect(postMix)
  reverbWet.connect(postMix)
  noiseSource.connect(noiseToneFilter)
  noiseToneFilter.connect(noiseGain)
  noiseGain.connect(postMix)
  postMix.connect(distortionIn)
  distortionIn.connect(distortionDry)
  distortionDry.connect(distortionOut)
  distortionIn.connect(distortionShaper)
  distortionShaper.connect(distortionTone)
  distortionTone.connect(distortionWet)
  distortionWet.connect(distortionOut)
  distortionOut.connect(compressorIn)
  compressorIn.connect(compressorDry)
  compressorDry.connect(compressorOut)
  compressorIn.connect(compressorNode)
  compressorNode.connect(compressorMakeup)
  compressorMakeup.connect(compressorWet)
  compressorWet.connect(compressorOut)
  const masterGain = context.createGain()
  masterGain.gain.value = DEFAULT_MASTER_VOLUME
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0

  compressorOut.connect(masterGain)
  masterGain.connect(destination)
  masterGain.connect(analyser)

  combOutput.connect(highpass)
  highpass.connect(bandpass)
  bandpass.connect(shaper)
  shaper.connect(ringCarrier)
  ringOsc.connect(ringDepth)
  ringDepth.connect(ringCarrier.gain)
  ringOffset.connect(ringCarrier.gain)
  ringCarrier.connect(amGain)
  amOsc.connect(amDepth)
  amDepth.connect(amGain.gain)
  amOffset.connect(amGain.gain)
  amGain.connect(wetGain)
  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  return {
    context,
    dryGain,
    wetGain,
    combDry,
    combDelay,
    combFeedback,
    combWet,
    highpass,
    bandpass,
    shaper,
    ringCarrier,
    ringOsc,
    ringDepth,
    ringOffset,
    amGain,
    amOsc,
    amDepth,
    amOffset,
    outputGain,
    combInput,
    combOutput,
    postInput,
    postDry,
    postMix,
    delayIn,
    delayNode,
    delayFeedback,
    delayWet,
    reverbIn,
    convolver,
    reverbWet,
    noiseGain,
    noiseToneFilter,
    noiseSource,
    lastReverbRoom: -1,
    lastReverbDecay: -1,
    lastCrushBits: -1,
    lastRadioGrit: -1,
    lastDistortionDrive: -1,
    vocoder,
    bitcrushIn,
    bitcrushDry,
    bitcrushWet,
    bitcrushOut,
    bitcrushWorklet,
    bitcrushShaper,
    bitcrushFilter,
    radioIn,
    radioDry,
    radioWet,
    radioOut,
    radioHighpass,
    radioLowpass,
    radioShaper,
    chorusIn,
    chorusDry,
    chorusWet,
    chorusOut,
    chorusDelayL,
    chorusDelayR,
    chorusLfoL,
    chorusLfoR,
    chorusLfoGainL,
    chorusLfoGainR,
    chorusPanL,
    chorusPanR,
    compressorIn,
    compressorDry,
    compressorWet,
    compressorOut,
    compressorNode,
    compressorMakeup,
    distortionIn,
    distortionDry,
    distortionWet,
    distortionOut,
    distortionShaper,
    distortionTone,
    masterGain,
    analyser,
  }
}

async function ensureGraph(): Promise<SynthGraph> {
  if (graph) {
    return graph
  }

  if (!graphReady) {
    graphReady = (async () => {
      const context = new AudioContext()
      const useWorklet = await loadBitcrusherWorklet(context)
      const nodes = buildSynthGraph(context, context.destination, useWorklet)
      applyIntensityToGraph(nodes, 0, 0)
      applyVocoderParams(nodes.vocoder, DEFAULT_VOCODER_PARAMS, 1, 0)
      applyPostProcessToGraph(nodes, DEFAULT_POST_PROCESS, 0)
      applyMasterOut(
        nodes,
        currentParams.masterVolume,
        currentParams.masterGainDb,
        0,
      )

      nodes.vocoder.carrier.saw.start()
      nodes.vocoder.carrier.square.start()
      nodes.vocoder.unvoice.noise.start()
      nodes.ringOsc.start()
      nodes.ringOffset.start()
      nodes.amOsc.start()
      nodes.amOffset.start()
      nodes.noiseSource.start()
      nodes.chorusLfoL.start()
      nodes.chorusLfoR.start()

      graph = nodes
      return nodes
    })().catch((error) => {
      graphReady = null
      throw error
    })
  }

  return graphReady
}

function scheduleOfflineGraph(
  nodes: SynthGraph,
  params: LiveSynthParams,
  samples: Float32Array,
  speechSeconds: number,
) {
  applyIntensityToGraph(nodes, params.metallic, 0)
  applyVocoderParams(nodes.vocoder, params.vocoder, params.pitch, 0)
  applyPostProcessToGraph(nodes, params.postProcess, 0)
  applyMasterOut(nodes, params.masterVolume, params.masterGainDb, 0)

  const playbackRate = mapPlaybackRate(params.speed, params.pitch)
  scheduleSpeechGatedNoise(
    nodes,
    samples,
    playbackRate,
    params.postProcess.noise,
    0,
  )

  nodes.vocoder.carrier.saw.start(0)
  nodes.vocoder.carrier.square.start(0)
  nodes.vocoder.unvoice.noise.start(0)
  nodes.vocoder.unvoice.noise.stop(Math.max(0.01, speechSeconds))
  nodes.ringOsc.start(0)
  nodes.ringOffset.start(0)
  nodes.amOsc.start(0)
  nodes.amOffset.start(0)
  nodes.noiseSource.start(0)
  nodes.noiseSource.stop(Math.max(0.01, speechSeconds))
  nodes.chorusLfoL.start(0)
  nodes.chorusLfoR.start(0)
}

export async function renderSynthOffline(
  samples: Float32Array,
  params: LiveSynthParams,
): Promise<AudioBuffer> {
  const merged: LiveSynthParams = {
    ...params,
    postProcess: mergePostProcess(DEFAULT_POST_PROCESS, params.postProcess),
    masterVolume: params.masterVolume ?? DEFAULT_MASTER_VOLUME,
    masterGainDb: params.masterGainDb ?? DEFAULT_MASTER_GAIN_DB,
  }

  const playbackRate = mapPlaybackRate(merged.speed, merged.pitch)
  const speechSeconds = samples.length / SAM_SAMPLE_RATE / playbackRate
  const tailSeconds = computeExportTailSeconds(merged.postProcess)
  const totalSeconds = speechSeconds + tailSeconds
  const frameCount = Math.ceil(totalSeconds * OFFLINE_SAMPLE_RATE)
  const offline = new OfflineAudioContext(2, frameCount, OFFLINE_SAMPLE_RATE)
  const useWorklet = await loadBitcrusherWorklet(offline)
  const nodes = buildSynthGraph(offline, offline.destination, useWorklet)

  scheduleOfflineGraph(nodes, merged, samples, speechSeconds)

  const sourceBuffer = offline.createBuffer(1, samples.length, SAM_SAMPLE_RATE)
  sourceBuffer.copyToChannel(new Float32Array(samples), 0)

  const source = offline.createBufferSource()
  source.buffer = sourceBuffer
  source.playbackRate.value = playbackRate
  source.connect(nodes.vocoder.input)
  source.start(0)

  return offline.startRendering()
}

function setAudioBufferFromSamples(samples: Float32Array, nodes: SynthGraph) {
  speechSamples = samples
  audioBuffer = nodes.context.createBuffer(1, samples.length, SAM_SAMPLE_RATE)
  audioBuffer.copyToChannel(new Float32Array(samples), 0)
}

function stopSourceOnly() {
  if (activeSource) {
    // Detach before stop so intentional restarts/cancels don't fire onEnd.
    activeSource.onended = null
    try {
      activeSource.stop()
    } catch {
      // Already stopped.
    }
    activeSource = null
  }

  if (graph) {
    const now = graph.context.currentTime
    graph.noiseGain.gain.cancelScheduledValues(now)
    graph.noiseGain.gain.setValueAtTime(0, now)
  }
}

function handleSourceEnded(event: Event) {
  // Ignore ended events from sources we already replaced or cancelled.
  if (event.target !== activeSource) {
    return
  }

  activeSource = null

  if (cancelled) {
    return
  }

  if (loopEnabled && audioBuffer) {
    startSource()
    return
  }

  onEndCallback?.()
}

function startSource(bufferOffsetSeconds = 0) {
  if (!audioBuffer || !graph || cancelled) {
    return
  }

  const nodes = graph
  stopSourceOnly()

  const liveContext = nodes.context as AudioContext
  if (liveContext.state === 'suspended' && !playbackPaused) {
    void liveContext.resume()
  }

  const maxOffset = Math.max(0, audioBuffer.duration - 0.001)
  const offset = Math.min(Math.max(0, bufferOffsetSeconds), maxOffset)

  const source = nodes.context.createBufferSource()
  source.buffer = audioBuffer
  sourcePlaybackRate = mapPlaybackRate(
    currentParams.speed,
    currentParams.pitch,
  )
  source.playbackRate.value = sourcePlaybackRate
  source.connect(nodes.vocoder.input)
  source.onended = handleSourceEnded

  sourceStartTime = nodes.context.currentTime
  sourceOffsetSeconds = offset
  lastPositionTime = sourceStartTime
  if (speechSamples) {
    scheduleSpeechGatedNoise(
      nodes,
      speechSamples,
      sourcePlaybackRate,
      currentParams.postProcess.noise,
      sourceStartTime,
      offset / sourcePlaybackRate,
    )
  }

  activeSource = source
  source.start(0, offset)
}

function captureSourcePosition() {
  if (!graph || !activeSource) {
    return
  }

  const now = graph.context.currentTime
  sourceOffsetSeconds += Math.max(0, now - lastPositionTime) * sourcePlaybackRate
  lastPositionTime = now
}

export function getSynthPlaybackProgress(): number {
  if (!audioBuffer || audioBuffer.duration <= 0) {
    return 0
  }

  captureSourcePosition()
  return Math.min(1, Math.max(0, sourceOffsetSeconds / audioBuffer.duration))
}

export function setSynthLoop(enabled: boolean) {
  loopEnabled = enabled
}

export function getSynthLoop(): boolean {
  return loopEnabled
}

export function replaceSynthSamples(samples: Float32Array) {
  if (!graph || cancelled) {
    return
  }

  const wasActive = activeSource !== null
  if (wasActive) {
    captureSourcePosition()
  }

  const previousDuration = audioBuffer?.duration ?? 0
  const progress =
    previousDuration > 0
      ? Math.min(1, Math.max(0, sourceOffsetSeconds / previousDuration))
      : 0

  setAudioBufferFromSamples(samples, graph)

  if (!wasActive || !audioBuffer) {
    return
  }

  startSource(progress * audioBuffer.duration)

  if (playbackPaused) {
    const liveContext = graph.context as AudioContext
    if (liveContext.state === 'running') {
      void liveContext.suspend()
    }
  }
}

export function updateLiveSynthParams(
  params: Partial<LiveSynthParams>,
  options?: { immediate?: boolean; applySourceRate?: boolean },
) {
  currentParams = {
    speed: params.speed ?? currentParams.speed,
    pitch: params.pitch ?? currentParams.pitch,
    metallic: params.metallic ?? currentParams.metallic,
    postProcess: mergePostProcess(
      currentParams.postProcess,
      params.postProcess,
    ),
    vocoder: {
      ...currentParams.vocoder,
      ...params.vocoder,
      bands: params.vocoder?.bands
        ? params.vocoder.bands.map((band, index) => ({
            ...currentParams.vocoder.bands[index],
            ...band,
          }))
        : currentParams.vocoder.bands,
    },
    masterVolume: params.masterVolume ?? currentParams.masterVolume,
    masterGainDb: params.masterGainDb ?? currentParams.masterGainDb,
  }

  if (!graph) {
    return
  }

  const rampSeconds = options?.immediate ? 0 : 0.03

  applyIntensityToGraph(graph, currentParams.metallic, rampSeconds)
  applyVocoderParams(
    graph.vocoder,
    currentParams.vocoder,
    currentParams.pitch,
    rampSeconds,
  )
  applyPostProcessToGraph(graph, currentParams.postProcess, rampSeconds)
  applyMasterOut(
    graph,
    currentParams.masterVolume,
    currentParams.masterGainDb,
    rampSeconds,
  )

  if (!activeSource || options?.applySourceRate === false) {
    return
  }

  captureSourcePosition()
  sourcePlaybackRate = mapPlaybackRate(
    currentParams.speed,
    currentParams.pitch,
  )
  const now = graph.context.currentTime
  if (options?.immediate) {
    activeSource.playbackRate.cancelScheduledValues(now)
    activeSource.playbackRate.setValueAtTime(sourcePlaybackRate, now)
  } else {
    activeSource.playbackRate.setTargetAtTime(sourcePlaybackRate, now, 0.03)
  }

  if (speechSamples) {
    scheduleSpeechGatedNoise(
      graph,
      speechSamples,
      sourcePlaybackRate,
      currentParams.postProcess.noise,
      now,
      sourceOffsetSeconds / sourcePlaybackRate,
    )
  }
}

export function stopSynthPlayback(options?: { clearLoop?: boolean }) {
  cancelled = true
  playbackGeneration += 1
  playbackPaused = false
  if (options?.clearLoop ?? true) {
    loopEnabled = false
  }
  stopSourceOnly()
  sourceOffsetSeconds = 0
  lastPositionTime = 0
  onEndCallback = null
  if (graph) {
    const liveContext = graph.context as AudioContext
    if (liveContext.state === 'suspended') {
      void liveContext.resume()
    }
  }
}

export function startSynthPlayback(
  samples: Float32Array,
  params: LiveSynthParams,
  callbacks: {
    loop?: boolean
    onEnd?: () => void
    onError?: (message: string) => void
  },
) {
  cancelled = false
  const generation = ++playbackGeneration
  playbackPaused = false
  currentParams = {
    ...params,
    postProcess: mergePostProcess(DEFAULT_POST_PROCESS, params.postProcess),
    vocoder: {
      ...DEFAULT_VOCODER_PARAMS,
      ...params.vocoder,
      bands: (params.vocoder?.bands ?? DEFAULT_VOCODER_PARAMS.bands).map(
        (band) => ({ ...band }),
      ),
    },
    masterVolume: params.masterVolume ?? DEFAULT_MASTER_VOLUME,
    masterGainDb: params.masterGainDb ?? DEFAULT_MASTER_GAIN_DB,
  }
  loopEnabled = callbacks.loop ?? false
  onEndCallback = callbacks.onEnd ?? null
  sourceOffsetSeconds = 0
  lastPositionTime = 0

  void (async () => {
    try {
      const nodes = await ensureGraph()
      if (cancelled || generation !== playbackGeneration) {
        return
      }
      setAudioBufferFromSamples(samples, nodes)
      applyIntensityToGraph(nodes, currentParams.metallic, 0)
      applyVocoderParams(
        nodes.vocoder,
        currentParams.vocoder,
        currentParams.pitch,
        0,
      )
      applyPostProcessToGraph(nodes, currentParams.postProcess, 0)
      applyMasterOut(
        nodes,
        currentParams.masterVolume,
        currentParams.masterGainDb,
        0,
      )
      startSource()
    } catch {
      if (generation === playbackGeneration) {
        callbacks.onError?.('Audio playback failed.')
      }
    }
  })()
}

export function cancelMetallicPlayback() {
  stopSynthPlayback({ clearLoop: false })
}
