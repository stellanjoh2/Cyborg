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

/** Plain-language voice credits — what visitors should take away. */
export const ABOUT_LEGAL_TEXT =
  "LX01 does not own these voices. They belong to other people and projects — please treat them that way.\n\nSAM is a reverse-engineered remake of Software Automatic Mouth (Don't Ask Software / SoftVoice, Inc., 1982). SoftVoice never licensed this port for free reuse. Use it for personal fun; don't sell it or claim it as yours.\n\nPiper voices (Amy, Danny, Lessac, Ryan, HFC Male, HFC Female, Joe, Kristin, Kusal, LJ Speech, Alan, Alba, Cori, Jenny Dioco, Northern Male) are free to use as published by Rhasspy, via vits-web. Keep their credits. Some training data adds extra rules (including non-commercial).\n\neSpeak-NG is a formant speech synthesizer from the eSpeak NG project (GPL-3.0). LX01 runs a browser WASM build of it. Keep their credit; if you redistribute the engine, follow GPL-3.0.\n\nPronunciation help uses the Carnegie Mellon Pronouncing Dictionary. Free to use; please credit Carnegie Mellon.\n\nLX01 itself is non-commercial.\n\nIf you reuse any of this elsewhere, check those third-party terms. LX01 is not affiliated with SoftVoice, Rhasspy, the eSpeak NG project, or Carnegie Mellon."
