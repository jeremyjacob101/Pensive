<p align="center">
  <img src="docs/images/pensive-logo.svg" alt="Pensive icon" width="140">
</p>

<h1 align="center">Pensive</h1>

<p align="center">
  A personal finance ledger that tracks what comes in, what goes out, and what comes back.
</p>

<p align="center">
  <img alt="App version 1.0.0" src="https://img.shields.io/badge/App-1.0.0-0F766E?style=for-the-badge">
  <img alt="iOS 17 or newer" src="https://img.shields.io/badge/iOS-17%2B-111827?style=for-the-badge&logo=apple&logoColor=white">
  <img alt="Swift 5" src="https://img.shields.io/badge/Swift-5-F05138?style=for-the-badge&logo=swift&logoColor=white">
  <img alt="React 19.2.6" src="https://img.shields.io/badge/React-19.2.6-0F172A?style=for-the-badge&logo=react&logoColor=61DAFB">
  <img alt="TypeScript 6.0.2" src="https://img.shields.io/badge/TypeScript-6.0.2-1D4ED8?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="Vite 8.0.12" src="https://img.shields.io/badge/Vite-8.0.12-111827?style=for-the-badge&logo=vite&logoColor=FBBF24">
  <img alt="Convex 1.39.1" src="https://img.shields.io/badge/Convex-1.39.1-EE342F?style=for-the-badge&logo=convex&logoColor=white">
</p>

> Spreadsheets grow unwieldy, budgeting apps lock data in, and split payments between friends
> are never quite settled. Pensive holds the full picture—income, expenses, paybacks, recurring
> bills, and freeform notes—with the same data available wherever you need it.

<p align="center">
  <a href="https://github.com/jeremyjacob101/Pensive"><strong>Take me there →</strong></a>
</p>

## Overview

Pensive is a personal finance tracking application with two native-feeling clients: a React web app and a SwiftUI iPhone app. Both use one Convex backend, one account, and one synchronized collection of financial data.

Instead of juggling multiple spreadsheets or being locked into a single app's export format, Pensive tracks expenses and incomings, links them together for reimbursement tracking, manages recurring bills and paychecks with automatic monthly materialization, and provides a freeform notepad for notes and tables. Every entry is searchable, filterable, and available across devices.

## Why This Exists

A shared meal, a monthly subscription, a freelance invoice, a loan to a friend—personal finance is rarely as simple as a single account balance.

Pensive is designed to handle that complexity without the spreadsheet tax:

- log expenses with categories, subcategories, accounts, and multi-month split allocation
- record income with type and subtype classification
- link expenses to specific incomings for payback and reimbursement tracking with effective-amount recomputation
- set up recurring bills and paychecks that materialize automatically on a daily cron
- view monthly breakdowns with raw and effective amounts, net balances, and proportional allocation
- track payment status across categories and types with color-coded monthly grids
- take structured notes and build inline tables in the notepad workspace
- customize account, category, and type lists with auto-assigned distinct colors
- search across titles, payees, categories, amounts, links, and notes
- permanently delete the complete account and its associated data from either client

## Highlights

- Shared username-and-password authentication across web and iOS.
- Per-user Convex data isolation for every query and mutation.
- Multi-month expense and income allocation via month-year arrays; proportional amount splitting across partial months.
- Payback link system that connects expenses to incomings and recomputes effective amounts with over-allocation warnings.
- Recurring transaction engine with daily GitHub Actions cron (1 AM UTC, Asia/Jerusalem timezone) that materializes due expenses and incomings.
- Search across titles, payees, accounts, categories, amounts, links, and notes.
- Breakdown and summary views with bar charts, pie charts, and month-by-month tables.
- Tracking dashboard with paid/unpaid status by category and income type per month.
- Notepad with structured notes (title + content) and editable tables (add/remove rows and columns).
- User options manager with auto-generated distinct colors using CIELAB color distance.
- Bulk create and patch-visible operations for batch editing.
- Dark mode toggle persisted across sessions.
- Keychain-backed iOS session storage.
- Complete account deletion covering expenses, incomings, recurrings, payback links, options, notepad workspaces, sessions, refresh tokens, and authentication records.

## Platform Snapshot

Pensive has three connected layers:

