import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type PointerEventHandler,
} from 'react'
import gsap from 'gsap'

const LINE_IN = 0.34
const LINE_GAP = 0.08
const CHAR_IN = 0.32
const CHAR_STAGGER = 0.1
const CHAR_GAP = 0.1
const HOLD = 0.18
const OUT = 0.28
const OUT_STAGGER = 0.08

export type LogotypeHandle = {
  /** LARYNX → INDUSTRIES → LX01 construct timeline. */
  revealTimeline: () => gsap.core.Timeline
  /** LX01 letters → INDUSTRIES → LARYNX fall-out (reveal reverse). */
  exitTimeline: () => gsap.core.Timeline
  /** Instant full visibility. */
  show: () => void
  /** Instant hide parts (keeps svg box). */
  hideParts: () => void
}

type LogotypeProps = {
  className?: string
  /** Mozayk-style LX01 loop while hovered (wordmark stays). */
  loopOnHover?: boolean
}

type LogoParts = {
  larynx: SVGGElement | null
  industries: SVGGElement | null
  chars: SVGElement[]
}

function partsOf(root: SVGSVGElement | null): LogoParts {
  if (!root) {
    return { larynx: null, industries: null, chars: [] }
  }
  return {
    larynx: root.querySelector<SVGGElement>('.logotype__larynx'),
    industries: root.querySelector<SVGGElement>('.logotype__industries'),
    chars: gsap.utils.toArray<SVGElement>(
      root.querySelectorAll('.logotype__char'),
    ),
  }
}

function allParts(root: SVGSVGElement | null) {
  const { larynx, industries, chars } = partsOf(root)
  return [larynx, industries, ...chars].filter(Boolean) as SVGElement[]
}

function wordmarkParts(root: SVGSVGElement | null) {
  const { larynx, industries } = partsOf(root)
  return [larynx, industries].filter(Boolean) as SVGElement[]
}

function revealLine(
  tl: gsap.core.Timeline,
  el: Element | null,
  at: number,
  yFrom = 10,
) {
  if (!el) return
  tl.fromTo(
    el,
    { autoAlpha: 0, y: yFrom },
    {
      autoAlpha: 1,
      y: 0,
      duration: LINE_IN,
      ease: 'power2.out',
      immediateRender: true,
    },
    at,
  )
}

/** 1 LARYNX → 2 INDUSTRIES → 3 LX01 L→R. */
export function buildLogotypeReveal(root: SVGSVGElement): gsap.core.Timeline {
  const { larynx, industries, chars } = partsOf(root)
  const tl = gsap.timeline()
  revealLine(tl, larynx, 0)
  const industriesAt = LINE_IN + LINE_GAP
  revealLine(tl, industries, industriesAt)
  const charsAt = industriesAt + LINE_IN + CHAR_GAP
  if (chars.length) {
    tl.fromTo(
      chars,
      { autoAlpha: 0, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: CHAR_IN,
        stagger: CHAR_STAGGER,
        ease: 'power2.out',
        immediateRender: true,
      },
      charsAt,
    )
  }
  return tl
}

/** Reveal reverse: LX01 letters → INDUSTRIES → LARYNX, falling down. */
export function buildLogotypeExit(root: SVGSVGElement): gsap.core.Timeline {
  const { larynx, industries, chars } = partsOf(root)
  const tl = gsap.timeline()
  const fallY = 28
  const dur = 0.55
  let at = 0
  if (chars.length) {
    tl.to(
      chars,
      {
        autoAlpha: 0,
        y: fallY,
        duration: dur,
        stagger: OUT_STAGGER,
        ease: 'power2.in',
      },
      at,
    )
    at += (chars.length - 1) * OUT_STAGGER + LINE_GAP
  }
  if (industries) {
    tl.to(
      industries,
      {
        autoAlpha: 0,
        y: fallY,
        duration: dur,
        ease: 'power2.in',
      },
      at,
    )
    at += LINE_GAP
  }
  if (larynx) {
    tl.to(
      larynx,
      {
        autoAlpha: 0,
        y: fallY,
        duration: dur,
        ease: 'power2.in',
      },
      at,
    )
  }
  return tl
}

/** LX01 only — L→R construct (wordmark stays put). */
function buildCharsReveal(root: SVGSVGElement): gsap.core.Timeline {
  const { chars } = partsOf(root)
  const tl = gsap.timeline()
  if (chars.length) {
    tl.fromTo(
      chars,
      { autoAlpha: 0, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: CHAR_IN,
        stagger: CHAR_STAGGER,
        ease: 'power2.out',
        immediateRender: false,
      },
    )
  }
  return tl
}

