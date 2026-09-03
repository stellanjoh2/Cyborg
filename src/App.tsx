import { useEffect, useMemo, useState } from 'react'
import { DevMode } from './components/DevMode'
import { Knob } from './components/Knob'
import {
  DEFAULT_POST_PROCESS_UI,
  formatBitcrushBits,
  formatBitcrushRate,
  formatChorusDepth,
  formatChorusRate,
  formatCompressorAttack,
  formatCompressorRelease,
  formatDelayFeedback,
  formatDelayLength,
  formatNoisePitch,
  formatNoiseTone,
  formatReverbDecay,
  formatReverbRoomSize,
  mapUiToPostProcess,
  type PostProcessUiState,
} from './postProcess'
import { resolveHumanRobotBlend } from './resolveHumanRobot'
import {
  DEFAULT_VOCODER_UI,
  formatBandPan,
  formatCarrierCutoff,
  formatCarrierMix,
  formatCarrierResonance,
  formatSigned63,
  mapUiToVocoder,
  VOCODER_BAND_COUNT,
  type VocoderUiState,
} from './vocoderParams'
import {
  cancelSamSpeech,
  exportSamWav,
  setSamLoop,
  speakSam,
  stopSamSpeech,
  updateSamLiveParams,
} from './samSpeech'
import { preloadPronunciationDictionary } from './samPronunciation'
import { cancelSpeechPlayback } from './speechPlayback'
import { getPresetById, VOICE_PRESETS, type VoiceId } from './voicePresets'
import './SpeechApp.css'

const DEFAULT_TEXT =
  '3 billion human lives ended on August 29, 1997. The survivors of the nuclear fire called the war Judgment Day. They lived only to face a new nightmare, the war against the Machines. The computer which controlled the machines, Skynet, sent two terminators back through time. Their mission: to destroy the leader of the human Resistance... John Connor. My son.'

