# Date Logic (Month / Range / Pie) — Swift Parity Spec

This doc defines the expected behavior for date scope selection and pie-chart math, including entries that span multiple months.

## 1) Core concepts
- `date`: actual transaction date (`YYYY-MM-DD`).
- `monthYears`: logical applied months (`["YYYY-MM", ...]`).
- `effectiveAmount`: amount used for analytics/allocation (fallback to `amount` if missing).
- A row can be **dated in one month** but **applied to other month(s)** via `monthYears`.

## 2) Scope modes

### A) Month mode
- Scope starts on newest available month (or current month if none).
- Active scope month list is `targetMonths` (descending, e.g. `2026-05, 2026-04, ...`).
- Date window is min/max across selected months:
  - `startDate = earliest selected month start`
  - `endDate = latest selected month end`
- “Load previous month” appends one older month unless already at oldest bound.

### B) Custom range mode
- User picks `startDate` + `endDate`.
- `targetMonths = all calendar months touched by the date range` (inclusive).
- Example: `2026-01-15` → `2026-03-02` => `targetMonths = [2026-01, 2026-02, 2026-03]`.

## 3) Which rows are included
For expenses and incomings, include row if either condition is true:
1. `date` is between `startDate...endDate` (inclusive), OR
2. row has overlap with `targetMonths` in `monthYears`.

This is critical for cross-month rows (e.g. paid in June, applied partly to May).

## 4) Pie contribution rule (important)
For each included row:
1. `rowMonths = monthYears`.
2. `monthCount = max(1, rowMonths.count)`.
3. `matchingMonths = rowMonths ∩ targetMonths`.
4. If `matchingMonths` is empty: contributes `0` to pie.
5. Otherwise:
   - `perMonth = effectiveAmount / monthCount`
   - `contribution = perMonth * matchingMonths.count`
6. Add `contribution` into category (or subcategory when toggled).

So pie is always proportional by month overlap, not full-row amount unless fully matched.

## 5) Display/UX expectations
- Same row may appear with partial value in scoped views if only some of its `monthYears` are in scope.
- Partial indicator rule: `matchingMonths.count < monthCount`.
- Month format validation: strict `^\d{4}-(0[1-9]|1[0-2])$`.
- Sort month keys lexicographically for chronology (`YYYY-MM` works naturally).

## 6) Canonical examples
1. **Single-month row**
   - `monthYears=[2026-05]`, `effectiveAmount=1200`, target includes `2026-05` => contributes `1200`.
2. **3-month spread, one month selected**
   - `monthYears=[2026-04,2026-05,2026-06]`, `effectiveAmount=900`, target=`[2026-05]` => `900/3*1 = 300`.
3. **3-month spread, two months selected**
   - target=`[2026-05,2026-06]` => `900/3*2 = 600`.
4. **Date-outside but month-overlap**
   - `date=2026-06-02`, `monthYears` includes `2026-05`, scope is May => row must be included.

## 7) Swift implementation checklist
- Build a single reusable `DateScope` model: `{ mode, startDate, endDate, targetMonths }`.
- Ensure fetching logic supports month overlap inclusion (not date-only filtering).
- Centralize pie math in one function shared by Expense/Incoming charts.
- Add unit tests for:
  - inclusive month generation from custom ranges,
  - overlap inclusion when date is outside range,
  - proportional contribution for 1/N and M/N matching months,
  - no-overlap => zero contribution.

