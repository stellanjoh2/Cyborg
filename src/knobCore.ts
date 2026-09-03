/** Default synth sweep: ~7 o'clock through ~5 o'clock (270° total). */
export const KNOB_MIN_DEG = -135
export const KNOB_MAX_DEG = 135
export const KNOB_SWEEP_DEG = KNOB_MAX_DEG - KNOB_MIN_DEG

export function clampKnobValue(
  value: number,
  min: number,
  max: number,
  step = 0,
): number {
  const clamped = Math.min(max, Math.max(min, value))
  if (!step || step <= 0) {
    return clamped
  }
  const stepped = Math.round(clamped / step) * step
  const decimals = `${step}`.includes('.')
    ? `${step}`.split('.')[1]?.length ?? 0
    : 0
  return Number(stepped.toFixed(decimals))
}

export function valueToKnobFill(
  value: number,
  min: number,
  max: number,
): number {
  if (max <= min) {
    return 0
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

export function valueToKnobAngle(
  value: number,
  min: number,
  max: number,
): number {
  return KNOB_MIN_DEG + valueToKnobFill(value, min, max) * KNOB_SWEEP_DEG
}

/** CSS degrees: 0 = 12 o'clock, clockwise positive. */
export function knobFillArcPath(
  fill: number,
  cx = 50,
  cy = 50,
  radius = 46,
): string | null {
  if (fill <= 0) {
    return null
  }

  const sweep = fill * KNOB_SWEEP_DEG
  const startDeg = KNOB_MIN_DEG
  const endDeg = startDeg + sweep
  const point = (cssDeg: number) => {
    const rad = ((cssDeg - 90) * Math.PI) / 180
    return `${cx + radius * Math.cos(rad)} ${cy + radius * Math.sin(rad)}`
  }

  return `M ${point(startDeg)} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${point(endDeg)}`
}

export function knobAngleToValue(
  angle: number,
  min: number,
  max: number,
  step = 0,
): number {
  const clampedAngle = Math.min(KNOB_MAX_DEG, Math.max(KNOB_MIN_DEG, angle))
  const t = (clampedAngle - KNOB_MIN_DEG) / KNOB_SWEEP_DEG
  const raw = min + t * (max - min)
  return clampKnobValue(raw, min, max, step)
}

/** Angle in degrees, 0 = 12 o'clock, clockwise positive. */
export function pointerAngleFromCenter(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const x = clientX - (rect.left + rect.width / 2)
  const y = clientY - (rect.top + rect.height / 2)
  return (Math.atan2(x, -y) * 180) / Math.PI
}

export function wheelDeltaToValueChange(
  deltaY: number,
  min: number,
  max: number,
  step: number,
): number {
  const direction = deltaY < 0 ? 1 : -1
  const span = max - min
  const baseStep = step > 0 ? step : span / 100
  return direction * baseStep
}

/** Pixels of vertical drag needed to sweep the full knob range. */
export const KNOB_DRAG_PIXELS = 160
const KNOB_PIXELS_PER_STEP = 14

export function verticalDragPixels(
  min: number,
  max: number,
  step = 0,
): number {
  const span = max - min
  if (span <= 0) {
    return KNOB_DRAG_PIXELS
  }

  if (step > 0) {
    const stepCount = span / step
    return Math.max(48, Math.min(KNOB_DRAG_PIXELS, stepCount * KNOB_PIXELS_PER_STEP))
  }

  return KNOB_DRAG_PIXELS
}

export function verticalDragToValueChange(
  deltaY: number,
  min: number,
  max: number,
  step = 0,
): number {
  const span = max - min
  if (span <= 0) {
    return 0
  }

  const pixels = verticalDragPixels(min, max, step)
  return (-deltaY / pixels) * span
}
