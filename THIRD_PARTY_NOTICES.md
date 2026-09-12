# Third-Party Notices

This document records the third-party voice components used by LX01™ and the
terms identified from their published package metadata and model cards. It is
informational, not legal advice. It was last checked on September 12, 2026.
LX01™-owned source is covered by the [PolyForm Noncommercial License
1.0.0](LICENSE). Copyright and license texts for the installed production
dependency tree are collected in
[Third-Party Software Licenses](THIRD_PARTY_LICENSES.md).

## eSpeak-NG JavaScript/WASM

LX01™ serves two eSpeak-NG-based JavaScript/WASM runtimes under
GPL-3.0-or-later. This is a present distribution obligation, not merely an
obligation for someone who later redistributes LX01™.

The direct speech engine is built from:

- eSpeak-NG 1.52-dev source commit
  [`0f65aa301e0d6bae5e172cc74197d32a6182200f`](https://github.com/rhasspy/espeak-ng/tree/0f65aa301e0d6bae5e172cc74197d32a6182200f)
- eSpeak-NG data commit
  [`8593723f10cfd9befd50de447f14bf0a9d2a14a4`](https://github.com/rhasspy/espeak-ng/tree/8593723f10cfd9befd50de447f14bf0a9d2a14a4)
- Emscripten 3.1.47 SDK commit
  [`37b85e9eaee5be090569d018cca77a15cacc11b7`](https://github.com/emscripten-core/emsdk/tree/37b85e9eaee5be090569d018cca77a15cacc11b7)

Piper's separate same-origin phonemizer is built from:

- piper-phonemize commit
  [`cfff8e52ebaea37c7e953ae2d06b174acb827ac4`](https://github.com/wide-video/piper-phonemize/tree/cfff8e52ebaea37c7e953ae2d06b174acb827ac4)
- linked eSpeak-NG source commit
  [`0f65aa301e0d6bae5e172cc74197d32a6182200f`](https://github.com/rhasspy/espeak-ng/tree/0f65aa301e0d6bae5e172cc74197d32a6182200f)
- eSpeak-NG data commit
  [`8593723f10cfd9befd50de447f14bf0a9d2a14a4`](https://github.com/rhasspy/espeak-ng/tree/8593723f10cfd9befd50de447f14bf0a9d2a14a4)
- the same pinned Emscripten 3.1.47 toolchain

The preferred build form, exact
[source manifest](third_party/voice-runtime/source-manifest.json), documented
patches, and SHA-256 output files are in
[`third_party/voice-runtime`](third_party/voice-runtime/). The deployed
runtimes and manifest are served from `vendor/voice-runtime/` on the same
origin; no floating package-CDN URL is used.

Both compiled runtimes are distributed under GPL-3.0-or-later. Technical
separation does not itself settle the copyleft scope of the combined browser
application. A distributor should obtain qualified legal review of that scope.
The complete [GPL-3.0 license text](third_party/licenses/GPL-3.0-or-later.txt)
is included locally.

## Interface font

LX01™ uses **Ac437 NEC MultiSpeed** from
[The Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/)
by VileR, copyright © 2016–2020 VileR. The font pack is licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).

## SAM / sam-js

LX01™ includes `sam-js` npm package version 0.3.1. It is a reverse-engineered
JavaScript port of Software Automatic Mouth, originally published by Don't Ask
Software and now attributed by the port's maintainer to SoftVoice, Inc.

- Port source and maintainer's rights statement:
  <https://github.com/discordier/sam>
- Package: <https://www.npmjs.com/package/sam-js/v/0.3.1>

The package declares `SEE LICENSE IN README.md`. Its README says the maintainer
cannot place the port under a specific open-source license because rights in
the original commercial software remain with SoftVoice, and advises use at
the user's own risk. LX01™ cannot grant rights in that underlying material.
The maintainer reports unsuccessful attempts to contact SoftVoice, and no
practical permission route is currently identified. SAM is included as-is;
treat it as personal, non-commercial use.

## Piper models and vits-web

LX01™ uses `@diffusionstudio/vits-web` version 1.0.3, which declares the MIT
License. At runtime it downloads models from Diffusion Studio's Piper voice
mirror, which identifies itself as a fork of Rhasspy's Piper voices.

- vits-web source: <https://github.com/diffusionstudio/vits-web>
- Runtime model mirror: <https://huggingface.co/diffusionstudio/piper-voices>
- Rhasspy model cards reviewed at v1.0.0:
  <https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0>

The mirror's repository-level MIT label does not replace restrictions stated
by upstream datasets or inherited through base-model training. The model cards
primarily describe source datasets, not a single uniform license for every
model or for generated audio.

### Selected voice details

- **Amy (`en_US-amy-low`)** — source card points to Mimic 3
  (CC BY-SA 4.0 repository) and says the model was fine-tuned from Ryan low,
  whose source dataset is CC BY-NC-SA 4.0. Treat as non-commercial.
- **Danny (`en_US-danny-low`)** — same Mimic 3 and Ryan-low lineage as Amy.
  Treat as non-commercial.
- **Lessac (`en_US-lessac-medium`)** — trained from scratch on Lessac Blizzard
  2013 material licensed for research purposes only. Not commercially cleared.
- **Ryan (`en_US-ryan-medium`)** — source dataset is CC BY-NC-SA 4.0 and the
  model was fine-tuned from Lessac. Non-commercial.
- **HFC Male and HFC Female (`en_US-hfc_male-medium`,
  `en_US-hfc_female-medium`)** — source dataset is CC BY-NC-SA 4.0 and both
  were fine-tuned from Lessac. Non-commercial.
- **Joe (`en_US-joe-medium`)** — source dataset is CC0, but the model was
  fine-tuned from Lessac. Commercial status is not treated as cleared.
- **Kristin (`en_US-kristin-medium`)** — trained from scratch using LibriVox
  recordings described by the card as public domain.
- **Kusal (`en_US-kusal-medium`)** — source card points to Apache-2.0-licensed
  Mimic 2, but the model was fine-tuned from Lessac. Commercial status is not
  treated as cleared.
- **LJ Speech (`en_US-ljspeech-medium`)** — trained from scratch on the
  public-domain LJ Speech dataset.
- **Alan (`en_GB-alan-medium`)** — source card points to Mimic 3 and the model
  was fine-tuned from Lessac. Commercial status is not treated as cleared.
- **Alba (`en_GB-alba-medium`)** — source dataset is CC BY 4.0, but the model
  was fine-tuned from Lessac. Commercial status is not treated as cleared.
- **Cori (`en_GB-cori-medium`)** — trained from scratch using LibriVox
  recordings described by the card as public domain.
- **Jenny Dioco (`en_GB-jenny_dioco-medium`)** — the source dataset permits
  commercial use and requires attribution as “Jenny” or, where practical,
  “Jenny (Dioco)”; the model was fine-tuned from Lessac, so commercial status
  is not treated as cleared.
- **Northern Male (`en_GB-northern_english_male-medium`)** — source dataset is
  CC BY-SA 4.0 and the model was fine-tuned from Lessac. Commercial status is
  not treated as cleared.

Review the exact model card, dataset terms, base-model lineage, and any
applicable voice or publicity rights before using or distributing a model or
its output. The three from-scratch/public-domain-source entries above are not
a warranty that every possible use of their outputs is legally unrestricted.

## LARYNX pronunciation components

The LARYNX voice engine uses the following third-party pronunciation components.

### Carnegie Mellon Pronouncing Dictionary

The Carnegie Mellon Pronouncing Dictionary (CMUdict) is maintained by the
Speech Group in the School of Computer Science at Carnegie Mellon University.
Its use for research or commercial purposes is unrestricted. Carnegie Mellon
requests acknowledgment when the dictionary is used or redistributed.

LX01™ accesses CMUdict through the `cmu-pronouncing-dictionary` npm package.

#### cmu-pronouncing-dictionary — ISC License

Copyright (c) 2015 Zeke Sikelianos <zeke@sikelianos.com>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### to-words — MIT License

Copyright (c) 2017 Munjal Dhamecha

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
