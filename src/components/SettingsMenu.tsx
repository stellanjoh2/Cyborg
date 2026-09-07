import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SettingsIcon } from './icons'
import {
  applyPerformanceMode,
  readPerformanceMode,
  type PerformanceMode,
} from '../ui/performance'
import {
  getUiSoundsEnabled,
  playUiSound,
  setUiSoundsEnabled,
} from '../ui/sounds'
import './SettingsMenu.css'

gsap.registerPlugin(useGSAP)

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

function SegmentedOption<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="settings-menu__row">
      <span className="settings-menu__label">{label}</span>
      <div className="settings-menu__segment" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              className={[
                'settings-menu__choice',
                selected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={selected}
              onClick={() => {
                if (selected) return
                onChange(option.value)
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SettingsMenu() {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<gsap.core.Timeline | null>(null)
  const introRef = useRef(true)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [performance, setPerformance] = useState(readPerformanceMode)
  const [uiSounds, setUiSounds] = useState(getUiSoundsEnabled)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    setPortalHost(document.querySelector('.speech-app'))
  }, [])

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

      const head = modal.querySelector<HTMLElement>('.settings-menu__head')
      const rows = gsap.utils.toArray<HTMLElement>(
        '.settings-menu__row',
        modal,
      )
      const parts = [modal, head, ...rows].filter(Boolean)
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
        if (introRef.current) {
          introRef.current = false
          gsap.set(modal, { autoAlpha: 0, y: -8 })
          if (head) gsap.set(head, { autoAlpha: 0, y: -6 })
          gsap.set(rows, { autoAlpha: 0, y: 12 })
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
          rows,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.26,
            stagger: 0.04,
            ease: 'power2.out',
          },
          '-=0.06',
        )
        return
      }

      const tl = gsap.timeline({ onComplete: unmount })
      animRef.current = tl
      tl.to(rows, {
        autoAlpha: 0,
        y: 12,
        duration: 0.2,
        stagger: { each: 0.03, from: 'end' },
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

  const setPerformanceMode = (mode: PerformanceMode) => {
    setPerformance(mode)
    applyPerformanceMode(mode)
    playUiSound('ok')
  }

  const setSounds = (enabled: boolean) => {
    setUiSoundsEnabled(enabled)
    setUiSounds(enabled)
    if (enabled) playUiSound('ok')
  }

  const modal =
    mounted && portalHost
      ? createPortal(
          <div
            className="settings-menu__modal"
            ref={modalRef}
            role="dialog"
            aria-label="Settings"
          >
            <div className="settings-menu__head">
              <h2 className="settings-menu__title">Settings</h2>
            </div>
            <div className="settings-menu__body">
              <SegmentedOption
                label="Performance"
                value={performance}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'high', label: 'High' },
                ]}
                onChange={setPerformanceMode}
              />
              <SegmentedOption
                label="UI Sounds"
                value={uiSounds ? 'on' : 'off'}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'on', label: 'On' },
                ]}
                onChange={(value) => setSounds(value === 'on')}
              />
            </div>
          </div>,
          portalHost,
        )
      : null

  return (
    <div
      className={['settings-menu', mounted ? 'is-open' : '']
        .filter(Boolean)
        .join(' ')}
      ref={rootRef}
    >
      <button
        className="settings-menu__trigger"
        ref={triggerRef}
        type="button"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Settings"
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
        <SettingsIcon />
      </button>
      {modal}
    </div>
  )
}
