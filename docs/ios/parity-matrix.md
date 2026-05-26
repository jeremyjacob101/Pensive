# iOS Product Parity Matrix

Status values used in this matrix: `not-started`, `in-progress`, `done`, `verified`.

## Auth

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Email/password sign-in | Route `/login`; `convex/auth.ts`; `convex/http.ts` | Password auth provider; auth routes mounted via Convex HTTP router. | Native sign-in screen with email/password form calling Convex auth endpoints and surfacing auth failures inline. | `not-started` |
| Sign-out | Global auth session; `convex/auth.ts` (`signOut`) | Session can be terminated explicitly; user data is auth-gated. | Sign-out action in app shell clears session and returns user to login route replacement screen. | `not-started` |
| Auth-gated data access | `requireUserId` checks across `convex/*.ts` modules | All finance/notepad/tracking/options queries and mutations throw `Unauthenticated` without user session. | Root app state machine gates all tabs behind authenticated session and handles unauthenticated errors uniformly. | `not-started` |

## Navigation Shell

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Primary app destinations | Routes `/expenses`, `/incomings`, `/breakdown`, `/recurrings`, `/tracking`, `/notepad`, `/options` | Source app exposes these top-level areas as primary navigation surfaces. | `TabView`-based bottom navigation with tabs for Expenses, Incomings, Breakdown, Recurrings, Tracking, Notepad, Options. | `not-started` |
| Per-feature read/write boundaries | `convex/expenses.ts`, `convex/incomings.ts`, `convex/summaries.ts`, `convex/recurrings.ts`, `convex/tracking.ts`, `convex/notepad.ts`, `convex/userOptions.ts` | Each route is backed by dedicated module contracts and user-scoped data. | Each iOS tab binds to a dedicated feature module and ViewModel with no cross-tab hidden mutation side effects. | `not-started` |

## Expenses

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Paginated expense feed | Route `/expenses`; `convex/expenses.ts#list` | Descending by date; capped page size (`numItems <= 50`). | Infinite-scroll expense list sorted by date descending with same server pagination cap. | `not-started` |
| Date-scope querying with month overlap option | `/expenses`; `convex/expenses.ts#listByDateScope` | Date-range filter plus optional inclusion of rows outside date bounds when `monthYears` overlaps target months. | Scope controls support strict date range and overlap mode exactly matching backend behavior. | `not-started` |
| Month boundary discovery | `/expenses`; `convex/expenses.ts#monthBounds`, `#previousMonthBefore` | Finds oldest/newest month and previous available month before selected month. | iOS scope navigator uses same month-bound semantics for jump/back behavior. | `not-started` |
| Expense create/update normalization | `/expenses`; `convex/expenses.ts#create`, `#update`; `convex/monthYears.ts` | Date accepts ISO/US inputs, normalized to ISO; `monthYears` sanitized with fallback month from date. | Form submit normalizes dates and month keys identically before mutation submission. | `not-started` |
| Bulk create and clear | `/expenses`; `convex/expenses.ts#bulkCreate`, `#clearAll` | Multi-row insert; batched clear with configurable batch size; payback links removed when rows deleted. | iOS import and clear flows execute same bulk semantics and show deleted/remaining progress. | `not-started` |
| Bulk patch for visible rows | `/expenses`; `convex/expenses.ts#bulkPatchVisible` | Batch updates selected fields; trims strings; `null` clears optional text fields. | Multi-select edit sheet with explicit field patches and backend-equivalent null clearing behavior. | `not-started` |
| Partner grouping and shared labels | `/expenses`; `convex/expenses.ts#linkExistingExpenses`, `#addPartnerExpense`, `#unlinkExpenseFromPartners`, `#renameBaseExpense`, `#removeBaseExpense` | Supports base/sub grouping, sequence `subExpenseId` assignment, partner merge/unlink, and base-label rename/removal. | Card actions provide link/unlink/rename/remove partner workflows preserving base/sub ordering and labels. | `not-started` |
| Payback-aware deletion and effective amounts | `/expenses`; `convex/expenses.ts#remove`; `convex/paybackHelpers.ts` | Expense deletion removes related payback links and recomputes linked effective amounts. | Delete flow warns about linked paybacks and ensures post-delete balances refresh from server results. | `not-started` |

