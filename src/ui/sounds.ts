const FILES = {
  delete: 'sounds/uisound-delete.wav',
  ok: 'sounds/uisound-close.wav',
  close: 'sounds/uisound-ok.wav',
  push: 'sounds/uisound-push.wav',
  slider: 'sounds/uisound-slider.wav',
  sliderLeft: 'sounds/uisound-slider.wav',
  hover: 'sounds/uisound-hover.wav',
  drop: 'sounds/uisound-drop.wav',
} as const

/** Buttons and interactive chrome that get hover + click cues. */
const HOVER_SELECTOR =
  '.secondary, .field-select__trigger, .field-select__option, .dev-mode__copy, .about-overlay__content a'

const CLICK_SELECTOR =
  '.secondary, .field-select__trigger, .field-select__option, .dev-mode__copy'

export type UiSound = keyof typeof FILES

const SOUND_NAMES = Object.keys(FILES) as UiSound[]

/** Per-cue gain matched to median RMS (−29 dBFS), peak-limited to −6 dBFS. */
const SOUND_GAIN: Partial<Record<UiSound, number>> = {
  delete: 0.9958 * 10 ** (-10 / 20),
  ok: 1.0,
  close: 10 ** (-2 / 20),
  push: 3.5818 * 10 ** (-10 / 20),
  slider: 0.7532,
  sliderLeft: 0.7532,
  hover: 0.9189 * 10 ** (5 / 20),
  drop: 1.8205 * 10 ** (-5 / 20),
}

/** Left-drag reuses the slider clip a half octave down. */
const PLAYBACK_RATE: Partial<Record<UiSound, number>> = {
  sliderLeft: 2 ** -0.5,
}

const STORAGE_KEY = 'lx01-ui-sounds'

type UiSoundPrefs = { enabled: boolean; volume: number }

function clampVolume(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function loadPrefs(): UiSoundPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { enabled: true, volume: 80 }
    const parsed = JSON.parse(raw) as Partial<UiSoundPrefs>
    return {
      enabled: parsed.enabled !== false,
      volume: clampVolume(Number(parsed.volume ?? 80)),
    }
  } catch {
    return { enabled: true, volume: 80 }
  }
}

let prefs = loadPrefs()

