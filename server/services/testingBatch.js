import { buildEntryFromBody, sortEntries } from "./storeModel.js";

const TESTING_RULE_ID = "system-testing-smoke";

export async function runTestingExpenseForAllUsers(options) {
  const {
    repository,
    now = new Date(),
    logger = console,
  } = options;
  const startedAt = Date.now();
  const users = await repository.listUserStores();
  const failures = [];
  let changedUsers = 0;
  let createdEntries = 0;

  for (const user of users) {
    try {
      const occurrenceKey = `${TESTING_RULE_ID}:${now.toISOString().slice(0, 10)}`;
      const exists = user.store.entries.some(
        (entry) => entry.recurringOccurrenceKey === occurrenceKey,
      );

      if (exists) {
        continue;
      }

      const result = buildEntryFromBody(
        {
          type: "expense",
          name: "TESTING",
          amount: 1,
          date: now.toISOString().slice(0, 10),
          category: user.store.defaults.categories.expense[0]?.name ?? null,
          account: user.store.defaults.accounts[0]?.name ?? null,
          notes: "GitHub Actions smoke test entry",
          entryKind: user.store.defaults.expenseKinds[0]?.name ?? "Regular",
          comments: "Created automatically by the test workflow.",
          linkedRecurringRuleId: TESTING_RULE_ID,
          recurringOccurrenceKey: occurrenceKey,
        },
        {
          forcedType: "expense",
          existingEntries: user.store.entries,
          now: now.toISOString(),
        },
      );

      if ("error" in result) {
        throw new Error(result.error);
      }

      user.store.entries.push(result.entry);
      user.store.entries = sortEntries(user.store.entries);
      await repository.saveUserStore(user.uid, user.store);
      changedUsers += 1;
      createdEntries += 1;
    } catch (error) {
      failures.push({
        uid: user.uid,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const summary = {
    scannedUsers: users.length,
    changedUsers,
    createdEntries,
    failures,
    durationMs: Date.now() - startedAt,
  };

  logger.info?.(JSON.stringify({ type: "testing-batch-summary", ...summary }));
  return summary;
}