1. **Web** — React 19 + TypeScript + Vite, deployed on Vercel with SPA rewrites.
2. **iOS** — SwiftUI for iOS 17 and newer, with protocol-based API client architecture, Keychain-backed auth storage, and Combine-driven state.
3. **Backend** — Convex queries, mutations, authentication, HTTP API, and synchronized storage shared by both clients.

```text
Web app ───────┐
               ├── Convex Auth ── Shared user account
iOS app ───────┘       │
                       └── Shared ledger, recurrings, notes, and account lifecycle
```

## Privacy by Design

- Only the data a user chooses to save (expenses, incomings, recurrings, notes, options) is sent to Convex.
- No advertising, tracking, or third-party analytics SDKs.
- Passwords are stored as secure hashes rather than plaintext.
- iOS session credentials are stored in Apple's Keychain.
- Account deletion is available inside both apps and removes all associated cloud data.

## Run Locally

### Shared Convex Backend

From the repository root:

```bash
npm install
npm run convex:dev
```

This creates or connects the Convex development deployment and generates the shared API types.

### Development database mock data

The development-only seed runner replaces all application data in the configured Convex development deployment with deterministic synthetic data. It preserves auth users and credentials so the existing development login continues to work. The default `realistic` profile creates thousands of expenses, hundreds of incomings, grouped/bulk rows, recurring templates, large one-time purchases, multi-month bills, internal transfers, partial and multi-expense paybacks, savings history, and notepad content. The `stress` profile creates a substantially larger dataset for pagination and performance checks.

The runner refuses to execute unless `.env.local` contains a `CONVEX_DEPLOYMENT` beginning with `dev:`. It always targets that development deployment and prints a replacement warning before it starts.

```bash
# Replace all development application data using the primary dev user automatically.
npm run dev:db:seed

# Optional larger dataset.
npm run dev:db:seed -- --profile stress

# Optional overrides for a different user or deterministic seed endpoint.
npm run dev:db:seed -- \
  --user-id <development-user-id> \
  --seed 20260818 \
  --as-of 2026-08-18
```

The internal seed functions are pushed to the dev deployment by the runner before they execute. The replacement clears application records for every user, then creates the mock dataset for the selected user; auth users and credentials remain intact. Do not substitute `--prod`, a staging deployment, or a production deployment for the runner’s fixed `--deployment dev` target.

### Production Schema Checkpoints

Production promotion is staging-first. Feature branches merge into `staging`; production is advanced only by the manually dispatched `Promote Staging to Main` workflow. That workflow verifies the exact staging commit, detects changes to `convex/schema.ts`, and—only for schema changes—exports production, stores the ZIP in production Convex File Storage, records it in `backupSnapshots`, imports it into the disposable staging deployment, and runs forward and backward compatibility contracts. If every check passes, the workflow advances `main` to that exact tested staging commit and deploys production. Non-schema promotions skip the snapshot and compatibility work.

Protect `main` in GitHub with a branch ruleset: disable normal pushes, force-pushes, and deletions, and allow only the GitHub Actions identity used by the promotion workflow to update it. Do not require a PR into `main`; the promotion workflow is the protected update path. This is what guarantees `main` cannot move before the pipeline passes. The existing `main → staging` sync then keeps the Git branch and staging deployment aligned after promotion. A direct push that bypasses this repository rule is not a supported production path.

The production GitHub environment needs its existing `CONVEX_DEPLOY_KEY`, and the staging GitHub environment needs its existing staging `CONVEX_DEPLOY_KEY`. No preview deploy key is needed. The staging deployment is overwritten during compatibility runs, so its data is intentionally disposable.

The `hotfix` branch is disposable. Every successful `main` update resets it to exactly the same commit, intentionally discarding any unpromoted hotfix work. It is created automatically on the first successful main update and is kept current by `Reset Hotfix to Main`.

For an emergency code-only fix, commit to `hotfix`, then run `Promote Hotfix to Main` from GitHub Actions. It verifies that `hotfix` contains current `main`, rejects any `convex/schema.ts` change, runs typecheck/build/lint, and only then advances `main` and deploys production. Schema changes must go through the normal staging promotion workflow.

When installing this system for the first time, manually export production once before deploying the new `backupSnapshots` schema and functions:

```bash
npx convex export --prod --path /tmp/pensive-bootstrap-snapshot.zip
```