/** LX01 only — L→R deconstruct (wordmark stays put). */
function buildCharsHide(root: SVGSVGElement): gsap.core.Timeline {
  const { chars } = partsOf(root)
  const tl = gsap.timeline()
  if (chars.length) {
    tl.to(chars, {
      autoAlpha: 0,
      y: -8,
      duration: OUT,
      stagger: OUT_STAGGER,
      ease: 'power2.in',
    })
  }
  return tl
}

export function logotypeRevealDuration(): number {
  return (
    LINE_IN +
    LINE_GAP +
    LINE_IN +
    CHAR_GAP +
    3 * CHAR_STAGGER +
    CHAR_IN
  )
}

export const Logotype = forwardRef<LogotypeHandle, LogotypeProps>(
  function Logotype({ className, loopOnHover = false }, ref) {
    const svgRef = useRef<SVGSVGElement>(null)
    const loopRef = useRef<gsap.core.Timeline | null>(null)

    useImperativeHandle(ref, () => ({
      revealTimeline: () => {
        const svg = svgRef.current
        if (!svg) return gsap.timeline()
        return buildLogotypeReveal(svg)
      },
      exitTimeline: () => {
        const svg = svgRef.current
        if (!svg) return gsap.timeline()
        return buildLogotypeExit(svg)
      },
      show: () => {
        gsap.set(allParts(svgRef.current), { autoAlpha: 1, y: 0 })
      },
      hideParts: () => {
        gsap.set(allParts(svgRef.current), { autoAlpha: 0, y: 0 })
      },
    }))

    const prefersReducedMotion = () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const stopLoop = () => {
      loopRef.current?.kill()
      loopRef.current = null
      // Keep inline visibility — clearing it would fall back to CSS
      // `visibility: hidden` and blank the mark.
      gsap.set(allParts(svgRef.current), { autoAlpha: 1, y: 0 })
    }

    const startLoop: PointerEventHandler<SVGSVGElement> = () => {
      if (!loopOnHover || prefersReducedMotion()) return
      const svg = svgRef.current
      if (!svg || loopRef.current) return
      if (svg.closest('.is-introducing')) return

      // Keep LARYNX + INDUSTRIES on; only LX01 cycles.
      gsap.set(wordmarkParts(svg), { autoAlpha: 1, y: 0 })

      const cycle = gsap.timeline({ repeat: -1 })
      cycle.add(buildCharsHide(svg), 0)
      cycle.add(buildCharsReveal(svg), OUT)
      cycle.to({}, { duration: HOLD })
      loopRef.current = cycle
    }

    const endLoop: PointerEventHandler<SVGSVGElement> = () => {
      if (!loopOnHover) return
      stopLoop()
    }

    const classes = ['logotype', className].filter(Boolean).join(' ')

    return (
      <svg
        ref={svgRef}
        className={classes}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 474.91 99.91"
        aria-hidden="true"
        onPointerEnter={loopOnHover ? startLoop : undefined}
        onPointerLeave={loopOnHover ? endLoop : undefined}
        onPointerCancel={loopOnHover ? endLoop : undefined}
      >
        <g className="logotype__larynx" fill="currentColor">
          <polygon points="18.34 10.75 4.33 10.75 4.33 .36 .22 .36 .22 14.13 18.34 14.13 18.34 10.75" />
          <path d="M25.6,11.56h12.92l1.79,2.57h5.09L35.25.36h-6.15l-10.17,13.77h4.86l1.81-2.57ZM31.21,3.63h1.74l3.4,4.84h-8.56l3.43-4.84Z" />
          <path d="M50.61,9.42h6.31l6.54,4.71h5.71l-6.66-4.71c1.08-.05,2.01-.28,2.79-.69.78-.41,1.38-.95,1.79-1.62.42-.67.63-1.41.63-2.22s-.23-1.61-.68-2.3-1.09-1.23-1.93-1.63c-.84-.41-1.83-.61-2.99-.61h-15.63v13.77h4.11v-4.71ZM50.61,3.44h10.94c.59,0,1.04.13,1.35.4s.46.61.46,1.05-.15.79-.46,1.05c-.31.26-.76.4-1.35.4h-10.94v-2.89Z" />
          <polygon points="77.84 8.98 77.84 14.13 81.95 14.13 81.95 8.98 82.84 8.98 92.58 .36 87.18 .36 81.05 5.8 78.91 5.8 72.77 .36 67.2 .36 77.02 8.98 77.84 8.98" />
          <polygon points="97.44 3.63 99.18 3.63 108.07 14.13 115.92 14.13 115.92 .36 111.82 .36 111.82 10.85 110.08 10.85 101.19 .36 93.33 .36 93.33 14.13 97.44 14.13 97.44 3.63" />
          <polygon points="122.43 14.13 128.76 8.65 130.92 8.65 137.11 14.13 142.84 14.13 134.41 6.86 142.4 .36 136.99 .36 131.13 5.18 128.97 5.18 123.22 .36 117.49 .36 125.44 6.95 117.05 14.13 122.43 14.13" />
          <polygon points="146.56 4.5 148.22 4.5 148.22 1.28 149.91 1.28 149.91 0 144.89 0 144.89 1.28 146.56 1.28 146.56 4.5" />
          <polygon points="152.03 2.02 153.64 4.5 154.37 4.5 155.97 2.04 155.97 4.5 157.44 4.5 157.44 0 155.9 0 154.03 2.71 152.15 0 150.6 0 150.6 4.5 152.03 4.5 152.03 2.02" />
        </g>
        <g className="logotype__industries" fill="currentColor">
          <rect x=".22" y="17.28" width="4.11" height="13.77" />
          <polygon points="25.32 27.78 23.59 27.78 14.69 17.28 6.84 17.28 6.84 31.06 10.95 31.06 10.95 20.56 12.69 20.56 21.58 31.06 29.43 31.06 29.43 17.28 25.32 17.28 25.32 27.78" />
          <path d="M54.72,19.29c-.74-.63-1.63-1.12-2.67-1.48-1.04-.35-2.22-.53-3.53-.53h-16.57v13.77h16.57c1.31,0,2.49-.18,3.53-.53,1.04-.35,1.93-.85,2.67-1.48.74-.63,1.31-1.36,1.7-2.19s.59-1.73.59-2.69-.2-1.86-.59-2.69c-.39-.83-.96-1.56-1.7-2.19ZM51.66,26.64c-.75.63-1.83.95-3.24.95h-12.37v-6.83h12.37c1.41,0,2.5.31,3.24.94.75.62,1.12,1.45,1.12,2.48s-.37,1.84-1.12,2.47Z" />
          <path d="M58.56,17.28v7.5c0,1.49.27,2.71.81,3.65.54.94,1.29,1.63,2.25,2.07s2.07.67,3.35.67h10.22c1.27,0,2.39-.22,3.34-.67.95-.44,1.69-1.13,2.23-2.07.53-.94.8-2.15.8-3.65v-7.5h-4.03v7.52c0,.75-.11,1.33-.34,1.76-.23.42-.51.72-.86.89-.35.17-.71.25-1.1.25h-10.26c-.41,0-.79-.08-1.14-.25-.35-.17-.63-.46-.84-.89-.21-.42-.32-1.01-.32-1.76v-7.52h-4.11Z" />
          <path d="M101.16,27.76h-12.65c-1.4,0-2.39-.49-2.97-1.49l-2.84,2.66c.72.78,1.54,1.35,2.46,1.71.92.35,2.04.53,3.37.53h12.56c1.22,0,2.24-.19,3.07-.58.82-.39,1.45-.91,1.87-1.58.42-.67.64-1.42.64-2.26,0-.89-.21-1.66-.63-2.32-.42-.66-1-1.17-1.75-1.53-.75-.36-1.63-.54-2.64-.54h-12.83c-.95,0-1.43-.32-1.43-.96,0-.28.11-.51.32-.69.21-.18.55-.27,1.01-.27h12.11c.84,0,1.48.1,1.93.31.45.21.78.51,1,.93l2.62-2.47c-.68-.72-1.43-1.24-2.24-1.55-.81-.32-1.77-.47-2.87-.47h-12.5c-1.17,0-2.16.18-2.96.55-.8.37-1.41.87-1.81,1.5-.4.64-.61,1.36-.61,2.17s.21,1.59.62,2.22c.41.63.99,1.12,1.75,1.47.75.35,1.63.52,2.63.52h12.79c.95,0,1.43.36,1.43,1.08,0,.31-.12.57-.36.77-.24.21-.6.31-1.09.31Z" />
          <polygon points="121.57 31.06 121.57 20.66 131.64 20.66 131.64 17.28 107.37 17.28 107.37 20.66 117.46 20.66 117.46 31.06 121.57 31.06" />
          <path d="M153.36,24.03c.42-.67.63-1.41.63-2.22s-.23-1.61-.68-2.3-1.09-1.23-1.93-1.63c-.84-.41-1.83-.61-2.99-.61h-15.63v13.77h4.11v-4.71h6.31l6.54,4.71h5.71l-6.66-4.71c1.08-.05,2.01-.28,2.79-.69.78-.41,1.38-.95,1.79-1.62ZM149.17,22.87c-.31.26-.76.4-1.35.4h-10.94v-2.89h10.94c.59,0,1.04.13,1.35.4s.46.61.46,1.05-.15.79-.46,1.05Z" />
          <rect x="156.61" y="17.28" width="4.11" height="13.77" />
          <polygon points="183.31 27.97 167.33 27.97 167.33 25.48 182.96 25.48 182.96 22.39 167.33 22.39 167.33 20.37 183.31 20.37 183.31 17.28 163.22 17.28 163.22 31.06 183.31 31.06 183.31 27.97" />
          <path d="M202.9,27.76h-12.65c-1.4,0-2.39-.49-2.97-1.49l-2.84,2.66c.72.78,1.54,1.35,2.46,1.71.92.35,2.04.53,3.37.53h12.56c1.22,0,2.24-.19,3.07-.58.82-.39,1.45-.91,1.87-1.58.42-.67.64-1.42.64-2.26,0-.89-.21-1.66-.63-2.32-.42-.66-1-1.17-1.75-1.53-.75-.36-1.63-.54-2.64-.54h-12.83c-.95,0-1.43-.32-1.43-.96,0-.28.11-.51.32-.69.21-.18.55-.27,1.01-.27h12.11c.84,0,1.48.1,1.93.31.45.21.78.51,1,.93l2.62-2.47c-.68-.72-1.43-1.24-2.24-1.55-.81-.32-1.77-.47-2.87-.47h-12.5c-1.17,0-2.16.18-2.96.55-.8.37-1.41.87-1.81,1.5-.4.64-.61,1.36-.61,2.17s.21,1.59.62,2.22c.41.63.99,1.12,1.75,1.47.75.35,1.63.52,2.63.52h12.79c.95,0,1.43.36,1.43,1.08,0,.31-.12.57-.36.77-.24.21-.6.31-1.09.31Z" />
        </g>
        <g className="logotype__chars" fill="currentColor">
          <path
            className="logotype__char"
            d="M114.27,80.47h-61.49c-.19,0-.37.05-.53.14l-28.01,16.17c-2.13,1.23-4.79-.31-4.79-2.77v-50.83c0-.59-.48-1.07-1.07-1.07H1.07c-.59,0-1.07.48-1.07,1.07v55.67c0,.59.48,1.07,1.07,1.07h113.2c.59,0,1.07-.48,1.07-1.07v-17.31c0-.59-.48-1.07-1.07-1.07Z"
          />
          <path
            className="logotype__char"
            d="M234.13,42.11h-25.48c-.19,0-.37.05-.53.14l-10.89,6.26c-.33.19-.53.54-.53.92v19.51c0,.82-.89,1.33-1.6.92l-48.27-27.73-.03-.02h-25.87c-.59,0-1.07.48-1.07,1.07v17.31c0,.59.48,1.07,1.07,1.07h20.4c.19,0,.37.05.53.14l11.39,6.54c2.14,1.23,2.14,4.31,0,5.54l-11.39,6.54c-.16.09-.34.14-.53.14h-20.4c-.59,0-1.07.48-1.07,1.07v17.31c0,.59.48,1.07,1.07,1.07h25.58c.19,0,.37-.05.53-.14l10.89-6.26c.33-.19.53-.54.53-.92v-19.51c0-.82.89-1.33,1.6-.92l48.27,27.73.03.02h25.77c.59,0,1.07-.48,1.07-1.07v-17.31c0-.59-.48-1.07-1.07-1.07h-20.29c-.19,0-.37-.05-.53-.14l-11.39-6.54c-2.14-1.23-2.14-4.31,0-5.54l11.39-6.54c.16-.09.34-.14.53-.14h20.29c.59,0,1.07-.48,1.07-1.07v-17.31c0-.59-.48-1.07-1.07-1.07Z"
          />
          <path
            className="logotype__char"
            d="M354.52,60.94l-32.58-18.81-.03-.02h-81.12c-.59,0-1.07.48-1.07,1.07v37.02c0,.38.2.73.53.92l32.51,18.77.03.02h81.19c.59,0,1.07-.48,1.07-1.07v-36.98c0-.38-.2-.73-.53-.92ZM335.61,79.4c0,.59-.48,1.07-1.07,1.07h-74.31c-.59,0-1.07-.48-1.07-1.07v-16.78c0-.59.48-1.07,1.07-1.07h74.31c.59,0,1.07.48,1.07,1.07v16.78Z"
          />
          <path
            className="logotype__char"
            d="M473.85,80.47h-45.81c-.59,0-1.07-.48-1.07-1.07v-17.43c0-.38-.2-.73-.53-.92l-32.77-18.92-.03-.02h-32.99c-.59,0-1.07.48-1.07,1.07v17.31c0,.59.48,1.07,1.07,1.07h45.81c.59,0,1.07.48,1.07,1.07v16.78c0,.59-.48,1.07-1.07,1.07h-45.81c-.59,0-1.07.48-1.07,1.07v17.31c0,.59.48,1.07,1.07,1.07h113.2c.59,0,1.07-.48,1.07-1.07v-17.31c0-.59-.48-1.07-1.07-1.07Z"
          />
        </g>
      </svg>
    )
  },
)
