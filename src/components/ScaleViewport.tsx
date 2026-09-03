import { useLayoutEffect, useState, type ReactNode } from 'react'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../layoutConstants'
import './ScaleViewport.css'

interface ScaleViewportProps {
  children: ReactNode
}

export function ScaleViewport({ children }: ScaleViewportProps) {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const updateScale = () => {
      const next = Math.min(
        window.innerWidth / DESIGN_WIDTH,
        window.innerHeight / DESIGN_HEIGHT,
      )
      setScale(next)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return (
    <div className="scale-viewport">
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
    </div>
  )
}
