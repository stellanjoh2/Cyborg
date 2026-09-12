import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import {
  EQ_MAX_FREQUENCY,
  EQ_MAX_GAIN,
  EQ_MAX_Q,
  EQ_MIN_FREQUENCY,
  EQ_MIN_GAIN,
  EQ_MIN_Q,
  equalizerMatchesDefault,
  equalizerResponseDb,
  frequencyToPosition,
  positionToFrequency,
  type EqualizerBand,
  type EqualizerState,
} from '../equalizer'
import { CloseIcon } from './icons'
import './EqualizerWindow.css'

gsap.registerPlugin(useGSAP)

const WIDTH = 1260
const HEIGHT = 500
const PLOT = { left: 48, right: 48, top: 48, bottom: 48 }
const RESPONSE_RANGE_DB = 12
const FREQUENCY_TICKS = [20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000]
const GAIN_TICKS = [12, 6, 0, -6, -12]

function plotX(frequency: number): number {
  return PLOT.left + frequencyToPosition(frequency) * (WIDTH - PLOT.left - PLOT.right)
}

function plotY(gain: number): number {
  const normalized = (RESPONSE_RANGE_DB - gain) / (RESPONSE_RANGE_DB * 2)
  return PLOT.top + normalized * (HEIGHT - PLOT.top - PLOT.bottom)
}

