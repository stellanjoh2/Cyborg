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
        <p className="mobile-unavailable__note">
          LX01™ is not available on mobile devices.
        </p>
      </div>
    </main>
  )
}
