#!/usr/bin/env bash
set -euo pipefail

SCHEME="${SCHEME:-Pensive}"
DEVICE="${DEVICE:-iPhone 17}"
DERIVED_DATA="${DERIVED_DATA:-/private/tmp/PensiveDerivedData}"
RESET_SIMULATOR="${PENSIVE_RESET_SIMULATOR:-0}"
RUN_LIVE_CONTRACT="${PENSIVE_RUN_LIVE_IOS_CONTRACT:-0}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$REPO_ROOT/Codebase - Pensive iOS"

cd "$REPO_ROOT"

if [[ "$RUN_LIVE_CONTRACT" == "1" ]]; then
  LIVE_URL="${PENSIVE_IOS_TEST_HTTP_URL:-}"
  if [[ -z "$LIVE_URL" ]]; then
    echo "PENSIVE_IOS_TEST_HTTP_URL is required when PENSIVE_RUN_LIVE_IOS_CONTRACT=1" >&2
    exit 1
  fi
  LIVE_URL_LOWER="$(printf '%s' "$LIVE_URL" | tr '[:upper:]' '[:lower:]')"
  case "$LIVE_URL_LOWER" in
    *frugal-mosquito-712*|*production*|*prod*)
      echo "Refusing to run iOS live tests against a production-looking URL: $LIVE_URL" >&2
      exit 1
      ;;
  esac
  echo "==> 0/6 Non-production live-route precheck"
  curl --fail --silent --show-error "$LIVE_URL/api/auth/session" >/tmp/pensive-ios-auth-session-check.out
  node --input-type=module -e '
    import fs from "node:fs";
    const payload = JSON.parse(fs.readFileSync("/tmp/pensive-ios-auth-session-check.out", "utf8"));
    if (payload.ok !== true || payload.data?.authenticated !== false) {
      throw new Error("The configured iOS test target did not return an unauthenticated session envelope.");
    }
  '
else
  echo "==> 0/6 Live contract skipped (set PENSIVE_RUN_LIVE_IOS_CONTRACT=1 for disposable staging/test)"
fi

echo "==> 1/6 Generating project"
cd "$IOS_DIR"
xcodegen generate

AVAILABLE_DEVICES="$(xcrun simctl list devices available 2>/dev/null || true)"
if [[ -z "$AVAILABLE_DEVICES" ]]; then
  echo "No available iOS Simulator devices were found." >&2
  exit 1
fi
if ! printf '%s\n' "$AVAILABLE_DEVICES" | rg -q --fixed-strings "    $DEVICE ("; then
  DEVICE="$(printf '%s\n' "$AVAILABLE_DEVICES" | rg -o 'iPhone [^()]+' | sed 's/[[:space:]]*$//' | head -n 1 || true)"
fi
if [[ -z "$DEVICE" ]]; then
  echo "Could not select an iPhone Simulator device." >&2
  exit 1
fi

echo "==> 2/6 Simulator preflight (${DEVICE})"
xcrun simctl shutdown "$DEVICE" || true
if [[ "$RESET_SIMULATOR" == "1" ]]; then
  xcrun simctl erase "$DEVICE"
fi
xcrun simctl boot "$DEVICE" || true
xcrun simctl bootstatus "$DEVICE" -b

echo "==> 3/6 Build sanity"
xcodebuild -scheme "$SCHEME" \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED_DATA" \
  build

echo "==> 4/6 Unit tests"
xcodebuild -scheme "$SCHEME" \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath "$DERIVED_DATA" \
  -parallel-testing-enabled NO \
  -maximum-parallel-testing-workers 1 \
  -only-testing:PensiveUnitTests test

echo "==> 5/6 Integration/API contract tests"
xcodebuild -scheme "$SCHEME" \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath "$DERIVED_DATA" \
  -parallel-testing-enabled NO \
  -maximum-parallel-testing-workers 1 \
  -only-testing:PensiveIntegrationTests test

echo "==> 6/6 UI end-to-end tests"
xcodebuild -scheme "$SCHEME" \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath "$DERIVED_DATA" \
  -parallel-testing-enabled NO \
  -maximum-parallel-testing-workers 1 \
  -only-testing:PensiveE2ETests test

echo "✅ iOS unit, integration, and UI end-to-end test flow complete"
