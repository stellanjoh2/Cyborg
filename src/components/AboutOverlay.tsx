import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ABOUT_LEGAL_TEXT,
  ABOUT_LINKS,
  ABOUT_LINKS_TEXT,
  ABOUT_TEXT,
} from '../aboutContent'
import { playUiSound } from '../ui/sounds'
import { TypewriterReveal } from './TypewriterReveal'
import './AboutOverlay.css'

type AboutOverlayProps = {
  open: boolean
  onClose: () => void
}

export function AboutOverlay({ open, onClose }: AboutOverlayProps) {
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const [linksActive, setLinksActive] = useState(false)
  const [legalActive, setLegalActive] = useState(false)
  const [okActive, setOkActive] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setLinksActive(false)
      setLegalActive(false)
      setOkActive(false)
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true))
      })
      return () => window.cancelAnimationFrame(id)
    }
    setEntered(false)
    setLinksActive(false)
    setLegalActive(false)
    setOkActive(false)
  }, [open])

  // ScaleViewport's transform: scale() puts the UI on its own compositor layer;
  // backdrop-filter on a body portal often samples empty chrome instead. Blur #root.
  useEffect(() => {
    document.documentElement.classList.toggle('is-about-open', entered)
    return () => document.documentElement.classList.remove('is-about-open')
  }, [entered])

  useEffect(() => {
    if (!mounted) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        playUiSound('close')
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mounted, onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className={['about-overlay', entered ? 'is-open' : '']
        .filter(Boolean)
        .join(' ')}
      role="presentation"
      onClick={() => {
        playUiSound('close')
        onClose()
      }}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget) return
        if (!open && event.propertyName === 'background-color') setMounted(false)
      }}
    >
      <div
        className="about-overlay__scroll"
        role="dialog"
        aria-modal="true"
        aria-label="About Stellan Johansson"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="about-overlay__content">
          <TypewriterReveal
            as="p"
            text={ABOUT_TEXT}
            active={entered}
            playTypeSound
            onComplete={() => setLinksActive(true)}
          />
          <TypewriterReveal
            as="p"
            className="about-overlay__links"
            text={ABOUT_LINKS_TEXT}
            active={entered && linksActive}
            playTypeSound
            hold
            caret={false}
            onComplete={() => setLegalActive(true)}
            links={[...ABOUT_LINKS]}
          />
          <TypewriterReveal
            as="p"
            className="about-overlay__legal"
            text={ABOUT_LEGAL_TEXT}
            active={entered && legalActive}
            playTypeSound
            hold
            caret={false}
            onComplete={() => setOkActive(true)}
          />
          <button
            type="button"
            className={[
              'secondary',
              'about-overlay__ok',
              okActive ? 'is-in' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-ui-sound="close"
            aria-hidden={!okActive}
            tabIndex={okActive ? 0 : -1}
            onClick={onClose}
          >
            <TypewriterReveal
              as="span"
              text="OK"
              active={entered && okActive}
              playTypeSound
              hold
              caret={false}
            />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
