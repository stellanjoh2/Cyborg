export interface LxFormant {
  frequency: number
  bandwidth: number
  gain: number
}

export interface LxNoiseBand {
  frequency: number
  bandwidth: number
  gain: number
}

export interface LxPhoneme {
  durationMs: number
  voiced: number
  gain: number
  formants: readonly LxFormant[]
  noise?: LxNoiseBand
  transient?: boolean
}

const vowel = (
  durationMs: number,
  f1: number,
  f2: number,
  f3: number,
): LxPhoneme => ({
  durationMs,
  voiced: 1,
  gain: 1,
  formants: [
    { frequency: f1, bandwidth: 75, gain: 1 },
    { frequency: f2, bandwidth: 105, gain: 0.62 },
    { frequency: f3, bandwidth: 145, gain: 0.34 },
  ],
})

const voiced = (
  durationMs: number,
  formants: readonly [number, number, number],
  noise?: LxNoiseBand,
): LxPhoneme => ({
  durationMs,
  voiced: noise ? 0.72 : 1,
  gain: 0.78,
  formants: [
    { frequency: formants[0], bandwidth: 95, gain: 1 },
    { frequency: formants[1], bandwidth: 135, gain: 0.55 },
    { frequency: formants[2], bandwidth: 190, gain: 0.28 },
  ],
  noise,
})

const unvoiced = (
  durationMs: number,
  frequency: number,
  bandwidth: number,
  gain = 0.72,
  transient = false,
): LxPhoneme => ({
  durationMs,
  voiced: 0,
  gain,
  formants: [],
  noise: { frequency, bandwidth, gain: 1 },
  transient,
})

/** Male-leaning ARPAbet source-filter targets, intentionally narrow and synthetic. */
export const LX_PHONEMES: Readonly<Record<string, LxPhoneme>> = {
  AA: vowel(150, 730, 1090, 2440),
  AE: vowel(145, 660, 1720, 2410),
  AH: vowel(125, 640, 1190, 2390),
  AO: vowel(150, 570, 840, 2410),
  AW: vowel(170, 650, 1200, 2400),
  AY: vowel(170, 620, 1600, 2550),
  EH: vowel(130, 530, 1840, 2480),
  ER: vowel(150, 490, 1350, 1690),
  EY: vowel(160, 500, 1960, 2550),
  IH: vowel(115, 390, 1990, 2550),
  IY: vowel(145, 270, 2290, 3010),
  OW: vowel(165, 500, 900, 2400),
  OY: vowel(175, 560, 1050, 2450),
  UH: vowel(120, 440, 1020, 2240),
  UW: vowel(150, 300, 870, 2240),

  B: voiced(62, [300, 900, 2200], { frequency: 700, bandwidth: 900, gain: 0.4 }),
  CH: unvoiced(105, 3400, 2100, 0.82, true),
  D: voiced(58, [350, 1700, 2600], { frequency: 2800, bandwidth: 1800, gain: 0.38 }),
  DH: voiced(82, [450, 1500, 2500], { frequency: 4200, bandwidth: 2500, gain: 0.42 }),
  F: unvoiced(105, 5200, 3200, 0.68),
  G: voiced(70, [300, 1350, 2350], { frequency: 1800, bandwidth: 1500, gain: 0.35 }),
  HH: unvoiced(82, 2600, 3000, 0.52),
  JH: voiced(105, [400, 1700, 2600], { frequency: 3200, bandwidth: 2000, gain: 0.62 }),
  K: unvoiced(78, 2100, 1800, 0.72, true),
  P: unvoiced(72, 1100, 1700, 0.62, true),
  S: unvoiced(120, 6500, 2600, 0.8),
  SH: unvoiced(125, 3400, 1900, 0.84),
  T: unvoiced(70, 4300, 2300, 0.76, true),
  TH: unvoiced(105, 4700, 3000, 0.64),
  V: voiced(92, [400, 1300, 2500], { frequency: 5000, bandwidth: 3000, gain: 0.48 }),
  Z: voiced(105, [420, 1550, 2600], { frequency: 6000, bandwidth: 2500, gain: 0.58 }),
  ZH: voiced(115, [430, 1500, 2450], { frequency: 3100, bandwidth: 1800, gain: 0.58 }),

  L: voiced(95, [360, 1100, 2700]),
  M: voiced(105, [260, 1050, 2200]),
  N: voiced(95, [280, 1700, 2600]),
  NG: voiced(110, [300, 2000, 2850]),
  R: voiced(100, [340, 1300, 1700]),
  W: voiced(90, [310, 800, 2200]),
  Y: voiced(88, [280, 2200, 3000]),

  // Common extended CMU/allophone symbols.
  AX: vowel(105, 500, 1500, 2500),
  AXR: vowel(125, 490, 1350, 1690),
  DX: voiced(45, [350, 1650, 2600]),
  EL: voiced(100, [360, 1100, 2700]),
  EM: voiced(105, [260, 1050, 2200]),
  EN: voiced(100, [280, 1700, 2600]),
  NX: voiced(100, [280, 1800, 2700]),
  Q: unvoiced(55, 1600, 2300, 0.5, true),
}

export const STANDARD_ARPABET_PHONEMES = [
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'B', 'CH', 'D', 'DH',
  'EH', 'ER', 'EY', 'F', 'G', 'HH', 'IH', 'IY', 'JH', 'K',
  'L', 'M', 'N', 'NG', 'OW', 'OY', 'P', 'R', 'S', 'SH',
  'T', 'TH', 'UH', 'UW', 'V', 'W', 'Y', 'Z', 'ZH',
] as const
