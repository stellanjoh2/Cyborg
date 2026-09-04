import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { DevMode } from './components/DevMode'
import { Knob } from './components/Knob'
import { MasterStrip } from './components/MasterStrip'
import { PhaseOrb } from './components/PhaseOrb'
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
  formatDistortionTone,
  formatNoisePitch,
  formatNoiseTone,
  formatReverbDecay,
  formatReverbRoomSize,
  mapUiToPostProcess,
  postProcessMatches,
  type PostProcessUiState,
} from './postProcess'
import { resolveHumanRobotBlend } from './resolveHumanRobot'
import {
  DEFAULT_VOCODER_UI,
  formatCarrierCutoff,
  formatCarrierMix,
  formatCarrierResonance,
  formatSigned63,
  mapUiToVocoder,
  type VocoderUiState,
} from './vocoderParams'
import {
  cancelSamSpeech,
  exportSamWav,
  setSamLoop,
  speakSam,
  stopSamSpeech,
  pauseSamSpeech,
  resumeSamSpeech,
  updateSamLiveParams,
} from './samSpeech'
import { getSynthPlaybackProgress, MASTER_GAIN_MAX_DB } from './speechSynthEngine'
import { preloadPronunciationDictionary } from './samPronunciation'
import { cancelSpeechPlayback } from './speechPlayback'
import {
  splitSpokenParts,
  spokenWordWeights,
  wordIndexAtProgress,
} from './spokenWords'
import {
  clonePresetVocoder,
  getPresetById,
  presetMatches,
  carrierMatches,
  vocoderMatches,
  voiceMatches,
  VOICE_PRESETS,
  type VoiceId,
} from './voicePresets'
import './SpeechApp.css'

