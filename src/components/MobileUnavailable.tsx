import { ABOUT_LINKS, ABOUT_TEXT } from '../aboutContent'
import './MobileUnavailable.css'

export function isMobileDevice() {
  const ua = navigator.userAgent
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true
  }
  // iPadOS 13+ can report as MacIntel with touch.
  if (
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ) {
    return true
  }
  return false
}

export function MobileUnavailable() {
  return (
    <main className="mobile-unavailable">
      <div className="mobile-unavailable__content">
        <p>{ABOUT_TEXT}</p>
        <p className="mobile-unavailable__links">
          {ABOUT_LINKS.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? ' · ' : null}
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.text}
              </a>
            </span>
          ))}
        </p>
        <p className="mobile-unavailable__note">
          LX01 is not available on mobile devices.
        </p>
      </div>
    </main>
  )
}
