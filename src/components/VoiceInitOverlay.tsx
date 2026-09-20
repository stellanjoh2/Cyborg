import { useLayoutEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import './VoiceInitOverlay.css'

/** 50 segments → 2% each; snaps cleanly to 100%. */
const RIDGES = 50

type VoiceInitOverlayProps = {
  open: boolean
  progress: number
  loadedBytes?: number
  totalBytes?: number
  onCancel?: () => void
}

function formatMb(loaded: number, total: number): string {
  const mb = (n: number) => Math.max(0, n / 1e6).toFixed(1)
  const totalMb = Math.max(Number(mb(total)), 0.1)
  return `${mb(loaded)}/${totalMb.toFixed(1)}mb`
}

function litFromProgress(progress: number): number {
  if (progress <= 0) return 0
  return Math.min(RIDGES, Math.round((progress / 100) * RIDGES))
}

export function VoiceInitOverlay({
  open,
  progress,
  loadedBytes = 0,
  totalBytes = 0,
  onCancel,
}: VoiceInitOverlayProps) {
  const [host, setHost] = useState<Element | null>(null)

  useLayoutEffect(() => {
    // Portal outside .scale-stage — transform ancestors break backdrop-filter.
    setHost(document.querySelector('.scale-viewport'))
  }, [])

  if (!open || !host) return null

  const lit = litFromProgress(progress)
  const pct = Math.round((lit / RIDGES) * 100)
  // Snap fill to whole segments so ridges never clip mid-bar.
  const fill = lit / RIDGES
  const meterStyle = {
    '--ridges': RIDGES,
    '--voice-fill': String(fill),
  } as CSSProperties

  return createPortal(
    <div
      className="voice-init-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="voice-init-title"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-busy="true"
      onClick={onCancel}
    >
      <div
        className="voice-init"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="voice-init__head">
          <h2 id="voice-init-title" className="voice-init__title">
            DOWNLOADING VOICE PACK
            <span className="voice-init__mb">
              {' '}
              ({formatMb(loadedBytes, totalBytes)})
            </span>
          </h2>
        </div>
        <div className="voice-init__row">
          <div
            className="voice-init__meter"
            style={meterStyle}
            aria-hidden="true"
          >
            <div className="voice-init__fill" />
          </div>
          <div className="voice-init__pct" aria-hidden="true">
            <span className="voice-init__pct-text">
              {pct}
              <span className="voice-init__pct-sign">%</span>
            </span>
          </div>
        </div>
      </div>
    </div>,
    host,
  )
}
