/** Target 16:9 canvas (2560×1440). ScaleViewport only scales down from this.
 *  Stage is top-aligned; letterbox gutters are --stage-bleed-x and
 *  --stage-bleed-y-top / --stage-bleed-y-bottom so plates can extend. */
export const DESIGN_WIDTH = 2560
export const DESIGN_HEIGHT = 1440

/** Matches `.speech-top` height: pad-y + control + pad-y + border (design px). */
export const NAV_HEIGHT =
  24 + /* --section-gap top */
  48 + /* --nav-control-h */
  24 + /* --section-gap bottom */
  1 /* --stroke-width */