## Incomings

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Paginated incoming feed | Route `/incomings`; `convex/incomings.ts#list` | Descending by date; capped page size (`numItems <= 50`). | Infinite-scroll incoming list with identical sort/pagination behavior. | `not-started` |
| Date-scope querying with month overlap option | `/incomings`; `convex/incomings.ts#listByDateScope` | Mirrors expenses scoping plus optional month overlap inclusion. | Same dual-mode scope controls as expenses. | `not-started` |
| Month boundary discovery | `/incomings`; `convex/incomings.ts#monthBounds`, `#previousMonthBefore` | Oldest/newest months and previous available month discovery. | iOS month navigator behavior mirrors source logic. | `not-started` |
| Incoming create/update normalization | `/incomings`; `convex/incomings.ts#create`, `#update`; `convex/monthYears.ts` | Date normalization and `monthYears` sanitation/fallback from date. | Incoming editor uses same normalization rules pre-submit. | `not-started` |
| Bulk create and clear | `/incomings`; `convex/incomings.ts#bulkCreate`, `#clearAll` | Batch create and delete with linked payback cleanup. | Import/clear tooling preserves batch semantics and linked cleanup effects. | `not-started` |
| Bulk patch for visible rows | `/incomings`; `convex/incomings.ts#bulkPatchVisible` | Batch patch for type/subtype/account/payer/notes/comments with trim + null clearing. | Multi-select edit flow mirrors patch contract and partial update rules. | `not-started` |
| Partner grouping | `/incomings`; `convex/incomings.ts#addPartnerIncoming`, `#unlinkIncomingFromPartners` | base/sub partner linking with deterministic sequence IDs and unlink normalization. | Partner actions match source grouping semantics and ordering. | `not-started` |
| Payback-aware deletion and effective amounts | `/incomings`; `convex/incomings.ts#remove`; `convex/paybackHelpers.ts` | Incoming deletion removes links and recomputes linked effective amounts. | Delete flow refreshes linked balances and surfaces warnings if needed. | `not-started` |

## Recurrings

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Recurring list | Route `/recurrings`; `convex/recurrings.ts#list` | User-scoped descending list with pagination cap. | Recurrings screen uses same sorted paging behavior. | `not-started` |
| Kind-specific create/update validation | `/recurrings`; `convex/recurrings.ts#create`, `#update`, `validateRecurringFields` | Expense kind requires expense-field set; incoming kind requires incoming-field set; irrelevant kind fields cleared. | Kind toggle UI conditionally requires and submits correct fields only. | `not-started` |
| Status toggle | `/recurrings`; `convex/recurrings.ts#setStatus` | Supports `active`/`inactive` lifecycle state updates. | Inline status chip/toggle with identical allowed states. | `not-started` |
| Due materialization and idempotency | `/recurrings`; `convex/recurrings.ts#materializeDueExpenses` | For `runDate`, materializes due active recurrences into expenses/incomings, idempotent via automation key, records trigger timestamp in comments. | iOS admin/debug action surfaces materialization results (`matched`, `created`, `skipped`) and preserves idempotency assumptions. | `not-started` |
| Legacy cleanup/migration hooks | `/recurrings`; `convex/recurrings.ts#cleanupRecurringKindFields`, `#migrateLegacyRecurringsForUserIds` | Provides migration/cleanup pathways for old recurring shape fields. | iOS migration compatibility assumes these endpoints remain callable when needed for legacy users. | `not-started` |

