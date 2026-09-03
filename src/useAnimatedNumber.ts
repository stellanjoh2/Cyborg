import { useEffect, useRef, useState } from 'react'

const SETTLE_MS = 500

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Display value that eases to programmatic updates; snaps while the user is dragging. */
export function useAnimatedNumber(value: number) {
  const [displayed, setDisplayed] = useState(value)
  const displayedRef = useRef(value)
  const immediateRef = useRef(false)
  const skipOnceRef = useRef(false)
  const rafRef = useRef(0)

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)

    const snap =
      immediateRef.current ||
      skipOnceRef.current ||
      prefersReducedMotion()
    skipOnceRef.current = false

    if (snap || value === displayedRef.current) {
      displayedRef.current = value
      setDisplayed(value)
      return
    }

    const from = displayedRef.current
    const started = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / SETTLE_MS)
      const next = from + (value - from) * easeInOut(t)
      displayedRef.current = next
      setDisplayed(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return {
    displayed,
    beginImmediate() {
      immediateRef.current = true
    },
    endImmediate() {
      immediateRef.current = false
    },
    skipOnce() {
      skipOnceRef.current = true
    },
  }
}
