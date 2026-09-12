# LX01

Browser speech synthesizer and vocoder from Larynx Industries.

**Live:** [stellanjoh2.github.io/Cyborg](https://stellanjoh2.github.io/Cyborg/)

## Credits

LX01 includes one project-authored voice engine and three third-party engines.

**LARYNX** is LX01's original, offline formant voice engine. Its ARPAbet phoneme source, excitation, resonators, timing, and robotic prosody are generated locally by this project without a downloaded voice model. It uses the Carnegie Mellon Pronouncing Dictionary for English pronunciation.

Audio generated with the **LARYNX engine** may be used, edited, distributed, and monetized without attribution. This is separate from **LX01-owned application source**, which is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

**SAM** is a reverse-engineered remake of Software Automatic Mouth (Don't Ask Software / SoftVoice, Inc., 1982). [`sam-js`](https://github.com/discordier/sam) states that it cannot place the port under a specific open-source license because rights in the original software remain with SoftVoice. LX01 cannot grant rights in that underlying material. The maintainer reports unsuccessful attempts to contact SoftVoice, and no practical permission route is currently identified. SAM is provided as-is and at your own risk; treat it as personal, non-commercial use.

**Piper** models are downloaded through MIT-licensed [`vits-web`](https://github.com/diffusionstudio/vits-web) from its [mirror](https://huggingface.co/diffusionstudio/piper-voices) of [Rhasspy's Piper voices](https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0). The selected voices do not share one commercially permissive status:

- **Non-commercial source or base-voice terms:** Amy, Danny, Ryan, HFC Male, HFC Female.
- **Lessac research-only source or fine-tune lineage; not treated here as commercially cleared:** Lessac, Alan, Alba, Joe, Kusal, Jenny Dioco, Northern Male.
- **Trained from scratch on data that their model cards describe as public-domain recordings:** Kristin, LJ Speech, Cori.

These are summaries of the model cards and training lineage, not legal conclusions about model output. Review the exact model card and all upstream terms before using or distributing a voice or its output.

**eSpeak-NG** is distributed under GPL-3.0-or-later. Serving LX01 conveys the compiled runtimes, so GPL obligations apply to this distribution now. The direct speech runtime is built from [eSpeak-NG 1.52.0 at an exact commit](https://github.com/espeak-ng/espeak-ng/tree/4870adfa25b1a32b4361592f1be8a40337c58d6c) with Emscripten 3.1.47.

Piper uses a separate same-origin phonemizer built from exact piper-phonemize and eSpeak-NG code and data commits. The [source manifest and reproducible build scripts](third_party/voice-runtime/) are published with SHA-256 files for the deployed outputs. Both runtimes are subject to the GPL. Technical isolation does not itself settle the GPL scope of a combined browser application; obtain qualified advice for your distribution.

**Pronunciation help** uses the Carnegie Mellon Pronouncing Dictionary. Free to use; please credit Carnegie Mellon.

See [Third-Party Notices](THIRD_PARTY_NOTICES.md) for package versions, voice-by-voice sources, and terms, and [Third-Party Software Licenses](THIRD_PARTY_LICENSES.md) for the production dependency license bundle.

Last reviewed: September 12, 2026. This summary is informational and is not legal advice. If you are shipping a commercial product—especially one using SAM, Piper voices, or an eSpeak-NG build—have qualified counsel review the applicable terms.

If you reuse anything beyond LARYNX-generated audio, check the applicable third-party terms. LX01 is not affiliated with SoftVoice, Rhasspy, the eSpeak NG project, or Carnegie Mellon.
