import { useEffect, useState } from 'react'
import {
  applyGrainOpacity,
  applyPalette,
  applyStrokeOpacity,
  DEFAULT_GRAIN_OPACITY,
  DEFAULT_PALETTE,
  DEFAULT_STROKE_OPACITY,
  formatPalette,
  isHexColor,
  PALETTE_KEYS,
  PALETTE_LABELS,
  type Palette,
  type PaletteKey,
} from '../devPalette'
import './DevMode.css'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function DevMode() {
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE)
  const [strokeOpacity, setStrokeOpacity] = useState(DEFAULT_STROKE_OPACITY)
  const [grainOpacity, setGrainOpacity] = useState(DEFAULT_GRAIN_OPACITY)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'd' && event.key !== 'D') {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if (isTypingTarget(event.target)) {
        return
      }

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const setColor = (key: PaletteKey, value: string) => {
    const next = { ...palette, [key]: value }
    setPalette(next)
    if (isHexColor(value)) {
      applyPalette(next)
    }
  }

  const setOpacity = (value: number) => {
    const next = Math.min(1, Math.max(0, value))
    setStrokeOpacity(next)
    applyStrokeOpacity(next)
  }

  const setGrain = (value: number) => {
    const next = Math.min(1, Math.max(0, value))
    setGrainOpacity(next)
    applyGrainOpacity(next)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      formatPalette(palette, strokeOpacity, grainOpacity),
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  if (!open) {
    return null
  }

  return (
    <aside className="dev-mode" aria-label="Color tuner">
      <h2 className="dev-mode__title">Dev colors</h2>
      {PALETTE_KEYS.map((key) => (
        <label key={key} className="dev-mode__row">
          <input
            className="dev-mode__swatch"
            type="color"
            value={isHexColor(palette[key]) ? palette[key] : DEFAULT_PALETTE[key]}
            onChange={(e) => setColor(key, e.target.value)}
            aria-label={PALETTE_LABELS[key]}
          />
          <span className="dev-mode__label">{PALETTE_LABELS[key]}</span>
          <input
            className="dev-mode__hex"
            type="text"
            value={palette[key]}
            onChange={(e) => setColor(key, e.target.value)}
            spellCheck={false}
            aria-label={`${PALETTE_LABELS[key]} hex`}
          />
        </label>
      ))}
      <label className="dev-mode__row dev-mode__row--opacity">
        <span className="dev-mode__label">border opacity</span>
        <input
          className="dev-mode__range"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(strokeOpacity * 100)}
          onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          aria-label="border opacity"
        />
        <input
          className="dev-mode__hex"
          type="text"
          value={strokeOpacity.toFixed(2)}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (Number.isFinite(next)) {
              setOpacity(next)
            }
          }}
          aria-label="border opacity value"
        />
      </label>
      <label className="dev-mode__row dev-mode__row--opacity">
        <span className="dev-mode__label">grain opacity</span>
        <input
          className="dev-mode__range"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(grainOpacity * 100)}
          onChange={(e) => setGrain(Number(e.target.value) / 100)}
          aria-label="grain opacity"
        />
        <input
          className="dev-mode__hex"
          type="text"
          value={grainOpacity.toFixed(2)}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (Number.isFinite(next)) {
              setGrain(next)
            }
          }}
          aria-label="grain opacity value"
        />
      </label>
      <button className="dev-mode__copy" type="button" onClick={() => void handleCopy()}>
        {copied ? 'Copied' : 'Copy palette'}
      </button>
    </aside>
  )
}
