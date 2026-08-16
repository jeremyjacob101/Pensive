import { asUser, createUser, internalApi, makeConvexTest, recurringExpenseInput, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex internal jobs and backup metadata", () => {
  it("materializes one user's due rows through the internal job entry point", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "internal-recurring-user");
    await asUser(t, user).mutation(
      testApi.recurrings.create,
      recurringExpenseInput("internal rent"),
    );

    const result = await t.mutation(
      internalApi.recurrings.materializeDueExpensesForUser,
      { userId: user, runDate: "2025-03-15" },
    );
    expect(result).toMatchObject({ matched: 1, created: 1, skipped: 0 });

    const allUsers = await t.mutation(
      internalApi.recurrings.materializeDueExpensesForAllUsers,
      { runDate: "2025-03-15" },
    );
    expect(allUsers).toMatchObject({
      matched: 1,
      usersProcessed: 1,
      created: 0,
      skipped: 1,
    });
  });

  it("stores and lists only valid backup snapshot metadata with bounded limits", async () => {
    const t = makeConvexTest();
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["snapshot"]));
    });

    const snapshotId = await t.run(async (ctx) => {
      return await ctx.db.insert("backupSnapshots", {
        environment: "prod",
        reason: "schema-change",
        storageId,
        beforeCommit: "before",
        afterCommit: "after",
        schemaHash: "hash",
        createdAt: Date.now(),
        archiveName: "snapshot.zip",
        sizeBytes: 8,
      });
    });

    const rows = await t.query(internalApi.backupSnapshots.list, { limit: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      _id: snapshotId,
      environment: "prod",
      reason: "schema-change",
      beforeCommit: "before",
      afterCommit: "after",
      archiveName: "snapshot.zip",
      sizeBytes: 8,
    });

    expect(rows[0].storageId).toBe(storageId);
  });
});