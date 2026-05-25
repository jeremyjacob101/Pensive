import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const DEFAULT_ROW_COUNT = 5;
const DEFAULT_COL_COUNT = 4;

type NotepadTable = {
  id: string;
  title: string;
  cells: string[][];
};

type NotepadNote = {
  id: string;
  title: string;
  content: string;
};

function makeDefaultCells() {
  return Array.from({ length: DEFAULT_ROW_COUNT }, () =>
    Array.from({ length: DEFAULT_COL_COUNT }, () => ""));
}

function makeId(prefix: "table" | "note") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCells(cells: string[][] | undefined) {
  const source = Array.isArray(cells) ? cells : [];
  const rowCount = Math.max(1, source.length || 0);
  const colCount = Math.max(
    1,
    source.reduce((max, row) => {
      if (!Array.isArray(row)) return max;
      return Math.max(max, row.length);
    }, 0),
  );

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = Array.isArray(source[rowIndex]) ? source[rowIndex] : [];
    return Array.from({ length: colCount }, (_, colIndex) => {
      const cell = sourceRow[colIndex];
      return typeof cell === "string" ? cell : "";
    });
  });
}

function normalizeTables(input: {
  tables?: Array<{ id?: string; title?: string; cells?: string[][] }>;
  cells?: string[][];
}): NotepadTable[] {
  const rawTables = Array.isArray(input.tables) ? input.tables : [];
  if (rawTables.length > 0) {
    return rawTables.map((table, index) => ({
      id: table.id?.trim() || `legacy-table-${index + 1}`,
      title: (table.title ?? "").trim() || `Table ${index + 1}`,
      cells: normalizeCells(table.cells),
    }));
  }

  return [
    {
      id: "legacy-table-1",
      title: "Table 1",
      cells: normalizeCells(input.cells),
    },
  ];
}

function normalizeNotes(input: {
  notes?: Array<{ id?: string; title?: string; content?: string }>;
  notesText?: string;
}): NotepadNote[] {
  const rawNotes = Array.isArray(input.notes) ? input.notes : [];
  if (rawNotes.length > 0) {
    return rawNotes.map((note, index) => ({
      id: note.id?.trim() || `legacy-note-${index + 1}`,
      title: (note.title ?? "").trim() || `Note ${index + 1}`,
      content: note.content ?? "",
    }));
  }

  const legacyText = (input.notesText ?? "").trim();
  if (!legacyText) return [];

  return [
    {
      id: "legacy-note-1",
      title: "Note 1",
      content: input.notesText ?? "",
    },
  ];
}

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

async function findWorkspaceByUserId(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("notepadWorkspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .first();
}

async function getOrCreateWorkspace(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"notepadWorkspaces">> {
  const existing = await findWorkspaceByUserId(ctx, userId);
  if (existing) return existing;

  const now = Date.now();
  const workspaceId = await ctx.db.insert("notepadWorkspaces", {
    userId,
    notesText: "",
    notes: [],
    cells: makeDefaultCells(),
    tables: [
      {
        id: makeId("table"),
        title: "Table 1",
        cells: makeDefaultCells(),
      },
    ],
    updatedAt: now,
  });

  const created = await ctx.db.get(workspaceId);
  if (!created) throw new Error("Workspace creation failed");
  return created;
}

function findTableIndex(tables: NotepadTable[], tableId: string) {
  return tables.findIndex((table) => table.id === tableId);
}

function findNoteIndex(notes: NotepadNote[], noteId: string) {
  return notes.findIndex((note) => note.id === noteId);
}

function firstNoteText(notes: NotepadNote[]) {
  return notes[0]?.content ?? "";
}

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const workspace = await ctx.db
      .query("notepadWorkspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!workspace) {
      const notes: NotepadNote[] = [];
      const tables: NotepadTable[] = [
        {
          id: "legacy-table-1",
          title: "Table 1",
          cells: makeDefaultCells(),
        },
      ];

      return {
        _id: null,
        _creationTime: Date.now(),
        userId,
        notesText: "",
        notes,
        cells: makeDefaultCells(),
        tables,
        updatedAt: Date.now(),
      };
    }

    const notes = normalizeNotes(workspace);
    const tables = normalizeTables(workspace);

    return {
      ...workspace,
      notes,
      notesText: firstNoteText(notes),
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
    };
  },
});

export const saveNotes = mutation({
  args: {
    notesText: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const notes = normalizeNotes(workspace);
    if (notes.length === 0) {
      const trimmed = args.notesText.trim();
      if (trimmed) {
        notes.push({
          id: makeId("note"),
          title: "Note 1",
          content: args.notesText,
        });
      }
    } else {
      notes[0] = { ...notes[0], content: args.notesText };
    }

    await ctx.db.patch(workspace._id, {
      notes,
      notesText: args.notesText,
      updatedAt: Date.now(),
    });
  },
});

