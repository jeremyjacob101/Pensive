# iOS Architecture Contract (Locked in Part 1)

This architecture is locked before implementation to prevent feature-by-feature drift.

## Module / Package Structure

- `App/` entrypoint and composition root.
- `Presentation/` SwiftUI views, feature coordinators, and view models.
- `Domain/` entities, use-cases, and business rules.
- `Data/` repositories, DTO translators, and data-source adapters.
- `Networking/` HTTP client, auth transport, retry policy, and request interceptors.
- `Infrastructure/` logging, persistence helpers, clocks, and platform adapters.
- `Resources/` assets, localized strings, and static design tokens.

## Layer Responsibilities

| Layer | Owns | Must not own |
| --- | --- | --- |
| `App/` | App lifecycle, root navigation shell, dependency graph wiring | Feature-specific business logic |
| `Presentation/` | View state, user-intent handling, navigation triggers | Raw HTTP calls, persistence details |
| `Domain/` | Business invariants, calculated rules, entity-level validation | UIKit/SwiftUI, transport logic |
| `Data/` | Repository implementations and mapping between Domain and API DTOs | UI composition |
| `Networking/` | Request execution, auth headers/session transport, retry/timeout behavior | Screen-specific state decisions |
| `Infrastructure/` | Cross-cutting utilities (logging, cache storage, date/currency formatters) | Feature policies |
| `Resources/` | Strings/assets/tokens | Runtime business logic |

## Dependency Direction (Strict)

- `App` can depend on all layers to wire composition.
- `Presentation` depends on `Domain` contracts and selected `Infrastructure` abstractions.
- `Domain` depends on no UI or networking implementation details.
- `Data` depends on `Domain`, `Networking`, and `Infrastructure`.
- `Networking` depends on `Infrastructure` only.
- `Resources` is consumed by `Presentation` and `App`.

## Feature-to-Layer Mapping

| Feature area | Domain use-cases (examples) | Data repositories (examples) |
| --- | --- | --- |
| Auth | `SignIn`, `SignOut`, `BootstrapSession` | `AuthRepository` using Convex auth routes |
| Expenses | `ListExpensesInScope`, `CreateExpense`, `LinkPartnerExpenses` | `ExpensesRepository`, `PaybackRepository` |
| Incomings | `ListIncomingsInScope`, `CreateIncoming`, `LinkPartnerIncomings` | `IncomingsRepository`, `PaybackRepository` |
| Recurrings | `ListRecurrings`, `UpsertRecurring`, `MaterializeDueRecurrings` | `RecurringsRepository` |
| Breakdown | `LoadSummaryRange` | `SummariesRepository` |
| Tracking | `LoadTrackingRows` | `TrackingRepository` |
| Notepad | `LoadWorkspace`, `SaveNote`, `SaveCell` | `NotepadRepository` |
| Options | `ListOptions`, `RenameOption`, `MoveSubtype`, `PromoteSubtype` | `UserOptionsRepository` |

## Cross-Cutting Standards (Locked)

### Currency

- Currency format is ILS (`he-IL`, `ILS`) for display.
- Storage and transport use numeric values from API payloads, never localized currency strings.
- Rounding rule is deterministic and centralized (single utility), with consistent behavior across list rows, detail views, and summary totals.

### Dates

- API/storage date format is ISO `yyyy-MM-dd`.
- UI display uses locale-formatted date strings.
- Parsing utility must normalize accepted legacy-style input (`M/D/YYYY`) into ISO before mutation calls.

### Month Key

- Canonical month key is `yyyy-MM`.
- Any month-based filter/control must emit only canonical month keys.

### Optimistic UI

- Optimistic updates are allowed only for low-risk local edits where rollback is trivial.
- Financial mutations (create/update/delete/link/unlink/allocate) are server-authoritative by default.

### Offline Mode (Phase 1)

- Read from last cached snapshot when available.
- Queueing of offline mutations is explicitly out of scope for phase 1.
- Mutations attempted while offline fail fast with actionable UI messaging.

### Accessibility Baseline

- Dynamic Type support for all primary text.
- VoiceOver labels on all interactive controls.
- Minimum hit area `44pt` for interactive elements.

### Localization Readiness

- All user-facing strings are extractable and centralized in localization resources.
- No hard-coded user-facing copy inside business or networking layers.

## Error Contract Strategy

- Preserve backend error semantics (`Unauthenticated`, `Not found`, validation errors) and map to typed domain errors.
- Presentation layer maps typed errors to user-readable copy and retry affordances.
- Unknown errors are logged via `Infrastructure` logger with request context IDs.

## Architecture Guardrails

- No direct `Networking` calls from SwiftUI views.
- No shared mutable global state for feature data.
- No feature may bypass repositories to patch cached models ad hoc.
- Any architecture change after Part 1 requires updating this document and parity matrix references in the same cycle.
