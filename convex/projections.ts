import { action, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const compoundingValidator = v.union(v.literal("monthly"), v.literal("yearly"));
const currencyValidator = v.union(v.literal("ILS"), v.literal("USD"));
const USD_ILS_PAIR = "USD_ILS";
const EXCHANGE_RATE_MAX_AGE_MS = 12 * 60 * 60 * 1_000;

type ExchangeRateResult = {
  rate: number;
  rateDate: string;
  fetchedAt: number;
  source: string;
  isStale: boolean;
};

type ProjectionCtx = QueryCtx | MutationCtx;

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

function normalizedName(value: string) {
  const name = value.trim();
  if (!name) throw new Error("Bank name is required");
  if (name.length > 80)
    throw new Error("Bank name must be 80 characters or fewer");
  return name;
}

function normalizedColor(value: string) {
  const color = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) {
    throw new Error("Bank color must be a six-digit hex color");
  }
  return color;
}

function validRate(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Annual interest rate must be between 0 and 100");
  }
  return value;
}

function validExchangeRate(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new Error(
      "USD to ILS rate must be greater than 0 and no more than 100",
    );
  }
  return value;
}

function validAmount(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000_000) {
    throw new Error("Balance amount must be a valid number");
  }
  return value;
}

function validDate(value: string) {
  const date = value.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(date)) {
    throw new Error("Balance date must be YYYY-MM-DD");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Balance date must be a real calendar date");
  }
  return date;
}

function normalizedNote(value?: string) {
  const note = value?.trim() ?? "";
  if (note.length > 240)
    throw new Error("Balance note must be 240 characters or fewer");
  return note || undefined;
}

async function requireOwnedBank(
  ctx: ProjectionCtx,
  bankId: Id<"projectionBanks">,
  userId: Id<"users">,
) {
  const bank = await ctx.db.get(bankId);
  if (!bank || bank.userId !== userId) {
    throw new Error("Projection bank not found");
  }
  return bank;
}

function validTimestamp(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Exchange-rate timestamp must be a valid number");
  }
  return value;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const [banks, entries, settings, liveRate] = await Promise.all([
      ctx.db
        .query("projectionBanks")
        .withIndex("by_user_sort", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("projectionEntries")
        .withIndex("by_user_date", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("projectionSettings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first(),
      ctx.db
        .query("projectionExchangeRates")
        .withIndex("by_pair", (q) => q.eq("pair", USD_ILS_PAIR))
        .order("desc")
        .first(),
    ]);

    return {
      banks: banks
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
        .map((bank) => ({
          ...bank,
          currency: bank.currency ?? ("ILS" as const),
        })),
      entries: entries
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
        )
        .map((entry) => ({
          ...entry,
          currency: entry.currency ?? ("ILS" as const),
        })),
      settings: {
        displayCurrency: settings?.displayCurrency ?? ("ILS" as const),
        manualUsdIlsRate: settings?.manualUsdIlsRate ?? null,
        liveUsdIlsRate: liveRate?.rate ?? null,
        liveRateDate: liveRate?.rateDate ?? null,
        liveRateFetchedAt: liveRate?.fetchedAt ?? null,
        rateSource: liveRate?.source ?? "Frankfurter",
      },
    };
  },
});

export const setCurrencySettings = mutation({
  args: {
    displayCurrency: currencyValidator,
    manualUsdIlsRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("projectionSettings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    const now = Date.now();
    const manualUsdIlsRate =
      args.manualUsdIlsRate === undefined
        ? undefined
        : validExchangeRate(args.manualUsdIlsRate);

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayCurrency: args.displayCurrency,
        manualUsdIlsRate,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("projectionSettings", {
        userId,
        displayCurrency: args.displayCurrency,
        ...(manualUsdIlsRate === undefined ? {} : { manualUsdIlsRate }),
        updatedAt: now,
      });
    }

    return {
      displayCurrency: args.displayCurrency,
      manualUsdIlsRate: manualUsdIlsRate ?? null,
    };
  },
});

export const getCachedExchangeRate = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("projectionExchangeRates")
      .withIndex("by_pair", (q) => q.eq("pair", USD_ILS_PAIR))
      .order("desc")
      .first(),
});

export const storeExchangeRate = internalMutation({
  args: {
    rate: v.number(),
    rateDate: v.string(),
    fetchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projectionExchangeRates")
      .withIndex("by_pair", (q) => q.eq("pair", USD_ILS_PAIR))
      .order("desc")
      .first();
    const value = {
      pair: USD_ILS_PAIR,
      base: "USD",
      quote: "ILS",
      rate: validExchangeRate(args.rate),
      rateDate: validDate(args.rateDate),
      source: "Frankfurter",
      fetchedAt: validTimestamp(args.fetchedAt),
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, value);
      return existing._id;
    }
    return await ctx.db.insert("projectionExchangeRates", value);
  },
});

