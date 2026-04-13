import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { buildRecurringRuleFromBody } from "../services/recurringRules.js";
import {
  applyRecurringRules,
  buildRecurringRunResponse,
} from "../services/storeModel.js";
import { normalizeStoredUserStore } from "../services/normalizers.js";
import { runRecurringForAllUsers } from "../services/recurringBatch.js";
import { createApp } from "../server.js";

function createStore(username = "tester", email = `${username}@example.com`) {
  return normalizeStoredUserStore(
    username,
    {
      profile: {
        username,
        fullName: username,
        email,
      },
      entries: [],
      recurringRules: [],
      evenUpRecords: [],
      importantDates: [],
      bills: [],
      notepad: { content: "", updatedAt: null },
    },
    email,
  );
}

function createInMemoryRepository(initialStores = {}) {
  const stores = new Map(
    Object.entries(initialStores).map(([uid, store]) => [uid, structuredClone(store)]),
  );

  return {
    stores,
    async readUserStore(authUser) {
      const existing = stores.get(authUser.uid);
      if (!existing) {
        const created = createStore(authUser.displayName ?? authUser.uid, authUser.email ?? null);
        stores.set(authUser.uid, created);
        return structuredClone(created);
      }

      return structuredClone(existing);
    },
    async updateUserStore(authUser, updater) {
      const current =
        stores.get(authUser.uid) ??
        createStore(authUser.displayName ?? authUser.uid, authUser.email ?? null);
      const workingCopy = structuredClone(current);
      const result = await updater(workingCopy, { authUser });
      stores.set(authUser.uid, workingCopy);
      return result;
    },
  };
}

function createTestApp(repository) {
  return createApp({
    userStoreRepository: repository,
    verifyIdToken: async () => ({
      uid: "user-1",
      email: "user-1@example.com",
      name: "user1",
      picture: null,
    }),
  });
}

async function requestApp(app, path, init = {}) {
  const headers = {
    Authorization: "Bearer test-token",
    ...(init.headers ?? {}),
  };

  const rawRequest = Readable.from(init.body ? [init.body] : []);
  rawRequest.method = init.method ?? "GET";
  rawRequest.url = `/api${path}`;
  rawRequest.headers = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  const responseHeaders = new Map();
  let responseBody = "";
  const rawResponse = {
    headersSent: false,
    writableEnded: false,
    statusCode: 200,
    setHeader(name, value) {
      responseHeaders.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return responseHeaders.get(name.toLowerCase());
    },
    end(payload = "") {
      responseBody = String(payload);
      this.writableEnded = true;
      this.headersSent = true;
    },
  };

  await app.handle(rawRequest, rawResponse);

  return {
    response: {
      status: rawResponse.statusCode,
      headers: responseHeaders,
    },
    payload: responseBody ? JSON.parse(responseBody) : null,
  };
}

test("buildRecurringRuleFromBody creates and updates expense/income rules", () => {
  const createResult = buildRecurringRuleFromBody(
    {
      type: "expense",
      status: "add",
      name: "Rent",
      amount: 1200,
      frequency: "Monthly",
      dayOfMonth: 3,
      entryKind: "Regular",
      startDate: "2026-04-01",
    },
    { now: "2026-04-01T10:00:00.000Z" },
  );

  assert.ok(!("error" in createResult));
  assert.equal(createResult.rule.status, "add");
  assert.equal(createResult.rule.type, "expense");
  assert.equal(createResult.rule.entryKind, "Regular");

  const updateResult = buildRecurringRuleFromBody(
    {
      type: "income",
      status: "paused",
      amount: 2000,
      dayOfMonth: 10,
    },
    {
      existingRule: createResult.rule,
      now: "2026-04-02T10:00:00.000Z",
    },
  );

  assert.ok(!("error" in updateResult));
  assert.equal(updateResult.rule.type, "income");
  assert.equal(updateResult.rule.status, "paused");
  assert.equal(updateResult.rule.entryKind, null);

  const invalidResult = buildRecurringRuleFromBody(
    { name: "", amount: -1, dayOfMonth: 0 },
    { now: "2026-04-01T10:00:00.000Z" },
  );
  assert.deepEqual(invalidResult, {
    error: "name, amount, and day of month are required",
  });
});

