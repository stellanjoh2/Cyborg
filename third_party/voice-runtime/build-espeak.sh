#!/usr/bin/env bash
set -euo pipefail

readonly SOURCE_URL='https://github.com/rhasspy/espeak-ng.git'
readonly SOURCE_COMMIT='0f65aa301e0d6bae5e172cc74197d32a6182200f'
readonly DATA_URL='https://github.com/rhasspy/espeak-ng.git'
readonly DATA_COMMIT='8593723f10cfd9befd50de447f14bf0a9d2a14a4'
readonly OUT_DIR_INPUT="${1:?usage: build-espeak.sh OUT_DIR}"
readonly WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$OUT_DIR_INPUT"
readonly OUT_DIR="$(cd "$OUT_DIR_INPUT" && pwd)"
# Emscripten 3.1.47's wide-character declarations conflict with eSpeak-NG's
# compatibility macros. This is the same documented patch used by the Piper
# phonemizer build.
sed -i -E \
  's/int[[:space:]]+(iswalnum|iswalpha|iswblank|iswcntrl|iswgraph|iswlower|iswprint|iswpunct|iswspace|iswupper|iswxdigit)\(wint_t\)/\/\/\0/g' \
  "${EMSDK:?activate Emscripten first}/upstream/emscripten/cache/sysroot/include/wchar.h"

git clone --filter=blob:none "$DATA_URL" "$WORK_DIR/espeak-data"
git -C "$WORK_DIR/espeak-data" checkout --detach "$DATA_COMMIT"
test "$(git -C "$WORK_DIR/espeak-data" rev-parse HEAD)" = "$DATA_COMMIT"
(
  cd "$WORK_DIR/espeak-data"
  ./autogen.sh
  ./configure
  make -j2
)
cp -a "$WORK_DIR/espeak-data/espeak-ng-data" \
  "$WORK_DIR/compiled-espeak-ng-data"

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
# Build the program target only. The full `all` target attempts to execute the
# just-built WebAssembly binary to regenerate data, which is not executable by
# the Linux host. The pinned source already contains the data we preload below.
emmake make -j2 src/espeak-ng

emcc -O3 \
  src/espeak-ng.o \
  src/.libs/libespeak-ng.a \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ENVIRONMENT=web \
  -s EXPORTED_RUNTIME_METHODS='["FS"]' \
  -s EXPORT_ES6=1 \
  -s FORCE_FILESYSTEM=1 \
  -s MODULARIZE=1 \
  --preload-file "$WORK_DIR/compiled-espeak-ng-data"@/usr/local/share/espeak-ng-data \
  -o "$OUT_DIR/espeak-ng.js"

(
  cd "$OUT_DIR"
  sha256sum espeak-ng.js espeak-ng.wasm espeak-ng.data > espeak-ng.sha256
)
