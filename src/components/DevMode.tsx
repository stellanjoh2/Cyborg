import { useEffect, useState } from 'react'
import {
  applyBevelEmboss,
  applyGrainOpacity,
  applyPalette,
  applyStrokeOpacity,
  applyWallpaperBlendMode,
  applyWallpaperOpacity,
  DEFAULT_BEVEL_EMBOSS,
  DEFAULT_GRAIN_OPACITY,
  DEFAULT_PALETTE,
  DEFAULT_STROKE_OPACITY,
  DEFAULT_WALLPAPER_BLEND_MODE,
  DEFAULT_WALLPAPER_OPACITY,
  formatPalette,
  isHexColor,
  PALETTE_KEYS,
  PALETTE_LABELS,
  WALLPAPER_BLEND_MODES,
  type BevelEmboss,
  type Palette,
  type PaletteKey,
  type WallpaperBlendMode,
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

function OpacityRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="dev-mode__row dev-mode__row--opacity">
      <span className="dev-mode__label">{label}</span>
      <input
        className="dev-mode__range"
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label={label}
      />
      <input
        className="dev-mode__hex"
        type="text"
        value={value.toFixed(2)}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) {
            onChange(next)
          }
        }}
        aria-label={`${label} value`}
      />
    </label>
  )
}

function PxRow({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="dev-mode__row dev-mode__row--opacity">
      <span className="dev-mode__label">{label}</span>
      <input
        className="dev-mode__range"
        type="range"
        min="0"
        max={max}
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <input
        className="dev-mode__hex"
        type="text"
        value={`${value}px`}
        onChange={(e) => {
          const next = Number(e.target.value.replace(/px$/i, ''))
          if (Number.isFinite(next)) {
            onChange(next)
          }
        }}
        aria-label={`${label} value`}
      />
    </label>
  )
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: string
  fallback: string
  onChange: (value: string) => void
}) {
  return (
    <label className="dev-mode__row">
      <input
        className="dev-mode__swatch"
        type="color"
        value={isHexColor(value) ? value : fallback}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
      <span className="dev-mode__label">{label}</span>
      <input
        className="dev-mode__hex"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={`${label} hex`}
      />
    </label>
  )
}

export function DevMode() {
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE)
  const [strokeOpacity, setStrokeOpacity] = useState(DEFAULT_STROKE_OPACITY)
  const [grainOpacity, setGrainOpacity] = useState(DEFAULT_GRAIN_OPACITY)
  const [wallpaperOpacity, setWallpaperOpacity] = useState(
    DEFAULT_WALLPAPER_OPACITY,
  )
  const [wallpaperBlendMode, setWallpaperBlendMode] =
    useState<WallpaperBlendMode>(DEFAULT_WALLPAPER_BLEND_MODE)
  const [bevelEmboss, setBevelEmboss] = useState<BevelEmboss>(DEFAULT_BEVEL_EMBOSS)
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

  const setWallpaper = (value: number) => {
    const next = Math.min(1, Math.max(0, value))
    setWallpaperOpacity(next)
    applyWallpaperOpacity(next)
  }

  const setBlendMode = (value: string) => {
    if (!(WALLPAPER_BLEND_MODES as readonly string[]).includes(value)) {
      return
    }
    const next = value as WallpaperBlendMode
    setWallpaperBlendMode(next)
    applyWallpaperBlendMode(next)
  }

  const patchBevel = (patch: Partial<BevelEmboss>) => {
    const next = { ...bevelEmboss, ...patch }
    setBevelEmboss(next)
    applyBevelEmboss(next)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      formatPalette(
        palette,
        strokeOpacity,
        grainOpacity,
        wallpaperOpacity,
        wallpaperBlendMode,
        bevelEmboss,
      ),
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
        <ColorRow
          key={key}
          label={PALETTE_LABELS[key]}
          value={palette[key]}
          fallback={DEFAULT_PALETTE[key]}
          onChange={(value) => setColor(key, value)}
        />
      ))}
      <OpacityRow
        label="border opacity"
        value={strokeOpacity}
        onChange={setOpacity}
      />
      <OpacityRow
        label="grain opacity"
        value={grainOpacity}
        onChange={setGrain}
      />
      <OpacityRow
        label="wallpaper opacity"
        value={wallpaperOpacity}
        onChange={setWallpaper}
      />
      <label className="dev-mode__row dev-mode__row--blend">
        <span className="dev-mode__label">wallpaper blend</span>
        <select
          className="dev-mode__select"
          value={wallpaperBlendMode}
          onChange={(e) => setBlendMode(e.target.value)}
          aria-label="wallpaper blend mode"
        >
          {WALLPAPER_BLEND_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>

      <h3 className="dev-mode__subtitle">Bevel / emboss</h3>
      <ColorRow
        label="highlight color"
        value={bevelEmboss.highlightColor}
        fallback={DEFAULT_BEVEL_EMBOSS.highlightColor}
        onChange={(value) => patchBevel({ highlightColor: value })}
      />
      <ColorRow
        label="shadow color"
        value={bevelEmboss.shadowColor}
        fallback={DEFAULT_BEVEL_EMBOSS.shadowColor}
        onChange={(value) => patchBevel({ shadowColor: value })}
      />
      <PxRow
        label="bevel radius"
        value={bevelEmboss.radius}
        max={12}
        onChange={(value) => patchBevel({ radius: value })}
      />
      <PxRow
        label="bevel offset"
        value={bevelEmboss.offset}
        max={8}
        onChange={(value) => patchBevel({ offset: value })}
      />
      <OpacityRow
        label="top highlight"
        value={bevelEmboss.topOpacity}
        onChange={(value) => patchBevel({ topOpacity: value })}
      />
      <OpacityRow
        label="bottom shadow"
        value={bevelEmboss.bottomOpacity}
        onChange={(value) => patchBevel({ bottomOpacity: value })}
      />
      <OpacityRow
        label="left highlight"
        value={bevelEmboss.leftOpacity}
        onChange={(value) => patchBevel({ leftOpacity: value })}
      />
      <OpacityRow
        label="right shadow"
        value={bevelEmboss.rightOpacity}
        onChange={(value) => patchBevel({ rightOpacity: value })}
      />
      <ColorRow
        label="glow color"
        value={bevelEmboss.glowColor}
        fallback={DEFAULT_BEVEL_EMBOSS.glowColor}
        onChange={(value) => patchBevel({ glowColor: value })}
      />
      <OpacityRow
        label="glow opacity"
        value={bevelEmboss.glowOpacity}
        onChange={(value) => patchBevel({ glowOpacity: value })}
      />
      <PxRow
        label="glow radius"
        value={bevelEmboss.glowRadius}
        max={80}
        onChange={(value) => patchBevel({ glowRadius: value })}
      />

      <button className="dev-mode__copy" type="button" onClick={() => void handleCopy()}>
        {copied ? 'Copied' : 'Copy palette'}
      </button>
    </aside>
  )
}
