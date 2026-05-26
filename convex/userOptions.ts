import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const optionKind = v.union(
  v.literal("expenseType"),
  v.literal("account"),
  v.literal("category"),
  v.literal("subcategory"),
  v.literal("incomeType"),
  v.literal("incomeSubtype"),
);

type OptionKind =
  | "expenseType"
  | "account"
  | "category"
  | "subcategory"
  | "incomeType"
  | "incomeSubtype";

const OPTION_KINDS: OptionKind[] = [
  "expenseType",
  "account",
  "category",
  "subcategory",
  "incomeType",
  "incomeSubtype",
];
const SUBTYPE_KINDS: OptionKind[] = ["subcategory", "incomeSubtype"];
const TRACKING_KINDS: OptionKind[] = [
  "category",
  "subcategory",
  "incomeType",
  "incomeSubtype",
];

const MAX_OPTIONS_PER_KIND = 250;
const COLOR_REGEX = /^#?[0-9A-Fa-f]{6}$/;
const RANDOM_CANDIDATE_COUNT = 80;

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (!COLOR_REGEX.test(trimmed)) return null;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  return `#${hex.toUpperCase()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hslToRgb(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) {
    rPrime = c;
    gPrime = x;
  } else if (hue < 120) {
    rPrime = x;
    gPrime = c;
  } else if (hue < 180) {
    gPrime = c;
    bPrime = x;
  } else if (hue < 240) {
    gPrime = x;
    bPrime = c;
  } else if (hue < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const hex = [r, g, b]
    .map((part) =>
      clamp(Math.round(part), 0, 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `#${hex}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function srgbToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function rgbToLab(r: number, g: number, b: number) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;

  const f = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function colorDistance(first: string, second: string) {
  const firstRgb = hexToRgb(first);
  const secondRgb = hexToRgb(second);
  if (!firstRgb || !secondRgb) return 0;

  const firstLab = rgbToLab(firstRgb.r, firstRgb.g, firstRgb.b);
  const secondLab = rgbToLab(secondRgb.r, secondRgb.g, secondRgb.b);

  return Math.hypot(
    firstLab.l - secondLab.l,
    firstLab.a - secondLab.a,
    firstLab.b - secondLab.b,
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
}

function makeSeededRng(seedText: string) {
  let seed = hashString(seedText) || 1;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function pickCandidateColor(candidateIndex: number, rng: () => number) {
  const hue = (rng() * 360 + candidateIndex * 137.508) % 360;
  const saturation = 0.58 + rng() * 0.34;
  const lightness = 0.38 + rng() * 0.28;
  const rgb = hslToRgb(hue, saturation, lightness);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function pickMostDistinctColor(existingColors: string[], rng: () => number) {
  const normalizedExisting = Array.from(
    new Set(
      existingColors
        .map((color) => normalizeHexColor(color) ?? "")
        .filter(Boolean),
    ),
  );

  let bestColor = pickCandidateColor(0, rng);
  let bestScore = -1;

  const candidateCount = Math.max(
    RANDOM_CANDIDATE_COUNT,
    normalizedExisting.length * 4,
  );

  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = pickCandidateColor(index, rng);

    const minDistance = normalizedExisting.length
      ? normalizedExisting.reduce((smallest, existing) => {
          const distance = colorDistance(candidate, existing);
          return Math.min(smallest, distance);
        }, Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;

    if (minDistance > bestScore) {
      bestScore = minDistance;
      bestColor = candidate;
    }
  }

  return normalizeHexColor(bestColor) ?? "#6B7280";
}

async function upsertOption(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: OptionKind,
  value: string,
  parentValue?: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return;
  const normalizedParentValue = parentValue?.trim() || undefined;
  if (SUBTYPE_KINDS.includes(kind) && !normalizedParentValue) {
    throw new Error("parentValue is required for subtypes");
  }

  const current = await ctx.db
    .query("userOptions")
    .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
    .take(MAX_OPTIONS_PER_KIND + 1);
  const scopedCurrent = SUBTYPE_KINDS.includes(kind)
    ? current.filter(
        (row) =>
          ((row as { parentValue?: string }).parentValue ?? "") ===
          (normalizedParentValue ?? ""),
      )
    : current;

  const existing = scopedCurrent.find((row) => row.value === trimmed);
  const otherColors = scopedCurrent
    .filter((row) => row.value !== trimmed)
    .map((row) => (row as { color?: string }).color ?? "")
    .filter((color) => normalizeHexColor(color));

  if (existing) {
    const existingColor = normalizeHexColor(
      (existing as { color?: string }).color ?? "",
    );
    if (existingColor) return;

    const replacementColor = pickMostDistinctColor(otherColors, Math.random);
    await ctx.db.patch(existing._id, { color: replacementColor });
    return;
  }

  if (current.length >= MAX_OPTIONS_PER_KIND) {
    throw new Error(
      `Too many ${kind} options. Remove one before adding another.`,
    );
  }

  const assignedColor = pickMostDistinctColor(otherColors, Math.random);
  await ctx.db.insert("userOptions", {
    userId,
    kind,
    value: trimmed,
    parentValue: normalizedParentValue,
    color: assignedColor,
    isDefault: false,
  });
}

function formatOptionList(
  kind: OptionKind,
  values: Array<{
    value: string;
    color?: string;
    isDefault?: boolean;
    isTracking?: boolean;
    parentValue?: string;
  }>,
) {
  const sorted = [...values].sort((a, b) => {
    const parentCompare = (a.parentValue ?? "").localeCompare(
      b.parentValue ?? "",
    );
    if (parentCompare !== 0) return parentCompare;
    return a.value.localeCompare(b.value);
  });
  const used: string[] = [];

  return sorted.map((row) => {
    const normalizedColor = normalizeHexColor(row.color ?? "");
    if (normalizedColor) {
      used.push(normalizedColor);
      return {
        value: row.value,
        color: normalizedColor,
        isDefault: row.isDefault === true,
        isTracking: row.isTracking === true,
        parentValue: row.parentValue,
      };
    }

    const deterministicColor = pickMostDistinctColor(
      used,
      makeSeededRng(`${kind}:${row.value}`),
    );
    used.push(deterministicColor);
    return {
      value: row.value,
      color: deterministicColor,
      isDefault: row.isDefault === true,
      isTracking: row.isTracking === true,
      parentValue: row.parentValue,
    };
  });
}

type OptionRow = {
  value: string;
  color?: string;
  isDefault?: boolean;
  isTracking?: boolean;
  parentValue?: string;
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const [
      expenseTypeRows,
      accountRows,
      categoryRows,
      subcategoryRows,
      incomeTypeRows,
      incomeSubtypeRows,
    ] = await Promise.all(
      OPTION_KINDS.map((kind) =>
        ctx.db
          .query("userOptions")
          .withIndex("by_user_kind", (q) =>
            q.eq("userId", userId).eq("kind", kind))
          .take(MAX_OPTIONS_PER_KIND)),
    );

    return {
      expenseType: formatOptionList(
        "expenseType",
        expenseTypeRows.map((row) => ({
          value: row.value,
          color: (row as { color?: string }).color,
          isDefault: (row as { isDefault?: boolean }).isDefault,
          isTracking: (row as { isTracking?: boolean }).isTracking,
        })),
      ),
      account: formatOptionList(
        "account",
        accountRows.map((row) => ({
          value: row.value,
          color: (row as { color?: string }).color,
          isDefault: (row as { isDefault?: boolean }).isDefault,
          isTracking: (row as { isTracking?: boolean }).isTracking,
        })),
      ),
      category: formatOptionList(
        "category",
        categoryRows.map((row) => ({
          value: row.value,
          color: (row as { color?: string }).color,
          isDefault: (row as { isDefault?: boolean }).isDefault,
          isTracking: (row as { isTracking?: boolean }).isTracking,
        })),
      ),
      subcategory: formatOptionList(
        "subcategory",
        subcategoryRows.map((row) => ({
          value: row.value,
          color: (row as OptionRow).color,
          isDefault: (row as OptionRow).isDefault,
          isTracking: (row as OptionRow).isTracking,
          parentValue: (row as OptionRow).parentValue,
        })),
      ),
      incomeType: formatOptionList(
        "incomeType",
        incomeTypeRows.map((row) => ({
          value: row.value,
          color: (row as { color?: string }).color,
          isDefault: (row as { isDefault?: boolean }).isDefault,
          isTracking: (row as { isTracking?: boolean }).isTracking,
        })),
      ),
      incomeSubtype: formatOptionList(
        "incomeSubtype",
        incomeSubtypeRows.map((row) => ({
          value: row.value,
          color: (row as OptionRow).color,
          isDefault: (row as OptionRow).isDefault,
          isTracking: (row as OptionRow).isTracking,
          parentValue: (row as OptionRow).parentValue,
        })),
      ),
    };
  },
});

export const add = mutation({
  args: {
    kind: optionKind,
    value: v.string(),
    parentValue: v.optional(v.string()),
  },
  handler: async (ctx, { kind, value, parentValue }) => {
    const userId = await requireUserId(ctx);
    await upsertOption(ctx, userId, kind, value, parentValue);
  },
});

export const updateColor = mutation({
  args: {
    kind: optionKind,
    value: v.string(),
    color: v.string(),
    parentValue: v.optional(v.string()),
  },
  handler: async (ctx, { kind, value, color, parentValue }) => {
    const userId = await requireUserId(ctx);
    const normalizedColor = normalizeHexColor(color);
    if (!normalizedColor)
      throw new Error("Color must be a hex value like #A1B2C3");

    const matches = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", value.trim()))
      .collect();
    const existing = matches.find(
      (row) =>
        ((row as { parentValue?: string }).parentValue ?? "") ===
        (parentValue?.trim() ?? ""),
    );

    if (!existing) throw new Error("Option not found");

    await ctx.db.patch(existing._id, { color: normalizedColor });
  },
});

export const remove = mutation({
  args: {
    kind: optionKind,
    value: v.string(),
    parentValue: v.optional(v.string()),
  },
  handler: async (ctx, { kind, value, parentValue }) => {
    const userId = await requireUserId(ctx);
    const matches = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", value.trim()))
      .collect();
    const normalizedParent = parentValue?.trim() ?? "";
    const existing = matches.find(
      (row) =>
        ((row as { parentValue?: string }).parentValue ?? "") ===
        normalizedParent,
    );
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    if (kind === "category") {
      const children = await ctx.db
        .query("userOptions")
        .withIndex("by_user_kind", (q) =>
          q.eq("userId", userId).eq("kind", "subcategory"))
        .collect();
      for (const child of children) {
        if (
          ((child as { parentValue?: string }).parentValue ?? "") ===
          value.trim()
        ) {
          await ctx.db.delete(child._id);
        }
      }
    }
    if (kind === "incomeType") {
      const children = await ctx.db
        .query("userOptions")
        .withIndex("by_user_kind", (q) =>
          q.eq("userId", userId).eq("kind", "incomeSubtype"))
        .collect();
      for (const child of children) {
        if (
          ((child as { parentValue?: string }).parentValue ?? "") ===
          value.trim()
        ) {
          await ctx.db.delete(child._id);
        }
      }
    }
  },
});

export const setDefault = mutation({
  args: {
    kind: optionKind,
    value: v.string(),
    isDefault: v.boolean(),
    parentValue: v.optional(v.string()),
  },
  handler: async (ctx, { kind, value, isDefault, parentValue }) => {
    const userId = await requireUserId(ctx);
    const trimmedValue = value.trim();
    if (!trimmedValue) throw new Error("Option value is required");

    const rows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
      .take(MAX_OPTIONS_PER_KIND);

    const normalizedParent = parentValue?.trim() ?? "";
    const selected = rows.find(
      (row) =>
        row.value === trimmedValue &&
        ((row as { parentValue?: string }).parentValue ?? "") ===
          normalizedParent,
    );
    if (!selected) throw new Error("Option not found");

    for (const row of rows) {
      const rowParent = (row as { parentValue?: string }).parentValue ?? "";
      const sameScope = SUBTYPE_KINDS.includes(kind)
        ? rowParent === normalizedParent
        : true;
      const nextIsDefault = sameScope && isDefault && row._id === selected._id;
      if ((row as { isDefault?: boolean }).isDefault === nextIsDefault)
        continue;
      await ctx.db.patch(row._id, { isDefault: nextIsDefault });
    }
  },
});

export const setTracking = mutation({
  args: {
    kind: optionKind,
    value: v.string(),
    isTracking: v.boolean(),
    parentValue: v.optional(v.string()),
  },
  handler: async (ctx, { kind, value, isTracking, parentValue }) => {
    const userId = await requireUserId(ctx);
    if (!TRACKING_KINDS.includes(kind)) {
      throw new Error(
        "Tracking is only supported for category and type options",
      );
    }

    const trimmedValue = value.trim();
    const normalizedParent = parentValue?.trim() ?? "";
    if (!trimmedValue) throw new Error("Option value is required");
    if (SUBTYPE_KINDS.includes(kind) && !normalizedParent) {
      throw new Error("parentValue is required for subtypes");
    }

    const rows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", trimmedValue))
      .collect();
    const selected = rows.find(
      (row) =>
        ((row as { parentValue?: string }).parentValue ?? "") ===
        normalizedParent,
    );
    if (!selected) throw new Error("Option not found");

    await ctx.db.patch(selected._id, { isTracking });
  },
});

export const rename = mutation({
  args: {
    kind: optionKind,
    value: v.string(),
    nextValue: v.string(),
    parentValue: v.optional(v.string()),
  },
  handler: async (ctx, { kind, value, nextValue, parentValue }) => {
    const userId = await requireUserId(ctx);
    const currentValue = value.trim();
    const targetValue = nextValue.trim();
    const normalizedParent = parentValue?.trim() ?? "";
    if (!currentValue || !targetValue) {
      throw new Error("Both value and nextValue are required");
    }
    if (currentValue === targetValue) return;
    if (SUBTYPE_KINDS.includes(kind) && !normalizedParent) {
      throw new Error("parentValue is required for subtypes");
    }

    const matches = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", currentValue))
      .collect();

    const existing = matches.find(
      (row) =>
        ((row as { parentValue?: string }).parentValue ?? "") ===
        normalizedParent,
    );
    if (!existing) throw new Error("Option not found");

    const sameNameRows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", targetValue))
      .collect();
    const duplicate = sameNameRows.find(
      (row) =>
        ((row as { parentValue?: string }).parentValue ?? "") ===
          normalizedParent && row._id !== existing._id,
    );
    if (duplicate) throw new Error("An option with this name already exists");

    await ctx.db.patch(existing._id, { value: targetValue });

    if (kind === "category") {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const expense of expenses) {
        const patch: { category?: string; subcategory?: string } = {};
        if (expense.category === currentValue) patch.category = targetValue;
        if ((expense.subcategory ?? "") === currentValue)
          patch.subcategory = targetValue;
        if (Object.keys(patch).length > 0)
          await ctx.db.patch(expense._id, patch);
      }

      const recurrings = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurring of recurrings) {
        const patch: {
          recurringExpenseCategory?: string;
          recurringExpenseSubcategory?: string;
        } = {};
        if ((recurring.recurringExpenseCategory ?? "") === currentValue)
          patch.recurringExpenseCategory = targetValue;
        if ((recurring.recurringExpenseSubcategory ?? "") === currentValue)
          patch.recurringExpenseSubcategory = targetValue;
        if (Object.keys(patch).length > 0)
          await ctx.db.patch(recurring._id, patch);
      }

      const subcategories = await ctx.db
        .query("userOptions")
        .withIndex("by_user_kind", (q) =>
          q.eq("userId", userId).eq("kind", "subcategory"))
        .collect();
      for (const sub of subcategories) {
        if (
          ((sub as { parentValue?: string }).parentValue ?? "") !== currentValue
        )
          continue;
        await ctx.db.patch(sub._id, { parentValue: targetValue });
      }
      return;
    }

    if (kind === "subcategory") {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const expense of expenses) {
        if (
          expense.category === normalizedParent &&
          (expense.subcategory ?? "") === currentValue
        ) {
          await ctx.db.patch(expense._id, { subcategory: targetValue });
        }
      }
      const recurrings = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurring of recurrings) {
        if (
          (recurring.recurringExpenseCategory ?? "") ===
            normalizedParent &&
          (recurring.recurringExpenseSubcategory ?? "") === currentValue
        ) {
          await ctx.db.patch(recurring._id, {
            recurringExpenseSubcategory: targetValue,
          });
        }
      }
      return;
    }

    if (kind === "incomeType") {
      const incomings = await ctx.db
        .query("incomings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const incoming of incomings) {
        const patch: { incomeType?: string; incomeSubtype?: string } = {};
        if (incoming.incomeType === currentValue)
          patch.incomeType = targetValue;
        if ((incoming.incomeSubtype ?? "") === currentValue)
          patch.incomeSubtype = targetValue;
        if (Object.keys(patch).length > 0)
          await ctx.db.patch(incoming._id, patch);
      }
      const recurrings = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurring of recurrings) {
        const patch: {
          recurringIncomingType?: string;
          recurringIncomingSubtype?: string;
        } = {};
        if ((recurring.recurringIncomingType ?? "") === currentValue)
          patch.recurringIncomingType = targetValue;
        if ((recurring.recurringIncomingSubtype ?? "") === currentValue)
          patch.recurringIncomingSubtype = targetValue;
        if (Object.keys(patch).length > 0)
          await ctx.db.patch(recurring._id, patch);
      }
      const subtypes = await ctx.db
        .query("userOptions")
        .withIndex("by_user_kind", (q) =>
          q.eq("userId", userId).eq("kind", "incomeSubtype"))
        .collect();
      for (const sub of subtypes) {
        if (
          ((sub as { parentValue?: string }).parentValue ?? "") !== currentValue
        )
          continue;
        await ctx.db.patch(sub._id, { parentValue: targetValue });
      }
      return;
    }

    if (kind === "incomeSubtype") {
      const incomings = await ctx.db
        .query("incomings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const incoming of incomings) {
        if (
          incoming.incomeType === normalizedParent &&
          (incoming.incomeSubtype ?? "") === currentValue
        ) {
          await ctx.db.patch(incoming._id, { incomeSubtype: targetValue });
        }
      }
      const recurrings = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurring of recurrings) {
        if (
          (recurring.recurringIncomingType ?? "") === normalizedParent &&
          (recurring.recurringIncomingSubtype ?? "") === currentValue
        ) {
          await ctx.db.patch(recurring._id, {
            recurringIncomingSubtype: targetValue,
          });
        }
      }
      return;
    }

    if (kind === "expenseType") {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const expense of expenses) {
        if (expense.type === currentValue) {
          await ctx.db.patch(expense._id, { type: targetValue });
        }
      }
      const recurrings = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurring of recurrings) {
        const patch: { recurringExpenseType?: string } = {};
        if ((recurring.recurringExpenseType ?? "") === currentValue)
          patch.recurringExpenseType = targetValue;
        if (Object.keys(patch).length > 0)
          await ctx.db.patch(recurring._id, patch);
      }
      return;
    }

    if (kind === "account") {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const expense of expenses) {
        if (expense.account === currentValue) {
          await ctx.db.patch(expense._id, { account: targetValue });
        }
      }
      const incomings = await ctx.db
        .query("incomings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const incoming of incomings) {
        if (incoming.account === currentValue) {
          await ctx.db.patch(incoming._id, { account: targetValue });
        }
      }
      const recurrings = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurring of recurrings) {
        const patch: {
          recurringExpenseAccount?: string;
          recurringIncomingAccount?: string;
        } = {};
        if ((recurring.recurringExpenseAccount ?? "") === currentValue)
          patch.recurringExpenseAccount = targetValue;
        if ((recurring.recurringIncomingAccount ?? "") === currentValue)
          patch.recurringIncomingAccount = targetValue;
        if (Object.keys(patch).length > 0)
          await ctx.db.patch(recurring._id, patch);
      }
    }
  },
});

