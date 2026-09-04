/** Target 16:9 canvas (2560×1440). ScaleViewport only scales down from this. */
export const DESIGN_WIDTH = 2560
export const DESIGN_HEIGHT = 1440

/** Matches `.speech-top` height: pad + control + pad + border (design px). */
export const NAV_HEIGHT =
  48 + /* --app-pad top */
  54 + /* --nav-control-h */
  48 + /* --app-pad bottom */
  1 /* --stroke-width */
