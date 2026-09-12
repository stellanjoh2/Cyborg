import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  applyColorTheme,
  COLOR_THEMES,
  getThemeById,
  readStoredThemeId,
  type ColorTheme,
} from '../colorThemes'
import { playUiSound } from '../ui/sounds'
import './ThemePicker.css'

gsap.registerPlugin(useGSAP)

function ThemeBall({
  primary,
  secondary,
  className,
  live = false,
}: {
  primary: string
  secondary: string
  className?: string
  /** Follows --theme-primary / --theme-secondary (accent | section fill). */
  live?: boolean
}) {
  return (
    <span
      className={['theme-ball', className].filter(Boolean).join(' ')}
      style={
        live
          ? undefined
          : ({
              '--theme-ball-a': primary,
              '--theme-ball-b': secondary,
            } as CSSProperties)
      }
      aria-hidden="true"
    />
  )
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function stageScale() {
  const viewport = document.querySelector('.scale-viewport')
  if (!viewport) return 1
  return (
    Number.parseFloat(
      getComputedStyle(viewport).getPropertyValue('--stage-scale'),
    ) || 1
  )
}

/** Anchor modal under the trigger in .speech-app design space (pre-scale). */
function placeModal(trigger: HTMLElement, modal: HTMLElement, app: HTMLElement) {
  const scale = Math.max(0.001, stageScale())
  const appRect = app.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  modal.style.top = `${(triggerRect.bottom - appRect.top) / scale + 12}px`
  modal.style.right = `${(appRect.right - triggerRect.right) / scale}px`
}

export function ThemePicker() {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<gsap.core.Timeline | null>(null)
  /** True until the first open tween of a mount; skips hide-set on mid-close re-open. */
  const introRef = useRef(true)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [themeId, setThemeId] = useState(readStoredThemeId)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const theme = getThemeById(themeId)

  useEffect(() => {
    applyColorTheme(getThemeById(themeId))
  }, [themeId])

  useLayoutEffect(() => {
    setPortalHost(document.querySelector('.speech-app'))
  }, [])

  // Portaled to .speech-app so it stacks above FX (GSAP transform layers) and
  // stays inside ScaleViewport's scale() — unlike a body portal.
  useLayoutEffect(() => {
    if (!mounted || !portalHost) return
    const trigger = triggerRef.current
    const modal = modalRef.current
    if (!trigger || !modal) return

    const sync = () => placeModal(trigger, modal, portalHost)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [mounted, open, portalHost])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      const root = rootRef.current
      const modal = modalRef.current
      if (root?.contains(event.target) || modal?.contains(event.target)) return
      playUiSound('close')
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        playUiSound('close')
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useGSAP(
    () => {
      if (!mounted) return
      const modal = modalRef.current
      if (!modal) return

      const head = modal.querySelector<HTMLElement>('.theme-picker__head')
      const options = gsap.utils.toArray<HTMLElement>(
        '.theme-picker__option',
        modal,
      )
      const parts = [modal, head, ...options].filter(Boolean)
      const unmount = () => {
        introRef.current = true
        setMounted(false)
      }

      animRef.current?.kill()
      animRef.current = null

      if (prefersReducedMotion()) {
        if (open) {
          introRef.current = false
          gsap.set(parts, { autoAlpha: 1, y: 0 })
        } else {
          gsap.set(parts, { autoAlpha: 0, y: 0 })
          queueMicrotask(unmount)
        }
        return
      }

      if (open) {
        // Fresh mount starts hidden; re-open mid-close continues from current.
        if (introRef.current) {
          introRef.current = false
          gsap.set(modal, { autoAlpha: 0, y: -8 })
          if (head) gsap.set(head, { autoAlpha: 0, y: -6 })
          gsap.set(options, { autoAlpha: 0, y: 12 })
        }

        const tl = gsap.timeline()
        animRef.current = tl
        tl.to(modal, {
          autoAlpha: 1,
          y: 0,
          duration: 0.2,
          ease: 'power2.out',
        })
        if (head) {
          tl.to(
            head,
            { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out' },
            '-=0.1',
          )
        }
        tl.to(
          options,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.26,
            stagger: 0.028,
            ease: 'power2.out',
          },
          '-=0.06',
        )
        return
      }

      // Close: reverse of open (options first, then head, then shell).
      const tl = gsap.timeline({ onComplete: unmount })
      animRef.current = tl
      tl.to(options, {
        autoAlpha: 0,
        y: 12,
        duration: 0.2,
        stagger: { each: 0.02, from: 'end' },
        ease: 'power2.in',
      })
      if (head) {
        tl.to(
          head,
          { autoAlpha: 0, y: -6, duration: 0.16, ease: 'power2.in' },
          '-=0.12',
        )
      }
      tl.to(
        modal,
        { autoAlpha: 0, y: -8, duration: 0.18, ease: 'power2.in' },
        '-=0.1',
      )
    },
    { dependencies: [open, mounted] },
  )

  const selectTheme = (next: ColorTheme) => {
    setThemeId(next.id)
    playUiSound('ok')
  }

  const modal =
    mounted && portalHost
      ? createPortal(
          <div
            className="theme-picker__modal"
            ref={modalRef}
            role="dialog"
            aria-label="Pick a theme"
          >
            <div className="theme-picker__head">
              <h2 className="theme-picker__title">Pick a theme</h2>
            </div>
            <div className="theme-picker__grid" role="list">
              {COLOR_THEMES.map((item) => {
                const selected = item.id === themeId
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={[
                      'theme-picker__option',
                      selected ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={selected}
                    aria-label={item.label}
                    onClick={() => selectTheme(item)}
                  >
                    <ThemeBall
                      primary={item.palette.lime}
                      secondary={item.palette.fill}
                      className="theme-picker__preview"
                    />
                    <span className="theme-picker__label">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>,
          portalHost,
        )
      : null

  return (
    <div
      className={['theme-picker', mounted ? 'is-open' : '']
        .filter(Boolean)
        .join(' ')}
      ref={rootRef}
    >
      <button
        className="theme-picker__trigger"
        ref={triggerRef}
        type="button"
        aria-label="Color themes"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tooltip="Color themes"
        onClick={() => {
          if (open) {
            playUiSound('close')
            setOpen(false)
          } else if (mounted) {
            playUiSound('drop')
            setOpen(true)
          } else {
            playUiSound('drop')
            setMounted(true)
            setOpen(true)
          }
        }}
      >
        <ThemeBall
          primary={theme.palette.lime}
          secondary={theme.palette.fill}
          live
          className="theme-picker__sphere"
        />
      </button>
      {modal}
    </div>
  )
}
