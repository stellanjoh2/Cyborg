#!/usr/bin/env bash
set -euo pipefail

readonly PIPER_URL='https://github.com/wide-video/piper-phonemize.git'
readonly PIPER_COMMIT='cfff8e52ebaea37c7e953ae2d06b174acb827ac4'
readonly DATA_URL='https://github.com/rhasspy/espeak-ng.git'
readonly DATA_COMMIT='8593723f10cfd9befd50de447f14bf0a9d2a14a4'
readonly OUT_DIR="${1:?usage: build-piper-phonemizer.sh OUT_DIR}"
readonly WORK_DIR="$(mktemp -d)"
readonly TOOLCHAIN_FILE="${EMSDK:?activate Emscripten first}/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$OUT_DIR"
git clone --filter=blob:none "$DATA_URL" "$WORK_DIR/espeak-data"
git -C "$WORK_DIR/espeak-data" checkout --detach "$DATA_COMMIT"
test "$(git -C "$WORK_DIR/espeak-data" rev-parse HEAD)" = "$DATA_COMMIT"

(
  cd "$WORK_DIR/espeak-data"
  ./autogen.sh
  ./configure
  make -j2
)

git clone --filter=blob:none "$PIPER_URL" "$WORK_DIR/piper-phonemize"
git -C "$WORK_DIR/piper-phonemize" checkout --detach "$PIPER_COMMIT"
test "$(git -C "$WORK_DIR/piper-phonemize" rev-parse HEAD)" = "$PIPER_COMMIT"

# Required by the pinned 2024 build recipe for Emscripten 3.1.47.
sed -i -E \
  's/int[[:space:]]+(iswalnum|iswalpha|iswblank|iswcntrl|iswgraph|iswlower|iswprint|iswpunct|iswspace|iswupper|iswxdigit)\(wint_t\)/\/\/\0/g' \
  "$EMSDK/upstream/emscripten/cache/sysroot/include/wchar.h"

cd "$WORK_DIR/piper-phonemize"
emmake cmake \
  -Bbuild \
  -DCMAKE_INSTALL_PREFIX=install \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN_FILE" \
  -DBUILD_TESTING=OFF \
  -G 'Unix Makefiles' \
  "-DCMAKE_CXX_FLAGS=-O3 -s INVOKE_RUN=0 -s MODULARIZE=1 -s EXPORT_NAME='createPiperPhonemize' -s EXPORTED_FUNCTIONS='[_main]' -s EXPORTED_RUNTIME_METHODS='[callMain, FS]' --preload-file $WORK_DIR/espeak-data/espeak-ng-data@/espeak-ng-data"

# The pinned upstream recipe first reaches a known generated-data permission
# failure. Preserve that build attempt, then apply the two documented patches.
emmake cmake --build build --config Release || true
test -f build/e/src/espeak_ng_external-build/CMakeFiles/Makefile2
test -f build/e/src/espeak_ng_external/src/speechPlayer/src/speechWaveGenerator.cpp
sed -i \
  's+$(MAKE) $(MAKESILENT) -f CMakeFiles/data.dir/build.make CMakeFiles/data.dir/build+#\0+g' \
  build/e/src/espeak_ng_external-build/CMakeFiles/Makefile2
sed -i 's/using namespace std/\/\/\0/g' \
  build/e/src/espeak_ng_external/src/speechPlayer/src/speechWaveGenerator.cpp
emmake cmake --build build --config Release

cp build/piper_phonemize.js "$OUT_DIR/"
cp build/piper_phonemize.wasm "$OUT_DIR/"
cp build/piper_phonemize.data "$OUT_DIR/"
(
  cd "$OUT_DIR"
  sha256sum \
    piper_phonemize.js \
    piper_phonemize.wasm \
    piper_phonemize.data > piper_phonemize.sha256
)