export const moveToSubtype = mutation({
  args: {
    kind: v.union(v.literal("category"), v.literal("incomeType")),
    sourceValue: v.string(),
    targetValue: v.string(),
  },
  handler: async (ctx, { kind, sourceValue, targetValue }) => {
    const userId = await requireUserId(ctx);
    const source = sourceValue.trim();
    const target = targetValue.trim();
    if (!source || !target) {
      throw new Error("sourceValue and targetValue are required");
    }
    if (source === target) {
      throw new Error("Cannot move an option into itself");
    }

    const subtypeKind: OptionKind =
      kind === "category" ? "subcategory" : "incomeSubtype";

    const topLevelRows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
      .collect();
    const sourceRow = topLevelRows.find((row) => row.value === source);
    const targetRow = topLevelRows.find((row) => row.value === target);
    if (!sourceRow || !targetRow) {
      throw new Error("Source or target option was not found");
    }
    const sourceIsTracking =
      (sourceRow as { isTracking?: boolean }).isTracking === true;

    const subtypeRows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) =>
        q.eq("userId", userId).eq("kind", subtypeKind))
      .collect();

    const existingDestinationSubtype = subtypeRows.find(
      (row) =>
        row.value === source &&
        ((row as { parentValue?: string }).parentValue ?? "") === target,
    );

    if (!existingDestinationSubtype) {
      const normalizedColor = normalizeHexColor(
        (sourceRow as { color?: string }).color ?? "",
      );
      const siblingColors = subtypeRows
        .filter(
          (row) =>
            ((row as { parentValue?: string }).parentValue ?? "") === target,
        )
        .map((row) => (row as { color?: string }).color ?? "")
        .filter((color) => normalizeHexColor(color));
      const assignedColor =
        normalizedColor ?? pickMostDistinctColor(siblingColors, Math.random);

      await ctx.db.insert("userOptions", {
        userId,
        kind: subtypeKind,
        value: source,
        parentValue: target,
        color: assignedColor,
        isDefault: false,
        isTracking: sourceIsTracking,
      });
    } else if (
      sourceIsTracking &&
      (existingDestinationSubtype as { isTracking?: boolean }).isTracking !==
        true
    ) {
      await ctx.db.patch(existingDestinationSubtype._id, { isTracking: true });
    }

    for (const subtypeRow of subtypeRows) {
      if (
        ((subtypeRow as { parentValue?: string }).parentValue ?? "") !== source
      )
        continue;
      await ctx.db.patch(subtypeRow._id, { parentValue: target });
    }

    await ctx.db.delete(sourceRow._id);

    if (kind === "category") {
      const expenseRows = await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const expenseRow of expenseRows) {
        if (expenseRow.category !== source) continue;
        const existingSubcategory = (expenseRow.subcategory ?? "").trim();
        await ctx.db.patch(expenseRow._id, {
          category: target,
          subcategory: existingSubcategory || source,
        });
      }

      const recurringRows = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurringRow of recurringRows) {
        const recurringCategory = (
          recurringRow.recurringExpenseCategory ?? ""
        ).trim();
        if (recurringCategory !== source) continue;
        const existingSubcategory = (
          recurringRow.recurringExpenseSubcategory ?? ""
        ).trim();
        await ctx.db.patch(recurringRow._id, {
          recurringExpenseCategory: target,
          recurringExpenseSubcategory: existingSubcategory || source,
        });
      }

      return;
    }

    const incomingRows = await ctx.db
      .query("incomings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const incomingRow of incomingRows) {
      if (incomingRow.incomeType !== source) continue;
      const existingSubtype = (incomingRow.incomeSubtype ?? "").trim();
      await ctx.db.patch(incomingRow._id, {
        incomeType: target,
        incomeSubtype: existingSubtype || source,
      });
    }

    const recurringRows = await ctx.db
      .query("recurrings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const recurringRow of recurringRows) {
      if ((recurringRow.recurringIncomingType ?? "").trim() !== source) continue;
      const existingSubtype = (recurringRow.recurringIncomingSubtype ?? "").trim();
      await ctx.db.patch(recurringRow._id, {
        recurringIncomingType: target,
        recurringIncomingSubtype: existingSubtype || source,
      });
    }
  },
});