After that bootstrap deployment, future staging-to-main promotions that change `convex/schema.ts` are protected automatically.

To list stored production checkpoints from the CLI:

```bash
npx convex run backupSnapshots:list '{"limit":50}' --prod
```

### Web App

```bash
cd "Codebase - Pensive Web"
npm install
npm run dev
```

The Vite app reads `VITE_CONVEX_URL` from its environment configuration and serves on port 1111.

Build the production bundle:

```bash
npm run build
```

### iOS App

Requirements:

- Xcode 26 or newer
- iOS 17 deployment target or newer

Generate the Xcode project and open it:

```bash
cd "Codebase - Pensive iOS"
xcodegen generate
open Pensive.xcodeproj
```

The app reads its Convex URL from xcconfig build settings defined in `Config/`, ensuring that it connects to the same deployment as the web client.

If VS Code/SourceKit reports `No such module 'XCTest'` in a file under `PensiveUnitTests`, configure the Xcode build server from the repository root and reload the editor:

```bash
./scripts/configure-ios-sourcekit.sh
```

`XCTest` is supplied by the iOS SDK; it should not be installed as a package dependency. The script regenerates the XcodeGen project and gives SourceKit the test-target build settings it needs.

### Test Suite

From the repository root:

```bash
npm test                  # deterministic web + Convex behavior tests
npm run test:static       # formatting, lint, typechecks, and web build
npm run test:e2e          # browser/API tests; requires explicit disposable targets
npm run ios:test          # iOS unit, API integration, and fixture-backed UI tests
npm run test:all          # complete local sequence
```

The Convex tests use an in-memory database. Browser tests require `PENSIVE_E2E_API_URL` and `PENSIVE_E2E_CONVEX_URL` for a disposable non-production deployment; the web bundle itself runs locally. iOS UI tests use loopback fixtures, and live iOS checks are opt-in with an explicit non-production URL. Production URLs are rejected by the test harness. Coverage is generated only as a temporary CI/local report under `test-results/` (ignored by Git); it is not committed or deployed.

## Shared Account Deletion

Both clients call the same authenticated Convex mutation:

```text
account:deleteMine
```

The mutation atomically removes:

- payback links, expenses, incomings, recurrings, user options, and notepad workspaces
- verification codes and verification records tied to the account
- active sessions, refresh tokens, and session verifiers
- the final user record

Local credentials are cleared only after the server confirms deletion.

## Project Tour

```text
.
├── convex/                              Shared schema, auth, HTTP API, queries, and mutations
│   ├── schema.ts                        Expense, incoming, recurring, payback, options, notepad tables
│   ├── http.ts                          REST API router (~50 endpoints)
│   ├── auth.ts / auth.config.ts         Convex Auth with Password provider
│   ├── expenses.ts / incomings.ts       CRUD queries and mutations
│   ├── recurrings.ts                    Recurring CRUD + materializeDueExpenses cron
│   ├── summaries.ts                     Monthly aggregation query
│   ├── tracking.ts                      Payment-status tracking queries
│   ├── paybackLinks.ts / paybackHelpers.ts  Expense–incoming link system
│   ├── userOptions.ts                   Customizable option lists with color assignment
│   ├── notepad.ts                       Notes + tables CRUD
│   ├── account.ts                       Complete account deletion
│   └── monthYears.ts / effectiveAmounts.ts / baseSubIds.ts  Shared utilities
├── Codebase - Pensive Web/              React + TypeScript + Vite client
│   ├── public/                          Favicon and logo assets
│   ├── src/
│   │   ├── App.tsx                      Entry point with Convex + Auth + routing
│   │   ├── pages/                       Expenses, Incomings, Breakdown, Tracking,
│   │   │                                Recurrings, Notepad, Options, LoginPage, AppLayout
│   │   ├── components/                  14 reusable UI components
│   │   ├── hooks/                       6 custom React hooks
│   │   ├── helpers/                     13 utility modules
│   │   ├── types/                       15 TypeScript type definition files
│   │   ├── context/                     Auth context and hook
│   │   ├── keys/                        localStorage key constants
│   │   └── routes/                      AppRoutes with ProtectedRoute / PublicOnlyRoute
│   └── config/                          Vite, TypeScript, ESLint, and Prettier configuration
├── Codebase - Pensive iOS/              SwiftUI iPhone app
│   ├── Pensive/
│   │   ├── App/                         PensiveApp, AppContainer, RootView
│   │   ├── Domain/                      Auth state, ledger models, options logic
│   │   ├── Data/                        ConvexAPI client, DTOs, session store
│   │   ├── Infrastructure/              Environment config, auth token store, filter persistence
│   │   ├── Networking/                  HTTP transport, URLSession client
│   │   └── Presentation/                Auth, Breakdown, Ledger, Notepad, Options,
│   │                                    QuickAdd, Recurrings, Shell, Tracking, User modules
│   ├── PensiveUnitTests/                Domain and API model unit tests
│   ├── PensiveIntegrationTests/         HTTP transport and non-production API contracts
│   ├── PensiveE2ETests/                 Fixture-backed UI workflows
│   └── project.yml                      XcodeGen source of truth
├── scripts/                             iOS tests, schema checkpoints, and compatibility contracts
├── docs/images/                         README artwork
├── .github/workflows/                   Staging deploy, promotion, branch sync, and recurring cron
├── vercel.json                          Vercel SPA deployment config
└── README.md
```

