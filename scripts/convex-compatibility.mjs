import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const urlFileIndex = process.argv.indexOf("--url-file");
const urlFile = urlFileIndex >= 0 ? process.argv[urlFileIndex + 1] : undefined;
const siteUrlFileIndex = process.argv.indexOf("--site-url-file");
const siteUrlFile =
  siteUrlFileIndex >= 0 ? process.argv[siteUrlFileIndex + 1] : undefined;
const credentialsFileIndex = process.argv.indexOf("--credentials-file");
const credentialsFile =
  credentialsFileIndex >= 0
    ? process.argv[credentialsFileIndex + 1]
    : undefined;

if (!urlFile || !siteUrlFile) {
  throw new Error(
    "Usage: node scripts/convex-compatibility.mjs --url-file <cloud path> --site-url-file <site path>",
  );
}

const cloudUrl = readFileSync(urlFile, "utf8").trim().replace(/\/$/, "");
const siteUrl = readFileSync(siteUrlFile, "utf8").trim().replace(/\/$/, "");
if (!cloudUrl.startsWith("https://") || !siteUrl.startsWith("https://")) {
  throw new Error("Compatibility targets must be HTTPS Convex deployment URLs");
}

const suffix = randomUUID().slice(0, 8);
let username = `compat-${Date.now().toString(36)}-${suffix}`.slice(0, 32);
let password = `Compat-${suffix}-Password!`;
const keepData = process.env.COMPAT_KEEP_DATA === "true";
const ids = {};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function responseSummary(result) {
  const body =
    result.payload === null
      ? "<non-JSON response>"
      : JSON.stringify(result.payload);
  return `${result.response.status} ${result.response.statusText}: ${body.slice(0, 500)}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function httpGet(path, token) {
  const result = await request(path, { token });
  assert(
    result.response.ok && result.payload?.ok === true,
    `HTTP GET contract failed: ${path} (${responseSummary(result)})`,
  );
  return result.payload.data;
}

async function httpPost(path, body, token) {
  const result = await request(path, {
    method: "POST",
    body,
    token,
  });
  assert(
    result.response.ok && result.payload?.ok === true,
    `HTTP POST contract failed: ${path} (${responseSummary(result)})`,
  );
  return result.payload.data;
}

async function signUp() {
  const result = await request("/api/auth/sign-up", {
    method: "POST",
    body: { username, password },
  });
  assert(
    result.response.ok && result.payload?.ok === true,
    `Compatibility user creation failed (${responseSummary(result)})`,
  );
  assert(
    typeof result.payload.data?.token === "string",
    "Compatibility auth token missing",
  );
  return result.payload.data;
}

async function signIn() {
  const result = await request("/api/auth/sign-in", {
    method: "POST",
    body: { username, password },
  });
  assert(
    result.response.ok && result.payload?.ok === true,
    `Compatibility user sign-in failed (${responseSummary(result)})`,
  );
  assert(
    typeof result.payload.data?.token === "string",
    "Compatibility auth token missing after sign-in",
  );
  return result.payload.data;
}

function loadSavedCredentials() {
  if (!credentialsFile || !existsSync(credentialsFile)) return null;

  const saved = JSON.parse(readFileSync(credentialsFile, "utf8"));
  assert(
    typeof saved?.username === "string" && typeof saved?.password === "string",
    "Compatibility credentials fixture is invalid",
  );
  username = saved.username;
  password = saved.password;
  return saved;
}

function saveCredentials() {
  if (!credentialsFile) return;
  writeFileSync(credentialsFile, JSON.stringify({ username, password }), {
    encoding: "utf8",
    mode: 0o600,
  });
}

function paginationOpts() {
  return { cursor: null, numItems: 10 };
}

function expenseInput(id, label) {
  return {
    expense: label,
    account: "Compatibility Account",
    category: "Compatibility Category",
    subcategory: "Compatibility Subcategory",
    amount: 12.34,
    date: "2025-01-15",
    paidTo: "Compatibility Payee",
    notes: "compatibility fixture",
    comments: "compatibility fixture",
    expenseId: id,
  };
}

function incomingInput(id, label) {
  return {
    incoming: label,
    paidBy: "Compatibility Payer",
    incomeType: "Compatibility Income",
    incomeSubtype: "Compatibility Income Subtype",
    account: "Compatibility Account",
    amount: 45.67,
    date: "2025-01-16",
    notes: "compatibility fixture",
    comments: "compatibility fixture",
    incomingId: id,
  };
}

function recurringExpenseInput(name) {
  return {
    status: "active",
    kind: "expense",
    name,
    amount: 9.99,
    frequency: "Monthly",
    dayOfMonth: 1,
    recurringExpenseAccount: "Compatibility Account",
    recurringExpenseCategory: "Compatibility Category",
    recurringExpenseSubcategory: "Compatibility Subcategory",
    recurringExpensePaidTo: "Compatibility Payee",
    notes: "compatibility fixture",
  };
}

async function runDirectConvexContracts(client) {
  const expenses = api.expenses;
  const incomings = api.incomings;
  const recurrings = api.recurrings;
  const options = api.userOptions;
  const notepad = api.notepad;
  const paybackLinks = api.paybackLinks;

  ids.expenseA = await client.mutation(
    expenses.create,
    expenseInput(`compat-expense-a-${suffix}`, "Expense A"),
  );
  ids.expenseB = await client.mutation(
    expenses.create,
    expenseInput(`compat-expense-b-${suffix}`, "Expense B"),
  );
  ids.incomingA = await client.mutation(
    incomings.create,
    incomingInput(`compat-incoming-a-${suffix}`, "Incoming A"),
  );
  ids.incomingB = await client.mutation(
    incomings.create,
    incomingInput(`compat-incoming-b-${suffix}`, "Incoming B"),
  );

  const expensePage = await client.query(expenses.list, {
    paginationOpts: paginationOpts(),
  });
  assert(
    Array.isArray(expensePage?.page) &&
      typeof expensePage?.isDone === "boolean",
    "Expense pagination response shape changed",
  );
  await client.query(expenses.listByAccount, {
    account: "Compatibility Account",
    paginationOpts: paginationOpts(),
  });
  await client.query(expenses.listByDateScope, {
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    targetMonths: ["2025-01"],
    includeMonthYearOverlapOutsideDate: true,
  });
  await client.query(expenses.monthBounds, {});
  await client.query(expenses.previousMonthBefore, { month: "2025-02" });

  const incomingPage = await client.query(incomings.list, {
    paginationOpts: paginationOpts(),
  });
  assert(
    Array.isArray(incomingPage?.page) &&
      typeof incomingPage?.isDone === "boolean",
    "Incoming pagination response shape changed",
  );
  await client.query(incomings.listByAccount, {
    account: "Compatibility Account",
    paginationOpts: paginationOpts(),
  });
  await client.query(incomings.listByDateScope, {
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    targetMonths: ["2025-01"],
    includeMonthYearOverlapOutsideDate: true,
  });
  await client.query(incomings.monthBounds, {});
  await client.query(incomings.previousMonthBefore, { month: "2025-02" });

  await client.mutation(expenses.update, {
    id: ids.expenseA,
    ...expenseInput(`compat-expense-a-${suffix}`, "Expense A updated"),
  });
  await client.mutation(incomings.update, {
    id: ids.incomingA,
    ...incomingInput(`compat-incoming-a-${suffix}`, "Incoming A updated"),
  });

  const expenseBulk = await client.mutation(expenses.bulkCreate, {
    rows: [
      expenseInput(`compat-expense-c-${suffix}`, "Expense C"),
      expenseInput(`compat-expense-d-${suffix}`, "Expense D"),
    ],
  });
  assert(expenseBulk?.inserted === 2, "Expense bulk-create contract failed");
  const incomingBulk = await client.mutation(incomings.bulkCreate, {
    rows: [
      incomingInput(`compat-incoming-c-${suffix}`, "Incoming C"),
      incomingInput(`compat-incoming-d-${suffix}`, "Incoming D"),
    ],
  });
  assert(incomingBulk?.inserted === 2, "Incoming bulk-create contract failed");

  await client.mutation(expenses.bulkPatchVisible, {
    ids: [ids.expenseA],
    patch: { notes: "patched", comments: "patched" },
  });
  await client.mutation(incomings.bulkPatchVisible, {
    ids: [ids.incomingA],
    patch: { notes: "patched", comments: "patched" },
  });

  const expenseGroup = await client.mutation(expenses.linkExistingExpenses, {
    expenseIds: [ids.expenseA, ids.expenseB],
    baseExpenseLabel: "Compatibility Expense Group",
  });
  await client.mutation(expenses.renameBaseExpense, {
    baseExpenseId: expenseGroup.baseExpenseId,
    baseExpenseLabel: "Compatibility Expense Group Renamed",
  });
  await client.mutation(expenses.unlinkExpenseFromPartners, {
    expenseId: ids.expenseB,
  });

  const incomingGroup = await client.mutation(incomings.addPartnerIncoming, {
    anchorIncomingId: ids.incomingA,
    partnerIncomingId: ids.incomingB,
  });
  await client.mutation(incomings.unlinkIncomingFromPartners, {
    incomingId: ids.incomingB,
  });
  assert(
    typeof incomingGroup.baseIncomingId === "string",
    "Incoming partnership contract failed",
  );

  const link = await client.mutation(paybackLinks.create, {
    expenseId: ids.expenseA,
    incomingId: ids.incomingA,
    allocatedAmount: 2.5,
    notes: "compatibility link",
  });
  assert(typeof link?.id === "string", "Payback link response shape changed");
  await client.query(paybackLinks.listForExpense, { expenseId: ids.expenseA });
  await client.query(paybackLinks.listForIncoming, {
    incomingId: ids.incomingA,
  });
  await client.query(paybackLinks.listIncomingCandidates, {});
  await client.query(paybackLinks.listExpenseCandidates, {});
  await client.mutation(paybackLinks.update, {
    id: link.id,
    allocatedAmount: 3.5,
    notes: "updated compatibility link",
  });
  await client.mutation(paybackLinks.remove, { id: link.id });

  ids.recurring = await client.mutation(
    recurrings.create,
    recurringExpenseInput(`Compatibility recurring ${suffix}`),
  );
  await client.query(recurrings.list, { paginationOpts: paginationOpts() });
  await client.mutation(recurrings.update, {
    id: ids.recurring,
    ...recurringExpenseInput(`Compatibility recurring updated ${suffix}`),
  });
  await client.mutation(recurrings.setStatus, {
    id: ids.recurring,
    status: "inactive",
  });
  await client.mutation(recurrings.materializeDueExpenses, {
    runDate: "2099-01-01",
  });
  await client.mutation(recurrings.remove, { id: ids.recurring });
  const recurringBulk = await client.mutation(recurrings.bulkCreate, {
    rows: [
      recurringExpenseInput(`Compatibility recurring bulk A ${suffix}`),
      recurringExpenseInput(`Compatibility recurring bulk B ${suffix}`),
    ],
  });
  assert(
    recurringBulk?.inserted === 2,
    "Recurring bulk-create contract failed",
  );
  await client.mutation(recurrings.clearAll, { batchSize: 50 });

  const summary = await client.query(api.summaries.range, {
    startDate: "2025-01-01",
    endDate: "2025-01-31",
  });
  assert(
    summary?.totals && Array.isArray(summary?.monthlyBuckets),
    "Summary response shape changed",
  );
  const tracking = await client.query(api.tracking.list, {});
  assert(
    tracking && typeof tracking === "object",
    "Tracking response shape changed",
  );

  await client.mutation(options.add, {
    kind: "account",
    value: `Compat Account ${suffix}`,
  });
  await client.mutation(options.add, {
    kind: "category",
    value: `Compat Category ${suffix}`,
  });
  await client.mutation(options.add, {
    kind: "subcategory",
    value: `Compat Subcategory ${suffix}`,
    parentValue: `Compat Category ${suffix}`,
  });
  await client.mutation(options.add, {
    kind: "incomeType",
    value: `Compat Income ${suffix}`,
  });
  await client.mutation(options.add, {
    kind: "incomeSubtype",
    value: `Compat Income Subtype ${suffix}`,
    parentValue: `Compat Income ${suffix}`,
  });
  const optionLists = await client.query(options.list, {});
  assert(
    optionLists?.account && optionLists?.category && optionLists?.incomeType,
    "User options response shape changed",
  );
  await client.mutation(options.updateColor, {
    kind: "category",
    value: `Compat Category ${suffix}`,
    color: "#123456",
  });
  await client.mutation(options.setDefault, {
    kind: "category",
    value: `Compat Category ${suffix}`,
    isDefault: true,
  });
  await client.mutation(options.setTracking, {
    kind: "category",
    value: `Compat Category ${suffix}`,
    isTracking: true,
  });
  await client.mutation(options.rename, {
    kind: "account",
    value: `Compat Account ${suffix}`,
    nextValue: `Compat Account Renamed ${suffix}`,
  });

  await client.mutation(options.add, {
    kind: "category",
    value: `Compat Source ${suffix}`,
  });
  await client.mutation(options.add, {
    kind: "category",
    value: `Compat Target ${suffix}`,
  });
  await client.mutation(options.add, {
    kind: "subcategory",
    value: `Compat Child ${suffix}`,
    parentValue: `Compat Source ${suffix}`,
  });
  await client.mutation(options.moveToSubtype, {
    kind: "category",
    sourceValue: `Compat Source ${suffix}`,
    targetValue: `Compat Target ${suffix}`,
  });
  await client.mutation(options.add, {
    kind: "category",
    value: `Compat Target Two ${suffix}`,
  });
  await client.mutation(options.moveSubtype, {
    kind: "subcategory",
    value: `Compat Child ${suffix}`,
    sourceParentValue: `Compat Target ${suffix}`,
    targetParentValue: `Compat Target Two ${suffix}`,
  });
  await client.mutation(options.promoteSubtype, {
    kind: "subcategory",
    value: `Compat Child ${suffix}`,
    parentValue: `Compat Target Two ${suffix}`,
  });
  await client.mutation(options.remove, {
    kind: "account",
    value: `Compat Account Renamed ${suffix}`,
  });

  const initialWorkspace = await client.query(notepad.getMine, {});
  assert(
    Array.isArray(initialWorkspace?.notes) &&
      Array.isArray(initialWorkspace?.tables),
    "Notepad response shape changed",
  );
  await client.mutation(notepad.addNote, {
    noteId: `compat-note-${suffix}`,
    title: "Compatibility note",
    content: "compatibility content",
  });
  await client.mutation(notepad.renameNote, {
    noteId: `compat-note-${suffix}`,
    title: "Renamed compatibility note",
  });
  await client.mutation(notepad.saveNoteContent, {
    noteId: `compat-note-${suffix}`,
    content: "updated compatibility content",
  });
  await client.mutation(notepad.cleanupEmptyNotes, {});
  await client.mutation(notepad.addTable, {
    tableId: `compat-table-${suffix}`,
    title: "Compatibility table",
    cells: [
      ["a", "b"],
      ["c", "d"],
    ],
  });
  await client.mutation(notepad.updateTable, {
    tableId: `compat-table-${suffix}`,
    title: "Updated compatibility table",
    cells: [
      ["1", "2"],
      ["3", "4"],
    ],
  });
  await client.mutation(notepad.renameTable, {
    tableId: `compat-table-${suffix}`,
    title: "Renamed compatibility table",
  });
  await client.mutation(notepad.saveCell, {
    tableId: `compat-table-${suffix}`,
    rowIndex: 0,
    colIndex: 0,
    value: "updated",
  });
  await client.mutation(notepad.addRow, { tableId: `compat-table-${suffix}` });
  await client.mutation(notepad.addColumn, {
    tableId: `compat-table-${suffix}`,
  });
  await client.mutation(notepad.removeLastRow, {
    tableId: `compat-table-${suffix}`,
  });
  await client.mutation(notepad.removeLastColumn, {
    tableId: `compat-table-${suffix}`,
  });
  await client.mutation(notepad.deleteNote, {
    noteId: `compat-note-${suffix}`,
  });
  await client.mutation(notepad.deleteTable, {
    tableId: `compat-table-${suffix}`,
  });

  await client.mutation(expenses.removeBaseExpense, {
    baseExpenseId: expenseGroup.baseExpenseId,
  });
  ids.expenseE = await client.mutation(
    expenses.create,
    expenseInput(`compat-expense-e-${suffix}`, "Expense E"),
  );
  await client.mutation(expenses.remove, { id: ids.expenseE });
  await client.mutation(incomings.remove, { id: ids.incomingA });
  await client.mutation(expenses.clearAll, { batchSize: 50 });
  await client.mutation(incomings.clearAll, { batchSize: 50 });
}

async function runHttpContracts(token, refreshToken) {
  await httpGet("/api/auth/session", token);
  const refreshed = await httpPost(
    "/api/auth/refresh",
    { refreshToken },
    token,
  );
  const activeToken = refreshed.token ?? token;

  const expense = await httpPost(
    "/api/expenses/create",
    expenseInput(`http-expense-${suffix}`, "HTTP Expense"),
    activeToken,
  );
  const incoming = await httpPost(
    "/api/incomings/create",
    incomingInput(`http-incoming-${suffix}`, "HTTP Incoming"),
    activeToken,
  );

  await httpGet("/api/expenses/month-bounds", activeToken);
  await httpPost(
    "/api/expenses/list-by-account",
    { account: "Compatibility Account", paginationOpts: paginationOpts() },
    activeToken,
  );
  await httpPost(
    "/api/expenses/list-by-date-scope",
    {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      targetMonths: ["2025-01"],
      includeMonthYearOverlapOutsideDate: true,
    },
    activeToken,
  );
  await httpPost(
    "/api/expenses/update",
    {
      id: expense,
      ...expenseInput(`http-expense-${suffix}`, "HTTP Expense updated"),
    },
    activeToken,
  );
  await httpPost(
    "/api/expenses/bulk-create",
    {
      rows: [expenseInput(`http-expense-bulk-${suffix}`, "HTTP Expense bulk")],
    },
    activeToken,
  );
  await httpPost(
    "/api/expenses/bulk-patch-visible",
    { ids: [expense], patch: { notes: "patched" } },
    activeToken,
  );
  await httpPost(
    "/api/expenses/add-partner-expense",
    {
      anchorExpenseId: expense,
      partnerExpenseId: await httpPost(
        "/api/expenses/create",
        expenseInput(`http-expense-partner-${suffix}`, "HTTP Expense partner"),
        activeToken,
      ),
    },
    activeToken,
  );
  await httpPost(
    "/api/expenses/rename-base-expense",
    {
      baseExpenseId: `http-expense-${suffix}`,
      baseExpenseLabel: "HTTP Expense group",
    },
    activeToken,
  );
  await httpPost(
    "/api/expenses/unlink-expense-from-partners",
    { expenseId: expense },
    activeToken,
  );
  await httpPost(
    "/api/expenses/remove-base-expense",
    { baseExpenseId: `http-expense-${suffix}` },
    activeToken,
  );

  await httpGet("/api/incomings/month-bounds", activeToken);
  await httpPost(
    "/api/incomings/list-by-account",
    { account: "Compatibility Account", paginationOpts: paginationOpts() },
    activeToken,
  );
  await httpPost(
    "/api/incomings/list-by-date-scope",
    {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      targetMonths: ["2025-01"],
      includeMonthYearOverlapOutsideDate: true,
    },
    activeToken,
  );
  await httpPost(
    "/api/incomings/update",
    {
      id: incoming,
      ...incomingInput(`http-incoming-${suffix}`, "HTTP Incoming updated"),
    },
    activeToken,
  );
  await httpPost(
    "/api/incomings/bulk-create",
    {
      rows: [
        incomingInput(`http-incoming-bulk-${suffix}`, "HTTP Incoming bulk"),
      ],
    },
    activeToken,
  );
  await httpPost(
    "/api/incomings/bulk-patch-visible",
    { ids: [incoming], patch: { notes: "patched" } },
    activeToken,
  );
  await httpPost(
    "/api/incomings/add-partner-incoming",
    {
      anchorIncomingId: incoming,
      partnerIncomingId: await httpPost(
        "/api/incomings/create",
        incomingInput(
          `http-incoming-partner-${suffix}`,
          "HTTP Incoming partner",
        ),
        activeToken,
      ),
    },
    activeToken,
  );
  await httpPost(
    "/api/incomings/unlink-incoming-from-partners",
    { incomingId: incoming },
    activeToken,
  );
  await httpPost("/api/incomings/remove", { id: incoming }, activeToken);

  const recurring = await httpPost(
    "/api/recurrings/create",
    recurringExpenseInput(`HTTP recurring ${suffix}`),
    activeToken,
  );
  await httpPost(
    "/api/recurrings/list",
    { paginationOpts: paginationOpts() },
    activeToken,
  );
  await httpPost(
    "/api/recurrings/update",
    {
      id: recurring,
      ...recurringExpenseInput(`HTTP recurring updated ${suffix}`),
    },
    activeToken,
  );
  await httpPost(
    "/api/recurrings/set-status",
    { id: recurring, status: "inactive" },
    activeToken,
  );
  await httpPost(
    "/api/recurrings/materialize-due-expenses",
    { runDate: "2099-01-01" },
    activeToken,
  );
  await httpPost("/api/recurrings/remove", { id: recurring }, activeToken);

  await httpPost(
    "/api/summaries/range",
    { startDate: "2025-01-01", endDate: "2025-01-31" },
    activeToken,
  );
  await httpGet("/api/tracking/list", activeToken);

  await httpGet("/api/notepad/get-mine", activeToken);
  await httpPost(
    "/api/notepad/add-note",
    { noteId: `http-note-${suffix}`, title: "HTTP note", content: "content" },
    activeToken,
  );
  await httpPost(
    "/api/notepad/rename-note",
    { noteId: `http-note-${suffix}`, title: "HTTP note renamed" },
    activeToken,
  );
  await httpPost(
    "/api/notepad/save-note-content",
    { noteId: `http-note-${suffix}`, content: "updated" },
    activeToken,
  );
  await httpPost("/api/notepad/cleanup-empty-notes", {}, activeToken);
  await httpPost(
    "/api/notepad/add-table",
    {
      tableId: `http-table-${suffix}`,
      title: "HTTP table",
      cells: [
        ["a", "b"],
        ["c", "d"],
      ],
    },
    activeToken,
  );
  await httpPost(
    "/api/notepad/update-table",
    {
      tableId: `http-table-${suffix}`,
      title: "HTTP table updated",
      cells: [
        ["1", "2"],
        ["3", "4"],
      ],
    },
    activeToken,
  );
  await httpPost(
    "/api/notepad/rename-table",
    { tableId: `http-table-${suffix}`, title: "HTTP table renamed" },
    activeToken,
  );
  await httpPost(
    "/api/notepad/save-cell",
    {
      tableId: `http-table-${suffix}`,
      rowIndex: 0,
      colIndex: 0,
      value: "updated",
    },
    activeToken,
  );
  await httpPost(
    "/api/notepad/add-row",
    { tableId: `http-table-${suffix}` },
    activeToken,
  );
  await httpPost(
    "/api/notepad/add-column",
    { tableId: `http-table-${suffix}` },
    activeToken,
  );
  await httpPost(
    "/api/notepad/remove-last-row",
    { tableId: `http-table-${suffix}` },
    activeToken,
  );
  await httpPost(
    "/api/notepad/remove-last-column",
    { tableId: `http-table-${suffix}` },
    activeToken,
  );
  await httpPost(
    "/api/notepad/delete-note",
    { noteId: `http-note-${suffix}` },
    activeToken,
  );
  await httpPost(
    "/api/notepad/delete-table",
    { tableId: `http-table-${suffix}` },
    activeToken,
  );

  const optionCategory = `HTTP Category ${suffix}`;
  await httpPost(
    "/api/user-options/add",
    { kind: "category", value: optionCategory },
    activeToken,
  );
  await httpGet("/api/user-options/list", activeToken);
  await httpPost(
    "/api/user-options/update-color",
    { kind: "category", value: optionCategory, color: "#123456" },
    activeToken,
  );
  await httpPost(
    "/api/user-options/set-default",
    { kind: "category", value: optionCategory, isDefault: true },
    activeToken,
  );
  await httpPost(
    "/api/user-options/set-tracking",
    { kind: "category", value: optionCategory, isTracking: true },
    activeToken,
  );
  await httpPost(
    "/api/user-options/rename",
    {
      kind: "category",
      value: optionCategory,
      nextValue: `${optionCategory} renamed`,
    },
    activeToken,
  );
  await httpPost(
    "/api/user-options/remove",
    { kind: "category", value: `${optionCategory} renamed` },
    activeToken,
  );
  await httpPost(
    "/api/user-options/add",
    { kind: "category", value: `HTTP Source ${suffix}` },
    activeToken,
  );
  await httpPost(
    "/api/user-options/add",
    { kind: "category", value: `HTTP Target ${suffix}` },
    activeToken,
  );
  await httpPost(
    "/api/user-options/add",
    {
      kind: "subcategory",
      value: `HTTP Child ${suffix}`,
      parentValue: `HTTP Source ${suffix}`,
    },
    activeToken,
  );
  await httpPost(
    "/api/user-options/move-to-subtype",
    {
      kind: "category",
      sourceValue: `HTTP Source ${suffix}`,
      targetValue: `HTTP Target ${suffix}`,
    },
    activeToken,
  );
  await httpPost(
    "/api/user-options/add",
    { kind: "category", value: `HTTP Target Two ${suffix}` },
    activeToken,
  );
  await httpPost(
    "/api/user-options/move-subtype",
    {
      kind: "subcategory",
      value: `HTTP Child ${suffix}`,
      sourceParentValue: `HTTP Target ${suffix}`,
      targetParentValue: `HTTP Target Two ${suffix}`,
    },
    activeToken,
  );
  await httpPost(
    "/api/user-options/promote-subtype",
    {
      kind: "subcategory",
      value: `HTTP Child ${suffix}`,
      parentValue: `HTTP Target Two ${suffix}`,
    },
    activeToken,
  );

  const httpPaybackIncoming = await httpPost(
    "/api/incomings/create",
    incomingInput(`http-payback-incoming-${suffix}`, "HTTP Payback Incoming"),
    activeToken,
  );
  const httpLink = await httpPost(
    "/api/payback-links/create",
    {
      expenseId: expense,
      incomingId: httpPaybackIncoming,
      allocatedAmount: 1.25,
      notes: "HTTP payback",
    },
    activeToken,
  );
  await httpPost(
    "/api/payback-links/list-for-expense",
    { expenseId: expense },
    activeToken,
  );
  await httpPost(
    "/api/payback-links/list-for-incoming",
    { incomingId: httpPaybackIncoming },
    activeToken,
  );
  await httpGet("/api/payback-links/list-incoming-candidates", activeToken);
  await httpGet("/api/payback-links/list-expense-candidates", activeToken);
  await httpPost(
    "/api/payback-links/update",
    { id: httpLink.id, allocatedAmount: 2 },
    activeToken,
  );
  await httpPost("/api/payback-links/remove", { id: httpLink.id }, activeToken);

  await httpPost("/api/expenses/remove", { id: expense }, activeToken);
  if (keepData) return;

  await httpPost("/api/auth/sign-out", {}, activeToken);
  const signedIn = await httpPost(
    "/api/auth/sign-in",
    { username, password },
    activeToken,
  );
  await httpPost("/api/auth/delete-account", {}, signedIn.token);
}

async function main() {
  const savedCredentials = loadSavedCredentials();
  const auth = savedCredentials ? await signIn() : await signUp();
  saveCredentials();
  const client = new ConvexHttpClient(cloudUrl);
  client.setAuth(auth.token);

  await runDirectConvexContracts(client);
  await runHttpContracts(auth.token, auth.refreshToken);

  console.log("Convex direct and HTTP compatibility contracts passed");
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Compatibility contracts failed",
  );
  process.exitCode = 1;
});