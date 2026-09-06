import { useLayoutEffect, useState, type ReactNode } from 'react'
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  NAV_HEIGHT,
} from '../layoutConstants'
import './ScaleViewport.css'

interface ScaleViewportProps {
  children: ReactNode
}

interface ScaleLayout {
  scale: number
  stageTop: number
}

export function ScaleViewport({ children }: ScaleViewportProps) {
  const [layout, setLayout] = useState<ScaleLayout>({ scale: 1, stageTop: 0 })

  useLayoutEffect(() => {
    const updateScale = () => {
      const scale = Math.min(
        1,
        window.innerWidth / DESIGN_WIDTH,
        window.innerHeight / DESIGN_HEIGHT,
      )
      const stageTop = (window.innerHeight - DESIGN_HEIGHT * scale) / 2
      setLayout({ scale, stageTop })
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const { scale, stageTop } = layout

  return (
    <div className="scale-viewport">
      <div
        className="scale-nav-bleed"
        style={{
          top: stageTop,
          height: NAV_HEIGHT * scale,
        }}
        aria-hidden
      />
      <div
        className="scale-stage"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
      {/* Screenspace dirt above the stage; clipped to the splash plate during intro. */}
      <div className="scale-viewport__dirt" aria-hidden />
    </div>
  )
}
