# SIMULATOR.md

This is the canonical simulator/test runbook for this repo.
Use this exact flow in every future chat.

## 0) Default One-Command Flow (Preferred)

Run this first:
```bash
./scripts/test-ios-stable.sh
```

This script includes:
- Convex deployment binding check
- Live auth route check
- Project generation
- Simulator preflight
- Build sanity
- Sequential unit + UI tests with stable flags

If this succeeds, no additional manual steps are required.

## 0) Backend Live-Route Precheck (Required)

Run before simulator tests when auth/API behavior is under test:
```bash
npm run convex:deployments
curl -i https://marvelous-fish-603.convex.site/api/auth/session
```

Pass criteria:
- Deployment is `marvelous-fish-603 (dev)`.
- `curl` returns `200` with JSON body (not `404 No matching routes found`).

If backend `convex/` code changed:
```bash
npm run convex:deploy
```

## 1) One-Time Project Sync

Run:
```bash
xcodegen generate
```

Reason: ensures new files are actually in `Pensive.xcodeproj`.

## 2) Required Simulator Target

Always use:
- Device: `iPhone 17`
- Destination flag: `-destination 'platform=iOS Simulator,name=iPhone 17'`

Never use test destination `Any iOS Simulator Device`.

## 3) Stable Test Flags (Always)

Use these flags for all test runs:
- `-derivedDataPath /private/tmp/PensiveDerivedData`
- `-parallel-testing-enabled NO`
- `-maximum-parallel-testing-workers 1`

These avoid prior failures from:
- restricted write paths under `~/Library/Developer/Xcode/DerivedData`
- test runner collisions
- simulator preflight instability

## 4) Proactive Preflight (Run Before Every Test Session)

Run this before unit/UI tests to avoid known first-run failures:
```bash
xcrun simctl shutdown 'iPhone 17' || true
xcrun simctl erase 'iPhone 17'
xcrun simctl boot 'iPhone 17'
xcrun simctl bootstatus 'iPhone 17' -b
```

Reason: reduces `SBMainWorkspace ... Busy (Application failed preflight checks)` flakiness and makes first run deterministic.

## 5) Canonical Commands (Manual Fallback)

Build sanity:
```bash
xcodebuild -scheme Pensive \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/PensiveDerivedData \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  build
```

Required unit tests:
```bash
xcodebuild -scheme Pensive \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath /private/tmp/PensiveDerivedData \
  -parallel-testing-enabled NO \
  -maximum-parallel-testing-workers 1 \
  -only-testing:PensiveTests test
```

Required UI smoke test:
```bash
xcodebuild -scheme Pensive \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath /private/tmp/PensiveDerivedData \
  -parallel-testing-enabled NO \
  -maximum-parallel-testing-workers 1 \
  -only-testing:PensiveUITests test
```

## 6) Codex Sandbox + Escalation Rule (Mandatory)

When running from Codex, simulator/Xcode operations can fail under sandbox constraints even when commands are correct.

Common symptom signatures:
- `CoreSimulatorService connection became invalid`
- `Unable to deliver request ... not connected to CoreSimulatorService`
- `DVTFilePathFSEvents` or simulator logging permission errors

Action:
- Immediately rerun the same `xcodebuild`/`simctl` command with escalated permissions in Codex.
- Do not change command flags first; preserve the canonical command from this document.
- Keep using `/private/tmp/PensiveDerivedData` and sequential test execution.

Recommended default in Codex:
- Run all `xcodebuild` and `simctl` commands with escalated permissions from the start.
- This avoids known CoreSimulator permission walls and reduces retry loops.

## 7) If Simulator Fails To Launch App (Preflight Busy)

Symptom usually includes:
- `SBMainWorkspace ... Busy (Application failed preflight checks)`

Recovery sequence:
```bash
xcrun simctl shutdown 'iPhone 17' || true
xcrun simctl erase 'iPhone 17'
xcrun simctl boot 'iPhone 17'
xcrun simctl bootstatus 'iPhone 17' -b
```

Then rerun the same test command with the stable flags above.

## 8) SweetPad Setup

This repo keeps SweetPad config in:
- `.vscode/settings.json`
- `.vscode/tasks.json`

Use the provided tasks directly for build/test runs to avoid drift.

## 9) Non-Negotiables

- Run unit and UI commands sequentially, not in parallel.
- Keep `iPhone 17` destination unless SWIFT.md explicitly changes it.
- Keep `/private/tmp/PensiveDerivedData` unless permissions model changes.
- Always run the proactive preflight sequence before test commands.
- For auth/API testing, always perform the backend live-route precheck first.
- If adding/removing files, rerun `xcodegen generate` before tests.
- If simulator tooling fails due to sandbox constraints, rerun with Codex escalation using the same command.
- In `.xcconfig`, never write raw `https://...` values directly; `//` is treated as a comment. Use `$(URL_SCHEME_HTTPS)$(URL_SLASH)$(URL_SLASH)...`.
