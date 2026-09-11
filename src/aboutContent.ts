export const ABOUT_TEXT =
  "Hi, I'm Stellan Johansson, a creative director and brand designer with 20+ years across games, 3D, motion, UI and visual identity — shipping titles at studios, running agencies, and shaping platforms used by millions of creators. LX01 is one of my sideprojects."

export const LINKEDIN_URL = 'https://www.linkedin.com/in/stellanj/'
export const MOBYGAMES_URL =
  'https://www.mobygames.com/person/289121/stellan-johansson/credits/'
export const X_URL = 'https://x.com/johstell'
export const ORBY_URL = 'https://orby.studio/'

export const ABOUT_LINKS = [
  { text: 'LinkedIn', href: LINKEDIN_URL },
  { text: 'MobyGames', href: MOBYGAMES_URL },
  { text: 'X', href: X_URL },
  { text: 'Orby', href: ORBY_URL },
] as const

export const ABOUT_LINKS_TEXT = ABOUT_LINKS.map((link) => link.text).join(' · ')

export const ABOUT_LEGAL_TEXT =
  "Voice engines use open tools and models. SAM is a JavaScript port of Software Automatic Mouth (Don't Ask Software / SoftVoice, Inc., 1982). Piper uses Rhasspy's MIT-licensed voices (here: Amy) via vits-web. Pronunciation help comes from the CMU Pronouncing Dictionary. Third-party licenses apply; LX01 doesn't claim ownership of those voices or engines."
