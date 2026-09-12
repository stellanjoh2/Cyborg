export const ABOUT_TEXT =
  "Hi, I'm Stellan Johansson, a creative director and brand designer with 20+ years across games, 3D, motion, UI and visual identity — shipping titles at studios, running agencies, and shaping platforms used by millions of creators. LX01™ is one of my sideprojects."

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
export const ABOUT_LEGAL_TEXT = [
  'LX01™ (The Application) includes one original voice engine and three third-party engines.',
  "LARYNX (The Sound Engine) is LX01™'s project-authored, offline formant voice engine. Text is converted into phonemes, then voiced locally through deterministic excitation, resonators, timing, transitions and robotic prosody created specifically for LX01™. LARYNX contains no voice recordings, cloned speaker, cloud speech service or downloaded voice model. Audio generated with LARYNX is royalty-free and may be used, edited and distributed in personal or commercial work without attribution or additional permission. To be explicit: LX01™-owned application source is licensed under PolyForm Noncommercial 1.0.0, while audio generated with the LARYNX engine may be monetized.",
  'LARYNX pronunciation uses the Carnegie Mellon Pronouncing Dictionary and the ISC-licensed cmu-pronouncing-dictionary package, with MIT-licensed to-words for numbers. These components permit commercial use. Redistributions of the engine source must retain their license notices.',
  "SAM is a reverse-engineered remake of Software Automatic Mouth (Don't Ask Software / SoftVoice, Inc., 1982). The sam-js maintainer says the port cannot be placed under a specific open-source license because rights in the original software remain with SoftVoice. LX01™ cannot grant rights in that underlying material. The maintainer reports unsuccessful attempts to contact SoftVoice, and no practical permission route is currently identified. SAM is provided as-is and at your own risk; treat it as personal, non-commercial use.",
  "Piper voice models are downloaded through MIT-licensed vits-web from a mirror of Rhasspy's Piper voices. Their source-data terms and training lineage differ. Amy, Danny, Ryan, HFC Male and HFC Female have non-commercial source or base-voice terms. Lessac uses research-only source material; Alan, Alba, Joe, Kusal, Jenny Dioco and Northern Male are fine-tuned from Lessac, so their commercial status is not treated as cleared here. Kristin, LJ Speech and Cori were trained from scratch on data that their model cards describe as public-domain recordings. Keep all required credits and review the Piper model cards before using or distributing a model or its output; these summaries are not a legal conclusion.",
  'eSpeak-NG is distributed in LX01™ under GPL-3.0-or-later. Distribution is already subject to the GPL; it is not a future obligation triggered only by redistributors. The direct speech runtime is built from exact eSpeak-NG 1.52-dev code and data commits with Emscripten 3.1.47. Piper uses a separate, same-origin phonemizer built from exact piper-phonemize and eSpeak-NG code and data commits with that same pinned toolchain. Build scripts, the source manifest, license texts and SHA-256 files are published with the project. Both compiled runtimes are subject to the GPL. Technical isolation does not by itself settle the GPL scope of a combined browser application, so that scope must be reviewed for your distribution. See Third-Party Notices and Third-Party Software Licenses for details.',
  'Last reviewed: September 12, 2026. This summary is informational and is not legal advice. If you are shipping a commercial product—especially one using SAM, Piper voices, or an eSpeak-NG build—have qualified counsel review the applicable terms.',
  'If you reuse anything beyond LARYNX-generated audio, check the applicable third-party terms. LX01™ is not affiliated with SoftVoice, Rhasspy, the eSpeak NG project, or Carnegie Mellon.',
].join('\n\n')

export const ABOUT_LEGAL_EMPHASIS = [
  { text: 'royalty-free' },
  { text: 'personal or commercial work' },
  { text: 'non-commercial use' },
  { text: 'may be monetized' },
  { text: 'PolyForm Noncommercial 1.0.0' },
  { text: 'cannot grant rights in that underlying material' },
  { text: 'at your own risk' },
  { text: 'non-commercial source or base-voice terms' },
  { text: 'research-only source material' },
  { text: 'not treated as cleared here' },
  { text: 'public-domain recordings' },
  { text: 'GPL-3.0-or-later' },
  { text: 'subject to the GPL' },
  { text: 'must be reviewed' },
  { text: 'not legal advice' },
  { text: 'qualified counsel review' },
] as const

/** Wikipedia (and similar) for engines / systems named in ABOUT_LEGAL_TEXT. */
export const ABOUT_LEGAL_LINKS = [
  {
    text: 'Software Automatic Mouth',
    href: 'https://en.wikipedia.org/wiki/Software_Automatic_Mouth',
  },
  {
    text: 'SAM',
    href: 'https://en.wikipedia.org/wiki/Software_Automatic_Mouth',
  },
  {
    text: 'eSpeak NG project',
    href: 'https://en.wikipedia.org/wiki/ESpeak',
  },
  {
    text: 'eSpeak-NG',
    href: 'https://en.wikipedia.org/wiki/ESpeak',
  },
  {
    text: 'Piper model cards',
    href: 'https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0',
  },
  {
    text: 'PolyForm Noncommercial 1.0.0',
    href: 'https://github.com/stellanjoh2/Cyborg/blob/main/LICENSE',
  },
  {
    text: 'source manifest',
    href: 'https://github.com/stellanjoh2/Cyborg/blob/main/third_party/voice-runtime/source-manifest.json',
  },
  {
    text: 'Build scripts',
    href: 'https://github.com/stellanjoh2/Cyborg/tree/main/third_party/voice-runtime',
  },
  {
    text: 'Third-Party Notices',
    href: 'https://github.com/stellanjoh2/Cyborg/blob/main/THIRD_PARTY_NOTICES.md',
  },
  {
    text: 'Third-Party Software Licenses',
    href: 'https://github.com/stellanjoh2/Cyborg/blob/main/THIRD_PARTY_LICENSES.md',
  },
  {
    text: 'Carnegie Mellon Pronouncing Dictionary',
    href: 'https://en.wikipedia.org/wiki/CMU_Pronouncing_Dictionary',
  },
] as const
