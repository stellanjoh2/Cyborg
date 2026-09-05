import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  MASTER_GAIN_MAX_DB,
  readMasterPeak,
} from '../speechSynthEngine'
import { useAnimatedNumber } from '../useAnimatedNumber'
import './MasterStrip.css'

const RIDGE_PERIOD_PX = 7
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
  return Math.max(1, Math.round((inner + gap) / RIDGE_PERIOD_PX))
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

function VerticalFader({
  label,
  value,
  displayed,
  onChange,
  skipOnce,
  format,
  valueClassName,
}: {
  label: string
  value: number
  displayed: number
  onChange: (value: number) => void
  skipOnce: () => void
  format: (value: number) => string
  valueClassName?: string
}) {
  return (
    <label className="master-fader">
      <span className={`master-fader__value${valueClassName ? ` ${valueClassName}` : ''}`}>
        {format(displayed)}
      </span>
      <span
        className="master-fader__track"
        style={{ '--fill-pct': `${displayed}%` } as CSSProperties}
      >
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={label}
          aria-orientation="vertical"
          {...{ orient: 'vertical' }}
          onChange={(event) => {
            skipOnce()
            onChange(Number(event.target.value))
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
}: {
  volume: number
  gain: number
  onVolumeChange: (value: number) => void
  onGainChange: (value: number) => void
  onReset: () => void
  canReset: boolean
}) {
  const ledsRef = useRef<HTMLDivElement>(null)
  const peakRef = useRef<HTMLSpanElement>(null)
  const metersRef = useRef<HTMLDivElement>(null)
  const displayed = useRef(0)
  const peakHoldUntil = useRef(0)
  const peakHeldLit = useRef(0)
  const [ridges, setRidges] = useState(48)
  const ridgesRef = useRef(ridges)
  ridgesRef.current = ridges
  const volumeAnim = useAnimatedNumber(volume)
  const gainAnim = useAnimatedNumber(gain)

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
      const inRed =
        meterDb >= RED_METER_DB ||
        (holdingPeak &&
          segmentMeterDb(heldLit - 1, ridgesCount) >= RED_METER_DB) ||
        instant >= 0.99

      const root = ledsRef.current
      if (root) {
        const leds = root.children
        for (let i = 0; i < leds.length; i += 1) {
          const on = i < lit || (holdingPeak && i === heldLit - 1)
          leds[i].classList.toggle('is-on', on)
        }
        root.classList.toggle('is-hot', inRed)
      }
      peakRef.current?.classList.toggle('is-on', inRed)

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
          value={volume}
          displayed={volumeAnim.displayed}
          onChange={onVolumeChange}
          skipOnce={volumeAnim.skipOnce}
          format={(value) => String(Math.round(value))}
        />
        <VerticalFader
          label="Gain"
          value={gain}
          displayed={gainAnim.displayed}
          onChange={onGainChange}
          skipOnce={gainAnim.skipOnce}
          format={formatGain}
          valueClassName="master-fader__value--gain"
        />
        <div className="vu">
          <span
            className="vu-peak"
            ref={peakRef}
            title="Peak"
            aria-label="Peak"
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
    </section>
  )
}
