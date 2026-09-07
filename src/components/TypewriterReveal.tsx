import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'

type IntrinsicTag = keyof React.JSX.IntrinsicElements

export type TypewriterLink = {
  text: string
  href: string
}

type TypewriterRevealProps = {
  as?: IntrinsicTag
  text: string
  active?: boolean
  speedMs?: number
  /** Pause at full text and at empty between loop cycles. */
  pauseMs?: number
  /** Type in → pause → type out → pause, forever while active. */
  loop?: boolean
  caret?: boolean
  hold?: boolean
  className?: string
  links?: TypewriterLink[]
  onComplete?: () => void
} & Omit<React.HTMLAttributes<HTMLElement>, 'children'>

const DEFAULT_SPEED_MS = 10
const DEFAULT_PAUSE_MS = 900

function renderWithLinks(value: string, links: TypewriterLink[] | undefined) {
  if (!links?.length) return value

  const hits: { start: number; end: number; href: string }[] = []
  for (const link of links) {
    let from = 0
    while (from < value.length) {
      const index = value.indexOf(link.text, from)
      if (index === -1) break
      hits.push({ start: index, end: index + link.text.length, href: link.href })
      from = index + link.text.length
    }
  }
  hits.sort((a, b) => a.start - b.start)

  const nodes: React.ReactNode[] = []
  let cursor = 0
  hits.forEach((hit, key) => {
    if (hit.start < cursor) return
    if (hit.start > cursor) nodes.push(value.slice(cursor, hit.start))
    nodes.push(
      <a key={key} href={hit.href} target="_blank" rel="noopener noreferrer">
        {value.slice(hit.start, hit.end)}
      </a>,
    )
    cursor = hit.end
  })
  if (cursor < value.length) nodes.push(value.slice(cursor))
  return nodes
}

export function TypewriterReveal({
  as = 'span',
  text,
  active = true,
  speedMs = DEFAULT_SPEED_MS,
  pauseMs = DEFAULT_PAUSE_MS,
  loop = false,
  caret = true,
  hold = false,
  className,
  links,
  onComplete,
  ...restProps
}: TypewriterRevealProps) {
  const Tag = as as React.ElementType
  const idleText = hold ? '' : text
  const [typed, setTyped] = useState(active ? '' : idleText)
  const [isComplete, setIsComplete] = useState(!active && !hold)
  const [isRewinding, setIsRewinding] = useState(false)
  const typedRef = useRef(typed)
  typedRef.current = typed
  const combinedClassName = ['typewriter-reveal', className]
    .filter(Boolean)
    .join(' ')
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const reduceMotion = useMemo(() => {
    return (
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    )
  }, [])

  useEffect(() => {
    if (!active) {
      if (!hold) {
        setTyped(text)
        setIsComplete(true)
        setIsRewinding(false)
        return
      }

      if (reduceMotion) {
        setTyped('')
        setIsComplete(false)
        setIsRewinding(false)
        return
      }

      let i = typedRef.current.length
      if (i <= 0) {
        setTyped('')
        setIsComplete(false)
        setIsRewinding(false)
        return
      }

      setIsRewinding(true)
      setIsComplete(false)
      const timer = window.setInterval(() => {
        i -= 1
        setTyped(text.slice(0, Math.max(0, i)))
        if (i <= 0) {
          window.clearInterval(timer)
          setIsRewinding(false)
          setIsComplete(false)
        }
      }, speedMs)

      return () => {
        window.clearInterval(timer)
        setIsRewinding(false)
      }
    }

    if (reduceMotion) {
      setTyped(text)
      setIsComplete(true)
      setIsRewinding(false)
      onCompleteRef.current?.()
      return
    }

    if (loop) {
      let i = 0
      let direction: 1 | -1 = 1
      let intervalId = 0
      let timeoutId = 0
      setTyped('')
      setIsComplete(false)
      setIsRewinding(false)

      const clear = () => {
        window.clearInterval(intervalId)
        window.clearTimeout(timeoutId)
      }

      const tick = () => {
        intervalId = window.setInterval(() => {
          i += direction
          setTyped(text.slice(0, Math.max(0, i)))
          if (direction === 1 && i >= text.length) {
            window.clearInterval(intervalId)
            setIsComplete(true)
            setIsRewinding(false)
            timeoutId = window.setTimeout(() => {
              direction = -1
              setIsComplete(false)
              setIsRewinding(true)
              tick()
            }, pauseMs)
          } else if (direction === -1 && i <= 0) {
            window.clearInterval(intervalId)
            setIsRewinding(false)
            setIsComplete(false)
            timeoutId = window.setTimeout(() => {
              direction = 1
              tick()
            }, pauseMs)
          }
        }, speedMs)
      }

      tick()
      return clear
    }

    setTyped('')
    setIsComplete(false)
    setIsRewinding(false)

    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setTyped(text.slice(0, i))
      if (i >= text.length) {
        window.clearInterval(timer)
        setIsComplete(true)
        onCompleteRef.current?.()
      }
    }, speedMs)

    return () => window.clearInterval(timer)
  }, [active, hold, loop, pauseMs, reduceMotion, speedMs, text])

  const showCaret =
    caret && active && !reduceMotion && (loop || !isComplete || isRewinding)

  return (
    <Tag className={combinedClassName} {...restProps}>
      <span className="typewriter-reveal__ghost" aria-hidden>
        {renderWithLinks(text, links)}
      </span>
      <span className="typewriter-reveal__live">
        {renderWithLinks(typed, links)}
        {showCaret ? (
          <span className="typewriter-reveal__caret" aria-hidden />
        ) : null}
      </span>
    </Tag>
  )
}
