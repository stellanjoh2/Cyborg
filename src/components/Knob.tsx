import {
  useEffect,
  useId,
  useRef,
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

export function Knob({
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
  const safeValue = clampKnobValue(value, min, max, step)
  const { displayed, beginImmediate, endImmediate, skipOnce } =
    useAnimatedNumber(safeValue)
  const angle = valueToKnobAngle(displayed, min, max)
  const fill = valueToKnobFill(displayed, min, max)
  const fillPath = knobFillArcPath(fill, 50, 50, DIAL_RADIUS)
  const displayValue = format ? format(displayed) : String(displayed)
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
        onKeyDown={handleKeyDown}
      >
        <svg className="knob__dial" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="knob__track" cx="50" cy="50" r={DIAL_RADIUS} />
          {fillPath ? (
            <path className="knob__fill" d={fillPath} />
          ) : null}
        </svg>
        <span
          className="knob__needle"
          style={{ transform: `rotate(${angle}deg)` }}
          aria-hidden="true"
        />
      </div>

      <span className="knob-value">{displayValue}</span>
    </div>
  )
}