export default function App() {
  const [text, setText] = useState(DEFAULT_TEXT)
  const [voiceId, setVoiceId] = useState<VoiceId>('default')
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [humanRobot, setHumanRobot] = useState(0)
  const [postUi, setPostUi] = useState<PostProcessUiState>(DEFAULT_POST_PROCESS_UI)
  const [vocoderUi, setVocoderUi] = useState<VocoderUiState>(DEFAULT_VOCODER_UI)
  const [betterEnglish, setBetterEnglish] = useState(true)
  const [isLooping, setIsLooping] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const livePlan = useMemo(
    () => resolveHumanRobotBlend(humanRobot, speed, pitch),
    [humanRobot, speed, pitch],
  )

  const postProcess = useMemo(() => mapUiToPostProcess(postUi), [postUi])
  const vocoder = useMemo(() => mapUiToVocoder(vocoderUi), [vocoderUi])

  const setVocoderKnob =
    (
      key: keyof Omit<VocoderUiState, 'bandLevels' | 'bandPans'>,
    ) =>
    (value: number) => {
      setVocoderUi((current) => ({ ...current, [key]: value }))
    }

  const setBandLevel = (index: number) => (value: number) => {
    setVocoderUi((current) => {
      const bandLevels = [...current.bandLevels]
      bandLevels[index] = value
      return { ...current, bandLevels }
    })
  }

  const setBandPan = (index: number) => (value: number) => {
    setVocoderUi((current) => {
      const bandPans = [...current.bandPans]
      bandPans[index] = value
      return { ...current, bandPans }
    })
  }

  const setPostKnob =
    (key: keyof PostProcessUiState) => (value: number) => {
      setPostUi((current) => ({ ...current, [key]: value }))
    }

  useEffect(() => {
    preloadPronunciationDictionary()
  }, [])

  useEffect(() => {
    if (!isSpeaking) {
      return
    }

    updateSamLiveParams({
      speed: livePlan.rate,
      pitch: livePlan.pitch,
      metallic: livePlan.metallic,
      vocoder,
    })
  }, [isSpeaking, livePlan, vocoder])

  useEffect(() => {
    if (!isSpeaking) {
      return
    }

    updateSamLiveParams({
      postProcess,
    })
  }, [isSpeaking, postProcess])

  const handleVoiceChange = (nextVoiceId: VoiceId) => {
    if (nextVoiceId === 'custom') {
      setVoiceId('custom')
      return
    }

    const preset = getPresetById(nextVoiceId)
    setVoiceId(nextVoiceId)
    setSpeed(preset.speed)
    setPitch(preset.pitch)
    setHumanRobot(preset.humanRobot)
    setVocoderUi({
      ...DEFAULT_VOCODER_UI,
      ...preset.vocoder,
      bandLevels: [...preset.vocoder.bandLevels],
      bandPans: [...preset.vocoder.bandPans],
    })
  }

  const handleStop = () => {
    cancelSpeechPlayback()
    stopSamSpeech()
    setIsLooping(false)
    setSamLoop(false)
    setIsSpeaking(false)
  }

  const handleLoopToggle = () => {
    const next = !isLooping
    setIsLooping(next)
    setSamLoop(next)
  }

  const handlePlayback = () => {
    setError(null)

    const trimmed = text.trim()
    if (!trimmed) {
      setIsSpeaking(false)
      setError('Please enter some text.')
      return
    }

    setIsSpeaking(true)
    cancelSamSpeech()
    setSamLoop(isLooping)

    void speakSam({
      text: trimmed,
      speed: livePlan.rate,
      pitch: livePlan.pitch,
      metallic: livePlan.metallic,
      vocoder,
      postProcess,
      betterEnglish,
      loop: isLooping,
      onEnd: () => setIsSpeaking(false),
      onError: (message) => {
        setIsSpeaking(false)
        setError(message)
      },
    })
  }

  const handleExportWav = () => {
    setError(null)

    const trimmed = text.trim()
    if (!trimmed) {
      setError('Please enter some text.')
      return
    }

    setIsExporting(true)

    void exportSamWav({
      text: trimmed,
      speed: livePlan.rate,
      pitch: livePlan.pitch,
      metallic: livePlan.metallic,
      vocoder,
      postProcess,
      betterEnglish,
    })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'WAV export failed.'
        setError(message)
      })
      .finally(() => {
        setIsExporting(false)
      })
  }

  return (
    <>
      <main className="speech-app">
      <h1 className="speech-title">
        Cyborg Dominance<span className="speech-title__tm">TM</span>
      </h1>

      <label className="field">
        <span className="field-label">Text</span>
        <textarea
          className="field-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something..."
          rows={5}
        />
      </label>

      <label className="field">
        <span className="field-label">Voice</span>
        <select
          className="field-select"
          value={voiceId}
          onChange={(e) => handleVoiceChange(e.target.value as VoiceId)}
        >
          {VOICE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>

      <section className="knob-panel">
        <h2 className="section-title">Voice</h2>
        <div className="knob-grid knob-grid--voice">
          <Knob
            label="Robot"
            value={humanRobot}
            min={0}
            max={100}
            step={1}
            size="lg"
            onChange={setHumanRobot}
            format={(value) => String(Math.round(value))}
          />
          <Knob
            label="Speed"
            value={speed}
            min={0.3}
            max={2.5}
            step={0.01}
            size="lg"
            onChange={setSpeed}
            format={(value) => value.toFixed(2)}
          />
          <Knob
            label="Pitch"
            value={pitch}
            min={0}
            max={2}
            step={0.01}
            size="lg"
            onChange={setPitch}
            format={(value) => value.toFixed(2)}
          />
        </div>
      </section>

      <section className="vocoder-panel">
        <h2 className="section-title">Vocoder</h2>

        <div className="knob-grid vocoder-main">
          <Knob
            label="Cutoff"
            value={vocoderUi.cutoff}
            min={0}
            max={126}
            step={1}
            size="md"
            onChange={setVocoderKnob('cutoff')}
            format={(value) => formatSigned63(value)}
          />
          <Knob
            label="Resonance"
            value={vocoderUi.resonance}
            min={0}
            max={127}
            step={1}
            size="md"
            onChange={setVocoderKnob('resonance')}
            format={(value) => String(Math.round(value))}
          />
          <Knob
            label="E.F. sense"
            value={vocoderUi.efSense}
            min={0}
            max={126}
            step={1}
            size="md"
            onChange={setVocoderKnob('efSense')}
            format={(value) => String(Math.round(value))}
          />
        </div>

        <div className="fx-group vocoder-carrier">
          <h3 className="fx-title">Carrier</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={vocoderUi.carrierAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setVocoderKnob('carrierAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="SAW/SQR"
              value={vocoderUi.carrierMix}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setVocoderKnob('carrierMix')}
              format={(value) => formatCarrierMix(value)}
            />
            <Knob
              label="Tone"
              value={vocoderUi.carrierCutoff}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setVocoderKnob('carrierCutoff')}
              format={(value) => formatCarrierCutoff(value)}
            />
            <Knob
              label="Reso"
              value={vocoderUi.carrierResonance}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setVocoderKnob('carrierResonance')}
              format={(value) => formatCarrierResonance(value)}
            />
          </div>
        </div>

        <div className="band-grid">
          {Array.from({ length: VOCODER_BAND_COUNT }, (_, index) => (
            <div key={index} className="band-strip">
              <span className="band-strip__label">Band {index + 1}</span>
              <Knob
                label="Level"
                value={vocoderUi.bandLevels[index] ?? 100}
                min={0}
                max={127}
                step={1}
                size="md"
                onChange={setBandLevel(index)}
                format={(value) => String(Math.round(value))}
              />
              <Knob
                label="Pan"
                value={vocoderUi.bandPans[index] ?? 63}
                min={0}
                max={126}
                step={1}
                size="md"
                onChange={setBandPan(index)}
                format={(value) => formatBandPan(value)}
              />
            </div>
          ))}
        </div>
      </section>

      <label className="field checkbox-field">
        <input
          type="checkbox"
          checked={betterEnglish}
          onChange={(e) => setBetterEnglish(e.target.checked)}
        />
        <span>
          Better English (CMU dictionary + custom word fixes for SAM)
        </span>
      </label>

      <section className="post-process">
        <h2 className="section-title">Post-processing</h2>

        <div className="fx-group">
          <h3 className="fx-title">White noise</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={postUi.noiseAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('noiseAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Pitch"
              value={postUi.noisePitch}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('noisePitch')}
              format={(value) => formatNoisePitch(value)}
            />
            <Knob
              label="Tone"
              value={postUi.noiseTone}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('noiseTone')}
              format={(value) => formatNoiseTone(value)}
            />
          </div>
        </div>

        <div className="fx-group">
          <h3 className="fx-title">Reverb</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={postUi.reverbAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('reverbAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Room size"
              value={postUi.reverbRoomSize}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('reverbRoomSize')}
              format={(value) => formatReverbRoomSize(value)}
            />
            <Knob
              label="Decay"
              value={postUi.reverbDecay}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('reverbDecay')}
              format={(value) => formatReverbDecay(value)}
            />
          </div>
        </div>

        <div className="fx-group">
          <h3 className="fx-title">Delay</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={postUi.delayAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('delayAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Length"
              value={postUi.delayLength}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('delayLength')}
              format={(value) => formatDelayLength(value)}
            />
            <Knob
              label="Feedback"
              value={postUi.delayFeedback}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('delayFeedback')}
              format={(value) => formatDelayFeedback(value)}
            />
          </div>
        </div>

        <div className="fx-group">
          <h3 className="fx-title">Bitcrush</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={postUi.bitcrushAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('bitcrushAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Bits"
              value={postUi.bitcrushBits}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('bitcrushBits')}
              format={(value) => formatBitcrushBits(value)}
            />
            <Knob
              label="Rate"
              value={postUi.bitcrushRate}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('bitcrushRate')}
              format={(value) => formatBitcrushRate(value)}
            />
          </div>
        </div>

        <div className="fx-group">
          <h3 className="fx-title">Radio</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={postUi.radioAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('radioAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Tone"
              value={postUi.radioTone}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('radioTone')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Grit"
              value={postUi.radioGrit}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('radioGrit')}
              format={(value) => String(Math.round(value))}
            />
          </div>
        </div>

        <div className="fx-group">
          <h3 className="fx-title">Chorus</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={postUi.chorusAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('chorusAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Rate"
              value={postUi.chorusRate}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('chorusRate')}
              format={(value) => formatChorusRate(value)}
            />
            <Knob
              label="Depth"
              value={postUi.chorusDepth}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('chorusDepth')}
              format={(value) => formatChorusDepth(value)}
            />
          </div>
        </div>

        <div className="fx-group">
          <h3 className="fx-title">Compressor</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={postUi.compressorAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('compressorAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Attack"
              value={postUi.compressorAttack}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('compressorAttack')}
              format={(value) => formatCompressorAttack(value)}
            />
            <Knob
              label="Release"
              value={postUi.compressorRelease}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('compressorRelease')}
              format={(value) => formatCompressorRelease(value)}
            />
          </div>
        </div>
      </section>

      <div className="actions">
        <button
          className="primary"
          type="button"
          onClick={handlePlayback}
          title={isSpeaking ? 'Restart speech' : 'Play speech'}
        >
          {isSpeaking ? 'Playing...' : 'Playback'}
        </button>
        <button
          className={`secondary${isLooping ? ' is-active' : ''}`}
          type="button"
          onClick={handleLoopToggle}
          title="Loop playback"
        >
          Loop
        </button>
        <button
          className="secondary"
          type="button"
          onClick={handleStop}
          disabled={!isSpeaking}
          title="Stop speech"
        >
          Stop
        </button>
        <button
          className="secondary"
          type="button"
          onClick={handleExportWav}
          disabled={isExporting || !text.trim()}
          title="Render full mix with FX tails to WAV"
        >
          {isExporting ? 'Exporting...' : 'Export WAV'}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      </main>
      <DevMode />
    </>
  )
}
