import { useEffect, useRef, type CSSProperties } from 'react'
import {
  MASTER_GAIN_MAX_DB,
  readMasterPeak,
} from '../speechSynthEngine'
import './MasterStrip.css'

const SEGMENTS = 16
const MIN_DB = -36
const RED_DB = -3
const YELLOW_DB = -12

function segmentZone(index: number): 'green' | 'yellow' | 'red' {
  const db = MIN_DB + ((index + 1) / SEGMENTS) * -MIN_DB
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
  const displayed = useRef(0)
  const peakHoldUntil = useRef(0)

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
      const lit = Math.ceil(((db - MIN_DB) / -MIN_DB) * SEGMENTS)
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
      <label className="master-fader">
        <span className="master-fader__label">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          style={{ '--fill-pct': `${volume}%` } as CSSProperties}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
        <span className="master-fader__value">{Math.round(volume)}</span>
      </label>
      <label className="master-fader">
        <span className="master-fader__label">Gain</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={gain}
          style={{ '--fill-pct': `${gain}%` } as CSSProperties}
          onChange={(event) => onGainChange(Number(event.target.value))}
        />
        <span className="master-fader__value master-fader__value--gain">
          {formatGain(gain)}
        </span>
      </label>
      <div className="vu">
        <div className="vu-leds" ref={ledsRef}>
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <span
              key={index}
              className={`vu-led vu-led--${segmentZone(index)}`}
            />
          ))}
        </div>
        <span
          className="vu-peak"
          ref={peakRef}
          title="Peak"
          aria-label="Peak"
        />
      </div>
      <button
        className="secondary section-reset"
        type="button"
        onClick={onReset}
        disabled={!canReset}
        title="Reset Master to the selected template"
      >
        Reset
      </button>
    </section>
  )
}
