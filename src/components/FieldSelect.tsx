import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './FieldSelect.css'

export type FieldSelectOption = {
  value: string
  label: string
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

/** Anchor menu under the trigger in .speech-app design space (pre-scale). */
function placeMenu(trigger: HTMLElement, menu: HTMLElement, app: HTMLElement) {
  const scale = Math.max(0.001, stageScale())
  const appRect = app.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  const em =
    Number.parseFloat(getComputedStyle(trigger).fontSize) || 16
  menu.style.top = `${(triggerRect.bottom - appRect.top) / scale + 4}px`
  menu.style.left = `${(triggerRect.left - appRect.left) / scale}px`
  menu.style.minWidth = `${Math.max(triggerRect.width / scale, 8 * em)}px`
}

export function FieldSelect({
  value,
  options,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  value: string
  options: FieldSelectOption[]
  onChange: (value: string) => void
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]
  const isVoice = Boolean(className?.includes('field-select--voice'))

  useLayoutEffect(() => {
    setPortalHost(document.querySelector('.speech-app'))
  }, [])

  useLayoutEffect(() => {
    if (!open || !portalHost) return
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    const sync = () => placeMenu(trigger, menu, portalHost)
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [open, portalHost, options.length, value])

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (rootRef.current?.contains(event.target)) return
      if (menuRef.current?.contains(event.target)) return
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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

  const menu =
    open && portalHost
      ? createPortal(
          <ul
            ref={menuRef}
            id={listId}
            className={[
              'field-select__menu',
              'field-select__menu--portal',
              isVoice ? 'field-select__menu--voice' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="listbox"
            aria-label={ariaLabel}
          >
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    className={`field-select__option${isSelected ? ' is-selected' : ''}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
          </ul>,
          portalHost,
        )
      : null

  return (
    <div
      ref={rootRef}
      className={[
        'field-select',
        'field-select--inline',
        open ? 'is-open' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        ref={triggerRef}
        type="button"
        className="field-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="field-select__value">{selected?.label}</span>
      </button>
      {menu}
    </div>
  )
}