function savePrefs(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

function soundUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file}`
}

type WindowWithWebkit = Window & {
  webkitAudioContext?: typeof AudioContext
}

let audioCtx: AudioContext | null = null
const rawFiles = new Map<UiSound, ArrayBuffer>()
const decoded = new Map<UiSound, AudioBuffer>()
const loadingRaw = new Map<UiSound, Promise<ArrayBuffer | null>>()
const loadingDecoded = new Map<UiSound, Promise<AudioBuffer | null>>()
let hoverUntil = 0
const HOVER_MIN_INTERVAL_MS = 120

function createAudioContext(): AudioContext | null {
  const AC = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext
  if (!AC) return null
  return new AC()
}

function audioContext(): AudioContext | null {
  if (audioCtx && audioCtx.state !== 'closed') return audioCtx
  decoded.clear()
  audioCtx = createAudioContext()
  return audioCtx
}

/** Resume the shared context. Call from a user gesture when possible. */
function unlockAudio(): AudioContext | null {
  const ctx = audioContext()
  if (!ctx) return null
  if (ctx.state !== 'running') {
    void ctx.resume().catch(() => {})
  }
  return ctx
}

async function loadRaw(name: UiSound): Promise<ArrayBuffer | null> {
  if (!import.meta.env.DEV) {
    const cached = rawFiles.get(name)
    if (cached) return cached
    const inflight = loadingRaw.get(name)
    if (inflight) return inflight
  }
  const promise = (async () => {
    try {
      const url = soundUrl(FILES[name])
      const res = await fetch(
        import.meta.env.DEV ? `${url}?t=${Date.now()}` : url,
      )
      if (!res.ok) return null
      const data = await res.arrayBuffer()
      if (!import.meta.env.DEV) rawFiles.set(name, data)
      return data
    } catch {
      return null
    } finally {
      if (!import.meta.env.DEV) loadingRaw.delete(name)
    }
  })()
  if (!import.meta.env.DEV) loadingRaw.set(name, promise)
  return promise
}

async function bufferFor(name: UiSound): Promise<AudioBuffer | null> {
  if (!import.meta.env.DEV) {
    const cached = decoded.get(name)
    if (cached) return cached
    const inflight = loadingDecoded.get(name)
    if (inflight) return inflight
  }
  const promise = (async () => {
    const ctx = audioContext()
    const raw = await loadRaw(name)
    if (!ctx || ctx.state === 'closed' || !raw) return null
    try {
      const buf = await ctx.decodeAudioData(raw.slice(0))
      if (!import.meta.env.DEV) decoded.set(name, buf)
      return buf
    } catch {
      if (!import.meta.env.DEV) decoded.delete(name)
      return null
    } finally {
      if (!import.meta.env.DEV) loadingDecoded.delete(name)
    }
  })()
  if (!import.meta.env.DEV) loadingDecoded.set(name, promise)
  return promise
}

function startSound(name: UiSound, buf: AudioBuffer): void {
  const ctx = unlockAudio()
  if (!ctx || ctx.state === 'closed') return
  const play = () => {
    if (!prefs.enabled || prefs.volume <= 0 || ctx.state !== 'running') return
    const source = ctx.createBufferSource()
    source.buffer = buf
    const rate = PLAYBACK_RATE[name] ?? 1
    source.playbackRate.value = rate
    const gain = ctx.createGain()
    const amp = SOUND_GAIN[name] ?? 1
    gain.gain.value = (prefs.volume / 100) * amp
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(0)
  }
  if (ctx.state === 'running') {
    play()
    return
  }
  void ctx
    .resume()
    .then(() => {
      if (ctx.state === 'running') play()
    })
    .catch(() => {})
}

export function getUiSoundsEnabled(): boolean {
  return prefs.enabled
}

export function getUiSoundsVolume(): number {
  return prefs.volume
}

export function setUiSoundsEnabled(enabled: boolean): void {
  prefs = { ...prefs, enabled }
  savePrefs()
  if (enabled) unlockAudio()
}

export function setUiSoundsVolume(volume: number): void {
  prefs = { ...prefs, volume: clampVolume(volume) }
  savePrefs()
}

export function playUiSound(name: UiSound, unthrottled = false): void {
  if (!prefs.enabled || prefs.volume <= 0) return
  if (name === 'hover' && !unthrottled) {
    const now = performance.now()
    if (now < hoverUntil) return
    hoverUntil = now + HOVER_MIN_INTERVAL_MS
  }
  const ctx = unlockAudio()
  if (!ctx) return
  const ready = import.meta.env.DEV ? undefined : decoded.get(name)
  if (ready) {
    try {
      startSound(name, ready)
      return
    } catch {
      decoded.delete(name)
    }
  }
  void bufferFor(name).then((buf) => {
    if (!buf || !prefs.enabled || prefs.volume <= 0) return
    startSound(name, buf)
  })
}

function shouldPlayHover(el: HTMLElement): boolean {
  if (el instanceof HTMLButtonElement && el.disabled) return false
  if (el.classList.contains('is-active')) return false
  if (el.classList.contains('is-selected')) return false
  return true
}

function onButtonHover(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) return
  const el = target.closest(HOVER_SELECTOR)
  if (!(el instanceof HTMLElement) || !shouldPlayHover(el)) return
  const related = event.relatedTarget
  if (related instanceof Node && el.contains(related)) return
  if (performance.now() < hoverUntil) return
  playUiSound('hover')
}

function playButtonCue(btn: Element): void {
  if (btn instanceof HTMLButtonElement && btn.disabled) return
  const cue = btn instanceof HTMLElement ? btn.dataset.uiSound : undefined
  if (cue && cue in FILES) {
    playUiSound(cue as UiSound)
    return
  }
  playUiSound('push')
}

function onButtonClick(event: Event): void {
  const el = event.target
  if (!(el instanceof Element)) return
  const btn = el.closest(CLICK_SELECTOR)
  if (!(btn instanceof HTMLElement)) return
  if (btn instanceof HTMLButtonElement && btn.disabled) return
  playButtonCue(btn)
}

function onUnlockGesture(): void {
  if (!prefs.enabled) return
  unlockAudio()
  for (const name of SOUND_NAMES) {
    if (!decoded.has(name)) void bufferFor(name)
  }
}

/** Preloads UI sounds and wires button hover/click cues. */
export function initUiSounds(): void {
  for (const name of SOUND_NAMES) void loadRaw(name)
  document.addEventListener('pointerdown', onUnlockGesture, true)
  document.addEventListener('keydown', onUnlockGesture, true)
  document.addEventListener('click', onButtonClick, true)
  document.addEventListener('mouseover', onButtonHover, true)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && prefs.enabled) unlockAudio()
  })
  window.addEventListener('pageshow', () => {
    if (prefs.enabled) unlockAudio()
  })
  window.addEventListener('focus', () => {
    if (prefs.enabled) unlockAudio()
  })
}
