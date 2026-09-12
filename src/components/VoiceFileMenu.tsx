import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { FloppyDiskIcon } from '@phosphor-icons/react'
import { playUiSound } from '../ui/sounds'
import './VoiceFileMenu.css'

gsap.registerPlugin(useGSAP)

function stageScale() {
  const viewport = document.querySelector('.scale-viewport')
  if (!viewport) return 1
  return (
    Number.parseFloat(
      getComputedStyle(viewport).getPropertyValue('--stage-scale'),
    ) || 1
  )
}

function placeMenu(trigger: HTMLElement, menu: HTMLElement, app: HTMLElement) {
  const scale = Math.max(0.001, stageScale())
  const appRect = app.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  menu.style.top = `${(triggerRect.bottom - appRect.top) / scale + 12}px`
  menu.style.right = `${(appRect.right - triggerRect.right) / scale}px`
}

export function VoiceFileMenu({
  onLoad,
  onSave,
}: {
  onLoad: () => void
  onSave: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<gsap.core.Timeline | null>(null)
  const firstOpenRef = useRef(true)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const portalHost = mounted
    ? document.querySelector<HTMLElement>('.speech-app')
    : null

  useLayoutEffect(() => {
    if (!mounted || !portalHost) return
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const place = () => placeMenu(trigger, menu, portalHost)
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [mounted, portalHost])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (
        rootRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return
      }
      playUiSound('close')
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      playUiSound('close')
      setOpen(false)
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
      const menu = menuRef.current
      if (!menu) return
      const title = menu.querySelector<HTMLElement>('.voice-file-menu__title')
      const actions = gsap.utils.toArray<HTMLElement>(
        '.voice-file-menu__action',
        menu,
      )
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const unmount = () => {
        firstOpenRef.current = true
        setMounted(false)
      }

      animationRef.current?.kill()
      if (reduced) {
        if (open) {
          firstOpenRef.current = false
          gsap.set([menu, title, ...actions], { autoAlpha: 1, y: 0 })
        } else {
          gsap.set([menu, title, ...actions], { autoAlpha: 0, y: 0 })
          queueMicrotask(unmount)
        }
        return
      }

      if (open) {
        if (firstOpenRef.current) {
          firstOpenRef.current = false
          gsap.set(menu, { autoAlpha: 0, y: -8 })
          if (title) gsap.set(title, { autoAlpha: 0, y: -6 })
          gsap.set(actions, { autoAlpha: 0, y: 10 })
        }
        animationRef.current = gsap
          .timeline()
          .to(menu, {
            autoAlpha: 1,
            y: 0,
            duration: 0.2,
            ease: 'power2.out',
          })
          .to(
            [title, ...actions],
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.22,
              stagger: 0.04,
              ease: 'power2.out',
            },
            '-=0.1',
          )
        return
      }

      animationRef.current = gsap
        .timeline({ onComplete: unmount })
        .to([title, ...actions], {
          autoAlpha: 0,
          y: 10,
          duration: 0.15,
          stagger: { each: 0.025, from: 'end' },
          ease: 'power2.in',
        })
        .to(
          menu,
          {
            autoAlpha: 0,
            y: -8,
            duration: 0.17,
            ease: 'power2.in',
          },
          '-=0.08',
        )
    },
    { dependencies: [open, mounted] },
  )

  const runAction = (action: () => void) => {
    playUiSound('ok')
    setOpen(false)
    action()
  }

  const menu =
    mounted && portalHost
      ? createPortal(
          <div
            ref={menuRef}
            className="voice-file-menu__modal"
            role="dialog"
            aria-label="Voice files"
          >
            <h2 className="voice-file-menu__title">Voice file</h2>
            <div className="voice-file-menu__actions">
              <button
                type="button"
                className="voice-file-menu__action"
                onClick={() => runAction(onLoad)}
              >
                Load
              </button>
              <button
                type="button"
                className="voice-file-menu__action"
                onClick={() => runAction(onSave)}
              >
                Save
              </button>
            </div>
          </div>,
          portalHost,
        )
      : null

  return (
    <div
      ref={rootRef}
      className={`voice-file-menu${mounted ? ' is-open' : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="voice-file-menu__trigger"
        aria-label="Voice files"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tooltip="Voice files"
        onClick={() => {
          playUiSound(open ? 'close' : 'drop')
          if (!mounted) setMounted(true)
          setOpen((current) => !current)
        }}
      >
        <FloppyDiskIcon weight="bold" />
      </button>
      {menu}
    </div>
  )
}
