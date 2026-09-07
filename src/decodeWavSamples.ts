/** Target rate expected by speechSynthEngine (SAM native rate). */
export const SPEECH_SAMPLE_RATE = 22050

function readString(view: DataView, offset: number, length: number): string {
  let text = ''
  for (let i = 0; i < length; i += 1) {
    text += String.fromCharCode(view.getUint8(offset + i))
  }
  return text
}

function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || input.length === 0) {
    return input
  }

  const ratio = fromRate / toRate
  const outLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outLength)

  for (let i = 0; i < outLength; i += 1) {
    const src = i * ratio
    const left = Math.floor(src)
    const right = Math.min(input.length - 1, left + 1)
    const frac = src - left
    output[i] = input[left] * (1 - frac) + input[right] * frac
  }

  return output
}

/** Decode a PCM WAV (8/16/32-bit) to mono float samples at SPEECH_SAMPLE_RATE. */
export function decodeWavToSpeechSamples(
  wav: ArrayBuffer | Uint8Array,
): Float32Array | null {
  const bytes = wav instanceof Uint8Array ? wav : new Uint8Array(wav)
  if (bytes.byteLength < 44) {
    return null
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (readString(view, 0, 4) !== 'RIFF' || readString(view, 8, 4) !== 'WAVE') {
    return null
  }

  let offset = 12
  let sampleRate = 0
  let numChannels = 0
  let bitsPerSample = 0
  let dataOffset = -1
  let dataLength = 0

  while (offset + 8 <= view.byteLength) {
    const chunkId = readString(view, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    const next = offset + 8 + chunkSize

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      numChannels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
    } else if (chunkId === 'data') {
      dataOffset = offset + 8
      dataLength = chunkSize
      break
    }

    offset = next + (chunkSize % 2)
  }

  if (
    dataOffset < 0 ||
    sampleRate <= 0 ||
    numChannels <= 0 ||
    ![8, 16, 32].includes(bitsPerSample)
  ) {
    return null
  }

  const frameCount = Math.floor(
    dataLength / ((numChannels * bitsPerSample) / 8),
  )
  if (frameCount <= 0) {
    return null
  }

  const mono = new Float32Array(frameCount)
  let cursor = dataOffset

  for (let i = 0; i < frameCount; i += 1) {
    let sample = 0
    for (let channel = 0; channel < numChannels; channel += 1) {
      let channelSample = 0
      if (bitsPerSample === 8) {
        channelSample = (view.getUint8(cursor) - 128) / 128
        cursor += 1
      } else if (bitsPerSample === 16) {
        channelSample = view.getInt16(cursor, true) / 0x8000
        cursor += 2
      } else {
        channelSample = view.getFloat32(cursor, true)
        cursor += 4
      }
      sample += channelSample
    }
    mono[i] = sample / numChannels
  }

  return resampleLinear(mono, sampleRate, SPEECH_SAMPLE_RATE)
}

export async function decodeWavBlobToSpeechSamples(
  blob: Blob,
): Promise<Float32Array | null> {
  return decodeWavToSpeechSamples(await blob.arrayBuffer())
}
