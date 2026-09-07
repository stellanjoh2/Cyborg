import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { AboutOverlay } from './components/AboutOverlay'
import { DevMode } from './components/DevMode'
import { FieldSelect } from './components/FieldSelect'
import { Knob } from './components/Knob'
import { MasterStrip } from './components/MasterStrip'
import { Oscilloscope } from './components/Oscilloscope'
import { SettingsMenu } from './components/SettingsMenu'
import { ThemePicker } from './components/ThemePicker'
import { Logotype, type LogotypeHandle } from './components/Logotype'
import { TypewriterReveal } from './components/TypewriterReveal'
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
  refreshSamLiveBuffer,
  setSamLoop,
  speakSam,
  stopSamSpeech,
  updateSamLiveParams,
} from './samSpeech'
import { getSynthPlaybackProgress, MASTER_GAIN_MAX_DB } from './speechSynthEngine'
import { preloadPronunciationDictionary } from './samPronunciation'
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

const SPLASH_CREDIT =
  'Larynx™ Industries — LX01 is created by Stellan Johansson.'
const SPLASH_VERSION = 'v0.1.0'
const SPLASH_YEAR = '© 2026'
/** Splash build/teardown pace (~15% faster than prior 1/0.9). */
const SPLASH_SPEED = 1 / 0.765
const SPLASH_TYPE_MS = Math.max(1, Math.round(10 / SPLASH_SPEED))
/** Larynx / S mark in — scale-up / dock; same length so stagger stays readable. */
const SPLASH_MARK_IN = 0.425 / SPLASH_SPEED
/** Difference dirt: Eli Fitch–style canvas pixelate (coarse → sharp). */
const SPLASH_DIRT_SRC = `${import.meta.env.BASE_URL}remapstudio-AFKX0ei32lA-unsplash.jpg`
/** Columns across the viewport at the coarsest end (megablocks). */
const SPLASH_DIRT_START_COLS = 2.4
/** Discrete pixelation levels (fewer = choppier). */
const SPLASH_DIRT_STEPS = 8
/** Vertical wipe strips for the accent plate in/out. */
const SPLASH_WIPE_COLS = 8
/** Per-column wipe duration (stagger adds on top). */
const SPLASH_WIPE_DUR = 0.95
/** Delay between adjacent columns in the wipe. */
const SPLASH_WIPE_STAGGER = 0.12
/** How early the Larynx mark may start before the wipe fully settles. */
const SPLASH_WIPE_MARK_LEAD = 0.12

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  iw: number,
  ih: number,
) {
  const ir = iw / ih
  const cr = dw / dh
  let sx: number
  let sy: number
  let sw: number
  let sh: number
  if (ir > cr) {
    sh = ih
    sw = sh * cr
    sx = (iw - sw) / 2
    sy = 0
  } else {
    sw = iw
    sh = sw / cr
    sx = 0
    sy = (ih - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

/** Log-space: t=0 → startCols megablocks, t=1 → full resolution (stepped). */
function dirtColsForProgress(t: number, canvasW: number) {
  const start = SPLASH_DIRT_START_COLS
  const end = Math.max(start + 1, canvasW)
  const p = Math.max(0, Math.min(1, t))
  const level = Math.round(p * SPLASH_DIRT_STEPS)
  const stepped = level / SPLASH_DIRT_STEPS
  return Math.exp(
    Math.log(start) + stepped * (Math.log(end) - Math.log(start)),
  )
}

function paintPixelatedDirt(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  progress: number,
  buffer: HTMLCanvasElement,
) {
  const w = canvas.width
  const h = canvas.height
  if (w < 1 || h < 1) return
  const cols = dirtColsForProgress(progress, w)
  const littleW = Math.max(1, Math.round(cols))
  const littleH = Math.max(1, Math.round(cols * (h / w)))
  if (buffer.width !== littleW) buffer.width = littleW
  if (buffer.height !== littleH) buffer.height = littleH
  const bctx = buffer.getContext('2d')
  if (!bctx) return
  bctx.imageSmoothingEnabled = false
  drawImageCover(
    bctx,
    img,
    0,
    0,
    littleW,
    littleH,
    img.naturalWidth,
    img.naturalHeight,
  )
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(buffer, 0, 0, littleW, littleH, 0, 0, w, h)
}

function sizeDirtCanvas(canvas: HTMLCanvasElement, host: HTMLElement) {
  const rect = host.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
}

export default function App() {
  const [text, setText] = useState(DEFAULT_TEXT)
  const [voiceId, setVoiceId] = useState<VoiceId>('default')
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(0.7)
  const [humanRobot, setHumanRobot] = useState(0)
  const [formant, setFormant] = useState(50)
  const [postUi, setPostUi] = useState<PostProcessUiState>(DEFAULT_POST_PROCESS_UI)
  const [vocoderUi, setVocoderUi] = useState<VocoderUiState>(DEFAULT_VOCODER_UI)
  const [isLooping, setIsLooping] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorOkReady, setErrorOkReady] = useState(false)
  const [emptyWarning, setEmptyWarning] = useState(false)
  const [inputTouched, setInputTouched] = useState(false)
  const [spokenWordIndex, setSpokenWordIndex] = useState<number | null>(null)
  const spokenWordRef = useRef<HTMLSpanElement>(null)
  const appRef = useRef<HTMLElement>(null)
  const splashLogoRef = useRef<LogotypeHandle>(null)
  const headerLogoRef = useRef<LogotypeHandle>(null)
  const bakedVoiceRef = useRef<{
    text: string
    rate: number
    pitch: number
    metallic: number
  } | null>(null)
  const transportToggleRef = useRef<() => void>(() => {})
  const [masterVolume, setMasterVolume] = useState(100)
  const [masterGain, setMasterGain] = useState(0)
  /** Intro-only volume meter drive; null hands control back to normal state. */
  const [volumeFill, setVolumeFill] = useState<number | null>(0)
  /** Intro-only single-ridge climb on gain, then VU. */
  const [activateGain, setActivateGain] = useState<number | null>(null)
  const [activateVu, setActivateVu] = useState<number | null>(null)
  const [splashCreditActive, setSplashCreditActive] = useState(false)
  const [splashVersionActive, setSplashVersionActive] = useState(false)
  const [splashYearActive, setSplashYearActive] = useState(false)
  const masterGainDb = (masterGain / 100) * MASTER_GAIN_MAX_DB
  const liveMasterVolume = isMuted ? 0 : masterVolume / 100

  useGSAP(
    () => {
      const navBleed = document.querySelector('.scale-nav-bleed')
      const viewportEl = document.querySelector('.scale-viewport')
      const splashDirt = document.querySelector<HTMLElement>(
        '.scale-viewport__dirt',
      )
      const splashDirtCanvas = splashDirt?.querySelector('canvas') ?? null
      const splashDirtCtx = splashDirtCanvas?.getContext('2d') ?? null
      const root = appRef.current
      const splash = root?.querySelector<HTMLElement>('.speech-splash')
      const splashBody = root?.querySelector<HTMLElement>('.speech-splash__body')
      const splashCols = gsap.utils.toArray<HTMLElement>(
        root?.querySelectorAll('.speech-splash__wipe-col') ?? [],
      )
      const splashMark = root?.querySelector<HTMLElement>(
        '.speech-splash__mark-slot',
      )
      const splashS = root?.querySelector<HTMLElement>('.speech-splash__s-slot')
      const splashCredit = root?.querySelector<HTMLElement>('.speech-splash__credit')
      const splashVersion = root?.querySelector<HTMLElement>(
        '.speech-splash__version',
      )
      const splashYear = root?.querySelector<HTMLElement>('.speech-splash__year')

      const dirtPix = { t: 0 }
      let dirtImg: HTMLImageElement | null = null
      const dirtBuffer = document.createElement('canvas')

      const paintDirt = () => {
        if (!splashDirtCanvas || !splashDirtCtx || !dirtImg?.complete) return
        paintPixelatedDirt(
          splashDirtCanvas,
          splashDirtCtx,
          dirtImg,
          dirtPix.t,
          dirtBuffer,
        )
      }

      const fitDirtCanvas = () => {
        if (!splashDirt || !splashDirtCanvas) return
        sizeDirtCanvas(splashDirtCanvas, splashDirt)
        paintDirt()
      }

      const clearSplashDirt = () => {
        if (!splashDirt) return
        splashDirt.classList.remove('is-splash')
        splashDirt.style.clipPath = ''
        dirtPix.t = 0
        if (splashDirtCtx && splashDirtCanvas) {
          splashDirtCtx.clearRect(
            0,
            0,
            splashDirtCanvas.width,
            splashDirtCanvas.height,
          )
        }
      }

      const clearSplashWipe = () => {
        if (splashBody) splashBody.style.clipPath = ''
        if (splashCols.length) {
          gsap.set(splashCols, { clearProps: 'transform,transformOrigin' })
        }
      }

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setVolumeFill(null)
        setActivateGain(null)
        setActivateVu(null)
        setSplashCreditActive(true)
        setSplashVersionActive(true)
        setSplashYearActive(true)
        document.documentElement.classList.remove('is-splash-void')
        clearSplashDirt()
        clearSplashWipe()
        if (splash) gsap.set(splash, { autoAlpha: 0 })
        splashLogoRef.current?.show()
        headerLogoRef.current?.show()
        return
      }

      if (!root || !splash || !splashCols.length) return

      // Keep masterVolume at 100 so Reset buttons stay dormant; only the
      // meter fill is overridden visually during intro.
      setVolumeFill(0)
      setActivateGain(null)
      setActivateVu(null)
      setSplashCreditActive(false)
      setSplashVersionActive(false)
      setSplashYearActive(false)

      root.classList.add('is-introducing')
      document.documentElement.classList.add('is-splash-void')
      // Accent fill for viewport letterbox (sides/top) while splash covers the stage.
      document.documentElement.classList.add('is-splash-bleed')

      // Full-bleed nav lives outside the stage; hide until UI intro starts.
      if (navBleed) gsap.set(navBleed, { autoAlpha: 0 })

      const D = 0.55
      let grainTween: gsap.core.Tween | undefined
      const clearIntroGrain = () => {
        grainTween?.kill()
        grainTween = undefined
        root.style.removeProperty('--panel-grain')
      }

      const tl = gsap.timeline({
        onComplete: () => {
          root.classList.remove('is-introducing')
          clearIntroGrain()
          document.documentElement.classList.remove(
            'is-splash-void',
            'is-splash-bleed',
          )
          clearSplashDirt()
          clearSplashWipe()
        },
      })

      // —— 0. Accent splash: column wipe in → mark → LX01 → version → S → credit → year → copyright-first teardown → wipe out ——
      const splashT = (t: number) => t / SPLASH_SPEED
      const staggerGap = splashT(0.14)
      const splashOut = splashT(0.55)
      const splashOutStagger = splashT(0.1)
      // Pause after full build before teardown (~15% shorter than prior 0.5s).
      const splashHold = 0.425
      const curtainDur = splashT(SPLASH_WIPE_DUR)
      const wipeStagger = splashT(SPLASH_WIPE_STAGGER)
      const wipeTotal = curtainDur + wipeStagger * (splashCols.length - 1)
      const wipeMarkLead = splashT(SPLASH_WIPE_MARK_LEAD)
      const creditTypeDur = (SPLASH_CREDIT.length * SPLASH_TYPE_MS) / 1000
      const versionTypeDur = (SPLASH_VERSION.length * SPLASH_TYPE_MS) / 1000
      const yearTypeDur = (SPLASH_YEAR.length * SPLASH_TYPE_MS) / 1000
      splashLogoRef.current?.hideParts()
      if (splashCredit) gsap.set(splashCredit, { autoAlpha: 1, y: 0 })
      if (splashVersion) gsap.set(splashVersion, { autoAlpha: 1, y: 0 })
      if (splashYear) gsap.set(splashYear, { autoAlpha: 1, y: 0 })
      const splashReveal = splashLogoRef.current?.revealTimeline()
      const splashLogoExit = splashLogoRef.current?.exitTimeline()
      splashReveal?.timeScale(SPLASH_SPEED)
      splashLogoExit?.timeScale(SPLASH_SPEED)
      const charsEnd = splashT(splashReveal?.duration() ?? 1.1)
      const logoExitDur = splashT(splashLogoExit?.duration() ?? 0.55)
      // getBoundingClientRect is screenspace; GSAP x is pre-scale design px.
      const stageScale = Math.max(
        0.001,
        Number.parseFloat(
          getComputedStyle(viewportEl ?? document.documentElement).getPropertyValue(
            '--stage-scale',
          ),
        ) || 1,
      )
      const sFromX = splashS
        ? -(splashS.getBoundingClientRect().right + 24) / stageScale
        : 0

      gsap.set(splash, { autoAlpha: 1 })
      // scaleX > 1 overlaps neighbor paint; force3D off avoids Safari layer-edge AA seams.
      gsap.set(splashCols, {
        scaleY: 0,
        scaleX: 1.04,
        transformOrigin: '50% 0%',
        force3D: false,
      })

      // Clip content + screenspace dirt to the live column geometry.
      // Body sits inside ScaleViewport's scale(); dirt is screenspace — divide accordingly.
      const columnClipPath = (host: DOMRect, localScale: number) => {
        const s = Math.max(0.001, localScale)
        // ~2 screen px of pad in this coordinate space (covers Safari clip AA).
        const padX = 2 / s
        let d = ''
        for (const col of splashCols) {
          const r = col.getBoundingClientRect()
          if (r.height < 0.5 || r.width < 0.5) continue
          const x0 = (r.left - host.left) / s - padX
          const y0 = (r.top - host.top) / s
          const x1 = (r.right - host.left) / s + padX
          const y1 = (r.bottom - host.top) / s
          d += `M${x0} ${y0}L${x0} ${y1}L${x1} ${y1}L${x1} ${y0}Z`
        }
        return d ? `path('${d}')` : 'inset(100% 0 0 0)'
      }

      const syncSplashClips = () => {
        if (splashBody) {
          splashBody.style.clipPath = columnClipPath(
            splashBody.getBoundingClientRect(),
            stageScale,
          )
        }
        if (!splashDirt || !viewportEl) return
        splashDirt.style.clipPath = columnClipPath(
          viewportEl.getBoundingClientRect(),
          1,
        )
      }
      splashDirt?.classList.add('is-splash')
      syncSplashClips()
      fitDirtCanvas()
      const onSplashResize = () => {
        syncSplashClips()
        fitDirtCanvas()
      }
      window.addEventListener('resize', onSplashResize)

      // Preload difference image; first paint stays coarse until the tween runs.
      const dirtLoader = new Image()
      dirtLoader.decoding = 'async'
      dirtLoader.src = SPLASH_DIRT_SRC
      dirtLoader.onload = () => {
        dirtImg = dirtLoader
        paintDirt()
      }
      if (dirtLoader.complete && dirtLoader.naturalWidth > 0) {
        dirtImg = dirtLoader
        paintDirt()
      }

      // Hold black void (~12.75 frames prior, +10 frames) before the column wipe.
      // Downstream splash + UI times are all relative to this, so they shift with it.
      const plateInAt = (15 * 0.85 + 10) / 60
      // Larynx → LX01 → version → S → credit → year (mark waits for the cascade to nearly settle).
      const markAt = plateInAt + Math.max(0, wipeTotal - wipeMarkLead)
      const lx01At = markAt + SPLASH_MARK_IN + staggerGap
      const versionAt = lx01At + charsEnd + staggerGap
      const sAt = versionAt + versionTypeDur + staggerGap
      const creditAt = sAt + SPLASH_MARK_IN + staggerGap
      const yearAt = creditAt + creditTypeDur
      // Teardown: larynx → LX01 → version → S → legal → copyright.
      const logoOutAt = yearAt + yearTypeDur + splashHold
      const logoExitAt = logoOutAt + splashOutStagger
      const versionRewindAt = logoExitAt + logoExitDur + splashOutStagger
      const sOutAt = versionRewindAt + versionTypeDur + splashOutStagger
      const creditRewindAt = sOutAt + SPLASH_MARK_IN + splashOutStagger
      const yearRewindAt = creditRewindAt + creditTypeDur
      const curtainAt = yearRewindAt + yearTypeDur
      const SPLASH = curtainAt + wipeTotal

      // Multi-column wipe in (top → bottom, L→R stagger).
      const wipeIn = gsap.timeline({ onUpdate: syncSplashClips })
      wipeIn.to(splashCols, {
        scaleY: 1,
        scaleX: 1.04,
        duration: curtainDur,
        ease: 'power3.out',
        stagger: { each: wipeStagger, from: 'start' },
      })
      tl.add(wipeIn, plateInAt)
      // Difference dirt: log-space pixelate; sharp when the top-left mark settles.
      // Out tracks the column wipe (megablocks as it leaves).
      if (splashDirtCanvas) {
        const dirtInEnd = markAt + SPLASH_MARK_IN
        dirtPix.t = 0
        paintDirt()
        tl.to(
          dirtPix,
          {
            t: 1,
            duration: Math.max(0.01, dirtInEnd - plateInAt),
            ease: 'none',
            onUpdate: paintDirt,
          },
          plateInAt,
        )
        tl.to(
          dirtPix,
          {
            t: 0,
            duration: wipeTotal,
            ease: 'none',
            onUpdate: paintDirt,
          },
          curtainAt,
        )
      }
      tl.call(
        () => document.documentElement.classList.remove('is-splash-void'),
        undefined,
        plateInAt + wipeTotal,
      )
      if (splashMark) {
        tl.fromTo(
          splashMark,
          { autoAlpha: 1, scale: 0 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: SPLASH_MARK_IN,
            ease: 'power3.out',
            immediateRender: true,
          },
          markAt,
        )
      }
      if (splashReveal) tl.add(splashReveal, lx01At)
      tl.call(() => setSplashVersionActive(true), undefined, versionAt)
      if (splashS) {
        tl.fromTo(
          splashS,
          { autoAlpha: 1, x: sFromX },
          {
            autoAlpha: 1,
            x: 0,
            duration: SPLASH_MARK_IN,
            ease: 'power3.out',
            immediateRender: true,
          },
          sAt,
        )
      }
      tl.call(() => setSplashCreditActive(true), undefined, creditAt)
      tl.call(() => setSplashYearActive(true), undefined, yearAt)
      // Larynx → LX01 → version → S → legal → copyright.
      if (splashMark) {
        tl.to(
          splashMark,
          {
            autoAlpha: 0,
            scale: 0,
            duration: splashOut,
            ease: 'power3.in',
          },
          logoOutAt,
        )
      }
      if (splashLogoExit) tl.add(splashLogoExit, logoExitAt)
      tl.call(() => setSplashVersionActive(false), undefined, versionRewindAt)
      if (splashS) {
        tl.to(
          splashS,
          {
            x: sFromX,
            duration: SPLASH_MARK_IN,
            ease: 'power3.in',
          },
          sOutAt,
        )
      }
      tl.call(() => setSplashCreditActive(false), undefined, creditRewindAt)
      tl.call(() => setSplashYearActive(false), undefined, yearRewindAt)
      // Drop letterbox fill with the curtain so orange doesn't linger over the UI.
      tl.call(
        () => document.documentElement.classList.remove('is-splash-bleed'),
        undefined,
        curtainAt,
      )
      // Multi-column wipe out (collapse toward bottom, L→R stagger).
      const wipeOut = gsap.timeline({ onUpdate: syncSplashClips })
      wipeOut.set(splashCols, { transformOrigin: '50% 100%' })
      wipeOut.to(splashCols, {
        scaleY: 0,
        scaleX: 1.04,
        duration: curtainDur,
        ease: 'power3.in',
        stagger: { each: wipeStagger, from: 'start' },
      })
      tl.add(wipeOut, curtainAt)
      tl.set(splash, { autoAlpha: 0 }, SPLASH)
      tl.call(clearSplashDirt, undefined, SPLASH)
      tl.call(clearSplashWipe, undefined, SPLASH)

      const ui = gsap.timeline({
        defaults: {
          duration: D,
          ease: 'power3.out',
        },
      })
      // Prior speed-ups kept; sequence is timed in beats below.
      ui.timeScale(1.5 / 1.25)

      // Header mark stays fully assembled (no splash-style reveal); hover loop still works.
      headerLogoRef.current?.show()

      // —— 1. Nav plate, then assets L→R ——
      ui.from(
        '.speech-top',
        { autoAlpha: 0, y: -28, immediateRender: true },
        0,
      )
      if (navBleed) {
        // Must use fromTo: gsap.set above left autoAlpha at 0.
        ui.fromTo(
          navBleed,
          { autoAlpha: 0, y: -28 },
          { autoAlpha: 1, y: 0 },
          0,
        )
      }

      const navItemsAt = D + 0.08
      const navEls = gsap.utils.toArray<HTMLElement>(
        ['.speech-top__brand', '.speech-scope', '.speech-top__right > *'].join(', '),
      )
      const navStagger = 0.07
      ui.from(
        navEls,
        {
          autoAlpha: 0,
          x: -20,
          y: -12,
          stagger: navStagger,
          immediateRender: true,
        },
        navItemsAt,
      )

      // Board starts the moment EXPORT (last nav item) finishes landing.
      const boardAt =
        navItemsAt + Math.max(0, navEls.length - 1) * navStagger + D

      // —— 2. Master + side columns assemble together ——
      ui.from(
        '.speech-col--master .master-strip',
        { autoAlpha: 0, y: 24, immediateRender: true },
        boardAt,
      )

      const sideDuration = D * 2.4
      ui.from(
        '.speech-col--voice',
        {
          autoAlpha: 0,
          x: (_i, el) => {
            const right = (el as HTMLElement).getBoundingClientRect().right
            return -(right + 24) / stageScale
          },
          duration: sideDuration,
          immediateRender: true,
        },
        boardAt,
      )
      ui.from(
        '.speech-col--fx',
        {
          autoAlpha: 0,
          x: (_i, el) => {
            const left = (el as HTMLElement).getBoundingClientRect().left
            return (window.innerWidth - left + 24) / stageScale
          },
          duration: sideDuration,
          immediateRender: true,
        },
        boardAt,
      )

      // Soft-light grain once structural plates have docked; leaf/meter UI keeps going.
      // Separate tween (not on `ui`) so duration stays 2s wall-clock despite ui.timeScale.
      // +2 frames after land so column transform completion doesn't punch soft-light.
      const platesLandAt = boardAt + sideDuration
      ui.call(
        () => {
          grainTween?.kill()
          grainTween = gsap.fromTo(
            root,
            { '--panel-grain': 0 },
            { '--panel-grain': 1, duration: 2, ease: 'none' },
          )
        },
        undefined,
        platesLandAt + 2 / 60,
      )

      // —— 3. Side panel contents (hold until columns are well into their land) ——
      // Columns already handle the horizontal dock; only leaf UI rises into place.
      const sideContentAt = boardAt + 0.78
      const leftLeaves = gsap.utils.toArray<HTMLElement>(
        [
          '.speech-col--voice .section-title',
          '.speech-col--voice .field-select',
          '.speech-col--voice .section-reset',
          '.speech-col--voice .field-textarea',
          '.speech-col--voice .field-readout',
          '.speech-col--voice .knob-field',
        ].join(', '),
      )
      const rightLeaves = gsap.utils.toArray<HTMLElement>(
        [
          '.speech-col--fx .section-title',
          '.speech-col--fx .section-reset',
          '.speech-col--fx .fx-title',
          '.speech-col--fx .knob-field',
        ].join(', '),
      )
      // Slightly tighter than pre-value-flash so dial+value cyan still fits the beat.
      const leafDuration = 0.36
      const leftStagger = 0.026
      const rightStagger = 0.019
      // Match LX01 char-flash: cyan dial+value lead, then ink lands and kills flash.
      const knobFlashLead = 0.08
      const knobFlashOut = 2 / 60
      const revealLeaves = (
        leaves: HTMLElement[],
        stagger: number,
        at: number,
      ) => {
        leaves.forEach((el, i) => {
          const t = at + i * stagger
          if (!el.classList.contains('knob-field')) {
            ui.from(
              el,
              {
                autoAlpha: 0,
                y: 12,
                duration: leafDuration,
                immediateRender: true,
              },
              t,
            )
            return
          }

          const flash = gsap.utils.toArray<HTMLElement>(
            el.querySelectorAll('.knob__flash, .knob-value__flash'),
          )
          const ink = gsap.utils.toArray<HTMLElement>(
            el.querySelectorAll(
              '.knob-label, .knob-hints, .knob__ink, .knob-value__ink',
            ),
          )
          // Keep the field box visible so the cyan flash can show.
          gsap.set(el, { autoAlpha: 1, y: 0 })
          if (flash.length) {
            ui.fromTo(
              flash,
              { autoAlpha: 0, y: 12 },
              {
                autoAlpha: 1,
                y: 0,
                duration: leafDuration,
                immediateRender: true,
              },
              t,
            )
            ui.to(
              flash,
              {
                autoAlpha: 0,
                duration: knobFlashOut,
                ease: 'none',
              },
              t + knobFlashLead + leafDuration,
            )
          }
          if (ink.length) {
            ui.fromTo(
              ink,
              { autoAlpha: 0, y: 12 },
              {
                autoAlpha: 1,
                y: 0,
                duration: leafDuration,
                immediateRender: true,
              },
              t + knobFlashLead,
            )
          }
        })
      }
      revealLeaves(leftLeaves, leftStagger, sideContentAt)
      revealLeaves(rightLeaves, rightStagger, sideContentAt)

      // Last knob: flash lead + ink land + flash kill.
      const knobTotalDur = knobFlashLead + leafDuration + knobFlashOut
      const lastKnobEnd = Math.max(
        ...[leftLeaves, rightLeaves].flatMap((leaves, side) => {
          const stagger = side === 0 ? leftStagger : rightStagger
          return leaves.map((el, i) =>
            el.classList.contains('knob-field')
              ? sideContentAt + i * stagger + knobTotalDur
              : sideContentAt,
          )
        }),
      )

      // —— 4. Master meters start with the FX leaf cascade ——
      const masterContentAt = sideContentAt
      ui.from(
        '.speech-col--master .section-head',
        { autoAlpha: 0, y: -12, immediateRender: true },
        masterContentAt,
      )

      const meterColumns = [
        '.master-meters > .master-fader:nth-child(1) > *',
        '.master-meters > .master-fader:nth-child(2) > *',
        '.master-meters > .vu > *',
      ]
      const meterStagger = 0.1
      meterColumns.forEach((selector, i) => {
        const els = gsap.utils.toArray<HTMLElement>(selector)
        if (!els.length) return
        ui.from(
          els,
          {
            autoAlpha: 0,
            y: 16,
            stagger: 0.03,
            immediateRender: true,
            // Drop leftover translate layers — Safari + VU mix-blend fringes on them.
            clearProps: 'transform',
          },
          masterContentAt + 0.06 + i * meterStagger,
        )
      })
      const masterMetersEnd =
        masterContentAt +
        0.06 +
        (meterColumns.length - 1) * meterStagger +
        D

      // Play, then mute → loop (corner pair mirrors L/R meter columns).
      const masterFooterAt = masterMetersEnd
      const masterFooterStagger = 0.08
      const masterFooter = gsap.utils.toArray<HTMLElement>(
        ['.master-transport', '.master-mute', '.master-loop'].join(', '),
      )
      ui.from(
        masterFooter,
        {
          autoAlpha: 0,
          y: 16,
          stagger: masterFooterStagger,
          immediateRender: true,
        },
        masterFooterAt,
      )
      const masterFooterEnd =
        masterFooterAt +
        Math.max(0, masterFooter.length - 1) * masterFooterStagger +
        D

      // One playing-ring revolution after the play button lands, before meter boot.
      const playSpinEl = root.querySelector<HTMLElement>('.master-play__spin')
      const playSpinDur = 0.72
      const playSpinAt = masterFooterEnd
      if (playSpinEl) {
        ui.fromTo(
          playSpinEl,
          { opacity: 0, rotation: 0 },
          {
            opacity: 1,
            duration: 0.2,
            ease: 'power2.out',
          },
          playSpinAt,
        )
        ui.to(
          playSpinEl,
          {
            rotation: 360,
            duration: playSpinDur,
            ease: 'power2.out',
          },
          playSpinAt,
        )
        ui.to(
          playSpinEl,
          {
            opacity: 0,
            duration: 0.2,
            clearProps: 'opacity,transform',
          },
          playSpinAt + playSpinDur,
        )
      }

      // —— 5. Volume fill waits for play spin + last knob reveal ——
      const volumeProxy = { v: 0 }
      const volumeFillDur = D * 1.9
      const volumeFillAt = Math.max(
        playSpinAt + playSpinDur,
        lastKnobEnd,
      )
      ui.fromTo(
        volumeProxy,
        { v: 0 },
        {
          v: 100,
          duration: volumeFillDur,
          onStart: () => setVolumeFill(0),
          onUpdate: () => setVolumeFill(volumeProxy.v),
          onComplete: () => setVolumeFill(null),
        },
        volumeFillAt,
      )

      // Single ridge climbs gain, then VU — each starts halfway through the prior meter.
      const activateGainProxy = { v: 0 }
      const activateGainAt = volumeFillAt + volumeFillDur * 0.5
      ui.fromTo(
        activateGainProxy,
        { v: 0 },
        {
          v: 1,
          duration: volumeFillDur,
          onStart: () => setActivateGain(0),
          onUpdate: () => setActivateGain(activateGainProxy.v),
          onComplete: () => setActivateGain(null),
        },
        activateGainAt,
      )
      const activateVuProxy = { v: 0 }
      ui.fromTo(
        activateVuProxy,
        { v: 0 },
        {
          v: 1,
          duration: volumeFillDur,
          onStart: () => setActivateVu(0),
          onUpdate: () => setActivateVu(activateVuProxy.v),
          onComplete: () => setActivateVu(null),
        },
        activateGainAt + volumeFillDur * 0.5,
      )

      // Far-left wipe-out column lands first; UI (nav header) starts then — follows splash pace.
      tl.add(ui, curtainAt + curtainDur)

      return () => {
        window.removeEventListener('resize', onSplashResize)
        root?.classList.remove('is-introducing')
        clearIntroGrain()
        document.documentElement.classList.remove(
          'is-splash-void',
          'is-splash-bleed',
        )
        clearSplashDirt()
        clearSplashWipe()
      }
    },
    {
      scope: appRef,
    },
  )

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault()
        transportToggleRef.current()
        return
      }

      if (event.key !== 'h' && event.key !== 'H') return
      event.preventDefault()
      document.documentElement.classList.toggle('is-app-hidden')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.documentElement.classList.remove('is-app-hidden')
    }
  }, [])

  const livePlan = useMemo(
    () => resolveHumanRobotBlend(humanRobot, speed, pitch),
    [humanRobot, speed, pitch],
  )

  const postProcess = useMemo(() => mapUiToPostProcess(postUi), [postUi])
  const vocoder = useMemo(
    () => mapUiToVocoder(vocoderUi, formant),
    [vocoderUi, formant],
  )
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

    // Keep graph in sync, but don't retarget the playing buffer's rate —
    // Robot/speed/pitch changes re-bake samples; applying rate early can
    // finish the old buffer and flip STOP back to PLAY.
    updateSamLiveParams(
      {
        speed: livePlan.rate,
        pitch: livePlan.pitch,
        metallic: livePlan.metallic,
        vocoder,
      },
      { applySourceRate: false },
    )
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
      masterVolume: liveMasterVolume,
      masterGainDb,
    })
  }, [liveMasterVolume, masterGainDb])

  useEffect(() => {
    if (!isSpeaking) {
      bakedVoiceRef.current = null
      return
    }

    const next = {
      text: text.trim(),
      rate: livePlan.rate,
      pitch: livePlan.pitch,
      metallic: livePlan.metallic,
    }
    const baked = bakedVoiceRef.current
    if (
      baked &&
      baked.text === next.text &&
      baked.rate === next.rate &&
      baked.pitch === next.pitch &&
      baked.metallic === next.metallic
    ) {
      return
    }

    const handle = window.setTimeout(() => {
      bakedVoiceRef.current = next
      void refreshSamLiveBuffer({
        text: next.text,
        speed: next.rate,
        pitch: next.pitch,
        metallic: next.metallic,
      })
    }, 140)

    return () => window.clearTimeout(handle)
  }, [isSpeaking, livePlan.rate, livePlan.pitch, livePlan.metallic, text])

  useEffect(() => {
    if (!isSpeaking) {
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
  }, [isSpeaking, spokenWeights])

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

  useEffect(() => {
    setErrorOkReady(false)
  }, [error])

  useEffect(() => {
    if (!error) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setError(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [error])

  const activePresetId = voiceId === 'custom' ? 'default' : voiceId
  const activePreset = getPresetById(activePresetId)
  const voiceDirty = !voiceMatches(activePreset, {
    speed,
    pitch,
    humanRobot,
    formant,
  })
  const vocoderDirty = !vocoderMatches(activePreset, vocoderUi)
  const carrierDirty = !carrierMatches(activePreset, vocoderUi)
  const fxDirty = !postProcessMatches(postUi)
  const masterDirty = masterVolume !== 100 || masterGain !== 0
  const templateDirty =
    !presetMatches(activePreset, {
      speed,
      pitch,
      humanRobot,
      formant,
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
    setFormant(preset.formant)
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
    const nextSpeed = activePreset.speed
    const nextPitch = activePreset.pitch
    const nextHumanRobot = activePreset.humanRobot
    const nextFormant = activePreset.formant
    setSpeed(nextSpeed)
    setPitch(nextPitch)
    setHumanRobot(nextHumanRobot)
    setFormant(nextFormant)

    if (isSpeaking) {
      const plan = resolveHumanRobotBlend(nextHumanRobot, nextSpeed, nextPitch)
      updateSamLiveParams(
        {
          speed: plan.rate,
          pitch: plan.pitch,
          metallic: plan.metallic,
          vocoder: mapUiToVocoder(vocoderUi, nextFormant),
        },
        { immediate: true },
      )
      bakedVoiceRef.current = null
    }
  }

  const handleResetVocoder = () => {
    const preset = clonePresetVocoder(activePreset)
    const next = {
      ...vocoderUi,
      cutoff: preset.cutoff,
      resonance: preset.resonance,
      efSense: preset.efSense,
      unvoice: preset.unvoice,
    }
    setVocoderUi(next)
    if (isSpeaking) {
      updateSamLiveParams(
        { vocoder: mapUiToVocoder(next, formant) },
        { immediate: true },
      )
    }
  }

  const handleResetCarrier = () => {
    const preset = clonePresetVocoder(activePreset)
    const next = {
      ...vocoderUi,
      carrierAmount: preset.carrierAmount,
      carrierMix: preset.carrierMix,
      carrierCutoff: preset.carrierCutoff,
      carrierResonance: preset.carrierResonance,
    }
    setVocoderUi(next)
    if (isSpeaking) {
      updateSamLiveParams(
        { vocoder: mapUiToVocoder(next, formant) },
        { immediate: true },
      )
    }
  }

  const handleResetPostProcess = () => {
    const next = { ...DEFAULT_POST_PROCESS_UI }
    setPostUi(next)
    if (isSpeaking) {
      updateSamLiveParams(
        { postProcess: mapUiToPostProcess(next) },
        { immediate: true },
      )
    }
  }

  const handleResetMaster = () => {
    setMasterVolume(100)
    setMasterGain(0)
    updateSamLiveParams(
      { masterVolume: 1, masterGainDb: 0 },
      { immediate: true },
    )
  }

  const handleResetTemplate = () => {
    const preset = getPresetById(activePresetId)
    const nextVocoder = clonePresetVocoder(preset)
    const nextPost = { ...DEFAULT_POST_PROCESS_UI }
    applyVoicePreset(activePresetId)
    setPostUi(nextPost)
    setMasterVolume(100)
    setMasterGain(0)

    if (isSpeaking) {
      const plan = resolveHumanRobotBlend(
        preset.humanRobot,
        preset.speed,
        preset.pitch,
      )
      updateSamLiveParams(
        {
          speed: plan.rate,
          pitch: plan.pitch,
          metallic: plan.metallic,
          vocoder: mapUiToVocoder(nextVocoder, preset.formant),
          postProcess: mapUiToPostProcess(nextPost),
          masterVolume: 1,
          masterGainDb: 0,
        },
        { immediate: true },
      )
      bakedVoiceRef.current = null
    }
  }

  const handleStop = () => {
    stopSamSpeech()
    setIsLooping(false)
    setSamLoop(false)
    setIsSpeaking(false)
    setSpokenWordIndex(null)
    bakedVoiceRef.current = null
  }

  const handleLoopToggle = () => {
    const next = !isLooping
    setIsLooping(next)
    setSamLoop(next)
  }

  const handleMuteToggle = () => {
    setIsMuted((prev) => !prev)
  }

  const handlePlayback = () => {
    setError(null)

    const trimmed = text.trim()
    if (!trimmed) {
      setIsSpeaking(false)
      setSpokenWordIndex(null)
      setEmptyWarning(true)
      return
    }

    setEmptyWarning(false)
    setIsSpeaking(true)
    setSpokenWordIndex(0)
    cancelSamSpeech()
    setSamLoop(isLooping)
    bakedVoiceRef.current = {
      text: trimmed,
      rate: livePlan.rate,
      pitch: livePlan.pitch,
      metallic: livePlan.metallic,
    }

    void speakSam({
      text: trimmed,
      speed: livePlan.rate,
      pitch: livePlan.pitch,
      metallic: livePlan.metallic,
      vocoder,
      postProcess,
      masterVolume: liveMasterVolume,
      masterGainDb,
      loop: isLooping,
      onEnd: () => {
        setIsSpeaking(false)
        setSpokenWordIndex(null)
        bakedVoiceRef.current = null
      },
      onError: (message) => {
        setIsSpeaking(false)
        setSpokenWordIndex(null)
        bakedVoiceRef.current = null
        setError(message)
      },
    }).catch((err: unknown) => {
      setIsSpeaking(false)
      setSpokenWordIndex(null)
      bakedVoiceRef.current = null
      setError(err instanceof Error ? err.message : 'Speech synthesis failed.')
    })
  }

  transportToggleRef.current = () => {
    if (aboutOpen || error) return
    if (isSpeaking) handleStop()
    else handlePlayback()
  }

  const handleExportWav = () => {
    setError(null)

    const trimmed = text.trim()
    if (!trimmed) {
      setEmptyWarning(true)
      return
    }

    setEmptyWarning(false)
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
      <div className="speech-splash" aria-hidden="true">
        <div className="speech-splash__wipe">
          {Array.from({ length: SPLASH_WIPE_COLS }, (_, i) => (
            <div key={i} className="speech-splash__wipe-col" />
          ))}
        </div>
        <div className="speech-splash__body">
          <div className="speech-splash__cyborg">
            <img
              src={`${import.meta.env.BASE_URL}cyborg-intro.png`}
              alt=""
              decoding="async"
            />
          </div>
          <div className="speech-splash__frame">
            <div className="speech-splash__mark-slot">
              <div className="speech-splash__mark" />
            </div>
            <div className="speech-splash__logo-slot">
              <Logotype ref={splashLogoRef} className="speech-splash__logo" />
            </div>
            <div className="speech-splash__version-slot">
              <TypewriterReveal
                as="p"
                className="speech-splash__version"
                text={SPLASH_VERSION}
                active={splashVersionActive}
                hold
                speedMs={SPLASH_TYPE_MS}
              />
            </div>
            <div className="speech-splash__bottom">
              <div className="speech-splash__s-slot">
                <div className="speech-splash__s" />
              </div>
              <div className="speech-splash__footer">
                <TypewriterReveal
                  as="p"
                  className="speech-splash__credit"
                  text={SPLASH_CREDIT}
                  active={splashCreditActive}
                  hold
                  speedMs={SPLASH_TYPE_MS}
                />
                <TypewriterReveal
                  as="p"
                  className="speech-splash__year"
                  text={SPLASH_YEAR}
                  active={splashYearActive}
                  hold
                  speedMs={SPLASH_TYPE_MS}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <header className="speech-top">
      <div className="speech-top__brand">
        <span className="speech-top__mark" aria-hidden="true">
          <span className="speech-top__mark-glyph" />
        </span>
        <span className="speech-top__sep" aria-hidden="true" />
        <h1 className="speech-title" aria-label="LX01">
          <Logotype ref={headerLogoRef} loopOnHover />
        </h1>
      </div>
      <Oscilloscope />
      <div className="speech-top__right actions">
        <button
          className="secondary"
          type="button"
          onClick={handleResetTemplate}
          disabled={!templateDirty}
          title="Reset all sections to the selected template"
        >
          <span className="speech-top__btn-label">RESET</span>
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => setAboutOpen(true)}
          title="About"
        >
          <span className="speech-top__btn-label">INFO</span>
        </button>
        <button
          className="secondary"
          type="button"
          onClick={handleExportWav}
          disabled={isExporting || !text.trim()}
          title="Render full mix with FX tails to WAV"
        >
          <span className="speech-top__btn-label">
            {isExporting ? 'EXPORTING...' : 'EXPORT'}
          </span>
        </button>
        <ThemePicker />
        <SettingsMenu />
      </div>
    </header>

      <div className="speech-board">
      <div className="speech-col speech-col--master">
      <MasterStrip
        volume={masterVolume}
        gain={masterGain}
        volumeFill={volumeFill}
        activateGain={activateGain}
        activateVu={activateVu}
        onVolumeChange={setMasterVolume}
        onGainChange={setMasterGain}
        onReset={handleResetMaster}
        canReset={masterDirty}
        isPlaying={isSpeaking}
        isLooping={isLooping}
        isMuted={isMuted}
        onPlayToggle={isSpeaking ? handleStop : handlePlayback}
        onLoopToggle={handleLoopToggle}
        onMuteToggle={handleMuteToggle}
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
          <h2 className="section-title" aria-label="Input">
            {inputTouched ? (
              'Input'
            ) : (
              <TypewriterReveal
                text="PLEASE INPUT YOUR OWN TEXT"
                loop
                speedMs={45}
                pauseMs={1100}
              />
            )}
          </h2>
        </div>
        {isSpeaking ? (
          <div className="field-textarea field-readout" aria-label="Input">
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
            className={`field-textarea${emptyWarning ? ' is-warning' : ''}`}
            value={text}
            onFocus={() => setInputTouched(true)}
            onChange={(e) => {
              setInputTouched(true)
              setText(e.target.value)
              if (emptyWarning) setEmptyWarning(false)
            }}
            placeholder={
              emptyWarning ? 'Please enter some text.' : 'Type something...'
            }
            rows={3}
            aria-label="Input"
          />
        )}
      </section>

      <section className="knob-panel">
        <div className="section-head section-head--voice">
          <h2 className="section-title">Voice</h2>
          <div className="voice-preset">
            <FieldSelect
              className="field-select--voice"
              value={voiceId}
              aria-label="Voice"
              onChange={(next) => handleVoiceChange(next as VoiceId)}
              options={[
                ...VOICE_PRESETS.map((preset) => ({
                  value: preset.id,
                  label: preset.label,
                })),
                { value: 'custom', label: 'Custom' },
              ]}
            />
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
          <Knob
            label="Formant"
            value={formant}
            min={0}
            max={100}
            step={1}
            size="md"
            onChange={setFormant}
            format={(value) => String(Math.round(value))}
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
          <Knob
            label="Unvoice"
            value={vocoderUi.unvoice}
            min={0}
            max={100}
            step={1}
            size="md"
            onChange={setVocoderKnob('unvoice')}
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
      </div>
      </div>

      {error ? (
        <div
          className="error-overlay"
          role="presentation"
          onClick={() => setError(null)}
        >
          <div
            className="error-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="error-modal-message"
            onClick={(event) => event.stopPropagation()}
          >
            <TypewriterReveal
              as="p"
              id="error-modal-message"
              className="error"
              text={error}
              playTypeSound
              onComplete={() => setErrorOkReady(true)}
            />
            <button
              type="button"
              className={[
                'secondary',
                'error-modal__ok',
                errorOkReady ? 'is-in' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-ui-sound="close"
              aria-hidden={!errorOkReady}
              tabIndex={errorOkReady ? 0 : -1}
              onClick={() => setError(null)}
            >
              <span className="error-modal__ok-label">OK</span>
            </button>
          </div>
        </div>
      ) : null}
      </main>
      <AboutOverlay open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <DevMode />
    </>
  )
}