### Key Files

- `convex/schema.ts` defines the expense, incoming, recurring, payback-link, user-options, and notepad tables alongside auth tables.
- `convex/http.ts` implements the full REST HTTP API with ~50 endpoints for auth, CRUD, summaries, tracking, and account management.
- `convex/account.ts` implements complete shared account deletion.
- `convex/expenses.ts` and `convex/incomings.ts` enforce per-user access and payload validation.
- `convex/recurrings.ts` contains the materialization logic that creates due expenses and incomings on a daily cron schedule.
- `convex/paybackLinks.ts` and `convex/paybackHelpers.ts` implement the expense–incoming link system with effective-amount recomputation.
- `convex/summaries.ts` provides the monthly aggregation that powers the Breakdown view.
- `convex/tracking.ts` computes paid/unpaid status per category and income type for the Tracking view.
- `Codebase - Pensive Web/src/pages/Expenses.tsx` contains the main expense ledger UI (the largest page at ~1525 lines).
- `Codebase - Pensive Web/src/pages/Breakdown.tsx` contains the summary charts and breakdown tables.
- `Codebase - Pensive Web/src/components/CategoryPieChart.tsx` and `RangePieChartPanel.tsx` contain the visualization components.
- `Codebase - Pensive iOS/Pensive/Domain/Auth/AuthState.swift` owns iOS authentication state management.
- `Codebase - Pensive iOS/Pensive/Data/API/ConvexAPI.swift` defines the protocol-based Convex API client with DTOs.
- `Codebase - Pensive iOS/Pensive/Networking/ConvexTransport.swift` implements the HTTP transport layer.

## App Store Preparation

- App version: `1.0.0`
- Build: `1`
- Bundle identifier: `com.pensive.app`
- Minimum iOS version: `17.0`
- Device family: iPhone and iPad
- In-app account deletion: included
- Keychain-based session storage: configured

Before release, upload a signed archive to TestFlight, complete App Privacy responses, provide a reviewer demo account, add screenshots and support metadata, and publish a privacy-policy URL in App Store Connect.

## Current Limitations

- Username/password recovery is not yet available.
- A live Convex connection is required to read or change the synchronized ledger.
- iOS notifications for upcoming recurring bills are not yet implemented.

## Links

- Repository: https://github.com/jeremyjacob101/Pensive
- License: [MIT](LICENSE.md)

## License

Pensive is available under the MIT License. The copyright
year is updated automatically each January while preserving 2026 as the
project's original year.

See the [LICENSE](LICENSE.md) file for the full text.

## Notes for Contributors

- Keep the Convex contract compatible with both clients.
- Treat account deletion as a cross-platform data-lifecycle feature; test it from web and iOS after any auth-schema change.
- Regenerate the Xcode project after editing `project.yml` or adding iOS source files.
- Validate UI changes on desktop web, mobile web, and a physical iPhone when camera or keyboard behavior is involved.
- The recurrings cron runs at 1 AM UTC daily (Asia/Jerusalem timezone); test materialization locally before deploying schema changes to the recurrings table.
