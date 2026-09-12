import { useEffect, useRef } from 'react'
import { introBoot } from '../introBoot'
import { getMasterAnalyser, readMasterPeak } from '../speechSynthEngine'
import './Oscilloscope.css'

/** Match MasterStrip VU scale (DJM-A9-style). */
const REFERENCE_DBFS = -21
const MIN_METER_DB = -26
const YELLOW_METER_DB = 0
const RED_METER_DB = 12
const SCOPE_BG_FALLBACK = '#0a0a0a'

function linearToMeterDb(linear: number): number {
  if (linear <= 0.0001) {
    return MIN_METER_DB
  }
  return Math.max(MIN_METER_DB, 20 * Math.log10(linear) - REFERENCE_DBFS)
}

/** Relative luminance 0–1 for #rgb / #rrggbb (enough for theme hex palettes). */
function hexLuma(color: string): number {
  const raw = color.trim()
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  let r = 0
  let g = 0
  let b = 0
  if (hex.length === 3) {
    r = Number.parseInt(hex[0]! + hex[0]!, 16)
    g = Number.parseInt(hex[1]! + hex[1]!, 16)
    b = Number.parseInt(hex[2]! + hex[2]!, 16)
  } else if (hex.length >= 6) {
    r = Number.parseInt(hex.slice(0, 2), 16)
    g = Number.parseInt(hex.slice(2, 4), 16)
    b = Number.parseInt(hex.slice(4, 6), 16)
  } else {
    return 0
  }
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return 0
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * CRT-style time-domain scope driven by the master synth analyser.
 * Adapted from classic Web Audio canvas scopes (e.g. Sound Lab style pens).
 */
export function Oscilloscope({ isPlaying }: { isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) {
      return
    }

    let frame = 0
    let data: Uint8Array<ArrayBuffer> | null = null
    let cssW = 0
    let cssH = 0

    const cssVar = (name: string, fallback: string) =>
      getComputedStyle(canvas).getPropertyValue(name).trim() || fallback

    const beamColor = (peak: number) => {
      const db = linearToMeterDb(peak)
      if (peak >= 0.99 || db >= RED_METER_DB) {
        return cssVar('--error', '#ff2a00')
      }
      if (db >= YELLOW_METER_DB) {
        return cssVar('--vu-yellow', '#ffd400')
      }
      return cssVar('--vu', '#00ffee')
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const nextW = Math.max(1, Math.round(canvas.clientWidth))
      const nextH = Math.max(1, Math.round(canvas.clientHeight))
      if (nextW === cssW && nextH === cssH && canvas.width === Math.round(nextW * dpr)) {
        return
      }
      cssW = nextW
      cssH = nextH
      canvas.width = Math.round(nextW * dpr)
      canvas.height = Math.round(nextH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawGrid = (
      w: number,
      h: number,
      color: string,
      alpha: number,
    ) => {
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = 1
      ctx.beginPath()
      const midY = h * 0.5
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      for (let i = 1; i < 4; i += 1) {
        const x = (w * i) / 4
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const scopeBg = () =>
      cssVar('--scope-bg', '') ||
      cssVar('--black', SCOPE_BG_FALLBACK) ||
      SCOPE_BG_FALLBACK

    const tick = () => {
      resize()
      const w = cssW
      const h = cssH
      const bg = scopeBg()

      // Intro is paint-heavy; hold a themed plate until VU crest opens the curtain.
      if (!introBoot.scopeLive) {
        ctx.globalAlpha = 1
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)
        frame = requestAnimationFrame(tick)
        return
      }

      const peak = isPlaying ? readMasterPeak() : 0
      const phosphor = beamColor(peak)
      const lightPlate = hexLuma(bg) > 0.42
      const gridAlpha = lightPlate ? 0.28 : 0.14
      const beamWidth = lightPlate ? 2 : 1.5
      const idleAlpha = lightPlate ? 0.8 : 0.45
      const glow = lightPlate ? 3 : 6

      // Phosphor persistence fade toward the themed plate (not hardcoded CRT black).
      ctx.fillStyle = bg
      ctx.globalAlpha = 0.35
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
      drawGrid(w, h, phosphor, gridAlpha)

      const analyser = isPlaying ? getMasterAnalyser() : null
      if (analyser) {
        if (!data || data.length !== analyser.fftSize) {
          data = new Uint8Array(analyser.fftSize)
        }
        analyser.getByteTimeDomainData(data)

        ctx.lineWidth = beamWidth
        ctx.strokeStyle = phosphor
        ctx.shadowColor = phosphor
        ctx.shadowBlur = glow
        ctx.beginPath()

        // Extra hot beam: 8× mid-rail excursion (clamped to CRT).
        const gain = 8
        const mid = h * 0.5
        const slice = w / data.length
        let x = 0
        for (let i = 0; i < data.length; i += 1) {
          const centered = ((data[i] ?? 128) / 128 - 1) * gain
          const y = Math.max(0, Math.min(h, mid + centered * mid))
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
          x += slice
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      } else {
        // Idle beam
        ctx.strokeStyle = phosphor
        ctx.globalAlpha = idleAlpha
        ctx.lineWidth = lightPlate ? 1.75 : 1.25
        ctx.beginPath()
        ctx.moveTo(0, h * 0.5)
        ctx.lineTo(w, h * 0.5)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])

  return (
    <div className="speech-scope" aria-hidden="true" title="Output scope">
      <canvas ref={canvasRef} className="speech-scope__canvas" />
    </div>
  )
}
