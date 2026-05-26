# Web-to-iOS UX Mapping (Locked)

This document locks migration-time UX transformations from source web behavior to native iOS behavior.

## Core Transform Decisions

| Web pattern | iOS replacement (locked) | Why this is locked |
| --- | --- | --- |
| Left menu rail | `TabView` bottom tabs | Native, thumb-reachable primary navigation pattern on iPhone; matches Part 1 mandate. |
| Dense row layouts | Card stacks with expandable details | Preserves information density while meeting mobile readability and touch-target needs. |
| Right-docked actions | Navigation bar toolbar actions + modal sheets | Maps desktop side actions to iOS-standard command surfaces. |
| Hover interactions | Explicit tap controls (buttons, disclosure, context menus) | iOS has no hover dependency; all critical actions must be explicit. |
| Drag interactions | Long-press + context actions/sheets | Replaces desktop drag affordances with discoverable touch-first actions. |

## Screen-Level Mapping

| Source route | Source interaction model | iOS target structure |
| --- | --- | --- |
| `/login` | Standalone auth form | Dedicated auth stack with email/password inputs, submit action, and inline error state. |
| `/expenses` | Dense table/list with scoped filters and partner actions | Card list + scope header + batch action mode; detail/edit in sheet. |
| `/incomings` | Dense table/list mirroring expenses patterns | Card list + scope header + batch action mode; detail/edit in sheet. |
| `/breakdown` | Summary/charts panel | Scrollable dashboard cards (totals, monthly buckets, chart blocks). |
| `/recurrings` | Row list with status and form editing | Sectioned list by status with add/edit sheets and validation prompts. |
| `/tracking` | Timeline-style tracking matrix | Horizontal month chips + vertically grouped tracked items with paid/unpaid state chips. |
| `/notepad` | Notes/tables workspace | Segmented control for Notes/Tables; note editor and table editor with row/col actions. |
| `/options` | Taxonomy manager with move/promote/rename/color actions | Grouped lists by kind with row-level context actions and dedicated move/promote sheets. |

## Interaction Mapping Rules

| Interaction area | Web behavior to preserve | iOS implementation rule |
| --- | --- | --- |
| Bulk edits (expenses/incomings) | Multi-row patch operations on visible scope | Use explicit selection mode with bottom action bar; no hidden gestures required. |
| Partner linking | Grouping entries via shared base/sub IDs | Use long-press context menu (`Link`, `Unlink`, `Rename Group`, `Remove Group`). |
| Payback link management | Link expense/incoming pairs and allocate amounts | Use dedicated link sheet with searchable candidate pickers and allocation warnings. |
| Recurring materialization trigger | Manual/automation-like run by date | Expose debug/admin action in recurrence area, behind confirmation dialog. |
| Option hierarchy transforms | Move to subtype, promote subtype, move subtype parent | Use guided sheets with pre-validation and explicit confirmation because data cascades. |

## Visual Density + Readability Rules

- Financial rows default collapsed and expand to show secondary metadata (`notes`, `comments`, `monthYears`, partner IDs).
- Primary amount + effective amount are always visible in row summary.
- Critical mutation actions (`delete`, `remove group`, `clear`) require confirmation.
- All tap targets for primary actions and row controls must be at least `44pt`.

## States Mapping

| State type | iOS rule |
| --- | --- |
| Loading | Skeleton or progress indicator per screen section; no blocking spinner for full app unless session bootstrap. |
| Empty | Friendly empty-state copy + one primary CTA relevant to that screen. |
| Error | Inline message near action context plus optional retry action; auth errors route back to sign-in shell. |
| Success | Lightweight confirmation (toast/banner) only for destructive or non-obvious operations. |

## Non-Negotiable Part 1 UX Contracts

- No hover-only affordance is allowed for any required action.
- No drag-and-drop dependency is allowed for options taxonomy operations.
- No action may depend on persistent right-side panel presence.
- No financial mutation is considered complete until server confirmation is received.
