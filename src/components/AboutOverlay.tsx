import { useEffect, useState } from 'react'
import {
  ABOUT_LEGAL_EMPHASIS,
  ABOUT_LEGAL_LINKS,
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
  textActive: boolean
  onClose: () => void
}

export function AboutOverlay({
  open,
  textActive,
  onClose,
}: AboutOverlayProps) {
  const [bioActive, setBioActive] = useState(false)
  const [linksActive, setLinksActive] = useState(false)

  useEffect(() => {
    if (textActive) return
    setBioActive(false)
    setLinksActive(false)
  }, [textActive])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        playUiSound('close')
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <div
      id="legal-view"
      className={['about-overlay', open ? 'is-open' : '']
        .filter(Boolean)
        .join(' ')}
      role="region"
      aria-label="Legal"
      aria-hidden={!open}
    >
      <div className="about-overlay__scroll">
        <div className="about-overlay__content">
          <TypewriterReveal
            as="p"
            className="about-overlay__legal"
            text={ABOUT_LEGAL_TEXT}
            active={textActive}
            playTypeSound
            hold
            caret={false}
            onComplete={() => setBioActive(true)}
            links={[...ABOUT_LEGAL_LINKS]}
            emphasis={[...ABOUT_LEGAL_EMPHASIS]}
          />
          <TypewriterReveal
            as="p"
            className="about-overlay__bio"
            text={ABOUT_TEXT}
            active={textActive && bioActive}
            playTypeSound
            hold
            caret={false}
            onComplete={() => setLinksActive(true)}
          />
          <TypewriterReveal
            as="p"
            className="about-overlay__links"
            text={ABOUT_LINKS_TEXT}
            active={textActive && linksActive}
            playTypeSound
            hold
            caret={false}
            links={[...ABOUT_LINKS]}
          />
        </div>
      </div>
    </div>
  )
}
