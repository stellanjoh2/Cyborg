import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { playUiSound } from '../ui/sounds'
import './ProTip.css'

gsap.registerPlugin(useGSAP)

const SHOW_DELAY_MS = 5000
const HOLD_MS = 9000

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ProTip({ ready }: { ready: boolean }) {
  const tipRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  const dismiss = () => {
    if (!open) return
    playUiSound('close')
    setOpen(false)
  }

  useEffect(() => {
    if (!ready || doneRef.current) return
    const id = window.setTimeout(() => {
      if (doneRef.current) return
      setMounted(true)
      setOpen(true)
    }, SHOW_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [ready])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => setOpen(false), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      playUiSound('close')
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useGSAP(
    () => {
      if (!mounted) return
      const tip = tipRef.current
      if (!tip) return

      const head = tip.querySelector<HTMLElement>('.pro-tip__head')
      const body = tip.querySelector<HTMLElement>('.pro-tip__body')
      const parts = [tip, head, body].filter(Boolean) as HTMLElement[]

      const unmount = () => {
        doneRef.current = true
        setMounted(false)
      }

      if (prefersReducedMotion()) {
        if (open) {
          playUiSound('drop')
          gsap.set(parts, { autoAlpha: 1, y: 0 })
        } else {
          gsap.set(parts, { autoAlpha: 0, y: 0 })
          queueMicrotask(unmount)
        }
        return
      }

      if (open) {
        playUiSound('drop')
        gsap.set(tip, { autoAlpha: 0, y: 14 })
        if (head) gsap.set(head, { autoAlpha: 0, y: 8 })
        if (body) gsap.set(body, { autoAlpha: 0, y: 10 })
        const tl = gsap.timeline()
        tl.to(tip, {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: 'power2.out',
        })
        if (head) {
          tl.to(
            head,
            { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' },
            '-=0.12',
          )
        }
        if (body) {
          tl.to(
            body,
            { autoAlpha: 1, y: 0, duration: 0.26, ease: 'power2.out' },
            '-=0.1',
          )
        }
        return
      }

      const tl = gsap.timeline({ onComplete: unmount })
      if (body) {
        tl.to(body, {
          autoAlpha: 0,
          y: 8,
          duration: 0.16,
          ease: 'power2.in',
        })
      }
      if (head) {
        tl.to(
          head,
          { autoAlpha: 0, y: 6, duration: 0.14, ease: 'power2.in' },
          '-=0.1',
        )
      }
      tl.to(
        tip,
        { autoAlpha: 0, y: 12, duration: 0.22, ease: 'power2.in' },
        '-=0.08',
      )
    },
    { dependencies: [open, mounted] },
  )

  if (!mounted) return null

  return createPortal(
    <div
      ref={tipRef}
      className="pro-tip"
      role="dialog"
      aria-labelledby="pro-tip-title"
      aria-describedby="pro-tip-body"
    >
      <div className="pro-tip__head">
        <h2 id="pro-tip-title" className="pro-tip__title">
          Pro Tip
        </h2>
      </div>
      <p id="pro-tip-body" className="pro-tip__body">
        You can change voice engine in the Settings
      </p>
      <button type="button" className="pro-tip__dismiss" onClick={dismiss}>
        OK
      </button>
    </div>,
    document.body,
  )
}
