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
  /** Oscilloscope stays dark until VU lamp boot ends, then center-out curtain. */
  scopeLive: true,
}
