import {
  createContext,
  memo,
  useContext,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  clampKnobValue,
  knobFillArcPath,
  valueToKnobAngle,
  valueToKnobFill,
  verticalDragToValueChange,
  wheelDeltaToValueChange,
} from '../knobCore'
import { useAnimatedNumber } from '../useAnimatedNumber'
import './Knob.css'

const DIAL_RADIUS = 46

/** Intro-only 0→1 arm progress; null = live value. */
export const KnobBootContext = createContext<number | null>(null)

export type KnobSize = 'lg' | 'md'

export interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
  size?: KnobSize
  disabled?: boolean
  hintMin?: string
  hintMax?: string
}

function KnobComponent({
  label,
  value,
  min,
  max,
  step = 0,
  onChange,
  format,
  size = 'md',
  disabled = false,
  hintMin,
  hintMax,
}: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const lastDragYRef = useRef<number | null>(null)
  const dragValueRef = useRef<number | null>(null)
  const labelId = useId()
  const boot = useContext(KnobBootContext)
  const safeValue = clampKnobValue(value, min, max, step)
  const { displayed, beginImmediate, endImmediate, skipOnce } =
    useAnimatedNumber(safeValue)
  // Boot: arms start at min and ease toward the committed value.
  const shown =
    boot == null ? displayed : min + (displayed - min) * boot
  const angle = valueToKnobAngle(shown, min, max)
  const fill = valueToKnobFill(shown, min, max)
  const fillPath = knobFillArcPath(fill, 50, 50, DIAL_RADIUS)
  const displayValue = format ? format(shown) : String(shown)
  const committedText = format ? format(safeValue) : String(safeValue)

  valueRef.current = safeValue
  onChangeRef.current = onChange

  useEffect(() => {
    const node = knobRef.current
    if (!node || disabled) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      skipOnce()
      const delta = wheelDeltaToValueChange(event.deltaY, min, max, step)
      onChangeRef.current(
        clampKnobValue(valueRef.current + delta, min, max, step),
      )
    }

    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [disabled, max, min, skipOnce, step])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    beginImmediate()
    lastDragYRef.current = event.clientY
    dragValueRef.current = safeValue
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      disabled ||
      !event.currentTarget.hasPointerCapture(event.pointerId) ||
      lastDragYRef.current === null ||
      dragValueRef.current === null
    ) {
      return
    }

    const deltaY = event.clientY - lastDragYRef.current
    if (deltaY === 0) {
      return
    }

    lastDragYRef.current = event.clientY
    const delta = verticalDragToValueChange(deltaY, min, max, step)
    dragValueRef.current += delta
    onChangeRef.current(
      clampKnobValue(dragValueRef.current, min, max, step),
    )
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    endImmediate()
    lastDragYRef.current = null
    dragValueRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }

    const delta =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? step || (max - min) / 100
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? -(step || (max - min) / 100)
          : 0

    if (!delta) {
      return
    }

    event.preventDefault()
    skipOnce()
    onChange(clampKnobValue(safeValue + delta, min, max, step))
  }

  return (
    <div
      className={`knob-field knob-field--${size}${disabled ? ' is-disabled' : ''}${fill <= 0 ? ' is-zero' : ''}`}
    >
      <span className="knob-label" id={labelId}>
        {label}
      </span>

      {hintMin || hintMax ? (
        <div className="knob-hints">
          <span>{hintMin}</span>
          <span>{hintMax}</span>
        </div>
      ) : null}

      <div
        ref={knobRef}
        className="knob"
        style={{ '--knob-fill': fill } as CSSProperties}
        role="slider"
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={safeValue}
        aria-valuetext={committedText}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={handleKeyDown}
      >
        {/* Cyan flash twin — intro reveal only (LX01 char-flash pattern). */}
        <div className="knob__flash" aria-hidden="true">
          <div className="knob__arc-bloom">
            <span className="knob__arc-bloom-ring" />
          </div>
          <svg className="knob__dial" viewBox="0 0 100 100">
            <circle className="knob__track" cx="50" cy="50" r={DIAL_RADIUS} />
            {fillPath ? <path className="knob__fill" d={fillPath} /> : null}
          </svg>
          <span
            className="knob__needle"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            <span className="knob__needle-bloom" />
            <span className="knob__needle-core" />
          </span>
        </div>
        <div className="knob__ink">
          <div className="knob__arc-bloom">
            <span className="knob__arc-bloom-ring" />
          </div>
          <svg className="knob__dial" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="knob__track" cx="50" cy="50" r={DIAL_RADIUS} />
            {fillPath ? <path className="knob__fill" d={fillPath} /> : null}
          </svg>
          <span
            className="knob__needle"
            style={{ transform: `rotate(${angle}deg)` }}
            aria-hidden="true"
          >
            <span className="knob__needle-bloom" />
            <span className="knob__needle-core" />
          </span>
        </div>
      </div>

      <span className="knob-value">
        {/* Cyan flash twin — intro reveal only (same lead as dial). */}
        <span className="knob-value__flash" aria-hidden="true">
          {displayValue}
        </span>
        <span className="knob-value__ink">{displayValue}</span>
      </span>
    </div>
  )
}

function knobPropsEqual(prev: KnobProps, next: KnobProps) {
  return (
    prev.value === next.value &&
    prev.min === next.min &&
    prev.max === next.max &&
    prev.step === next.step &&
    prev.label === next.label &&
    prev.size === next.size &&
    prev.disabled === next.disabled &&
    prev.hintMin === next.hintMin &&
    prev.hintMax === next.hintMax
  )
}

export const Knob = memo(KnobComponent, knobPropsEqual)
