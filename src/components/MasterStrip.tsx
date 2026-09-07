import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  MASTER_GAIN_MAX_DB,
  readMasterPeak,
} from '../speechSynthEngine'
import { useAnimatedNumber } from '../useAnimatedNumber'
import { LoopIcon, SpeakerIcon } from './icons'
import './MasterStrip.css'

/** Target pitch of one ridge + gap. */
const RIDGE_PERIOD_PX = 14
/** DJM-A9 default: meter 0 ≈ −21 dBFS */
const REFERENCE_DBFS = -21
/** Pioneer channel scale floor / ∞ ceiling (∞ sits slightly above +12) */
const MIN_METER_DB = -26
const MAX_METER_DB = 15
const YELLOW_METER_DB = 0
const RED_METER_DB = 12
const PEAK_HOLD_MS = 2000

function ridgesForTrack(track: HTMLElement): number {
  const styles = getComputedStyle(track)
  const inner =
    track.clientHeight -
    Number.parseFloat(styles.paddingTop) -
    Number.parseFloat(styles.paddingBottom)
  const gap = Number.parseFloat(styles.getPropertyValue('--ridge-gap')) || 2
  // floor keeps period ≥ target; CSS (100% + gap) / n tiles an exact integer count
  return Math.max(1, Math.floor((inner + gap) / RIDGE_PERIOD_PX))
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
}: {
  label: string
  value: number
  displayed: number
  ridges: number
  onChange: (value: number) => void
  skipOnce: () => void
  format: (value: number) => string
  valueClassName?: string
}) {
  const lit = ridgeLit(value, ridges)
  const fillPct = litToValue(ridgeLit(displayed, ridges), ridges)

  return (
    <label className="master-fader">
      <span className={`master-fader__value${valueClassName ? ` ${valueClassName}` : ''}`}>
        {format(displayed)}
      </span>
      <span
        className="master-fader__track"
        style={{ '--fill-pct': `${fillPct}%` } as CSSProperties}
      >
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
  const ridgesRef = useRef(ridges)
  ridgesRef.current = ridges
  const volumeAnim = useAnimatedNumber(volume)
  const gainAnim = useAnimatedNumber(gain)
  const volumeShown = volumeFill ?? volumeAnim.displayed
  const volumeLit = volumeFill ?? volume

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
      const instant = readMasterPeak()
      displayed.current =
        instant > displayed.current
          ? instant
          : displayed.current * 0.88 + instant * 0.12

      const ridgesCount = ridgesRef.current
      const meterDb = linearToMeterDb(displayed.current)
      const lit = meterDbToLit(meterDb, ridgesCount)
      const instantMeterDb = linearToMeterDb(instant)
      const instantLit = meterDbToLit(instantMeterDb, ridgesCount)

      if (instantLit >= peakHeldLit.current) {
        peakHeldLit.current = instantLit
        peakHoldUntil.current = now + PEAK_HOLD_MS
      } else if (now >= peakHoldUntil.current) {
        peakHeldLit.current = lit
      }

      const heldLit = peakHeldLit.current
      const holdingPeak = now < peakHoldUntil.current && heldLit > lit
      const heldDb = holdingPeak
        ? segmentMeterDb(heldLit - 1, ridgesCount)
        : meterDb
      const zoneDb = Math.max(meterDb, heldDb)
      const inRed = zoneDb >= RED_METER_DB || instant >= 0.99
      const inYellow = !inRed && zoneDb >= YELLOW_METER_DB
      const isLive = !inRed && !inYellow && lit > 0

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
        for (let i = 0; i < leds.length; i += 1) {
          const on = i < lit || (holdingPeak && i === heldLit - 1)
          leds[i].classList.toggle('is-on', on)
        }
        root.classList.toggle('is-hot', inRed)
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
        <button
          className={`master-play${isPlaying ? ' is-playing' : ''}`}
          type="button"
          onClick={onPlayToggle}
          title={isPlaying ? 'Stop speech' : 'Play speech'}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? 'Stop' : 'Play'}
        >
          <span className="master-play__rail" aria-hidden="true" />
          <span className="master-play__spin" aria-hidden="true" />
          <span className="master-play__face" aria-hidden="true">
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