## Breakdown

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Summary totals and monthly buckets | Route `/breakdown`; `convex/summaries.ts#range` | Computes raw/effective totals and monthly buckets for expenses/incomings with net values. | Breakdown dashboard displays raw vs effective totals and per-month trend data from identical query contract. | `not-started` |
| Effective amount fallback usage | `/breakdown`; `convex/summaries.ts`; `convex/paybackHelpers.ts#getEffectiveAmountFallback` | When effective amount missing, falls back to raw amount for calculations. | iOS summary rendering uses server-returned totals and does not recalculate with conflicting client logic. | `not-started` |

## Tracking

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Tracking rows from flagged options | Route `/tracking`; `convex/tracking.ts#list`; `convex/userOptions.ts#setTracking` | Builds tracked rows from options marked `isTracking` in category/subcategory/incomeType/incomeSubtype kinds. | Tracking screen reflects only explicitly tracked options from options management. | `not-started` |
| Paid/unpaid month timeline | `/tracking`; `convex/tracking.ts#list` | Computes `paidMonths`, range months, and `statusByMonth` based on expenses/incomings `monthYears` coverage. | iOS timeline grid renders month status exactly from backend row payload. | `not-started` |
| Label composition for subtype rows | `/tracking`; `convex/tracking.ts#list` | Subtype labels rendered as `parent / child`. | iOS row titles preserve same composed label format. | `not-started` |

## Notepad

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Workspace bootstrap/get | Route `/notepad`; `convex/notepad.ts#getMine`, `getOrCreateWorkspace` | User workspace lazily created; if absent, returns default table scaffold for rendering. | Notepad screen always opens with a usable default workspace without forcing separate setup action. | `not-started` |
| Notes add/rename/save/cleanup | `/notepad`; `convex/notepad.ts#addNote`, `#renameNote`, `#saveNoteContent`, `#cleanupEmptyNotes` | Notes can be added/renamed; empty content may be pruned; save creates note if missing and content non-empty. | Notes UX supports quick-add, rename, autosave, and empty-note cleanup parity. | `not-started` |
| Tables add/rename/delete | `/notepad`; `convex/notepad.ts#addTable`, `#renameTable`, `#deleteTable` | Multi-table workspace with titled tables and default 5x4 cell grids. | Table tabs/cards support create/rename/delete with same default dimension assumptions. | `not-started` |
| Cell editing and dimensions | `/notepad`; `convex/notepad.ts#saveCell`, `#addRow`, `#addColumn`, `#removeLastRow`, `#removeLastColumn` | Coordinate validation enforced; row/column mutations maintain at least 1 row and 1 column. | Spreadsheet-like editor enforces identical bounds and mutation behavior. | `not-started` |

