import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './VoiceInitOverlay.css'

/** Match master fader ridge density at this bar width. */
const RIDGES = 40

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

export function VoiceInitOverlay({
  open,
  progress,
  loadedBytes = 0,
  totalBytes = 0,
  onCancel,
}: VoiceInitOverlayProps) {
  const [displayPct, setDisplayPct] = useState(0)
  const [displayLoaded, setDisplayLoaded] = useState(0)
  const [displayTotal, setDisplayTotal] = useState(0)
  const displayRef = useRef({ pct: 0, loaded: 0, total: 0 })
  const targetRef = useRef({ pct: 0, loaded: 0, total: 0 })
  const propsRef = useRef({ progress, loadedBytes, totalBytes })
  const rafRef = useRef(0)

  propsRef.current = { progress, loadedBytes, totalBytes }

  const kickEase = () => {
    if (rafRef.current !== 0) return

    const tick = () => {
      const d = displayRef.current
      const t = targetRef.current
      const nextPct = d.pct + (t.pct - d.pct) * 0.22
      const nextLoaded = d.loaded + (t.loaded - d.loaded) * 0.22
      const snappedPct = Math.abs(t.pct - nextPct) < 0.05 ? t.pct : nextPct
      const snappedLoaded =
        Math.abs(t.loaded - nextLoaded) < 40_000 ? t.loaded : nextLoaded
      const nextTotal = t.total > 0 ? t.total : d.total

      displayRef.current = {
        pct: snappedPct,
        loaded: snappedLoaded,
        total: nextTotal,
      }
      setDisplayPct(snappedPct)
      setDisplayLoaded(snappedLoaded)
      setDisplayTotal(nextTotal)

      if (snappedPct !== t.pct || snappedLoaded !== t.loaded) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = 0
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (!open) return
    targetRef.current = {
      pct: Math.max(0, Math.min(100, progress)),
      loaded: Math.max(0, loadedBytes),
      total: Math.max(0, totalBytes),
    }
    kickEase()
  }, [open, progress, loadedBytes, totalBytes])

  useEffect(() => {
    if (!open) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      displayRef.current = { pct: 0, loaded: 0, total: 0 }
      targetRef.current = { pct: 0, loaded: 0, total: 0 }
      setDisplayPct(0)
      setDisplayLoaded(0)
      setDisplayTotal(0)
      return
    }

    const { progress: p, loadedBytes: loaded, totalBytes: total } =
      propsRef.current
    const seed = {
      pct: Math.max(0, Math.min(100, p)),
      loaded: Math.max(0, loaded),
      total: Math.max(0, total),
    }
    displayRef.current = seed
    targetRef.current = seed
    setDisplayPct(seed.pct)
    setDisplayLoaded(seed.loaded)
    setDisplayTotal(seed.total)
    kickEase()

    return () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [open])

  if (!open) return null

  const pct = Math.max(0, Math.min(100, Math.round(displayPct)))
  const fill = Math.max(0, Math.min(1, displayPct / 100))
  const meterStyle = {
    '--ridges': RIDGES,
    '--voice-fill': String(fill),
  } as CSSProperties

  return (
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
              ({formatMb(displayLoaded, displayTotal || totalBytes)})
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
    </div>
  )
}
