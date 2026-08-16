#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$REPO_ROOT/Codebase - Pensive iOS"

command -v xcodegen >/dev/null 2>&1 || {
  echo "xcodegen is required to generate the iOS project." >&2
  exit 1
}
command -v xcode-build-server >/dev/null 2>&1 || {
  echo "xcode-build-server is required for SourceKit/Xcode project integration." >&2
  exit 1
}

cd "$IOS_DIR"
xcodegen generate

SYMROOT="$(
  xcodebuild -showBuildSettings -project Pensive.xcodeproj -scheme Pensive 2>/dev/null \
    | sed -n 's/^[[:space:]]*SYMROOT = //p' \
    | head -n 1
)"

if [[ -z "$SYMROOT" ]]; then
  echo "Could not determine Xcode's derived-data build root." >&2
  exit 1
fi

BUILD_ROOT="${SYMROOT%/Build/Products}"

# SourceKit needs compiler flags for the test bundles, not only the app. A
# plain `xcodebuild -showBuildSettings` can create a valid buildServer.json
# while leaving xcode-build-server's compile cache populated with app flags
# only. Build the test bundles into the same DerivedData root so the cache
# contains XCTest's simulator SDK/framework flags too.
xcodebuild -project Pensive.xcodeproj \
  -scheme Pensive \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$BUILD_ROOT" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build-for-testing

xcode-build-server config --build_root "$BUILD_ROOT" --scheme Pensive

BUILD_ROOT_KEY="${BUILD_ROOT//\//-}"
BUILD_ROOT_HASH="$(printf '%s' "$BUILD_ROOT" | md5 -q)"
COMPILE_CACHE_DIR="${HOME}/Library/Caches/xcode-build-server/${BUILD_ROOT_KEY}"
COMPILE_CACHE_FILE="$COMPILE_CACHE_DIR/compile_file-Pensive-${BUILD_ROOT_HASH}"
mkdir -p "$COMPILE_CACHE_DIR"
xcode-build-server parse \
  -s "$BUILD_ROOT" \
  -o "$COMPILE_CACHE_FILE" \
  >/dev/null

echo "✅ SourceKit build-server configuration written to $IOS_DIR/buildServer.json"
echo "✅ SourceKit compiler cache refreshed for app and iOS test targets"
echo "Open Pensive.xcodeproj (scheme Pensive), then reload the editor's Swift/SourceKit extension."