function formatFrequency(frequency: number): string {
  if (frequency >= 1_000) {
    const value = frequency / 1_000
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}k`
  }
  return String(Math.round(frequency))
}

function formatGain(gain: number): string {
  return `${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB`
}

function updateBand(
  equalizer: EqualizerState,
  index: number,
  patch: Partial<EqualizerBand>,
): EqualizerState {
  return {
    ...equalizer,
    bands: equalizer.bands.map((band, bandIndex) =>
      bandIndex === index ? { ...band, ...patch } : band,
    ),
  }
}

function flashButton(button: HTMLButtonElement) {
  if (button.disabled) return
  button.classList.add('is-flash')
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      button.classList.remove('is-flash')
    })
  })
}

function onButtonPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
  if (event.button !== 0) return
  flashButton(event.currentTarget)
}

function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  flashButton(event.currentTarget)
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className={`eq-control${disabled ? ' is-disabled' : ''}`}>
      <span className="eq-control__head">
        <span>{label}</span>
        <output>{display}</output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function EqualizerWindow({
  open,
  value,
  onChange,
  onClose,
  onReset,
}: {
  open: boolean
  value: EqualizerState
  onChange: (value: EqualizerState) => void
  onClose: () => void
  onReset: () => void
}) {
  const windowRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const windowDragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    left: number
    top: number
    scale: number
    maxLeft: number
    maxTop: number
  } | null>(null)
  const pendingPositionRef = useRef<{ left: number; top: number } | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIndex = value.bands.findIndex((band) => band.id === selectedId)
  const selectedBand = value.bands[selectedIndex]

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
      }
    },
    [],
  )

  useGSAP(
    () => {
      const panel = windowRef.current
      const body = bodyRef.current
      if (!panel || !body) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      gsap.killTweensOf([panel, body])
      if (open) {
        panel.style.pointerEvents = 'auto'
        if (reduced) {
          gsap.set([panel, body], { autoAlpha: 1, y: 0, scale: 1 })
          return
        }
        gsap.fromTo(
          panel,
          { autoAlpha: 0, y: -18, scale: 0.985 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.24,
            ease: 'power2.out',
          },
        )
        gsap.fromTo(
          body,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.28,
            ease: 'power2.out',
            delay: 0.06,
          },
        )
        return
      }
      if (getComputedStyle(panel).visibility === 'hidden') {
        gsap.set([panel, body], { autoAlpha: 0 })
        panel.style.pointerEvents = 'none'
        return
      }
      panel.style.pointerEvents = 'none'
      if (reduced) {
        gsap.set(panel, { autoAlpha: 0, y: 0, scale: 1 })
        return
      }
      gsap.to(body, {
        autoAlpha: 0,
        y: 10,
        duration: 0.14,
        ease: 'power2.in',
      })
      gsap.to(panel, {
        autoAlpha: 0,
        y: -14,
        scale: 0.985,
        duration: 0.2,
        ease: 'power2.in',
        delay: 0.04,
      })
    },
    { dependencies: [open], scope: windowRef, revertOnUpdate: false },
  )

  const responsePath = useMemo(() => {
    const points = Array.from({ length: 181 }, (_, index) => {
      const frequency = positionToFrequency(index / 180)
      const response = Math.max(
        -RESPONSE_RANGE_DB,
        Math.min(RESPONSE_RANGE_DB, equalizerResponseDb(value, frequency)),
      )
      return `${index === 0 ? 'M' : 'L'}${plotX(frequency).toFixed(2)},${plotY(response).toFixed(2)}`
    })
    return points.join(' ')
  }, [value])

  const moveBandFromPointer = (
    event: ReactPointerEvent<SVGGElement>,
    index: number,
  ) => {
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT
    const plotWidth = WIDTH - PLOT.left - PLOT.right
    const plotHeight = HEIGHT - PLOT.top - PLOT.bottom
    const frequency = Math.round(
      positionToFrequency((x - PLOT.left) / plotWidth),
    )
    const gain = Math.round(
      Math.min(
        EQ_MAX_GAIN,
        Math.max(
          EQ_MIN_GAIN,
          RESPONSE_RANGE_DB -
            ((y - PLOT.top) / plotHeight) * RESPONSE_RANGE_DB * 2,
        ),
      ) * 10,
    ) / 10
    onChange(updateBand(value, index, { frequency, gain }))
  }

  const handlePointKeyDown = (
    event: KeyboardEvent<SVGGElement>,
    index: number,
  ) => {
    const band = value.bands[index]
    if (!band) return
    let patch: Partial<EqualizerBand> | null = null
    if (event.key === 'ArrowUp') patch = { gain: Math.min(EQ_MAX_GAIN, band.gain + 0.5) }
    if (event.key === 'ArrowDown') patch = { gain: Math.max(EQ_MIN_GAIN, band.gain - 0.5) }
    if (event.key === 'ArrowRight') patch = { frequency: Math.min(EQ_MAX_FREQUENCY, Math.round(band.frequency * 1.06)) }
    if (event.key === 'ArrowLeft') patch = { frequency: Math.max(EQ_MIN_FREQUENCY, Math.round(band.frequency / 1.06)) }
    if (!patch) return
    event.preventDefault()
    onChange(updateBand(value, index, patch))
  }

  const beginWindowDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const panel = windowRef.current
    const app = panel?.parentElement
    if (!panel || !app) return
    const appRect = app.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const scale = appRect.width / app.clientWidth
    const left = (panelRect.left - appRect.left) / scale
    const top = (panelRect.top - appRect.top) / scale
    windowDragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      left,
      top,
      scale,
      maxLeft: Math.max(0, app.clientWidth - panel.offsetWidth),
      maxTop: Math.max(0, app.clientHeight - panel.offsetHeight),
    }
    panel.style.left = '0'
    panel.style.top = '0'
    panel.style.translate = `${left}px ${top}px`
    panel.style.willChange = 'translate'
    event.currentTarget.parentElement?.classList.add('is-dragging')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const dragWindow = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = windowDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    pendingPositionRef.current = {
      left: Math.min(
        drag.maxLeft,
        Math.max(0, drag.left + (event.clientX - drag.clientX) / drag.scale),
      ),
      top: Math.min(
        drag.maxTop,
        Math.max(0, drag.top + (event.clientY - drag.clientY) / drag.scale),
      ),
    }
    if (dragFrameRef.current !== null) return
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null
      const position = pendingPositionRef.current
      const panel = windowRef.current
      if (!position || !panel) return
      panel.style.translate = `${position.left}px ${position.top}px`
      pendingPositionRef.current = null
    })
  }

  const endWindowDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = windowDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
    }
    const position = pendingPositionRef.current
    const panel = windowRef.current
    if (position && panel) {
      panel.style.translate = `${position.left}px ${position.top}px`
    }
    pendingPositionRef.current = null
    windowDragRef.current = null
    if (panel) panel.style.willChange = ''
    event.currentTarget.parentElement?.classList.remove('is-dragging')
  }

  const selectBand = (index: number) => {
    const band = value.bands[index]
    if (band) setSelectedId(band.id)
  }

  return (
    <div
      id="master-equalizer"
      ref={windowRef}
      className={`eq-window${value.enabled ? '' : ' is-bypassed'}`}
      role="dialog"
      aria-modal="false"
      aria-label="Master equalizer"
      aria-hidden={!open}
    >
      <header className="eq-window__head">
        <div
          className="eq-window__drag"
          onPointerDown={beginWindowDrag}
          onPointerMove={dragWindow}
          onPointerUp={endWindowDrag}
          onPointerCancel={endWindowDrag}
        >
          <span className="eq-window__grip" aria-hidden="true">••••••</span>
          <h2>Master EQ</h2>
        </div>
        <div className="eq-window__actions">
          <button
            type="button"
            className={`eq-window__action${value.enabled ? ' is-active' : ''}`}
            onPointerDown={onButtonPointerDown}
            onKeyDown={onButtonKeyDown}
            onClick={() => onChange({ ...value, enabled: !value.enabled })}
            aria-pressed={value.enabled}
          >
            <span className="eq-window__action-label">
              {value.enabled ? 'On' : 'Bypass'}
            </span>
          </button>
          <button
            type="button"
            className="eq-window__reset"
            onPointerDown={onButtonPointerDown}
            onKeyDown={onButtonKeyDown}
            onClick={onReset}
            disabled={equalizerMatchesDefault(value)}
            aria-label="Reset equalizer"
            data-tooltip="Reset EQ"
          >
            <ArrowCounterClockwiseIcon weight="bold" />
          </button>
          <button
            type="button"
            className="eq-window__close"
            onPointerDown={onButtonPointerDown}
            onKeyDown={onButtonKeyDown}
            onClick={onClose}
            aria-label="Close equalizer"
            data-tooltip="Close EQ"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="eq-window__body" ref={bodyRef}>
        <div className="eq-graph">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="Equalizer response curve">
            <defs>
              <linearGradient id="eq-response-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {FREQUENCY_TICKS.map((frequency) => (
              <g key={frequency}>
                <line
                  className="eq-grid-line"
                  x1={plotX(frequency)}
                  x2={plotX(frequency)}
                  y1={PLOT.top}
                  y2={HEIGHT - PLOT.bottom}
                />
                <text
                  className="eq-axis-label"
                  x={plotX(frequency)}
                  y={HEIGHT - PLOT.bottom / 2}
                  dominantBaseline="central"
                  textAnchor={
                    frequency === EQ_MIN_FREQUENCY
                      ? 'start'
                      : frequency === EQ_MAX_FREQUENCY
                        ? 'end'
                        : 'middle'
                  }
                >
                  {formatFrequency(frequency)}
                </text>
              </g>
            ))}
            {GAIN_TICKS.map((gain) => (
              <g key={gain}>
                <line
                  className={`eq-grid-line${gain === 0 ? ' is-zero' : ''}`}
                  x1={PLOT.left}
                  x2={WIDTH - PLOT.right}
                  y1={plotY(gain)}
                  y2={plotY(gain)}
                />
                <text
                  className="eq-axis-label"
                  x={PLOT.left - 12}
                  y={plotY(gain) + 5}
                  textAnchor="end"
                >
                  {gain > 0 ? `+${gain}` : gain}
                </text>
              </g>
            ))}

            <path
              className="eq-response-area"
              d={`${responsePath} L${WIDTH - PLOT.right},${HEIGHT - PLOT.bottom} L${PLOT.left},${HEIGHT - PLOT.bottom} Z`}
            />
            <path className="eq-response-line" d={responsePath} />

            {value.bands.map((band, index) => (
              <g
                key={band.id}
                className={`eq-point${index === selectedIndex ? ' is-selected' : ''}`}
                role="slider"
                tabIndex={open ? 0 : -1}
                aria-label={`${band.label}: ${formatFrequency(band.frequency)} hertz, ${formatGain(band.gain)}`}
                aria-valuemin={EQ_MIN_GAIN}
                aria-valuemax={EQ_MAX_GAIN}
                aria-valuenow={band.gain}
                transform={`translate(${plotX(band.frequency)} ${plotY(band.gain)})`}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  selectBand(index)
                  event.currentTarget.setPointerCapture(event.pointerId)
                  moveBandFromPointer(event, index)
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    moveBandFromPointer(event, index)
                  }
                }}
                onKeyDown={(event) => handlePointKeyDown(event, index)}
              >
                <circle className="eq-point__hit" r="28" />
                <circle className="eq-point__ring" r="17" />
                {/* Ac437 digits fill the ascent (0.875em); half of that centers ink in the ring. */}
                <text className="eq-point__number" y="0.4375em" textAnchor="middle">
                  {index + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="eq-band-tabs" role="tablist" aria-label="EQ bands">
          {value.bands.map((band, index) => (
            <button
              key={band.id}
              type="button"
              role="tab"
              aria-selected={index === selectedIndex}
              className={`eq-band-tab${index === selectedIndex ? ' is-selected' : ''}`}
              onPointerDown={onButtonPointerDown}
              onKeyDown={onButtonKeyDown}
              onClick={() => selectBand(index)}
            >
              <span>{index + 1} · {band.label}</span>
              <span>{formatFrequency(band.frequency)} Hz / {formatGain(band.gain)}</span>
            </button>
          ))}
        </div>

        <div className={`eq-controls${selectedBand ? '' : ' is-idle'}`}>
          <Slider
            label="Frequency"
            value={
              selectedBand ? frequencyToPosition(selectedBand.frequency) : 0.5
            }
            min={0}
            max={1}
            step={0.001}
            display={
              selectedBand
                ? `${formatFrequency(selectedBand.frequency)} Hz`
                : '—'
            }
            disabled={!selectedBand}
            onChange={(next) =>
              onChange(
                updateBand(value, selectedIndex, {
                  frequency: Math.round(positionToFrequency(next)),
                }),
              )
            }
          />
          <Slider
            label="Gain"
            value={selectedBand?.gain ?? 0}
            min={EQ_MIN_GAIN}
            max={EQ_MAX_GAIN}
            step={0.1}
            display={selectedBand ? formatGain(selectedBand.gain) : '—'}
            disabled={!selectedBand}
            onChange={(gain) =>
              onChange(updateBand(value, selectedIndex, { gain }))
            }
          />
          <Slider
            label="Q"
            value={selectedBand?.q ?? 1}
            min={EQ_MIN_Q}
            max={EQ_MAX_Q}
            step={0.05}
            display={
              !selectedBand
                ? '—'
                : selectedBand.type === 'peaking'
                  ? selectedBand.q.toFixed(2)
                  : 'Shelf'
            }
            disabled={!selectedBand || selectedBand.type !== 'peaking'}
            onChange={(q) =>
              onChange(updateBand(value, selectedIndex, { q }))
            }
          />
        </div>
      </div>
    </div>
  )
}
