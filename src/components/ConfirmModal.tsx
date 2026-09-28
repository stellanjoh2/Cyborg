import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { TypewriterReveal } from './TypewriterReveal'

gsap.registerPlugin(useGSAP)

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type ConfirmModalProps = {
  open: boolean
  title: string
  body: string
  cancelLabel?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmModal({
  open,
  title,
  body,
  cancelLabel = 'Cancel',
  confirmLabel = 'Reset',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [textActive, setTextActive] = useState(false)
  const [bodyActive, setBodyActive] = useState(false)
  const [actionsActive, setActionsActive] = useState(false)
  const [cancelDone, setCancelDone] = useState(false)
  const [confirmDone, setConfirmDone] = useState(false)

  const actionsReady = cancelDone && confirmDone

  useEffect(() => {
    if (!open) return
    setMounted(true)
    const reduced = prefersReducedMotion()
    setTextActive(reduced)
    setBodyActive(reduced)
    setActionsActive(reduced)
    setCancelDone(reduced)
    setConfirmDone(reduced)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  useGSAP(
    () => {
      if (!mounted) return
      const backdrop = backdropRef.current
      const panel = modalRef.current
      const content = contentRef.current
      if (!backdrop || !panel || !content) return

      const unmount = () => setMounted(false)
      const targets = [backdrop, panel, content]
      gsap.killTweensOf(targets)

      if (open) {
        if (prefersReducedMotion()) {
          gsap.set([backdrop, panel, content], {
            autoAlpha: 1,
            y: 0,
            scale: 1,
          })
          return
        }
        gsap.fromTo(
          backdrop,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.24, ease: 'power2.out' },
        )
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
          content,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.28,
            ease: 'power2.out',
            delay: 0.06,
            onComplete: () => setTextActive(true),
          },
        )
        return
      }

      if (prefersReducedMotion()) {
        gsap.set(targets, { autoAlpha: 0, y: 0, scale: 1 })
        queueMicrotask(unmount)
        return
      }

      gsap.to(content, {
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
      gsap.to(backdrop, {
        autoAlpha: 0,
        duration: 0.2,
        ease: 'power2.in',
        delay: 0.04,
        onComplete: unmount,
      })
    },
    { dependencies: [open, mounted], revertOnUpdate: false },
  )

  if (!mounted) return null

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div ref={backdropRef} className="confirm-overlay__backdrop" aria-hidden />
      <div
        ref={modalRef}
        id="reset-confirm-dialog"
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-confirm-title"
        aria-describedby="reset-confirm-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div ref={contentRef} className="confirm-modal__content">
          <TypewriterReveal
            as="h2"
            id="reset-confirm-title"
            className="confirm-modal__title"
            text={title}
            active={textActive}
            playTypeSound
            hold
            onComplete={() => setBodyActive(true)}
          />
          <TypewriterReveal
            as="p"
            id="reset-confirm-body"
            className="confirm-modal__body"
            text={body}
            active={textActive && bodyActive}
            playTypeSound
            hold
            onComplete={() => setActionsActive(true)}
          />
          <div
            className={[
              'confirm-modal__actions',
              actionsActive ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden={!actionsActive}
          >
            <button
              type="button"
              className="confirm-modal__action"
              data-ui-sound="close"
              disabled={!actionsReady}
              tabIndex={actionsReady ? 0 : -1}
              onClick={onCancel}
            >
              <TypewriterReveal
                as="span"
                className="confirm-modal__action-label"
                text={cancelLabel}
                active={actionsActive}
                playTypeSound
                hold
                caret={false}
                onComplete={() => setCancelDone(true)}
              />
            </button>
            <button
              type="button"
              className="confirm-modal__action confirm-modal__action--danger"
              data-ui-sound="ok"
              disabled={!actionsReady}
              tabIndex={actionsReady ? 0 : -1}
              onClick={onConfirm}
            >
              <TypewriterReveal
                as="span"
                className="confirm-modal__action-label"
                text={confirmLabel}
                active={actionsActive}
                playTypeSound
                hold
                caret={false}
                onComplete={() => setConfirmDone(true)}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