## Options

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| List options by kind with colors/default/tracking | Route `/options`; `convex/userOptions.ts#list` | Returns all option kinds; deterministic color assignment when missing; includes default and tracking flags. | Options screen loads grouped lists with color chips, default marker, and tracking indicator parity. | `not-started` |
| Add option and subtype parent validation | `/options`; `convex/userOptions.ts#add`, `upsertOption` | Upsert by kind/value; subtype kinds require `parentValue`; max 250 options per kind. | Add dialogs enforce parent selection for subtypes and show limit errors from backend unchanged. | `not-started` |
| Update color | `/options`; `convex/userOptions.ts#updateColor` | Validates strict hex color format and updates exact row scope (kind/value/parent). | Color picker commits hex colors that satisfy backend regex and surfaces validation failures. | `not-started` |
| Remove option and cascaded subtype cleanup | `/options`; `convex/userOptions.ts#remove` | Deleting category/incomeType also deletes child subtype options with matching parent. | Remove flows warn about child-subtype cascade and refresh dependent lists. | `not-started` |
| Set default option | `/options`; `convex/userOptions.ts#setDefault` | Exactly one default per scope (global per kind, or per subtype parent scope). | iOS default toggles enforce same scoped uniqueness. | `not-started` |
| Set tracking flag | `/options`; `convex/userOptions.ts#setTracking` | Tracking only permitted for category/subcategory/incomeType/incomeSubtype; subtype requires parent. | Tracking switches limited to supported kinds and parent-scoped subtype rows. | `not-started` |
| Rename with downstream propagation | `/options`; `convex/userOptions.ts#rename` | Renames options and propagates to expenses/incomings/recurrings and relevant subtype parents. | Rename flow warns about cascading impacts and expects immediate reflected changes across feature screens. | `not-started` |
| Move top-level option into subtype | `/options`; `convex/userOptions.ts#moveToSubtype` | Converts category/incomeType to subtype under target parent and migrates affected rows. | iOS action sheet supports safe convert-to-subtype workflow with cascade updates. | `not-started` |
| Promote subtype to top-level | `/options`; `convex/userOptions.ts#promoteSubtype` | Lifts subtype to top-level category/incomeType and rewrites affected rows to new parent model. | Promote action preserves tracking intent and migrates dependent records. | `not-started` |
| Move subtype between parents | `/options`; `convex/userOptions.ts#moveSubtype` | Changes subtype parent and rewrites dependent expense/incoming/recurring parent values. | Parent-change workflow prevents duplicates at destination and mirrors cascade behavior. | `not-started` |

## Global Search / Filter / Scope Controls

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Month key canonical format | Shared helpers; `convex/monthYears.ts` | Valid month key regex: `yyyy-MM`; invalid entries dropped; fallback month inferred from date when needed. | Shared iOS formatter/parser uses the same canonical month-key contract and fallback rules. | `not-started` |
| Date normalization contract | `convex/expenses.ts`, `convex/incomings.ts`, `convex/monthYears.ts` | Accepts `yyyy-MM-dd` and `M/D/YYYY` inputs; stores/uses normalized ISO date strings. | Date fields normalize to ISO before submit while displaying locale-formatted values in UI. | `not-started` |
| Scope overlap behavior | `convex/expenses.ts#listByDateScope`, `convex/incomings.ts#listByDateScope` | Optional inclusion of out-of-range rows if their `monthYears` intersects target scope months. | Scope controls include explicit "include month overlap" option with identical semantics. | `not-started` |
| Candidate limits for quick linkage | `convex/paybackLinks.ts#listIncomingCandidates`, `#listExpenseCandidates` | Link candidate lists capped to most recent 200 entries by date. | Selector sheets for payback linking apply same result limits and sort order. | `not-started` |

## Error / Loading / Empty States

| Feature | Source location (page/component/module) | Behavior summary (source web + Convex) | iOS target behavior | Status |
| --- | --- | --- | --- | --- |
| Unauthenticated errors | All protected modules via `requireUserId` | Operations throw `Unauthenticated` when no session exists. | Global error handler routes to auth flow and presents non-destructive retry affordance. | `not-started` |
| Not-found and validation errors | `convex/expenses.ts`, `convex/incomings.ts`, `convex/recurrings.ts`, `convex/notepad.ts`, `convex/paybackLinks.ts`, `convex/userOptions.ts` | Throws domain-specific errors for missing records, invalid coordinates, duplicate names, invalid color, etc. | iOS maps server errors to user-friendly inline/toast messaging with no silent failure. | `not-started` |
| Empty-state defaults | `convex/notepad.ts#getMine`; list queries across modules | Notepad returns default table scaffold when no saved workspace; list queries may return empty arrays/pages. | Each screen defines explicit empty-state copy and first-action CTA while honoring server defaults. | `not-started` |
| Loading and optimistic behavior boundary | Part 1 standards from `SWIFT.md` | Optimistic updates are allowed only where safe; otherwise server-authoritative refresh required. | iOS interaction model uses optimistic updates for low-risk local edits only and server truth for financial mutations. | `not-started` |
