import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { playUiSound } from '../ui/sounds'

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
  /** Tick hover cue on each word start while typing forward (Mozayk). */
  playTypeSound?: boolean
  hold?: boolean
  className?: string
  links?: TypewriterLink[]
  onComplete?: () => void
} & Omit<React.HTMLAttributes<HTMLElement>, 'children'>

const DEFAULT_SPEED_MS = 10
const DEFAULT_PAUSE_MS = 900

function isWordStart(text: string, index: number) {
  const ch = text[index]
  if (!ch || /\s/.test(ch)) return false
  return index === 0 || /\s/.test(text[index - 1])
}

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
  // Prefer longer matches when they share a start (e.g. full name vs short).
  hits.sort((a, b) => a.start - b.start || b.end - a.end)

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

type ReserveSize = { width: number; height: number }

function measureTextReserve(
  root: HTMLElement,
  text: string,
  withCaret: boolean,
): ReserveSize {
  const cs = getComputedStyle(root)
  const wrap = document.createElement('span')
  wrap.setAttribute('aria-hidden', 'true')
  // Zero-height paint containment: probe never composites (Brave/Blink scale crumbs).
  wrap.style.cssText =
    'position:absolute;left:0;top:0;width:max-content;height:0;overflow:hidden;contain:paint;opacity:0;pointer-events:none;'

  const probe = document.createElement('span')
  probe.style.display = 'block'
  probe.style.whiteSpace = cs.whiteSpace
  probe.style.font = cs.font
  probe.style.letterSpacing = cs.letterSpacing
  probe.style.wordSpacing = cs.wordSpacing
  probe.style.textTransform = cs.textTransform
  probe.style.lineHeight = cs.lineHeight
  probe.textContent = text

  const nowrap = cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre'
  if (nowrap) {
    probe.style.width = 'max-content'
  } else {
    const basis = root.clientWidth || root.parentElement?.clientWidth || 0
    probe.style.width = basis > 0 ? `${basis}px` : 'max-content'
  }

  if (withCaret) {
    const caret = document.createElement('span')
    caret.className = 'typewriter-reveal__caret'
    probe.appendChild(caret)
  }

  wrap.appendChild(probe)
  root.appendChild(wrap)
  const width = Math.ceil(probe.offsetWidth)
  const height = Math.ceil(probe.offsetHeight)
  root.removeChild(wrap)
  return { width, height }
}

export function TypewriterReveal({
  as = 'span',
  text,
  active = true,
  speedMs = DEFAULT_SPEED_MS,
  pauseMs = DEFAULT_PAUSE_MS,
  loop = false,
  caret = true,
  playTypeSound = false,
  hold = false,
  className,
  links,
  onComplete,
  style,
  ...restProps
}: TypewriterRevealProps) {
  const Tag = as as React.ElementType
  const idleText = hold ? '' : text
  const [typed, setTyped] = useState(active ? '' : idleText)
  const [isComplete, setIsComplete] = useState(!active && !hold)
  const [isRewinding, setIsRewinding] = useState(false)
  const [reserve, setReserve] = useState<ReserveSize | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)
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

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const update = () => {
      const next = measureTextReserve(root, text, caret && !reduceMotion)
      setReserve((prev) =>
        prev && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      )
    }

    update()
    // Fallback metrics often under-measure pixel fonts before they load.
    void document.fonts?.ready?.then(update)
    const ro = new ResizeObserver(update)
    ro.observe(root)
    if (root.parentElement) ro.observe(root.parentElement)
    return () => ro.disconnect()
  }, [caret, reduceMotion, text])

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
          const next = direction === 1 ? i : i - 1
          i += direction
          setTyped(text.slice(0, Math.max(0, i)))
          if (
            playTypeSound &&
            direction === 1 &&
            isWordStart(text, next)
          ) {
            playUiSound('hover', true)
          }
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
      const next = i
      i += 1
      setTyped(text.slice(0, i))
      if (playTypeSound && isWordStart(text, next)) playUiSound('hover', true)
      if (i >= text.length) {
        window.clearInterval(timer)
        setIsComplete(true)
        onCompleteRef.current?.()
      }
    }, speedMs)

    return () => window.clearInterval(timer)
  }, [active, hold, loop, pauseMs, playTypeSound, reduceMotion, speedMs, text])

  const showCaret =
    caret && active && !reduceMotion && (loop || !isComplete || isRewinding)

  return (
    <Tag
      ref={rootRef}
      className={combinedClassName}
      style={{
        ...style,
        ...(reserve
          ? { minWidth: reserve.width, minHeight: reserve.height }
          : null),
      }}
      {...restProps}
    >
      <span className="typewriter-reveal__live">
        {renderWithLinks(typed, links)}
        {showCaret ? (
          <span className="typewriter-reveal__caret" aria-hidden />
        ) : null}
      </span>
    </Tag>
  )
}
