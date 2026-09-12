#!/usr/bin/env bash
set -euo pipefail

readonly SOURCE_URL='https://github.com/espeak-ng/espeak-ng.git'
readonly SOURCE_COMMIT='4870adfa25b1a32b4361592f1be8a40337c58d6c'
readonly OUT_DIR="${1:?usage: build-espeak.sh OUT_DIR}"
readonly WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$OUT_DIR"
git clone --filter=blob:none "$SOURCE_URL" "$WORK_DIR/espeak-ng"
git -C "$WORK_DIR/espeak-ng" checkout --detach "$SOURCE_COMMIT"
test "$(git -C "$WORK_DIR/espeak-ng" rev-parse HEAD)" = "$SOURCE_COMMIT"

cd "$WORK_DIR/espeak-ng"
./autogen.sh
emconfigure ./configure \
  --without-async \
  --without-klatt \
  --without-mbrola \
  --without-pcaudiolib \
  --without-sonic \
  --without-speechplayer
emmake make -j2

emcc -O3 \
  src/espeak_ng-espeak-ng.o \
  src/.libs/libespeak-ng.a \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ENVIRONMENT=web \
  -s EXPORTED_RUNTIME_METHODS='["FS"]' \
  -s EXPORT_ES6=1 \
  -s FORCE_FILESYSTEM=1 \
  -s MODULARIZE=1 \
  --preload-file espeak-ng-data@/usr/local/share/espeak-ng-data \
  -o "$OUT_DIR/espeak-ng.js"

(
  cd "$OUT_DIR"
  sha256sum espeak-ng.js espeak-ng.wasm espeak-ng.data > espeak-ng.sha256
)
