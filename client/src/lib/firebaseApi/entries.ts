import {
  buildEntryFromBody,
  sortEntries,
} from "../../features/finance/storeModel";
import { withUserStoreTransaction } from "./store";

export async function createEntryRecord(body: Record<string, unknown>) {
  return withUserStoreTransaction((store) => {
    const result = buildEntryFromBody(body, {
      existingEntries: store.entries,
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    store.entries.push(result.entry);
    return result.entry;
  });
}

export async function updateEntryRecord(
  entryId: string,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const entryIndex = store.entries.findIndex((entry) => entry.id === entryId);

    if (entryIndex === -1) {
      throw new Error("entry not found");
    }

    const existingEntry = store.entries[entryIndex];
    const result = buildEntryFromBody(body, {
      existingEntry,
      existingEntries: store.entries,
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    store.entries[entryIndex] = result.entry;
    store.entries = sortEntries(store.entries);
    return result.entry;
  });
}

export async function deleteEntryRecord(entryId: string) {
  return withUserStoreTransaction((store) => {
    const entryIndex = store.entries.findIndex((entry) => entry.id === entryId);

    if (entryIndex === -1) {
      throw new Error("entry not found");
    }

    const [deletedEntry] = store.entries.splice(entryIndex, 1);

    return {
      deleted: true,
      entry: deletedEntry,
    };
  });
}
