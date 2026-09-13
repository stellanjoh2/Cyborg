import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { playUiSound } from '../ui/sounds'
import './Hint.css'

gsap.registerPlugin(useGSAP)

const HOLD_MS = 4000

export type HintMessage = {
  title: string
  body: string
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Hint({
  message,
  onDismiss,
}: {
  message: HintMessage | null
  onDismiss: () => void
}) {
  const tipRef = useRef<HTMLDivElement>(null)
  const onDismissRef = useRef(onDismiss)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState<HintMessage | null>(null)

  onDismissRef.current = onDismiss

  useEffect(() => {
    if (message) {
      setShown(message)
      setMounted(true)
      setOpen(true)
      return
    }
    setOpen(false)
  }, [message])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => onDismissRef.current(), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [open, shown])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      playUiSound('close')
      onDismissRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useGSAP(
    () => {
      if (!mounted || !shown) return
      const tip = tipRef.current
      if (!tip) return

      const head = tip.querySelector<HTMLElement>('.hint__head')
      const body = tip.querySelector<HTMLElement>('.hint__body')
      const parts = [tip, head, body].filter(Boolean) as HTMLElement[]

      const unmount = () => {
        setMounted(false)
        setShown(null)
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
    { dependencies: [open, mounted, shown] },
  )

  if (!mounted || !shown) return null

  return createPortal(
    <div
      ref={tipRef}
      className="hint"
      role="status"
      aria-labelledby="hint-title"
      aria-describedby="hint-body"
    >
      <div className="hint__head">
        <h2 id="hint-title" className="hint__title">
          {shown.title}
        </h2>
      </div>
      <p id="hint-body" className="hint__body">
        {shown.body}
      </p>
    </div>,
    document.body,
  )
}
