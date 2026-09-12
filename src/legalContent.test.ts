import { describe, expect, it } from 'vitest'
import {
  ABOUT_LEGAL_EMPHASIS,
  ABOUT_LEGAL_TEXT,
} from './aboutContent'
import { COLOR_THEMES } from './colorThemes'
import { buildLxVoiceFile, parseLxVoiceFile } from './lxVoiceFile'
import { PIPER_VOICE_OPTIONS } from './piperVoices'
import { DEFAULT_VOCODER_UI } from './vocoderParams'
import { VOICE_ENGINE_OPTIONS } from './voiceEngines'

describe('legal presentation', () => {
  it('uses LARYNX as the public label without changing the engine id', () => {
    expect(VOICE_ENGINE_OPTIONS).toHaveLength(4)
    expect(
      VOICE_ENGINE_OPTIONS.find((engine) => engine.value === 'lx'),
    ).toEqual({ value: 'lx', label: 'LARYNX' })
  })

  it('distinguishes the application from its sound engine', () => {
    const [application, soundEngine] = ABOUT_LEGAL_TEXT.split('\n\n')
    expect(application).toContain('LX01™ (The Application)')
    expect(soundEngine).toContain('LARYNX (The Sound Engine)')
    expect(ABOUT_LEGAL_TEXT).not.toMatch(/LX01(?!™)/)
  })

  it('keeps all fifteen reviewed Piper voices', () => {
    expect(PIPER_VOICE_OPTIONS).toHaveLength(15)
  })

  it('round-trips the unchanged .lxvoice format', () => {
    const voice = buildLxVoiceFile(
      {
        speed: 0.6,
        pitch: 0.5,
        humanRobot: 0.4,
        formant: 0.7,
        vocoder: DEFAULT_VOCODER_UI,
      },
      'Compatibility',
    )
    expect(parseLxVoiceFile(JSON.stringify(voice))).toEqual(voice)
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
