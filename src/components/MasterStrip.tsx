import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { introBoot } from '../introBoot'
import {
  getSynthPlaybackClock,
  MASTER_GAIN_MAX_DB,
  readMasterPeak,
} from '../speechSynthEngine'
import { useAnimatedNumber } from '../useAnimatedNumber'
import { LoopIcon, SpeakerIcon } from './icons'
import './MasterStrip.css'

const IDLE_CLOCK = '0:00.0/0:00.0'

/** Format seconds as m:ss.t (e.g. 0:03.2). */
function formatClockSeconds(seconds: number): string {
  const tenthsTotal = Math.max(0, Math.floor(seconds * 10 + 1e-6))
  const mins = Math.floor(tenthsTotal / 600)
  const secTenths = tenthsTotal % 600
  const secs = Math.floor(secTenths / 10)
  const tenths = secTenths % 10
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`
}

function formatPlaybackClock(elapsed: number, duration: number): string {
  return `${formatClockSeconds(elapsed)}/${formatClockSeconds(duration)}`
}

/** Must match `.master-fader__track` / `.vu-leds` `--ridge-gap`. */
const RIDGE_GAP_PX = 2
/** DJM-A9 default: meter 0 ≈ −21 dBFS */
const REFERENCE_DBFS = -21
/** Pioneer channel scale floor / ∞ ceiling (∞ sits slightly above +12) */
const MIN_METER_DB = -26
const MAX_METER_DB = 15
const YELLOW_METER_DB = 0
const RED_METER_DB = 12
const PEAK_HOLD_MS = 2000

/**
 * Single-ridge window aligned to the CSS mask: periods are
 * (inner + gap) / ridges, not inner / ridges — equal % steps clip upper ridges.
 */
export function ridgeFillWindow(
  lit: number,
  ridges: number,
  innerPx: number,
  gapPx = RIDGE_GAP_PX,
): { start: number; end: number } {
  if (lit <= 0 || ridges <= 0 || innerPx <= 0) {
    return { start: 0, end: 0 }
  }
  const period = (innerPx + gapPx) / ridges
  const ridge = period - gapPx
  const startPx = (lit - 1) * period
  const endPx = startPx + ridge
  return {
    start: (startPx / innerPx) * 100,
    end: (endPx / innerPx) * 100,
  }
}

/** Map 0–1 progress onto a single lit ridge index (0 = none). */
export function activateRidgeLit(progress: number, ridges: number): number {
  if (progress <= 0 || ridges <= 0) {
    return 0
  }
  return Math.min(ridges, Math.ceil(progress * ridges))
}

/** Height the fill/ridge mask use (full padding box — tips bleed like VU LEDs). */
export function trackInnerHeight(track: HTMLElement): number {
  return track.clientHeight
}

/**
 * Integer ridge count so tip segments ≈ pill radius.
 * First/last dividers land on the cap tangents (not mid-curve).
 */
function ridgesForTrack(track: HTMLElement): number {
  const inner = trackInnerHeight(track)
  const gap =
    Number.parseFloat(getComputedStyle(track).getPropertyValue('--ridge-gap')) ||
    RIDGE_GAP_PX
  const radius = track.clientWidth / 2
  const period = Math.max(gap + 1, radius + gap)
  return Math.max(1, Math.round((inner + gap) / period))
}

function linearToMeterDb(linear: number): number {
  if (linear <= 0.0001) {
    return MIN_METER_DB
  }
  return Math.max(MIN_METER_DB, 20 * Math.log10(linear) - REFERENCE_DBFS)
}

function meterDbToLit(meterDb: number, ridges: number): number {
  const t = (meterDb - MIN_METER_DB) / (MAX_METER_DB - MIN_METER_DB)
  return Math.max(0, Math.min(ridges, Math.ceil(t * ridges)))
}

function segmentMeterDb(index: number, ridges: number): number {
  return MIN_METER_DB + ((index + 0.5) / ridges) * (MAX_METER_DB - MIN_METER_DB)
}

function segmentZone(index: number, ridges: number): 'green' | 'yellow' | 'red' {
  const db = segmentMeterDb(index, ridges)
  if (db >= RED_METER_DB) {
    return 'red'
  }
  if (db >= YELLOW_METER_DB) {
    return 'yellow'
  }
  return 'green'
}

function formatGain(slider: number): string {
  const db = (slider / 100) * MASTER_GAIN_MAX_DB
  return `+${db.toFixed(1)} dB`
}

/** Snap a 0–100 fader value onto an integer ridge count. */
function ridgeLit(value: number, ridges: number): number {
  return Math.max(0, Math.min(ridges, Math.round((value / 100) * ridges)))
}

function litToValue(lit: number, ridges: number): number {
  return ridges > 0 ? (lit / ridges) * 100 : 0
}

function VerticalFader({
  label,
  value,
  displayed,
  ridges,
  onChange,
  skipOnce,
  format,
  valueClassName,
  fillWindow,
}: {
  label: string
  value: number
  displayed: number
  ridges: number
  onChange: (value: number) => void
  skipOnce: () => void
  format: (value: number) => string
  valueClassName?: string
  /** When set, paints only [start, end] % instead of 0→displayed fill. */
  fillWindow?: { start: number; end: number } | null
}) {
  const lit = ridgeLit(value, ridges)
  const fillPct = fillWindow?.end ?? litToValue(ridgeLit(displayed, ridges), ridges)
  const fillStart = fillWindow?.start ?? 0

  return (
    <label className="master-fader">
      <span className={`master-fader__value${valueClassName ? ` ${valueClassName}` : ''}`}>
        {format(displayed)}
      </span>
      <span
        className="master-fader__track-wrap"
        style={
          {
            '--fill-a': fillStart / 100,
            '--fill-b': fillPct / 100,
          } as CSSProperties
        }
      >
        <span className="master-fader__track">
          <span className="master-fader__fill" aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={ridges}
            step={1}
            value={lit}
            aria-label={label}
            aria-orientation="vertical"
            {...{ orient: 'vertical' }}
            onChange={(event) => {
              skipOnce()
              onChange(litToValue(Number(event.target.value), ridges))
            }}
          />
        </span>
      </span>
      <span className="master-fader__label">{label}</span>
    </label>
  )
}

export function MasterStrip({
  volume,
  gain,
  onVolumeChange,
  onGainChange,
  onReset,
  canReset,
  volumeFill,
  isPlaying,
  isLoading = false,
  isLooping,
  isMuted,
  onPlayToggle,
  onLoopToggle,
  onMuteToggle,
}: {
  volume: number
  gain: number
  onVolumeChange: (value: number) => void
  onGainChange: (value: number) => void
  onReset: () => void
  canReset: boolean
  /** When set, drives the volume meter fill/readout directly (skips ease). */
  volumeFill?: number | null
  isPlaying: boolean
  isLoading?: boolean
  isLooping: boolean
  isMuted: boolean
  onPlayToggle: () => void
  onLoopToggle: () => void
  onMuteToggle: () => void
}) {
  const ledsRef = useRef<HTMLDivElement>(null)
  const peakRef = useRef<HTMLSpanElement>(null)
  const metersRef = useRef<HTMLDivElement>(null)
  const displayed = useRef(0)
  const peakHoldUntil = useRef(0)
  const peakHeldLit = useRef(0)
  const lastVuPaint = useRef({
    lit: -1,
    heldLit: -1,
    holdingPeak: false,
    inRed: false,
    inYellow: false,
    isLive: false,
  })
  const [ridges, setRidges] = useState(24)
  const [clockLabel, setClockLabel] = useState(IDLE_CLOCK)
  const ridgesRef = useRef(ridges)
  ridgesRef.current = ridges
  const volumeAnim = useAnimatedNumber(volume)
  const gainAnim = useAnimatedNumber(gain)
  // Prop gates empty→live handoff; introBoot paints fill/label imperatively mid-tween.
  const volumeShown = volumeFill ?? volumeAnim.displayed
  const volumeLit = volumeFill ?? volume

  // After intro volume boot, clear the imperative clip only once live
  // --fill-* are committed — otherwise the bar flashes empty (React still at 0).
  useLayoutEffect(() => {
    if (volumeFill != null) return
    const fill = metersRef.current?.querySelector(
      '.master-fader:nth-child(1) .master-fader__fill',
    )
    if (fill instanceof HTMLElement) {
      fill.style.removeProperty('clip-path')
    }
  }, [volumeFill])

  useEffect(() => {
    if (!isPlaying) {
      setClockLabel(IDLE_CLOCK)
      return
    }

    let frame = 0
    const tick = () => {
      const { elapsed, duration } = getSynthPlaybackClock()
      const next = formatPlaybackClock(elapsed, duration)
      setClockLabel((current) => (current === next ? current : next))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])

  useEffect(() => {
    const meters = metersRef.current
    const track = meters?.querySelector('.master-fader__track')
    if (!meters || !(track instanceof HTMLElement)) {
      return
    }

    const applyRidges = () => {
      const count = ridgesForTrack(track)
      meters.style.setProperty('--ridges', String(count))
      setRidges((prev) => (prev === count ? prev : count))
    }

    const observer = new ResizeObserver(applyRidges)
    observer.observe(track)
    applyRidges()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let frame = 0

    const tick = (now: number) => {
      const ridgesCount = ridgesRef.current
      const boot = introBoot.vuProgress

      let lit: number
      let heldLit: number
      let holdingPeak: boolean
      let inRed: boolean
      let inYellow: boolean
      let isLive: boolean

      if (boot != null) {
        // Boot solo-ridge: skip analyser — getFloatTimeDomainData is wasted here.
        lit = activateRidgeLit(boot, ridgesCount)
        heldLit = lit
        holdingPeak = false
        const bootDb = lit > 0 ? segmentMeterDb(lit - 1, ridgesCount) : MIN_METER_DB
        // Boot sweep: light red LEDs, but never the hot capsule stroke / peak alarm.
        // Peak lamp stays dark until the solo ridge reaches the top segment.
        const atTop = lit >= ridgesCount
        inRed = false
        inYellow = atTop && bootDb >= YELLOW_METER_DB
        isLive = atTop && !inYellow && lit > 0
      } else if (ledsRef.current?.closest('.is-introducing')) {
        // Volume/gain boot: keep VU dark without analyser polling.
        lit = 0
        heldLit = 0
        holdingPeak = false
        inRed = false
        inYellow = false
        isLive = false
      } else {
        const instant = readMasterPeak()
        displayed.current =
          instant > displayed.current
            ? instant
            : displayed.current * 0.88 + instant * 0.12

        const meterDb = linearToMeterDb(displayed.current)
        lit = meterDbToLit(meterDb, ridgesCount)
        const instantMeterDb = linearToMeterDb(instant)
        const instantLit = meterDbToLit(instantMeterDb, ridgesCount)

        if (instantLit >= peakHeldLit.current) {
          peakHeldLit.current = instantLit
          peakHoldUntil.current = now + PEAK_HOLD_MS
        } else if (now >= peakHoldUntil.current) {
          peakHeldLit.current = lit
        }

        heldLit = peakHeldLit.current
        holdingPeak = now < peakHoldUntil.current && heldLit > lit
        const heldDb = holdingPeak
          ? segmentMeterDb(heldLit - 1, ridgesCount)
          : meterDb
        const zoneDb = Math.max(meterDb, heldDb)
        inRed = zoneDb >= RED_METER_DB || instant >= 0.99
        inYellow = !inRed && zoneDb >= YELLOW_METER_DB
        isLive = !inRed && !inYellow && lit > 0
      }

      const prev = lastVuPaint.current
      if (
        prev.lit === lit &&
        prev.heldLit === heldLit &&
        prev.holdingPeak === holdingPeak &&
        prev.inRed === inRed &&
        prev.inYellow === inYellow &&
        prev.isLive === isLive
      ) {
        frame = requestAnimationFrame(tick)
        return
      }
      lastVuPaint.current = {
        lit,
        heldLit,
        holdingPeak,
        inRed,
        inYellow,
        isLive,
      }

      const root = ledsRef.current
      if (root) {
        const leds = root.children
        if (boot != null) {
          // Solo ridge: only flip the previous + current LED.
          if (prev.lit > 0) {
            leds[prev.lit - 1]?.classList.remove('is-on')
          }
          if (lit > 0) {
            leds[lit - 1]?.classList.add('is-on')
          }
        } else {
          for (let i = 0; i < leds.length; i += 1) {
            const on = i < lit || (holdingPeak && i === heldLit - 1)
            leds[i].classList.toggle('is-on', on)
          }
        }
      }

      const peak = peakRef.current
      if (peak) {
        peak.classList.toggle('is-live', isLive)
        peak.classList.toggle('is-caution', inYellow)
        peak.classList.toggle('is-on', inRed)
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <section className="master-strip">
      <div className="section-head">
        <h2 className="section-title">Master</h2>
        <button
          className="secondary section-reset"
          type="button"
          onClick={onReset}
          disabled={!canReset}
          title="Reset Master to the selected template"
        >
          Reset
        </button>
      </div>
      <div ref={metersRef} className="master-meters">
        <VerticalFader
          label="Volume"
          value={volumeLit}
          displayed={volumeShown}
          ridges={ridges}
          onChange={onVolumeChange}
          skipOnce={volumeAnim.skipOnce}
          format={(value) => String(Math.round(value))}
        />
        <VerticalFader
          label="Gain"
          value={gain}
          displayed={gainAnim.displayed}
          ridges={ridges}
          onChange={onGainChange}
          skipOnce={gainAnim.skipOnce}
          format={formatGain}
          valueClassName="master-fader__value--gain"
        />
        <div className="vu">
          <span
            className="vu-peak"
            ref={peakRef}
            title="Signal"
            aria-label="Signal lamp"
          />
          <div className="vu-leds" ref={ledsRef}>
            {Array.from({ length: ridges }, (_, index) => (
              <span
                key={index}
                className={`vu-led vu-led--${segmentZone(index, ridges)}`}
              />
            ))}
          </div>
          <span className="master-fader__label">VU</span>
        </div>
      </div>
      <div className="master-transport">
        <div
          className={`master-clock${isPlaying ? ' is-playing' : ''}`}
          aria-label="Speech duration"
          aria-live="off"
        >
          <span className="master-clock__lcd">{clockLabel}</span>
        </div>
        <button
          className={[
            'master-play',
            isPlaying ? 'is-playing' : '',
            isLoading ? 'is-loading' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          type="button"
          onClick={onPlayToggle}
          title={
            isLoading
              ? 'Cancel loading'
              : isPlaying
                ? 'Stop speech'
                : 'Play speech'
          }
          aria-pressed={isPlaying || isLoading}
          aria-busy={isLoading || undefined}
          aria-label={isLoading ? 'Loading' : isPlaying ? 'Stop' : 'Play'}
        >
          <span className="master-play__rail" aria-hidden="true" />
          <span className="master-play__spin" aria-hidden="true" />
          <span className="master-play__face" aria-hidden="true">
            {isLoading ? (
              <span className="master-play__label">Loading</span>
            ) : (
              <span className="master-play__icon">
                {isPlaying ? (
                  <svg
                    className="master-play__icon-stop"
                    viewBox="0 0 28 28"
                    focusable="false"
                    aria-hidden="true"
                  >
                    <rect x="6" y="6" width="16" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg
                    className="master-play__icon-play"
                    viewBox="0 0 28 28"
                    focusable="false"
                    aria-hidden="true"
                  >
                    <path d="M8 4.5v19L24 14 8 4.5z" />
                  </svg>
                )}
              </span>
            )}
          </span>
        </button>
      </div>
      <button
        className={`master-mute${isMuted ? ' is-active' : ''}`}
        type="button"
        onClick={onMuteToggle}
        title={isMuted ? 'Unmute master' : 'Mute master'}
        aria-pressed={isMuted}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        <SpeakerIcon />
      </button>
      <span className="master-s" aria-hidden="true" />
      <button
        className={`master-loop${isLooping ? ' is-active' : ''}`}
        type="button"
        onClick={onLoopToggle}
        title="Loop playback"
        aria-pressed={isLooping}
        aria-label="Loop"
      >
        <LoopIcon />
      </button>
    </section>
  )
}
