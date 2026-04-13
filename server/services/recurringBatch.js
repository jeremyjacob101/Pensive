import { applyRecurringRules } from "./storeModel.js";

export async function runRecurringForAllUsers(options) {
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
      const recurringResult = applyRecurringRules(user.store, now);

      if (!recurringResult.changed) {
        continue;
      }

      await repository.saveUserStore(user.uid, user.store);
      changedUsers += 1;
      createdEntries += recurringResult.createdEntries.length;
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

  logger.info?.(JSON.stringify({ type: "recurring-batch-summary", ...summary }));
  return summary;
}
