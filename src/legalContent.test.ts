import { describe, expect, it } from 'vitest'
import {
  ABOUT_LEGAL_EMPHASIS,
  ABOUT_LEGAL_TEXT,
} from './aboutContent'
import { COLOR_THEMES } from './colorThemes'
import { VOICE_ENGINE_OPTIONS } from './voiceEngines'

describe('legal presentation', () => {
  it('uses LARYNX as the public label without changing the engine id', () => {
    expect(
      VOICE_ENGINE_OPTIONS.find((engine) => engine.value === 'lx'),
    ).toEqual({ value: 'lx', label: 'LARYNX' })
  })

  it('keeps every emphasized phrase in the legal copy', () => {
    for (const emphasis of ABOUT_LEGAL_EMPHASIS) {
      expect(ABOUT_LEGAL_TEXT, emphasis.text).toContain(emphasis.text)
    }
  })

  it('gives every theme a visibly red legal emphasis color', () => {
    for (const theme of COLOR_THEMES) {
      const value = theme.palette.legal
      expect(value, theme.id).toMatch(/^#[\da-f]{6}$/i)
      const red = Number.parseInt(value.slice(1, 3), 16)
      const green = Number.parseInt(value.slice(3, 5), 16)
      const blue = Number.parseInt(value.slice(5, 7), 16)
      expect(red, theme.id).toBeGreaterThan(green * 1.35)
      expect(red, theme.id).toBeGreaterThan(blue * 1.15)
    }
  })
})
