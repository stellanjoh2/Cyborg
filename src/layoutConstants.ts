/** Target 16:9 canvas (2560×1440). ScaleViewport only scales down from this. */
export const DESIGN_WIDTH = 2560
export const DESIGN_HEIGHT = 1440

/** Matches `.speech-top` height: pad-y + control + pad-y + border (design px). */
export const NAV_HEIGHT =
  24 + /* --section-gap top */
  54 + /* --nav-control-h / --phase-orb-size */
  24 + /* --section-gap bottom */
  1 /* --stroke-width */
