import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  clampKnobValue,
  valueToKnobAngle,
  verticalDragToValueChange,
  wheelDeltaToValueChange,
} from '../knobCore'
import './Knob.css'

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
  const angle = valueToKnobAngle(safeValue, min, max)
  const displayValue = format ? format(safeValue) : String(safeValue)

  valueRef.current = safeValue
  onChangeRef.current = onChange

  useEffect(() => {
    const node = knobRef.current
    if (!node || disabled) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const delta = wheelDeltaToValueChange(event.deltaY, min, max, step)
      onChangeRef.current(
        clampKnobValue(valueRef.current + delta, min, max, step),
      )
    }

    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [disabled, max, min, step])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
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
    onChange(clampKnobValue(safeValue + delta, min, max, step))
  }

  return (
    <div
      className={`knob-field knob-field--${size}${disabled ? ' is-disabled' : ''}`}
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
        aria-valuetext={displayValue}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
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
