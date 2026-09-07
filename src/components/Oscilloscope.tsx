import { useEffect, useRef } from 'react'
import { getMasterAnalyser, readMasterPeak } from '../speechSynthEngine'
import './Oscilloscope.css'

/** Match MasterStrip VU scale (DJM-A9-style). */
const REFERENCE_DBFS = -21
const MIN_METER_DB = -26
const YELLOW_METER_DB = 0
const RED_METER_DB = 12
const YELLOW_HEX = '#ffd400'

function linearToMeterDb(linear: number): number {
  if (linear <= 0.0001) {
    return MIN_METER_DB
  }
  return Math.max(MIN_METER_DB, 20 * Math.log10(linear) - REFERENCE_DBFS)
}

/**
 * CRT-style time-domain scope driven by the master synth analyser.
 * Adapted from classic Web Audio canvas scopes (e.g. Sound Lab style pens).
 */
export function Oscilloscope() {
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
        return YELLOW_HEX
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

    const drawGrid = (w: number, h: number, color: string) => {
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.14
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

    const tick = () => {
      resize()
      const w = cssW
      const h = cssH
      const peak = readMasterPeak()
      const phosphor = beamColor(peak)

      // Phosphor persistence fade
      ctx.fillStyle = '#0a0a0a'
      ctx.globalAlpha = 0.35
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
      drawGrid(w, h, phosphor)

      const analyser = getMasterAnalyser()
      if (analyser) {
        if (!data || data.length !== analyser.fftSize) {
          data = new Uint8Array(analyser.fftSize)
        }
        analyser.getByteTimeDomainData(data)

        ctx.lineWidth = 1.5
        ctx.strokeStyle = phosphor
        ctx.shadowColor = phosphor
        ctx.shadowBlur = 6
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
        ctx.globalAlpha = 0.45
        ctx.lineWidth = 1.25
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
  }, [])

  return (
    <div className="speech-scope" aria-hidden="true" title="Output scope">
      <canvas ref={canvasRef} className="speech-scope__canvas" />
    </div>
  )
}
