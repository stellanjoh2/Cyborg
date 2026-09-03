import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  MASTER_GAIN_MAX_DB,
  readMasterPeak,
} from '../speechSynthEngine'
import { useAnimatedNumber } from '../useAnimatedNumber'
import './MasterStrip.css'

const RIDGE_PERIOD_PX = 7
const MIN_DB = -36
const RED_DB = -3
const YELLOW_DB = -12

function ridgesForTrack(track: HTMLElement): number {
  const styles = getComputedStyle(track)
  const inner =
    track.clientHeight -
    Number.parseFloat(styles.paddingTop) -
    Number.parseFloat(styles.paddingBottom)
  const gap = Number.parseFloat(styles.getPropertyValue('--ridge-gap')) || 2
  return Math.max(1, Math.round((inner + gap) / RIDGE_PERIOD_PX))
}

function segmentZone(index: number, ridges: number): 'green' | 'yellow' | 'red' {
  const db = MIN_DB + ((index + 1) / ridges) * -MIN_DB
  if (db >= RED_DB) {
    return 'red'
  }
  if (db >= YELLOW_DB) {
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

      const db =
        displayed.current <= 0.0001
          ? MIN_DB
          : Math.max(MIN_DB, 20 * Math.log10(displayed.current))
      const lit = Math.ceil(((db - MIN_DB) / -MIN_DB) * ridgesRef.current)
      const clipping = instant >= 0.99
      if (clipping) {
        peakHoldUntil.current = now + 900
      }
      const hot = db >= RED_DB || now < peakHoldUntil.current

      const root = ledsRef.current
      if (root) {
        const leds = root.children
        for (let i = 0; i < leds.length; i += 1) {
          leds[i].classList.toggle('is-on', i < lit)
        }
        root.classList.toggle('is-hot', hot)
      }
      peakRef.current?.classList.toggle('is-on', now < peakHoldUntil.current)

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
