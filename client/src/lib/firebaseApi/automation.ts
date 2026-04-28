import {
  buildDashboard,
  cleanOptionalString,
  getCurrentMonth,
  type StoredEvenUpRecord,
  type UserStore,
} from "../../features/finance/storeModel";
import type { EvenUpRecord } from "../../features/finance/types";
import { withUserStoreTransaction } from "./store";

function findEvenUpRecordIndex(userStore: UserStore, recordId: string) {
  return userStore.evenUpRecords.findIndex((record) => record.id === recordId);
}

function getNextEvenUpCode(store: UserStore) {
  const maxNumber = store.evenUpRecords.reduce((currentMax, record) => {
    const match = record.code.match(/(\d+)$/);
    const numeric = Number(match?.[1]);
    return Number.isFinite(numeric)
      ? Math.max(currentMax, numeric)
      : currentMax;
  }, 0);

  return `EVN${String(maxNumber + 1).padStart(9, "0")}`;
}

export async function createRecurringRuleRecord(body: Record<string, unknown>) {
  void body;
  throw new Error("Recurring rules are display-only right now.");
}

export async function updateRecurringRuleRecord(
  ruleId: string,
  body: Record<string, unknown>,
) {
  void ruleId;
  void body;
  throw new Error("Recurring rules are display-only right now.");
}

export async function deleteRecurringRuleRecord(ruleId: string) {
  void ruleId;
  throw new Error("Recurring rules are display-only right now.");
}

export async function runRecurringRulesNow() {
  throw new Error("Recurring rules are display-only right now.");
}

export async function createEvenUpRecord(body: Record<string, unknown>) {
  return withUserStoreTransaction((store) => {
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? "");

    if (!startDate || !endDate) {
      throw new Error("start date and end date are required");
    }

    const now = new Date().toISOString();
    const record: StoredEvenUpRecord = {
      id: crypto.randomUUID(),
      code: getNextEvenUpCode(store),
      status: cleanOptionalString(body.status) ?? "Open",
      startDate,
      endDate,
      from: cleanOptionalString(body.from),
      to: cleanOptionalString(body.to),
      paid: Math.max(0, Number(body.paid ?? 0) || 0),
      notes: cleanOptionalString(body.notes),
      createdAt: now,
      updatedAt: now,
    };

    store.evenUpRecords.push(record);

    return buildDashboard(store, getCurrentMonth()).evenUpRecords.find(
      (current) => current.id === record.id,
    ) as EvenUpRecord;
  });
}

export async function updateEvenUpRecord(
  recordId: string,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const index = findEvenUpRecordIndex(store, recordId);

    if (index === -1) {
      throw new Error("even-up record not found");
    }

    const existing = store.evenUpRecords[index];
    const startDate = String(body.startDate ?? existing.startDate);
    const endDate = String(body.endDate ?? existing.endDate);

    if (!startDate || !endDate) {
      throw new Error("start date and end date are required");
    }

    store.evenUpRecords[index] = {
      ...existing,
      status: cleanOptionalString(body.status) ?? existing.status,
      startDate,
      endDate,
      from: cleanOptionalString(body.from ?? existing.from),
      to: cleanOptionalString(body.to ?? existing.to),
      paid: Math.max(0, Number(body.paid ?? existing.paid) || 0),
      notes: cleanOptionalString(body.notes ?? existing.notes),
      updatedAt: new Date().toISOString(),
    };

    return buildDashboard(store, getCurrentMonth()).evenUpRecords.find(
      (current) => current.id === recordId,
    ) as EvenUpRecord;
  });
}

export async function deleteEvenUpRecord(recordId: string) {
  return withUserStoreTransaction((store) => {
    const index = findEvenUpRecordIndex(store, recordId);

    if (index === -1) {
      throw new Error("even-up record not found");
    }

    const [deletedRecord] = store.evenUpRecords.splice(index, 1);

    return {
      deleted: true,
      evenUpRecord: deletedRecord,
    };
  });
}
