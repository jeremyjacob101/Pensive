import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const optionKind = v.union(
  v.literal("expenseType"),
  v.literal("account"),
  v.literal("category"),
  v.literal("incomeType"),
);

type OptionKind = "expenseType" | "account" | "category" | "incomeType";

const OPTION_KINDS: OptionKind[] = [
  "expenseType",
  "account",
  "category",
  "incomeType",
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

function shuffleWithRng<T>(items: T[], rng: () => number) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = output[index];
    output[index] = output[swapIndex];
    output[swapIndex] = current;
  }
  return output;
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
) {
  const trimmed = value.trim();
  if (!trimmed) return;

  const current = await ctx.db
    .query("userOptions")
    .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
    .take(MAX_OPTIONS_PER_KIND + 1);

  const existing = current.find((row) => row.value === trimmed);
  const otherColors = current
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
    color: assignedColor,
    isDefault: false,
  });
}

function formatOptionList(
  kind: OptionKind,
  values: Array<{ value: string; color?: string; isDefault?: boolean }>,
) {
  const sorted = [...values].sort((a, b) => a.value.localeCompare(b.value));
  const used: string[] = [];

  return sorted.map((row) => {
    const normalizedColor = normalizeHexColor(row.color ?? "");
    if (normalizedColor) {
      used.push(normalizedColor);
      return {
        value: row.value,
        color: normalizedColor,
        isDefault: row.isDefault === true,
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
    };
  });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const [expenseTypeRows, accountRows, categoryRows, incomeTypeRows] =
      await Promise.all(
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
        })),
      ),
      account: formatOptionList(
        "account",
        accountRows.map((row) => ({
          value: row.value,
          color: (row as { color?: string }).color,
          isDefault: (row as { isDefault?: boolean }).isDefault,
        })),
      ),
      category: formatOptionList(
        "category",
        categoryRows.map((row) => ({
          value: row.value,
          color: (row as { color?: string }).color,
          isDefault: (row as { isDefault?: boolean }).isDefault,
        })),
      ),
      incomeType: formatOptionList(
        "incomeType",
        incomeTypeRows.map((row) => ({
          value: row.value,
          color: (row as { color?: string }).color,
          isDefault: (row as { isDefault?: boolean }).isDefault,
        })),
      ),
    };
  },
});

export const add = mutation({
  args: { kind: optionKind, value: v.string() },
  handler: async (ctx, { kind, value }) => {
    const userId = await requireUserId(ctx);
    await upsertOption(ctx, userId, kind, value);
  },
});

export const updateColor = mutation({
  args: { kind: optionKind, value: v.string(), color: v.string() },
  handler: async (ctx, { kind, value, color }) => {
    const userId = await requireUserId(ctx);
    const normalizedColor = normalizeHexColor(color);
    if (!normalizedColor)
      throw new Error("Color must be a hex value like #A1B2C3");

    const existing = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", value.trim()))
      .first();

    if (!existing) throw new Error("Option not found");

    await ctx.db.patch(existing._id, { color: normalizedColor });
  },
});

export const backfillColors = mutation({
  args: { forceReassignAll: v.optional(v.boolean()) },
  handler: async (ctx, { forceReassignAll }) => {
    const userId = await requireUserId(ctx);
    let updated = 0;
    const shouldReassignAll = forceReassignAll === true;

    for (const kind of OPTION_KINDS) {
      const rawRows = await ctx.db
        .query("userOptions")
        .withIndex("by_user_kind", (q) =>
          q.eq("userId", userId).eq("kind", kind))
        .take(MAX_OPTIONS_PER_KIND);
      const rows = shouldReassignAll
        ? shuffleWithRng(rawRows, Math.random)
        : rawRows;

      const usedColors: string[] = [];

      for (const row of rows) {
        const normalizedColor = normalizeHexColor(
          (row as { color?: string }).color ?? "",
        );
        if (!shouldReassignAll && normalizedColor) {
          usedColors.push(normalizedColor);
          continue;
        }

        const replacementColor = pickMostDistinctColor(usedColors, Math.random);
        usedColors.push(replacementColor);
        await ctx.db.patch(row._id, { color: replacementColor });
        updated += 1;
      }
    }

    return { updated };
  },
});

export const remove = mutation({
  args: { kind: optionKind, value: v.string() },
  handler: async (ctx, { kind, value }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", value.trim()))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const setDefault = mutation({
  args: { kind: optionKind, value: v.string(), isDefault: v.boolean() },
  handler: async (ctx, { kind, value, isDefault }) => {
    const userId = await requireUserId(ctx);
    const trimmedValue = value.trim();
    if (!trimmedValue) throw new Error("Option value is required");

    const rows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
      .take(MAX_OPTIONS_PER_KIND);

    const selected = rows.find((row) => row.value === trimmedValue);
    if (!selected) throw new Error("Option not found");

    for (const row of rows) {
      const nextIsDefault = isDefault && row._id === selected._id;
      if ((row as { isDefault?: boolean }).isDefault === nextIsDefault)
        continue;
      await ctx.db.patch(row._id, { isDefault: nextIsDefault });
    }
  },
});