export const promoteSubtype = mutation({
  args: {
    kind: v.union(v.literal("subcategory"), v.literal("incomeSubtype")),
    value: v.string(),
    parentValue: v.string(),
  },
  handler: async (ctx, { kind, value, parentValue }) => {
    const userId = await requireUserId(ctx);
    const subtypeValue = value.trim();
    const sourceParent = parentValue.trim();
    if (!subtypeValue || !sourceParent) {
      throw new Error("value and parentValue are required");
    }

    const rows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", subtypeValue))
      .collect();
    const subtypeRow = rows.find(
      (row) =>
        ((row as { parentValue?: string }).parentValue ?? "") === sourceParent,
    );
    if (!subtypeRow) throw new Error("Subtype option not found");
    const sourceIsTracking =
      (subtypeRow as { isTracking?: boolean }).isTracking === true;

    const topKind: OptionKind =
      kind === "subcategory" ? "category" : "incomeType";
    const existingTop = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", topKind).eq("value", subtypeValue))
      .first();

    if (!existingTop) {
      await ctx.db.insert("userOptions", {
        userId,
        kind: topKind,
        value: subtypeValue,
        color:
          normalizeHexColor((subtypeRow as { color?: string }).color ?? "") ??
          "#6B7280",
        isDefault: false,
        isTracking: sourceIsTracking,
      });
    } else if (
      sourceIsTracking &&
      (existingTop as { isTracking?: boolean }).isTracking !== true
    ) {
      await ctx.db.patch(existingTop._id, { isTracking: true });
    }

    await ctx.db.delete(subtypeRow._id);

    if (kind === "subcategory") {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const expense of expenses) {
        if (
          expense.category === sourceParent &&
          (expense.subcategory ?? "") === subtypeValue
        ) {
          await ctx.db.patch(expense._id, {
            category: subtypeValue,
            subcategory: "",
          });
        }
      }

      const recurrings = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurring of recurrings) {
        const recurringCategory = (
          recurring.recurringExpenseCategory ?? ""
        ).trim();
        if (
          recurringCategory === sourceParent &&
          (recurring.recurringExpenseSubcategory ?? "") === subtypeValue
        ) {
          await ctx.db.patch(recurring._id, {
            recurringExpenseCategory: subtypeValue,
            recurringExpenseSubcategory: "",
          });
        }
      }
      return;
    }

    const incomings = await ctx.db
      .query("incomings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const incoming of incomings) {
      if (
        incoming.incomeType === sourceParent &&
        (incoming.incomeSubtype ?? "") === subtypeValue
      ) {
        await ctx.db.patch(incoming._id, {
          incomeType: subtypeValue,
          incomeSubtype: "",
        });
      }
    }

    const recurrings = await ctx.db
      .query("recurrings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const recurring of recurrings) {
      if (
        (recurring.recurringIncomingType ?? "") === sourceParent &&
        (recurring.recurringIncomingSubtype ?? "") === subtypeValue
      ) {
        await ctx.db.patch(recurring._id, {
          recurringIncomingType: subtypeValue,
          recurringIncomingSubtype: "",
        });
      }
    }
  },
});

