import { mutation } from "./_generated/server";

function normalizeUsername(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export const backfillUsernames = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const passwordAccounts = (await ctx.db.query("authAccounts").collect())
      .filter((account) => account.provider === "password");

    const accountByUserId = new Map(
      passwordAccounts.map((account) => [account.userId, account]),
    );

    let updated = 0;
    for (const user of users) {
      if (normalizeUsername(user.username)) continue;

      const fromUserEmail = normalizeUsername(user.email);
      const fromPasswordAccount = normalizeUsername(
        accountByUserId.get(user._id)?.providerAccountId,
      );
      const username = fromUserEmail || fromPasswordAccount;
      if (!username) continue;

      await ctx.db.patch(user._id, { username });
      updated += 1;
    }

    return { scanned: users.length, updated };
  },
});