test("applyRecurringRules generates due expense and income entries, catches up, and avoids duplicates", () => {
  const store = createStore();
  store.recurringRules.push(
    {
      id: "rule-expense",
      type: "expense",
      status: "add",
      name: "Rent",
      amount: 1200,
      frequency: "Monthly",
      dayOfMonth: 31,
      account: "Joint",
      category: "Home",
      entryKind: "Regular",
      counterparty: "Landlord",
      notes: null,
      startDate: "2026-01-31",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "rule-income",
      type: "income",
      status: "add",
      name: "Salary",
      amount: 8000,
      frequency: "Every 2 months",
      dayOfMonth: 15,
      account: "Main",
      category: "Salary",
      entryKind: null,
      counterparty: "Employer",
      notes: null,
      startDate: "2026-01-15",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "rule-paused",
      type: "expense",
      status: "paused",
      name: "Paused",
      amount: 99,
      frequency: "Monthly",
      dayOfMonth: 1,
      account: null,
      category: null,
      entryKind: "Regular",
      counterparty: null,
      notes: null,
      startDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  );

  const firstRun = applyRecurringRules(store, new Date("2026-04-20T12:00:00.000Z"));
  assert.equal(firstRun.createdEntries.length, 5);
  assert.equal(
    firstRun.createdEntries.filter((entry) => entry.linkedRecurringRuleId === "rule-expense").length,
    3,
  );
  assert.equal(
    firstRun.createdEntries.filter((entry) => entry.linkedRecurringRuleId === "rule-income").length,
    2,
  );
  assert.equal(
    firstRun.createdEntries.some((entry) => entry.linkedRecurringRuleId === "rule-paused"),
    false,
  );
  assert.equal(
    firstRun.createdEntries.some((entry) => entry.date === "2026-02-28"),
    true,
  );

  const secondRun = applyRecurringRules(store, new Date("2026-04-20T12:00:00.000Z"));
  assert.equal(secondRun.createdEntries.length, 0);
  assert.equal(buildRecurringRunResponse(firstRun).createdCount, 5);
});

test("recurring rule API supports list/create/update/toggle/delete", async () => {
  const repository = createInMemoryRepository({
    "user-1": createStore("user1", "user-1@example.com"),
  });
  const app = createTestApp(repository);

  const createResult = await requestApp(app, "/recurring-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "expense",
      status: "add",
      name: "Gym",
      amount: 50,
      frequency: "Monthly",
      dayOfMonth: 5,
      startDate: "2026-04-05",
    }),
  });

  assert.equal(createResult.response.status, 201);
  assert.equal(createResult.payload.name, "Gym");

  const listResult = await requestApp(app, "/recurring-rules");
  assert.equal(listResult.response.status, 200);
  assert.equal(listResult.payload.length, 1);

  const ruleId = createResult.payload.id;
  const toggleResult = await requestApp(app, `/recurring-rules/${ruleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "paused" }),
  });
  assert.equal(toggleResult.response.status, 200);
  assert.equal(toggleResult.payload.status, "paused");

  const deleteResult = await requestApp(app, `/recurring-rules/${ruleId}`, {
    method: "DELETE",
  });
  assert.equal(deleteResult.response.status, 200);
  assert.equal(deleteResult.payload.deleted, true);
});

test("runRecurringForAllUsers updates only changed stores and reports failures", async () => {
  const changedStore = createStore("alpha", "alpha@example.com");
  changedStore.recurringRules.push({
    id: "alpha-rule",
    type: "expense",
    status: "add",
    name: "Rent",
    amount: 1200,
    frequency: "Monthly",
    dayOfMonth: 1,
    account: null,
    category: "Home",
    entryKind: "Regular",
    counterparty: null,
    notes: null,
    startDate: "2026-04-01",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  });

  const unchangedStore = createStore("beta", "beta@example.com");
  unchangedStore.recurringRules.push({
    id: "beta-rule",
    type: "expense",
    status: "paused",
    name: "Paused",
    amount: 10,
    frequency: "Monthly",
    dayOfMonth: 1,
    account: null,
    category: null,
    entryKind: "Regular",
    counterparty: null,
    notes: null,
    startDate: "2026-04-01",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  });

  const savedUsers = [];
  const repository = {
    async listUserStores() {
      return [
        { uid: "alpha", store: structuredClone(changedStore) },
        { uid: "beta", store: structuredClone(unchangedStore) },
        { uid: "broken", store: structuredClone(changedStore) },
      ];
    },
    async saveUserStore(uid, store) {
      if (uid === "broken") {
        throw new Error("boom");
      }

      savedUsers.push({ uid, entries: store.entries.length });
    },
  };

  const summary = await runRecurringForAllUsers({
    repository,
    now: new Date("2026-04-03T12:00:00.000Z"),
    logger: { info() {} },
  });

  assert.equal(summary.scannedUsers, 3);
  assert.equal(summary.changedUsers, 1);
  assert.equal(summary.createdEntries, 1);
  assert.equal(summary.failures.length, 1);
  assert.equal(savedUsers.length, 1);
  assert.equal(savedUsers[0].uid, "alpha");
});
