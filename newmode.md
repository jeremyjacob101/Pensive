# New Scope Mode Spec (Web parity for iOS)

This is the exact behavior to replicate in Swift iOS.

## Goal
Use **one calendar button** (not separate tabs on screen) to control scope for expenses/incomings/pie:
- **Months mode** (applied-month logic)
- **Custom mode** (transaction-date logic)

For mobile UI, selecting a **start month + end month** is perfect.

---

## 1) Two scope modes

### A) Months mode (Applied Months)
Use this for budgeting/allocation view.

- User selects a month range (startMonth..endMonth), e.g. `2025-12` to `2026-05`.
- `targetMonths` = all months in that range (inclusive).
- Date window is derived from months:
  - `startDate = first selected month start` (YYYY-MM-01)
  - `endDate = last selected month end`
- Backend query must include overlap behavior:
  - include row if `date ∈ [startDate, endDate]` **OR** `row.monthYears` overlaps `targetMonths`.

### B) Custom mode (Date transactions only)
Use this for cashflow/date-truth view.

- User selects `startDate` and `endDate`.
- `targetMonths` may still be derived for display, but **do not use it for overlap inclusion**.
- Backend query must be strict:
  - include row only if `date ∈ [startDate, endDate]`.
  - no monthYears-overlap backfill.

---

## 2) Pie-chart calculation rules

### Months mode pie
For each included row:
1. `rowMonths = row.monthYears`
2. `monthCount = max(1, rowMonths.count)`
3. `matching = count(rowMonths ∩ targetMonths)`
4. if `matching == 0` => contribution `0`
5. else contribution = `effectiveAmount / monthCount * matching`

Aggregate contribution by category/subcategory.

### Custom mode pie
For each included row:
- contribution = full `effectiveAmount`
- no proration by monthYears

Aggregate by category/subcategory.

---

## 3) List amount display rules

### Months mode
- Row display amount uses same prorated formula as above.
- If only partially matched months: show it as partial (optional UI hint).

### Custom mode
- Row display amount = full `effectiveAmount`.
- No partial-month disclaimer needed.

---

## 4) Row mismatch disclaimers
Only in **Months mode**:
- if date outside range but monthYears overlaps: “applied this month/s, paid in different month”
- if date in range but monthYears does not overlap: “paid this month, applied to different month/s”

In **Custom mode**: do not show these (everything is date-based).

---

## 5) Header label behavior
Top label should reflect current scope:
- Months single: `May 2026`
- Months range: `Dec 2025 – May 2026` (short month names)
- Custom: existing date-range label formatting

---

## 6) Calendar-button UX for iOS (single entry point)
Use one calendar button that opens a sheet:

- Segmented control at top: `Months` | `Custom`
- `Months` panel:
  - Start month picker
  - End month picker
  - enforce start <= end
  - Apply
- `Custom` panel:
  - Start date picker
  - End date picker
  - enforce start <= end
  - Apply

Persist last used mode + values.

---

## 7) Defaults and persistence
- Default mode: `Months`
- Default months: current calendar month only
- Persist:
  - mode
  - selected start/end month (or explicit month list)
  - selected start/end date

---

## 8) API contract toggle (critical)
Your scope request should explicitly send whether month-overlap is enabled:
- Months mode: `includeMonthYearOverlapOutsideDate = true`
- Custom mode: `includeMonthYearOverlapOutsideDate = false`

This single flag is what makes the two modes mathematically different.

---

## 9) Test matrix (must pass)
1. **Months mode, single month**: matches prior applied-month behavior.
2. **Months mode, multi-month**: pie/list totals scale by matched month count.
3. **Months mode overlap**: row outside date but with monthYears overlap is included.
4. **Custom mode strictness**: outside-date rows are excluded even if monthYears overlaps.
5. **Custom mode full amounts**: no proration in pie/list.
6. **Header labels**: short month range renders correctly.

---

## 10) One-line mental model
- **Months = applied allocation truth**
- **Custom = transaction date truth**

