import { runRecurringForAllUsers } from "../services/recurringBatch.js";
import { getAdminUserStoreRepository } from "../storage/adminUserStore.js";
import { getDateFromDateKey, getDatePartsInTimeZone } from "../utils/common.js";

const TIME_ZONE = "Asia/Jerusalem";

function shouldSkipScheduledRun(now) {
  if (process.env.GITHUB_EVENT_NAME !== "schedule") {
    return false;
  }

  const parts = getDatePartsInTimeZone(TIME_ZONE, now);
  return parts.hour !== 3;
}

async function main() {
  const wallClockNow = new Date();

  if (shouldSkipScheduledRun(wallClockNow)) {
    const parts = getDatePartsInTimeZone(TIME_ZONE, wallClockNow);
    console.info(
      JSON.stringify({
        type: "recurring-batch-skipped",
        reason: "outside-target-hour",
        timeZone: TIME_ZONE,
        jerusalemHour: parts.hour,
      }),
    );
    return;
  }

  const effectiveDate =
    process.env.RECURRING_BUSINESS_DATE ??
    getDatePartsInTimeZone(TIME_ZONE, wallClockNow).dateKey;
  const summary = await runRecurringForAllUsers({
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
      type: "recurring-batch-fatal",
      error: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  process.exitCode = 1;
});