export const addNote = mutation({
  args: {
    noteId: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const notes = normalizeNotes(workspace);
    notes.push({
      id: args.noteId?.trim() || makeId("note"),
      title: args.title?.trim() || `Note ${notes.length + 1}`,
      content: "",
    });

    await ctx.db.patch(workspace._id, {
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const cleanupEmptyNotes = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const notes = normalizeNotes(workspace).filter(
      (note) => note.content.trim().length > 0,
    );
    const rawNotes = normalizeNotes(workspace);
    if (notes.length === rawNotes.length) return;

    await ctx.db.patch(workspace._id, {
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const renameNote = mutation({
  args: {
    noteId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const notes = normalizeNotes(workspace);
    const noteIndex = findNoteIndex(notes, args.noteId);
    if (noteIndex < 0) throw new Error("Note not found");

    notes[noteIndex] = {
      ...notes[noteIndex],
      title: args.title.trim() || notes[noteIndex].title,
    };

    await ctx.db.patch(workspace._id, {
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const saveNoteContent = mutation({
  args: {
    noteId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const notes = normalizeNotes(workspace);
    const noteIndex = findNoteIndex(notes, args.noteId);
    if (noteIndex < 0) throw new Error("Note not found");

    const nextContent = args.content;
    if (!nextContent.trim()) {
      notes.splice(noteIndex, 1);
    } else {
      notes[noteIndex] = {
        ...notes[noteIndex],
        content: nextContent,
      };
    }

    await ctx.db.patch(workspace._id, {
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const addTable = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const tables = normalizeTables(workspace);
    const notes = normalizeNotes(workspace);

    tables.push({
      id: makeId("table"),
      title: `Table ${tables.length + 1}`,
      cells: makeDefaultCells(),
    });

    await ctx.db.patch(workspace._id, {
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const renameTable = mutation({
  args: {
    tableId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const tables = normalizeTables(workspace);
    const notes = normalizeNotes(workspace);
    const index = findTableIndex(tables, args.tableId);
    if (index < 0) throw new Error("Table not found");

    tables[index] = {
      ...tables[index],
      title: args.title.trim() || tables[index].title,
    };

    await ctx.db.patch(workspace._id, {
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const deleteTable = mutation({
  args: {
    tableId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const tables = normalizeTables(workspace).filter(
      (table) => table.id !== args.tableId,
    );
    const notes = normalizeNotes(workspace);

    await ctx.db.patch(workspace._id, {
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const saveCell = mutation({
  args: {
    tableId: v.string(),
    rowIndex: v.number(),
    colIndex: v.number(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    if (
      !Number.isInteger(args.rowIndex) ||
      !Number.isInteger(args.colIndex) ||
      args.rowIndex < 0 ||
      args.colIndex < 0
    ) {
      throw new Error("Invalid cell coordinate");
    }

    const tables = normalizeTables(workspace);
    const notes = normalizeNotes(workspace);
    const tableIndex = findTableIndex(tables, args.tableId);
    if (tableIndex < 0) throw new Error("Table not found");

    const nextCells = normalizeCells(tables[tableIndex].cells);
    const rowCount = nextCells.length;
    const colCount = nextCells[0]?.length ?? 0;

    if (args.rowIndex >= rowCount || args.colIndex >= colCount) {
      throw new Error("Invalid cell coordinate");
    }

    nextCells[args.rowIndex][args.colIndex] = args.value;
    tables[tableIndex] = { ...tables[tableIndex], cells: nextCells };

    await ctx.db.patch(workspace._id, {
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const addRow = mutation({
  args: { tableId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const tables = normalizeTables(workspace);
    const notes = normalizeNotes(workspace);
    const tableIndex = findTableIndex(tables, args.tableId);
    if (tableIndex < 0) throw new Error("Table not found");

    const nextCells = normalizeCells(tables[tableIndex].cells);
    const colCount = nextCells[0]?.length ?? DEFAULT_COL_COUNT;
    nextCells.push(Array.from({ length: colCount }, () => ""));
    tables[tableIndex] = { ...tables[tableIndex], cells: nextCells };

    await ctx.db.patch(workspace._id, {
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const addColumn = mutation({
  args: { tableId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const tables = normalizeTables(workspace);
    const notes = normalizeNotes(workspace);
    const tableIndex = findTableIndex(tables, args.tableId);
    if (tableIndex < 0) throw new Error("Table not found");

    const nextCells = normalizeCells(tables[tableIndex].cells).map((row) => [
      ...row,
      "",
    ]);
    tables[tableIndex] = { ...tables[tableIndex], cells: nextCells };

    await ctx.db.patch(workspace._id, {
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const removeLastRow = mutation({
  args: { tableId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const tables = normalizeTables(workspace);
    const notes = normalizeNotes(workspace);
    const tableIndex = findTableIndex(tables, args.tableId);
    if (tableIndex < 0) throw new Error("Table not found");

    const nextCells = normalizeCells(tables[tableIndex].cells);
    if (nextCells.length <= 1) return;

    nextCells.pop();
    tables[tableIndex] = { ...tables[tableIndex], cells: nextCells };

    await ctx.db.patch(workspace._id, {
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});

export const removeLastColumn = mutation({
  args: { tableId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const workspace = await getOrCreateWorkspace(ctx, userId);
    if (workspace.userId !== userId) throw new Error("Workspace not found");

    const tables = normalizeTables(workspace);
    const notes = normalizeNotes(workspace);
    const tableIndex = findTableIndex(tables, args.tableId);
    if (tableIndex < 0) throw new Error("Table not found");

    const nextCells = normalizeCells(tables[tableIndex].cells);
    const colCount = nextCells[0]?.length ?? 1;
    if (colCount <= 1) return;

    tables[tableIndex] = {
      ...tables[tableIndex],
      cells: nextCells.map((row) => row.slice(0, -1)),
    };

    await ctx.db.patch(workspace._id, {
      tables,
      cells: tables[0]?.cells ?? makeDefaultCells(),
      notes,
      notesText: firstNoteText(notes),
      updatedAt: Date.now(),
    });
  },
});