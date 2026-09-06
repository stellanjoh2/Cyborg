import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
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
  bleedX: number
  bleedY: number
}

function measureLayout(): ScaleLayout {
  const scale = Math.min(
    1,
    window.innerWidth / DESIGN_WIDTH,
    window.innerHeight / DESIGN_HEIGHT,
  )
  const stageTop = (window.innerHeight - DESIGN_HEIGHT * scale) / 2
  // Design-space padding so plates can paint into letterbox gutters.
  const bleedX = Math.max(0, (window.innerWidth / scale - DESIGN_WIDTH) / 2)
  const bleedY = Math.max(0, (window.innerHeight / scale - DESIGN_HEIGHT) / 2)
  return { scale, stageTop, bleedX, bleedY }
}

export function ScaleViewport({ children }: ScaleViewportProps) {
  const [layout, setLayout] = useState<ScaleLayout>(measureLayout)

  useLayoutEffect(() => {
    const updateScale = () => setLayout(measureLayout())

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const { scale, stageTop, bleedX, bleedY } = layout

  return (
    <div
      className="scale-viewport"
      style={
        {
          '--stage-scale': scale,
          '--stage-bleed-x': `${bleedX}px`,
          '--stage-bleed-y': `${bleedY}px`,
        } as CSSProperties
      }
    >
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
      <div className="scale-viewport__dirt" aria-hidden>
        <canvas />
      </div>
    </div>
  )
}
