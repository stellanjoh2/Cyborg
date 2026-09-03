class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 8, minValue: 1.5, maxValue: 16 },
      { name: 'downsample', defaultValue: 1, minValue: 1, maxValue: 32 },
    ]
  }

  constructor() {
    super()
    this.phase = 0
    this.held = [0, 0]
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0 || !output || output.length === 0) {
      return true
    }

    const bits = parameters.bits
    const downs = parameters.downsample
    const frameCount = output[0].length
    const channels = output.length

    for (let i = 0; i < frameCount; i += 1) {
      const bitValue = bits.length > 1 ? bits[i] : bits[0]
      const downValue = Math.max(1, downs.length > 1 ? downs[i] : downs[0])
      const step = 2 ** (bitValue - 1)

      this.phase += 1
      if (this.phase >= downValue) {
        this.phase = 0
        for (let channel = 0; channel < channels; channel += 1) {
          const source = input[channel] ?? input[0]
          const sample = source ? source[i] : 0
          this.held[channel] = Math.round(sample * step) / step
        }
      }

      for (let channel = 0; channel < channels; channel += 1) {
        output[channel][i] = this.held[channel] ?? 0
      }
    }

    return true
  }
}

registerProcessor('bitcrusher', BitcrusherProcessor)
