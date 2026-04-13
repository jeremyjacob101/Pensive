import { runTestingExpenseForAllUsers } from "../services/testingBatch.js";
import { getAdminUserStoreRepository } from "../storage/adminUserStore.js";
import { getDateFromDateKey, getDatePartsInTimeZone } from "../utils/common.js";

const TIME_ZONE = "Asia/Jerusalem";

async function main() {
  const wallClockNow = new Date();

  const effectiveDate =
    process.env.TESTING_BUSINESS_DATE ??
    getDatePartsInTimeZone(TIME_ZONE, wallClockNow).dateKey;
  const summary = await runTestingExpenseForAllUsers({
    repository: getAdminUserStoreRepository(),
    now: getDateFromDateKey(effectiveDate),
  });

  if (summary.failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      type: "testing-batch-fatal",
      error: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  process.exitCode = 1;
});