gsap.registerPlugin(useGSAP)

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
  const [isLooping, setIsLooping] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spokenWordIndex, setSpokenWordIndex] = useState<number | null>(null)
  const spokenWordRef = useRef<HTMLSpanElement>(null)
  const appRef = useRef<HTMLElement>(null)
  const [masterVolume, setMasterVolume] = useState(100)
  const [masterGain, setMasterGain] = useState(0)
  const masterGainDb = (masterGain / 100) * MASTER_GAIN_MAX_DB

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const from = {
        opacity: 0,
        y: 14,
        duration: 0.5,
        ease: 'power2.out',
        clearProps: 'transform',
      } as const

      const left = gsap.utils.toArray<HTMLElement>(
        '.speech-top__left > *, .speech-col--voice > *',
      )
      const middle = gsap.utils.toArray<HTMLElement>(
        '.speech-title, .speech-col--master > *',
      )
      const right = gsap.utils.toArray<HTMLElement>(
        [
          '.speech-top__right > *',
          '.speech-col--fx .section-head',
          '.speech-col--fx .fx-group',
        ].join(', '),
      )

      const tl = gsap.timeline()
      tl.from(left, { ...from, stagger: 0.05 })
        .from(middle, { ...from, stagger: 0.05 }, '-=0.2')
        .from(right, { ...from, stagger: 0.04 }, '-=0.2')
    },
    { scope: appRef },
  )

  const livePlan = useMemo(
    () => resolveHumanRobotBlend(humanRobot, speed, pitch),
    [humanRobot, speed, pitch],
  )

  const postProcess = useMemo(() => mapUiToPostProcess(postUi), [postUi])
  const vocoder = useMemo(() => mapUiToVocoder(vocoderUi), [vocoderUi])
  const spokenParts = useMemo(() => splitSpokenParts(text), [text])
  const spokenWeights = useMemo(
    () => spokenWordWeights(spokenParts),
    [spokenParts],
  )

  const setVocoderKnob =
    (key: keyof VocoderUiState) =>
    (value: number) => {
      setVocoderUi((current) => ({ ...current, [key]: value }))
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

  useEffect(() => {
    updateSamLiveParams({
      masterVolume: masterVolume / 100,
      masterGainDb,
    })
  }, [masterVolume, masterGainDb])

  useEffect(() => {
    if (!isSpeaking || isPaused) {
      return
    }

    let frame = 0
    const tick = () => {
      const next = wordIndexAtProgress(
        spokenWeights,
        getSynthPlaybackProgress(),
      )
      setSpokenWordIndex((current) => (current === next ? current : next))
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [isSpeaking, isPaused, spokenWeights])

  useEffect(() => {
    const node = spokenWordRef.current
    const scroller = node?.closest('.field-readout')
    if (!node || !scroller) {
      return
    }

    const nodeRect = node.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    if (nodeRect.top < scrollerRect.top) {
      scroller.scrollTop -= scrollerRect.top - nodeRect.top
    } else if (nodeRect.bottom > scrollerRect.bottom) {
      scroller.scrollTop += nodeRect.bottom - scrollerRect.bottom
    }
  }, [spokenWordIndex])

  const activePresetId = voiceId === 'custom' ? 'default' : voiceId
  const activePreset = getPresetById(activePresetId)
  const voiceDirty = !voiceMatches(activePreset, { speed, pitch, humanRobot })
  const vocoderDirty = !vocoderMatches(activePreset, vocoderUi)
  const carrierDirty = !carrierMatches(activePreset, vocoderUi)
  const fxDirty = !postProcessMatches(postUi)
  const masterDirty = masterVolume !== 100 || masterGain !== 0
  const templateDirty =
    !presetMatches(activePreset, {
      speed,
      pitch,
      humanRobot,
      vocoder: vocoderUi,
    }) ||
    fxDirty ||
    masterDirty

  const applyVoicePreset = (nextVoiceId: Exclude<VoiceId, 'custom'>) => {
    const preset = getPresetById(nextVoiceId)
    setVoiceId(nextVoiceId)
    setSpeed(preset.speed)
    setPitch(preset.pitch)
    setHumanRobot(preset.humanRobot)
    setVocoderUi(clonePresetVocoder(preset))
  }

  const handleVoiceChange = (nextVoiceId: VoiceId) => {
    if (nextVoiceId === 'custom') {
      setVoiceId('custom')
      return
    }

    applyVoicePreset(nextVoiceId)
  }

  const handleResetVoice = () => {
    setSpeed(activePreset.speed)
    setPitch(activePreset.pitch)
    setHumanRobot(activePreset.humanRobot)
  }

  const handleResetVocoder = () => {
    const preset = clonePresetVocoder(activePreset)
    setVocoderUi((current) => ({
      ...current,
      cutoff: preset.cutoff,
      resonance: preset.resonance,
      efSense: preset.efSense,
    }))
  }

  const handleResetCarrier = () => {
    const preset = clonePresetVocoder(activePreset)
    setVocoderUi((current) => ({
      ...current,
      carrierAmount: preset.carrierAmount,
      carrierMix: preset.carrierMix,
      carrierCutoff: preset.carrierCutoff,
      carrierResonance: preset.carrierResonance,
    }))
  }

  const handleResetPostProcess = () => {
    setPostUi({ ...DEFAULT_POST_PROCESS_UI })
  }

  const handleResetMaster = () => {
    setMasterVolume(100)
    setMasterGain(0)
  }

  const handleResetTemplate = () => {
    applyVoicePreset(activePresetId)
    handleResetPostProcess()
    handleResetMaster()
  }

  const handleStop = () => {
    cancelSpeechPlayback()
    stopSamSpeech()
    setIsLooping(false)
    setSamLoop(false)
    setIsSpeaking(false)
    setIsPaused(false)
    setSpokenWordIndex(null)
  }

  const handlePlayPause = () => {
    if (isSpeaking && isPaused) {
      resumeSamSpeech()
      setIsPaused(false)
      return
    }
    if (isSpeaking) {
      pauseSamSpeech()
      setIsPaused(true)
      return
    }
    handlePlayback()
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
      setSpokenWordIndex(null)
      setError('Please enter some text.')
      return
    }

    setIsSpeaking(true)
    setIsPaused(false)
    setSpokenWordIndex(0)
    cancelSamSpeech()
    setSamLoop(isLooping)

    void speakSam({
      text: trimmed,
      speed: livePlan.rate,
      pitch: livePlan.pitch,
      metallic: livePlan.metallic,
      vocoder,
      postProcess,
      masterVolume: masterVolume / 100,
      masterGainDb,
      loop: isLooping,
      onEnd: () => {
        setIsSpeaking(false)
        setIsPaused(false)
        setSpokenWordIndex(null)
      },
      onError: (message) => {
        setIsSpeaking(false)
        setIsPaused(false)
        setSpokenWordIndex(null)
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
      masterVolume: masterVolume / 100,
      masterGainDb,
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
      <main className="speech-app" ref={appRef}>
      <header className="speech-top">
      <div className="speech-top__left actions">
        <button
          className="primary"
          type="button"
          onClick={handlePlayPause}
          title={isSpeaking && !isPaused ? 'Pause speech' : 'Play speech'}
          aria-pressed={isSpeaking && !isPaused}
        >
          {isSpeaking && !isPaused ? 'PAUSE' : 'PLAY'}
        </button>
        <button
          className={`secondary${isLooping ? ' is-active' : ''}`}
          type="button"
          onClick={handleLoopToggle}
          title="Loop playback"
          aria-pressed={isLooping}
        >
          LOOP
        </button>
        <button
          className="secondary"
          type="button"
          onClick={handleStop}
          disabled={!isSpeaking}
          title="Stop speech"
        >
          STOP
        </button>
        {isSpeaking && !isPaused ? (
          <div
            className="speech-top__phase-orb"
            aria-hidden="true"
            title="Playing"
          >
            <PhaseOrb />
          </div>
        ) : null}
      </div>
      <h1 className="speech-title" aria-label="Cyborg Dominance" />
      <div className="speech-top__right actions">
        <button
          className="secondary"
          type="button"
          onClick={handleResetTemplate}
          disabled={!templateDirty}
          title="Reset all sections to the selected template"
        >
          RESET
        </button>
        <button
          className="secondary"
          type="button"
          onClick={handleExportWav}
          disabled={isExporting || !text.trim()}
          title="Render full mix with FX tails to WAV"
        >
          {isExporting ? 'EXPORTING...' : 'EXPORT'}
        </button>
      </div>
      </header>

      <div className="speech-board">
      <div className="speech-col speech-col--master">
      <MasterStrip
        volume={masterVolume}
        gain={masterGain}
        onVolumeChange={setMasterVolume}
        onGainChange={setMasterGain}
        onReset={handleResetMaster}
        canReset={masterDirty}
      />
      </div>
      <div className="speech-col speech-col--fx">
      <section className="post-process">
        <div className="section-head">
          <h2 className="section-title">FX</h2>
          <button
            className="secondary section-reset"
            type="button"
            onClick={handleResetPostProcess}
            disabled={!fxDirty}
            title="Reset FX to the selected template"
          >
            Reset
          </button>
        </div>

        <div className="fx-rack">
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

        <div className="fx-group">
          <h3 className="fx-title">Distortion</h3>
          <div className="knob-grid">
            <Knob
              label="Amount"
              value={postUi.distortionAmount}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('distortionAmount')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Drive"
              value={postUi.distortionDrive}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('distortionDrive')}
              format={(value) => String(Math.round(value))}
            />
            <Knob
              label="Tone"
              value={postUi.distortionTone}
              min={0}
              max={100}
              step={1}
              size="md"
              onChange={setPostKnob('distortionTone')}
              format={(value) => formatDistortionTone(value)}
            />
          </div>
        </div>
        </div>
      </section>
      </div>

      <div className="speech-col speech-col--voice">
      <section className="knob-panel text-panel">
        <div className="section-head">
          <h2 className="section-title">Text</h2>
        </div>
        {isSpeaking ? (
          <div className="field-textarea field-readout" aria-label="Text">
            {spokenParts.map((part, index) => (
              <span
                key={index}
                ref={
                  part.wordIndex === spokenWordIndex ? spokenWordRef : undefined
                }
                className={
                  part.wordIndex === spokenWordIndex ? 'is-spoken' : undefined
                }
              >
                {part.text}
              </span>
            ))}
          </div>
        ) : (
          <textarea
            className="field-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type something..."
            rows={4}
            aria-label="Text"
          />
        )}
      </section>

      <section className="knob-panel">
        <div className="section-head">
          <div className="section-head__start">
            <h2 className="section-title">Voice</h2>
            <select
              className="field-select field-select--inline"
              value={voiceId}
              onChange={(e) => handleVoiceChange(e.target.value as VoiceId)}
              aria-label="Voice"
            >
              {VOICE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>
          <button
            className="secondary section-reset"
            type="button"
            onClick={handleResetVoice}
            disabled={!voiceDirty}
            title="Reset Voice to the selected template"
          >
            Reset
          </button>
        </div>
        <div className="knob-grid knob-grid--voice">
          <Knob
            label="Robot"
            value={humanRobot}
            min={0}
            max={100}
            step={1}
            size="md"
            onChange={setHumanRobot}
            format={(value) => String(Math.round(value))}
          />
          <Knob
            label="Speed"
            value={speed}
            min={0.3}
            max={2.5}
            step={0.01}
            size="md"
            onChange={setSpeed}
            format={(value) => value.toFixed(2)}
          />
          <Knob
            label="Pitch"
            value={pitch}
            min={0}
            max={2}
            step={0.01}
            size="md"
            onChange={setPitch}
            format={(value) => value.toFixed(2)}
          />
        </div>
      </section>

      <section className="vocoder-panel">
        <div className="section-head">
          <h2 className="section-title">Vocoder</h2>
          <button
            className="secondary section-reset"
            type="button"
            onClick={handleResetVocoder}
            disabled={!vocoderDirty}
            title="Reset Vocoder to the selected template"
          >
            Reset
          </button>
        </div>

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

      </section>

      <section className="knob-panel carrier-panel">
        <div className="section-head">
          <h2 className="section-title">Carrier</h2>
          <button
            className="secondary section-reset"
            type="button"
            onClick={handleResetCarrier}
            disabled={!carrierDirty}
            title="Reset Carrier to the selected template"
          >
            Reset
          </button>
        </div>
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
      </section>

      {error ? <p className="error">{error}</p> : null}
      </div>
      </div>
      </main>
      <DevMode />
    </>
  )
}
