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
xcode-build-server config --build_root "$BUILD_ROOT" --scheme Pensive

echo "✅ SourceKit build-server configuration written to $IOS_DIR/buildServer.json"
echo "Open Pensive.xcodeproj (scheme Pensive), then reload the editor's Swift/SourceKit extension."
