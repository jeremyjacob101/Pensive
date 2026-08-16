import { asUser, createUser, makeConvexTest, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex notepad", () => {
  it("returns a default table without persisting a workspace", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "notepad-user");
    const client = asUser(t, user);
    const workspace = await client.query(testApi.notepad.getMine, {});
    expect(workspace._id).toBeNull();
    expect(workspace.notes).toEqual([]);
    expect(workspace.tables).toHaveLength(1);
    expect(workspace.tables[0].cells).toHaveLength(5);
    expect(workspace.tables[0].cells[0]).toHaveLength(4);
  });

  it("supports notes and table editing with normalization", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "notepad-editor");
    const client = asUser(t, user);
    await client.mutation(testApi.notepad.addNote, {
      noteId: "note-1",
      title: "  Ideas ",
      content: "first content",
    });
    await client.mutation(testApi.notepad.renameNote, {
      noteId: "note-1",
      title: "  Better ideas ",
    });
    await client.mutation(testApi.notepad.saveNoteContent, {
      noteId: "note-1",
      content: "updated",
    });
    await client.mutation(testApi.notepad.addTable, {
      tableId: "table-2",
      title: "  Budget ",
      cells: [["a"], ["b", "c"]],
    });

    let workspace = await client.query(testApi.notepad.getMine, {});
    const note = workspace.notes?.find((row) => row.id === "note-1");
    const table = workspace.tables?.find((row) => row.id === "table-2");
    expect(note).toMatchObject({ title: "Better ideas", content: "updated" });
    expect(table).toMatchObject({
      title: "Budget",
      cells: [
        ["a", ""],
        ["b", "c"],
      ],
    });

    await client.mutation(testApi.notepad.saveCell, {
      tableId: "table-2",
      rowIndex: 1,
      colIndex: 0,
      value: "changed",
    });
    await client.mutation(testApi.notepad.addRow, { tableId: "table-2" });
    await client.mutation(testApi.notepad.addColumn, { tableId: "table-2" });
    workspace = await client.query(testApi.notepad.getMine, {});
    const updated = workspace.tables?.find((row) => row.id === "table-2");
    expect(updated?.cells).toEqual([
      ["a", "", ""],
      ["changed", "c", ""],
      ["", "", ""],
    ]);

    await expect(
      client.mutation(testApi.notepad.saveCell, {
        tableId: "table-2",
        rowIndex: -1,
        colIndex: 0,
        value: "bad",
      }),
    ).rejects.toThrow("Invalid cell coordinate");
    await client.mutation(testApi.notepad.saveNoteContent, {
      noteId: "note-1",
      content: "   ",
    });
    workspace = await client.query(testApi.notepad.getMine, {});
    expect(workspace.notes?.some((row) => row.id === "note-1")).toBe(false);
  });

  it("keeps workspaces isolated", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "notepad-alice");
    const bob = await createUser(t, "notepad-bob");
    await asUser(t, alice).mutation(testApi.notepad.addNote, {
      noteId: "alice-note",
      content: "private",
    });
    const bobWorkspace = await asUser(t, bob).query(
      testApi.notepad.getMine,
      {},
    );
    expect(bobWorkspace.notes).toEqual([]);
  });
});