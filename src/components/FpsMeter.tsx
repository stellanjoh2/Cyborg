import { useEffect, useRef, useState } from 'react'
import './FpsMeter.css'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

/** Hidden FPS overlay — toggle with F. */
export function FpsMeter() {
  const [open, setOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const rafRef = useRef(0)
  const framesRef = useRef(0)
  const lastSampleRef = useRef(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (event.key !== 'f' && event.key !== 'F') return
      event.preventDefault()
      setOpen((prev) => !prev)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) {
      setFps(0)
      return
    }

    framesRef.current = 0
    lastSampleRef.current = performance.now()

    const tick = (now: number) => {
      framesRef.current += 1
      const elapsed = now - lastSampleRef.current
      if (elapsed >= 500) {
        setFps(Math.round((framesRef.current * 1000) / elapsed))
        framesRef.current = 0
        lastSampleRef.current = now
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [open])

  if (!open) return null

  return (
    <div className="fps-meter" aria-live="polite">
      {fps || '—'} FPS
    </div>
  )
}
