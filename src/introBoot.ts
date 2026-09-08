/**
 * Intro boot progress owned outside React so GSAP can update every frame
 * without re-rendering App (was the main boot jank source).
 *
 * null = live / not driving that channel.
 */
export const introBoot = {
  volumeFill: null as number | null,
  gainProgress: null as number | null,
  vuProgress: null as number | null,
  knobProgress: null as number | null,
  /** Oscilloscope stays dark until VU lamp boot ends, then center-out curtain. */
  scopeLive: true,
}

type Listener = () => void
const knobListeners = new Set<Listener>()

export function setKnobBootProgress(value: number | null) {
  // Quantize mid-tween so knobs don't re-render every GSAP frame (~60Hz).
  const next =
    value == null ? null : Math.round(value * 40) / 40
  if (introBoot.knobProgress === next) return
  introBoot.knobProgress = next
  knobListeners.forEach((listener) => listener())
}

export function subscribeKnobBoot(listener: Listener) {
  knobListeners.add(listener)
  return () => {
    knobListeners.delete(listener)
  }
}

export function getKnobBootSnapshot() {
  return introBoot.knobProgress
}
