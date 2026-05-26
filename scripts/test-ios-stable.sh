#!/usr/bin/env bash
set -euo pipefail

SCHEME="${SCHEME:-Pensive}"
DEVICE="${DEVICE:-iPhone 17}"
DERIVED_DATA="${DERIVED_DATA:-/private/tmp/PensiveDerivedData}"
WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$WORKDIR"

echo "==> 0/5 Backend live-route precheck"
npm run convex:deployments
curl -i https://marvelous-fish-603.convex.site/api/auth/session >/tmp/pensive-auth-session-check.out
if ! rg -q "200" /tmp/pensive-auth-session-check.out; then
  echo "Backend auth route check failed. See /tmp/pensive-auth-session-check.out"
  exit 1
fi

echo "==> 1/5 Generating project"
xcodegen generate

echo "==> 2/5 Simulator preflight (${DEVICE})"
xcrun simctl shutdown "$DEVICE" || true
xcrun simctl erase "$DEVICE"
xcrun simctl boot "$DEVICE"
xcrun simctl bootstatus "$DEVICE" -b

echo "==> 3/5 Build sanity"
xcodebuild -scheme "$SCHEME" \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED_DATA" \
  build

echo "==> 4/5 Unit tests (sequential, stable flags)"
xcodebuild -scheme "$SCHEME" \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath "$DERIVED_DATA" \
  -parallel-testing-enabled NO \
  -maximum-parallel-testing-workers 1 \
  -only-testing:PensiveTests test

echo "==> 5/5 UI tests (sequential, stable flags)"
xcodebuild -scheme "$SCHEME" \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath "$DERIVED_DATA" \
  -parallel-testing-enabled NO \
  -maximum-parallel-testing-workers 1 \
  -only-testing:PensiveUITests test

echo "✅ iOS stable test flow complete"
