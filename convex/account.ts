import { mutation, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

type UserOwnedTable =
  | "paybackLinks"
  | "expenses"
  | "incomings"
  | "recurrings"
  | "userOptions"
  | "notepadWorkspaces";

async function userOwnedDocs(
  ctx: MutationCtx,
  table: UserOwnedTable,
  userId: Id<"users">,
) {
  switch (table) {
    case "paybackLinks":
      return await ctx.db
        .query("paybackLinks")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
    case "expenses":
      return await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
    case "incomings":
      return await ctx.db
        .query("incomings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
    case "recurrings":
      return await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
    case "userOptions":
      return await ctx.db
        .query("userOptions")
        .withIndex("by_user_kind", (q) => q.eq("userId", userId))
        .collect();
    case "notepadWorkspaces":
      return await ctx.db
        .query("notepadWorkspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
  }
}

async function deleteByUserId(
  ctx: MutationCtx,
  table: UserOwnedTable,
  userId: Id<"users">,
) {
  const docs = await userOwnedDocs(ctx, table, userId);
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
  return docs.length;
}

export const deleteMine = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    let deleted = 0;

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    for (const session of sessions) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of refreshTokens) {
        await ctx.db.delete(token._id);
        deleted += 1;
      }

      const verifiers = await ctx.db.query("authVerifiers").collect();
      for (const verifier of verifiers) {
        if (verifier.sessionId === session._id) {
          await ctx.db.delete(verifier._id);
          deleted += 1;
        }
      }
    }

    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) {
        await ctx.db.delete(code._id);
        deleted += 1;
      }
      await ctx.db.delete(account._id);
      deleted += 1;
    }

    for (const session of sessions) {
      await ctx.db.delete(session._id);
      deleted += 1;
    }

    deleted += await deleteByUserId(ctx, "paybackLinks", userId);
    deleted += await deleteByUserId(ctx, "expenses", userId);
    deleted += await deleteByUserId(ctx, "incomings", userId);
    deleted += await deleteByUserId(ctx, "recurrings", userId);
    deleted += await deleteByUserId(ctx, "userOptions", userId);
    deleted += await deleteByUserId(ctx, "notepadWorkspaces", userId);

    await ctx.db.delete(userId);
    deleted += 1;

    return { deleted };
  },
});