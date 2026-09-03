/** Project-specific fixes for words CMU/SAM often mishandle. ARPAbet. */
export const PRONUNCIATION_OVERRIDES: Record<string, string> = {
  atari: 'AH T AA R IY',
  browser: 'B R AW1 Z ER0',
  placeholder: 'P L EY1 S HH OW2 L D ER0',
  synthesiser: 'S IH1 N TH AH0 S AY2 Z ER0',
  synthesizer: 'S IH1 N TH AH0 S AY2 Z ER0',
  synth: 'S IH1 N TH',
  tts: 'T IY1 T IY1 EH1 S',
  ui: 'Y UW1 AY1',
  vocoder: 'V OW1 K OW2 D ER0',
  sam: 'S AE1 M',
  st: 'EH1 S T IY1',
  webspeech: 'W EH1 B S P IY1 CH',
}
