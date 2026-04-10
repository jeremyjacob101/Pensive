import {
  cleanOptionalString,
  cleanRequiredString,
  type StoredBillReference,
} from "../../features/finance/storeModel";
import type { BillReference, NotepadDocument } from "../../features/finance/types";
import { withUserStoreTransaction } from "./store";

function findBillIndex(bills: StoredBillReference[], billId: string) {
  return bills.findIndex((bill) => bill.id === billId);
}

function normalizeBillBody(
  body: Record<string, unknown>,
  existingBill?: StoredBillReference,
) {
  const name = cleanRequiredString(body.name ?? existingBill?.name);

  if (!name) {
    throw new Error("name is required");
  }

  return {
    name,
    customerNumber: cleanOptionalString(
      body.customerNumber ?? existingBill?.customerNumber,
    ),
    consumerNumber: cleanOptionalString(
      body.consumerNumber ?? existingBill?.consumerNumber,
    ),
    meterNumber: cleanOptionalString(body.meterNumber ?? existingBill?.meterNumber),
    contractAccount: cleanOptionalString(
      body.contractAccount ?? existingBill?.contractAccount,
    ),
    identityNumber: cleanOptionalString(
      body.identityNumber ?? existingBill?.identityNumber,
    ),
    notes: cleanOptionalString(body.notes ?? existingBill?.notes),
  };
}

export async function createBillRecord(body: Record<string, unknown>) {
  return withUserStoreTransaction((store) => {
    const nextBill = normalizeBillBody(body);
    const duplicate = store.bills.find(
      (bill) => bill.name.toLowerCase() === nextBill.name.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("bill already exists");
    }

    const now = new Date().toISOString();
    const bill: StoredBillReference = {
      id: crypto.randomUUID(),
      ...nextBill,
      createdAt: now,
      updatedAt: now,
    };

    store.bills.push(bill);
    store.bills.sort((left, right) => left.name.localeCompare(right.name));

    return bill satisfies BillReference;
  });
}

export async function updateBillRecord(
  billId: string,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const billIndex = findBillIndex(store.bills, billId);

    if (billIndex === -1) {
      throw new Error("bill not found");
    }

    const existingBill = store.bills[billIndex];
    const nextBill = normalizeBillBody(body, existingBill);
    const duplicate = store.bills.find(
      (bill, index) =>
        index !== billIndex && bill.name.toLowerCase() === nextBill.name.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("bill already exists");
    }

    store.bills[billIndex] = {
      ...existingBill,
      ...nextBill,
      updatedAt: new Date().toISOString(),
    };
    store.bills.sort((left, right) => left.name.localeCompare(right.name));

    const updatedBill = store.bills.find((bill) => bill.id === billId);

    if (!updatedBill) {
      throw new Error("bill not found");
    }

    return updatedBill satisfies BillReference;
  });
}

export async function deleteBillRecord(billId: string) {
  return withUserStoreTransaction((store) => {
    const billIndex = findBillIndex(store.bills, billId);

    if (billIndex === -1) {
      throw new Error("bill not found");
    }

    const [deletedBill] = store.bills.splice(billIndex, 1);

    return {
      deleted: true,
      bill: deletedBill,
    };
  });
}

export async function updateNotepadRecord(body: Record<string, unknown>) {
  return withUserStoreTransaction((store) => {
    if (typeof body.content !== "string") {
      throw new Error("content is required");
    }

    store.notepad = {
      content: body.content,
      updatedAt: new Date().toISOString(),
    };

    return store.notepad satisfies NotepadDocument;
  });
}