export const refreshExchangeRate = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<ExchangeRateResult> => {
    await requireUserId(ctx);
    const cached: Doc<"projectionExchangeRates"> | null = await ctx.runQuery(
      internal.projections.getCachedExchangeRate,
      {},
    );
    const now = Date.now();
    if (
      cached &&
      !args.force &&
      now - cached.fetchedAt < EXCHANGE_RATE_MAX_AGE_MS
    ) {
      return {
        rate: cached.rate,
        rateDate: cached.rateDate,
        fetchedAt: cached.fetchedAt,
        source: cached.source,
        isStale: false,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(
        "https://api.frankfurter.dev/v2/rate/USD/ILS",
        { signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error(`Exchange-rate provider returned ${response.status}`);
      }
      const payload = (await response.json()) as {
        base?: unknown;
        quote?: unknown;
        rate?: unknown;
        date?: unknown;
      };
      if (
        payload.base !== "USD" ||
        payload.quote !== "ILS" ||
        typeof payload.rate !== "number" ||
        typeof payload.date !== "string"
      ) {
        throw new Error("Exchange-rate provider returned an invalid response");
      }
      const rate = validExchangeRate(payload.rate);
      const rateDate = validDate(payload.date);
      await ctx.runMutation(internal.projections.storeExchangeRate, {
        rate,
        rateDate,
        fetchedAt: now,
      });
      return {
        rate,
        rateDate,
        fetchedAt: now,
        source: "Frankfurter",
        isStale: false,
      };
    } catch (error) {
      if (cached) {
        return {
          rate: cached.rate,
          rateDate: cached.rateDate,
          fetchedAt: cached.fetchedAt,
          source: cached.source,
          isStale: true,
        };
      }
      throw new Error(
        error instanceof Error
          ? `Could not load the USD to ILS rate: ${error.message}`
          : "Could not load the USD to ILS rate",
      );
    } finally {
      clearTimeout(timeout);
    }
  },
});

export const createBank = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    interestEnabled: v.boolean(),
    annualInterestRate: v.number(),
    compounding: compoundingValidator,
    currency: currencyValidator,
    startingBalance: v.optional(v.number()),
    startingDate: v.optional(v.string()),
    startingNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("projectionBanks")
      .withIndex("by_user_sort", (q) => q.eq("userId", userId))
      .collect();
    const name = normalizedName(args.name);
    const color = normalizedColor(args.color);
    const annualInterestRate = validRate(args.annualInterestRate);
    const startingBalance =
      args.startingBalance === undefined
        ? undefined
        : validAmount(args.startingBalance);
    if (startingBalance !== undefined && !args.startingDate) {
      throw new Error("Starting balance date is required");
    }
    const startingDate = args.startingDate
      ? validDate(args.startingDate)
      : undefined;
    const startingNote =
      startingBalance === undefined
        ? undefined
        : normalizedNote(args.startingNote);
    const now = Date.now();
    const bankId = await ctx.db.insert("projectionBanks", {
      userId,
      name,
      color,
      currency: args.currency,
      interestEnabled: args.interestEnabled,
      annualInterestRate,
      compounding: args.compounding,
      sortOrder:
        existing.reduce((max, bank) => Math.max(max, bank.sortOrder), -1) + 1,
      createdAt: now,
      updatedAt: now,
    });

    if (startingBalance !== undefined && startingDate !== undefined) {
      await ctx.db.insert("projectionEntries", {
        userId,
        bankId,
        date: startingDate,
        amount: startingBalance,
        currency: args.currency,
        note: startingNote,
        createdAt: now,
        updatedAt: now,
      });
    }

    return bankId;
  },
});

export const updateBank = mutation({
  args: {
    id: v.id("projectionBanks"),
    name: v.string(),
    color: v.string(),
    interestEnabled: v.boolean(),
    annualInterestRate: v.number(),
    compounding: compoundingValidator,
    currency: currencyValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedBank(ctx, args.id, userId);
    await ctx.db.patch(args.id, {
      name: normalizedName(args.name),
      color: normalizedColor(args.color),
      currency: args.currency,
      interestEnabled: args.interestEnabled,
      annualInterestRate: validRate(args.annualInterestRate),
      compounding: args.compounding,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const removeBank = mutation({
  args: { id: v.id("projectionBanks") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedBank(ctx, args.id, userId);
    const entries = await ctx.db
      .query("projectionEntries")
      .withIndex("by_user_bank_date", (q) =>
        q.eq("userId", userId).eq("bankId", args.id))
      .collect();
    for (const entry of entries) await ctx.db.delete(entry._id);
    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const reorderBanks = mutation({
  args: { ids: v.array(v.id("projectionBanks")) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const uniqueIds = [...new Set(args.ids)];
    if (uniqueIds.length !== args.ids.length)
      throw new Error("Bank order contains duplicates");
    const ownedBanks = await ctx.db
      .query("projectionBanks")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const id of uniqueIds) {
      await requireOwnedBank(ctx, id, userId);
    }
    if (uniqueIds.length !== ownedBanks.length) {
      throw new Error("Bank order must include every bank exactly once");
    }
    for (const [sortOrder, id] of uniqueIds.entries()) {
      await ctx.db.patch(id, { sortOrder, updatedAt: Date.now() });
    }
    return { updated: uniqueIds.length };
  },
});

export const createEntry = mutation({
  args: {
    bankId: v.id("projectionBanks"),
    date: v.string(),
    amount: v.number(),
    currency: currencyValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedBank(ctx, args.bankId, userId);
    const now = Date.now();
    return await ctx.db.insert("projectionEntries", {
      userId,
      bankId: args.bankId,
      date: validDate(args.date),
      amount: validAmount(args.amount),
      currency: args.currency,
      note: normalizedNote(args.note),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateEntry = mutation({
  args: {
    id: v.id("projectionEntries"),
    bankId: v.id("projectionBanks"),
    date: v.string(),
    amount: v.number(),
    currency: currencyValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== userId)
      throw new Error("Projection balance not found");
    await requireOwnedBank(ctx, args.bankId, userId);
    await ctx.db.patch(args.id, {
      bankId: args.bankId,
      date: validDate(args.date),
      amount: validAmount(args.amount),
      currency: args.currency,
      note: normalizedNote(args.note),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const removeEntry = mutation({
  args: { id: v.id("projectionEntries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== userId)
      throw new Error("Projection balance not found");
    await ctx.db.delete(args.id);
    return args.id;
  },
});