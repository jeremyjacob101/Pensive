import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

type TrackingKind =
  | "category"
  | "subcategory"
  | "incomeType"
  | "incomeSubtype";

const TRACKING_KINDS: TrackingKind[] = [
  "category",
  "subcategory",
  "incomeType",
  "incomeSubtype",
];

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const match = month.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const year = Number.parseInt(match[1], 10);
  const monthNum = Number.parseInt(match[2], 10) - 1;
  const totalMonths = year * 12 + monthNum + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
}

function getMonthsBetween(start: string, end: string): string[] {
  if (!MONTH_PATTERN.test(start) || !MONTH_PATTERN.test(end)) return [];
  if (start > end) return [];
  const months: string[] = [];
  let current = start;
  while (current <= end) {
    months.push(current);
    current = shiftMonth(current, 1);
  }
  return months;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const currentMonth = getCurrentMonth();

    const [categoryRows, subcategoryRows, incomeTypeRows, incomeSubtypeRows] =
      await Promise.all(
        TRACKING_KINDS.map((kind) =>
          ctx.db
            .query("userOptions")
            .withIndex("by_user_kind", (q) =>
              q.eq("userId", userId).eq("kind", kind))
            .collect()),
      );

    const trackedOptions = [
      ...categoryRows
        .filter((row) => (row as { isTracking?: boolean }).isTracking === true)
        .map((row) => ({
          kind: "category" as const,
          value: row.value,
          parentValue: "",
          color: (row as { color?: string }).color ?? "#6B7280",
        })),
      ...subcategoryRows
        .filter((row) => (row as { isTracking?: boolean }).isTracking === true)
        .map((row) => ({
          kind: "subcategory" as const,
          value: row.value,
          parentValue: (row as { parentValue?: string }).parentValue ?? "",
          color: (row as { color?: string }).color ?? "#6B7280",
        })),
      ...incomeTypeRows
        .filter((row) => (row as { isTracking?: boolean }).isTracking === true)
        .map((row) => ({
          kind: "incomeType" as const,
          value: row.value,
          parentValue: "",
          color: (row as { color?: string }).color ?? "#6B7280",
        })),
      ...incomeSubtypeRows
        .filter((row) => (row as { isTracking?: boolean }).isTracking === true)
        .map((row) => ({
          kind: "incomeSubtype" as const,
          value: row.value,
          parentValue: (row as { parentValue?: string }).parentValue ?? "",
          color: (row as { color?: string }).color ?? "#6B7280",
        })),
    ];

    const [expenseRows, incomingRows] = await Promise.all([
      ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("incomings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const rows = trackedOptions.map((tracked) => {
      const paidMonthSet = new Set<string>();
      const source = tracked.kind === "category" || tracked.kind === "subcategory"
        ? "expense"
        : "incoming";

      if (source === "expense") {
        for (const expenseRow of expenseRows) {
          const matchesTrackedRow =
            tracked.kind === "category"
              ? expenseRow.category === tracked.value
              : expenseRow.category === tracked.parentValue &&
                (expenseRow.subcategory ?? "") === tracked.value;
          if (!matchesTrackedRow) continue;
          for (const month of expenseRow.monthYears ?? []) {
            const trimmed = month.trim();
            if (MONTH_PATTERN.test(trimmed)) paidMonthSet.add(trimmed);
          }
        }
      } else {
        for (const incomingRow of incomingRows) {
          const matchesTrackedRow =
            tracked.kind === "incomeType"
              ? incomingRow.incomeType === tracked.value
              : incomingRow.incomeType === tracked.parentValue &&
                (incomingRow.incomeSubtype ?? "") === tracked.value;
          if (!matchesTrackedRow) continue;
          for (const month of incomingRow.monthYears ?? []) {
            const trimmed = month.trim();
            if (MONTH_PATTERN.test(trimmed)) paidMonthSet.add(trimmed);
          }
        }
      }

      const paidMonths = [...paidMonthSet].sort((a, b) => a.localeCompare(b));
      const earliestPaid = paidMonths[0] ?? "";
      const latestPaid = paidMonths[paidMonths.length - 1] ?? "";
      const rangeEnd =
        earliestPaid && earliestPaid > currentMonth ? latestPaid : currentMonth;
      const rangeMonths =
        earliestPaid && rangeEnd
          ? getMonthsBetween(earliestPaid, rangeEnd)
          : [];
      const statusByMonth: Record<string, "paid" | "unpaid"> = {};
      for (const month of rangeMonths) {
        statusByMonth[month] = paidMonthSet.has(month) ? "paid" : "unpaid";
      }

      const label =
        tracked.parentValue && tracked.kind !== "category" && tracked.kind !== "incomeType"
          ? `${tracked.parentValue} / ${tracked.value}`
          : tracked.value;

      return {
        key: `${source}:${tracked.kind}:${tracked.parentValue}:${tracked.value}`,
        source,
        kind: tracked.kind,
        value: tracked.value,
        parentValue: tracked.parentValue || undefined,
        color: tracked.color,
        label,
        paidMonths,
        rangeMonths,
        statusByMonth,
      };
    });

    rows.sort((a, b) => {
      if (a.source !== b.source) return a.source.localeCompare(b.source);
      return a.label.localeCompare(b.label);
    });

    return {
      currentMonth,
      rows,
    };
  },
});
