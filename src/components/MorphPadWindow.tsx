import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { CloseIcon } from './icons'
import './MorphPadWindow.css'
import './EqualizerWindow.css'

gsap.registerPlugin(useGSAP)

export type MorphModeId = 'voice' | 'vocoder' | 'carrier'

export const MORPH_MODES: readonly {
  id: MorphModeId
  label: string
  detail: string
}[] = [
  { id: 'voice', label: 'Voice', detail: 'Robot × Formant' },
  { id: 'vocoder', label: 'Vocoder', detail: 'Cutoff × Reso' },
  { id: 'carrier', label: 'Carrier', detail: 'Tone × Reso' },
]

export type MorphAxis = {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function snap(value: number, step: number): number {
  if (step <= 0) return value
  return Math.round(value / step) * step
}

function axisToUnit(value: number, min: number, max: number): number {
  if (max === min) return 0.5
  return clamp((value - min) / (max - min), 0, 1)
}

function unitToAxis(
  unit: number,
  min: number,
  max: number,
  step: number,
): number {
  return clamp(snap(min + unit * (max - min), step), min, max)
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

function morphCssVars(xUnit: number, yUnit: number): CSSProperties {
  return {
    ['--morph-x' as string]: (xUnit * 100).toFixed(2),
    ['--morph-y' as string]: (yUnit * 100).toFixed(2),
  }
}

export function MorphPadWindow({
  open,
  mode,
  onModeChange,
  x,
  y,
  onChange,
  onClose,
  onReset,
  canReset,
  zIndex,
  onActivate,
}: {
  open: boolean
  mode: MorphModeId
  onModeChange: (mode: MorphModeId) => void
  x: MorphAxis
  y: MorphAxis
  onChange: (nextX: number, nextY: number) => void
  onClose: () => void
  onReset: () => void
  canReset: boolean
  zIndex?: number
  onActivate?: () => void
}) {
  const windowRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const xOutRef = useRef<HTMLOutputElement>(null)
  const yOutRef = useRef<HTMLOutputElement>(null)
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
  const padRectRef = useRef<DOMRect | null>(null)
  const pendingAxesRef = useRef<{ x: number; y: number } | null>(null)
  const commitFrameRef = useRef<number | null>(null)
  const axesRef = useRef({ x, y, onChange })
  axesRef.current = { x, y, onChange }
  const [grabbing, setGrabbing] = useState(false)

  const xUnit = axisToUnit(x.value, x.min, x.max)
  const yUnit = axisToUnit(y.value, y.min, y.max)

  useEffect(() => {
    if (!open) setGrabbing(false)
  }, [open])

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
      if (commitFrameRef.current !== null) {
        cancelAnimationFrame(commitFrameRef.current)
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

  const paintMorph = (nextXUnit: number, nextYUnit: number) => {
    const body = bodyRef.current
    if (!body) return
    body.style.setProperty('--morph-x', (nextXUnit * 100).toFixed(2))
    body.style.setProperty('--morph-y', (nextYUnit * 100).toFixed(2))
  }

  const flushCommit = () => {
    commitFrameRef.current = null
    const pending = pendingAxesRef.current
    if (!pending) return
    pendingAxesRef.current = null
    axesRef.current.onChange(pending.x, pending.y)
  }

  const scheduleCommit = (nextX: number, nextY: number) => {
    pendingAxesRef.current = { x: nextX, y: nextY }
    if (commitFrameRef.current !== null) return
    commitFrameRef.current = requestAnimationFrame(flushCommit)
  }

  const moveFromClient = (clientX: number, clientY: number) => {
    const rect = padRectRef.current ?? padRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return
    padRectRef.current = rect
    const { x: axisX, y: axisY } = axesRef.current
    const nextX = unitToAxis(
      (clientX - rect.left) / rect.width,
      axisX.min,
      axisX.max,
      axisX.step,
    )
    const nextY = unitToAxis(
      1 - (clientY - rect.top) / rect.height,
      axisY.min,
      axisY.max,
      axisY.step,
    )
    paintMorph(
      axisToUnit(nextX, axisX.min, axisX.max),
      axisToUnit(nextY, axisY.min, axisY.max),
    )
    if (xOutRef.current) xOutRef.current.textContent = String(nextX)
    if (yOutRef.current) yOutRef.current.textContent = String(nextY)
    scheduleCommit(nextX, nextY)
  }

  const beginPadDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    padRectRef.current = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    setGrabbing(true)
    moveFromClient(event.clientX, event.clientY)
  }

  const dragPad = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    moveFromClient(event.clientX, event.clientY)
  }

  const endPadDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    padRectRef.current = null
    if (commitFrameRef.current !== null) {
      cancelAnimationFrame(commitFrameRef.current)
      flushCommit()
    }
    setGrabbing(false)
  }

  const handlePadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const stepX = Math.max(x.step, (x.max - x.min) * 0.02)
    const stepY = Math.max(y.step, (y.max - y.min) * 0.02)
    let nextX = x.value
    let nextY = y.value
    if (event.key === 'ArrowRight') nextX = clamp(x.value + stepX, x.min, x.max)
    else if (event.key === 'ArrowLeft') nextX = clamp(x.value - stepX, x.min, x.max)
    else if (event.key === 'ArrowUp') nextY = clamp(y.value + stepY, y.min, y.max)
    else if (event.key === 'ArrowDown') nextY = clamp(y.value - stepY, y.min, y.max)
    else return
    event.preventDefault()
    onChange(snap(nextX, x.step), snap(nextY, y.step))
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

  return (
    <div
      id="morph-pad"
      ref={windowRef}
      className="eq-window morph-window"
      style={zIndex != null ? { zIndex } : undefined}
      role="dialog"
      aria-modal="false"
      aria-label="Morph pad"
      aria-hidden={!open}
      onPointerDownCapture={onActivate}
    >
      <header className="eq-window__head">
        <div
          className="eq-window__drag"
          onPointerDown={beginWindowDrag}
          onPointerMove={dragWindow}
          onPointerUp={endWindowDrag}
          onPointerCancel={endWindowDrag}
        >
          <span className="eq-window__grip" aria-hidden="true">
            ••••••
          </span>
          <h2>Morph</h2>
        </div>
        <div className="eq-window__actions">
          <button
            type="button"
            className="eq-window__reset"
            onPointerDown={onButtonPointerDown}
            onKeyDown={onButtonKeyDown}
            onClick={onReset}
            disabled={!canReset}
            aria-label="Reset morph axes"
            data-tooltip="Reset"
          >
            <ArrowCounterClockwiseIcon weight="bold" />
          </button>
          <button
            type="button"
            className="eq-window__close"
            onPointerDown={onButtonPointerDown}
            onKeyDown={onButtonKeyDown}
            onClick={onClose}
            aria-label="Close morph pad"
            data-tooltip="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div
        className="eq-window__body morph-window__body"
        ref={bodyRef}
        style={morphCssVars(xUnit, yUnit)}
      >
        <div
          ref={padRef}
          className={`morph-pad${grabbing ? ' is-grabbing' : ''}`}
          role="application"
          tabIndex={open ? 0 : -1}
          aria-label={`${x.label} by ${y.label} morph pad`}
          aria-valuetext={`${x.label} ${x.display}, ${y.label} ${y.display}`}
          onPointerDown={beginPadDrag}
          onPointerMove={dragPad}
          onPointerUp={endPadDrag}
          onPointerCancel={endPadDrag}
          onKeyDown={handlePadKeyDown}
        >
          <div className="morph-pad__center" aria-hidden="true" />
          <div
            className="morph-pad__crosshair morph-pad__crosshair--x"
            aria-hidden="true"
          />
          <div
            className="morph-pad__crosshair morph-pad__crosshair--y"
            aria-hidden="true"
          />
          <span className="morph-axis morph-axis--y" aria-hidden="true">
            {y.label}
          </span>
          <span className="morph-axis morph-axis--x" aria-hidden="true">
            {x.label}
          </span>
          <div className="morph-knob" aria-hidden="true">
            <span className="morph-knob__ring" />
            <span className="morph-knob__core" />
          </div>
        </div>

        <div
          className="eq-band-tabs morph-mode-tabs"
          role="tablist"
          aria-label="Morph targets"
        >
          {MORPH_MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={mode === entry.id}
              className={`eq-band-tab${mode === entry.id ? ' is-selected' : ''}`}
              onPointerDown={onButtonPointerDown}
              onKeyDown={onButtonKeyDown}
              onClick={() => onModeChange(entry.id)}
            >
              <span>{entry.label}</span>
              <span>{entry.detail}</span>
            </button>
          ))}
        </div>

        <div className="eq-controls morph-readouts">
          <div className="eq-control morph-readout">
            <span className="eq-control__head">
              <span>{x.label}</span>
              <output ref={xOutRef}>{x.display}</output>
            </span>
            <div className="morph-readout__bar" aria-hidden="true">
              <span />
            </div>
          </div>
          <div className="eq-control morph-readout">
            <span className="eq-control__head">
              <span>{y.label}</span>
              <output ref={yOutRef}>{y.display}</output>
            </span>
            <div className="morph-readout__bar" aria-hidden="true">
              <span />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