export const moveSubtype = mutation({
  args: {
    kind: v.union(v.literal("subcategory"), v.literal("incomeSubtype")),
    value: v.string(),
    sourceParentValue: v.string(),
    targetParentValue: v.string(),
  },
  handler: async (
    ctx,
    { kind, value, sourceParentValue, targetParentValue },
  ) => {
    const userId = await requireUserId(ctx);
    const subtypeValue = value.trim();
    const sourceParent = sourceParentValue.trim();
    const targetParent = targetParentValue.trim();
    if (!subtypeValue || !sourceParent || !targetParent) {
      throw new Error(
        "value, sourceParentValue and targetParentValue are required",
      );
    }
    if (sourceParent === targetParent) return;

    const rows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", subtypeValue))
      .collect();
    const sourceRow = rows.find(
      (row) =>
        ((row as { parentValue?: string }).parentValue ?? "") === sourceParent,
    );
    if (!sourceRow) throw new Error("Subtype option not found");

    const duplicateAtTarget = rows.find(
      (row) =>
        row._id !== sourceRow._id &&
        ((row as { parentValue?: string }).parentValue ?? "") === targetParent,
    );
    if (duplicateAtTarget) {
      throw new Error("Target parent already has this subtype name");
    }

    await ctx.db.patch(sourceRow._id, { parentValue: targetParent });

    if (kind === "subcategory") {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const expense of expenses) {
        if (
          expense.category === sourceParent &&
          (expense.subcategory ?? "") === subtypeValue
        ) {
          await ctx.db.patch(expense._id, { category: targetParent });
        }
      }

      const recurrings = await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      for (const recurring of recurrings) {
        if (
          (recurring.recurringExpenseCategory ?? "") ===
            sourceParent &&
          (recurring.recurringExpenseSubcategory ?? "") === subtypeValue
        ) {
          await ctx.db.patch(recurring._id, {
            recurringExpenseCategory: targetParent,
          });
        }
      }
      return;
    }

    const incomings = await ctx.db
      .query("incomings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const incoming of incomings) {
      if (
        incoming.incomeType === sourceParent &&
        (incoming.incomeSubtype ?? "") === subtypeValue
      ) {
        await ctx.db.patch(incoming._id, { incomeType: targetParent });
      }
    }

    const recurrings = await ctx.db
      .query("recurrings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const recurring of recurrings) {
      if (
        (recurring.recurringIncomingType ?? "") === sourceParent &&
        (recurring.recurringIncomingSubtype ?? "") === subtypeValue
      ) {
        await ctx.db.patch(recurring._id, {
          recurringIncomingType: targetParent,
        });
      }
    }
  },
});
