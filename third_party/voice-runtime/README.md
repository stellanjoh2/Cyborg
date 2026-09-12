# Voice runtime corresponding source

LX01 builds both eSpeak-NG WebAssembly runtimes from the immutable revisions in
`source-manifest.json`. The scripts in this directory are the preferred build
form for the deployed binaries. They reject unpinned revisions and write
SHA-256 checksums next to the outputs.

- `build-espeak.sh` builds the direct eSpeak speech engine from eSpeak-NG
  1.52-dev code and its exactly pinned data revision.
- `build-piper-phonemizer.sh` builds Piper's eSpeak-NG-based phonemizer.
- `.github/workflows/build-voice-runtime.yml` installs the exactly pinned
  Emscripten SDK and runs both scripts.

Run the workflow or activate Emscripten 3.1.47 locally and run:

```sh
third_party/voice-runtime/build-espeak.sh public/vendor/voice-runtime
third_party/voice-runtime/build-piper-phonemizer.sh public/vendor/voice-runtime
```

The deployed application loads these same-origin files. Upstream source can be
obtained at the exact commit links recorded in `source-manifest.json`; no
floating branch or package CDN is used for either WASM runtime.

eSpeak-NG is GPL-3.0-or-later. Piper-phonemize's wrapper code is MIT-licensed
and links with eSpeak-NG, so the resulting phonemizer runtime is distributed
under GPL-3.0-or-later as a whole. This repository's PolyForm terms do not
replace any third-party license.
