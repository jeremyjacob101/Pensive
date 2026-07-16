import { columnLabel, makeClientNoteId, makeClientTableId, normalizeCells, parseNumberArray, parseSizeMap } from "../helpers/notepad";
import { NOTEPAD_COL_WIDTHS_BY_TABLE_KEY, NOTEPAD_ROW_HEIGHTS_BY_TABLE_KEY } from "../keys/notepad";
import { EntryModal, FormField, ModalActions } from "../components/EntryModal";
import type { NotepadNote, NotepadTable } from "../types/notepad";
import { Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useMutation, useQuery } from "convex/react";
import { api } from "@pensive/convex-api";

const DEFAULT_COL_COUNT = 4;
const DEFAULT_COL_WIDTH = 104;
const DEFAULT_ROW_HEIGHT = 30;
const MIN_COL_WIDTH = 36;
const MIN_ROW_HEIGHT = 10;

export function Notepad() {
  const workspace = useQuery(api.notepad.getMine);
  const addNote = useMutation(api.notepad.addNote);
  const renameNote = useMutation(api.notepad.renameNote);
  const deleteNote = useMutation(api.notepad.deleteNote);
  const saveNoteContent = useMutation(api.notepad.saveNoteContent);
  const addTable = useMutation(api.notepad.addTable);
  const renameTable = useMutation(api.notepad.renameTable);
  const deleteTable = useMutation(api.notepad.deleteTable);
  const saveCell = useMutation(api.notepad.saveCell);
  const addRow = useMutation(api.notepad.addRow);
  const addColumn = useMutation(api.notepad.addColumn);
  const removeLastRow = useMutation(api.notepad.removeLastRow);
  const removeLastColumn = useMutation(api.notepad.removeLastColumn);

  const [storedColWidths, setStoredColWidths] = useLocalStorage(
    NOTEPAD_COL_WIDTHS_BY_TABLE_KEY,
    "{}",
  );
  const [storedRowHeights, setStoredRowHeights] = useLocalStorage(
    NOTEPAD_ROW_HEIGHTS_BY_TABLE_KEY,
    "{}",
  );

  const [notes, setNotes] = useState<NotepadNote[]>([]);
  const [tables, setTables] = useState<NotepadTable[]>([]);
  const [editingTableIds, setEditingTableIds] = useState<
    Record<string, boolean>
  >({});
  const [editingNoteIds, setEditingNoteIds] = useState<Record<string, boolean>>(
    {},
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<"note" | "table" | null>(null);
  const [draftNoteTitle, setDraftNoteTitle] = useState("");
  const [draftNoteContent, setDraftNoteContent] = useState("");
  const [draftTableTitle, setDraftTableTitle] = useState("");
  const [draftTableCells, setDraftTableCells] = useState<string[][]>([[""]]);
  const [creating, setCreating] = useState(false);

  const notesSyncedRef = useRef(false);
  const tablesSyncedRef = useRef(false);
  const noteContentTimersRef = useRef<Record<string, number>>({});
  const noteTitleTimersRef = useRef<Record<string, number>>({});
  const tableTitleTimersRef = useRef<Record<string, number>>({});

  const colWidthMap = useMemo(
    () => parseSizeMap(storedColWidths),
    [storedColWidths],
  );
  const rowHeightMap = useMemo(
    () => parseSizeMap(storedRowHeights),
    [storedRowHeights],
  );

  useEffect(() => {
    if (workspace === undefined) return;

    if (!notesSyncedRef.current) {
      const nextNotes = (workspace.notes ?? []).map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
      }));
      setNotes(nextNotes.filter((note) => note.content.trim().length > 0));
      notesSyncedRef.current = true;
    }

    if (!tablesSyncedRef.current) {
      const nextTables = (workspace.tables ?? []).map((table) => ({
        id: table.id,
        title: table.title,
        cells: normalizeCells(table.cells),
      }));
      setTables(nextTables);
      tablesSyncedRef.current = true;
    }
  }, [workspace]);

  const setTableColWidth = (
    tableId: string,
    colCount: number,
    colIndex: number,
    value: number,
  ) => {
    setStoredColWidths((currentRaw) => {
      const map = parseSizeMap(currentRaw);
      const current = parseNumberArray(
        JSON.stringify(map[tableId] ?? []),
        colCount,
        DEFAULT_COL_WIDTH,
        MIN_COL_WIDTH,
      );
      current[colIndex] = Math.max(MIN_COL_WIDTH, value);
      map[tableId] = current;
      return JSON.stringify(map);
    });
  };

  const setTableRowHeight = (
    tableId: string,
    rowCount: number,
    rowIndex: number,
    value: number,
  ) => {
    setStoredRowHeights((currentRaw) => {
      const map = parseSizeMap(currentRaw);
      const current = parseNumberArray(
        JSON.stringify(map[tableId] ?? []),
        rowCount,
        DEFAULT_ROW_HEIGHT,
        MIN_ROW_HEIGHT,
      );
      current[rowIndex] = Math.max(MIN_ROW_HEIGHT, value);
      map[tableId] = current;
      return JSON.stringify(map);
    });
  };

  const openNoteDraft = () => {
    setSaveError(null);
    setDraftNoteTitle("");
    setDraftNoteContent("");
    setCreateMode("note");
  };

  const openTableDraft = () => {
    setSaveError(null);
    setDraftTableTitle("");
    setDraftTableCells([[""]]);
    setCreateMode("table");
  };

  const closeCreateModal = () => {
    if (!creating) setCreateMode(null);
  };

  const canSaveNote =
    draftNoteTitle.trim().length > 0 && draftNoteContent.trim().length > 0;
  const canSaveTable =
    draftTableTitle.trim().length > 0 ||
    draftTableCells.some((row) => row.some((cell) => cell.trim().length > 0));

  const handleCreateNote = async () => {
    if (!canSaveNote || creating) return;
    const note: NotepadNote = {
      id: makeClientNoteId(),
      title: draftNoteTitle.trim(),
      content: draftNoteContent.trim(),
    };

    setCreating(true);
    setSaveError(null);
    try {
      await addNote({
        noteId: note.id,
        title: note.title,
        content: note.content,
      });
      setNotes((current) => [...current, note]);
      setCreateMode(null);
    } catch {
      setSaveError("Could not create the note.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateTable = async () => {
    if (!canSaveTable || creating) return;
    const table: NotepadTable = {
      id: makeClientTableId(),
      title: draftTableTitle.trim() || "Untitled Table",
      cells: normalizeCells(draftTableCells),
    };

    setCreating(true);
    setSaveError(null);
    try {
      await addTable({
        tableId: table.id,
        title: table.title,
        cells: table.cells,
      });
      setTables((current) => [...current, table]);
      setCreateMode(null);
    } catch {
      setSaveError("Could not create the table.");
    } finally {
      setCreating(false);
    }
  };

  const updateDraftTableCell = (
    rowIndex: number,
    colIndex: number,
    value: string,
  ) => {
    setDraftTableCells((current) =>
      current.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColIndex) =>
              currentColIndex === colIndex ? value : cell)
          : row));
  };

  const addDraftTableRow = () => {
    setDraftTableCells((current) => [
      ...current,
      Array.from({ length: current[0]?.length ?? 1 }, () => ""),
    ]);
  };

  const addDraftTableColumn = () => {
    setDraftTableCells((current) => current.map((row) => [...row, ""]));
  };

  if (workspace === undefined) {
    return <p className="notepad-status">Loading notepad...</p>;
  }

  return (
    <div className="notepad-page">
      {saveError ? (
        <div className="notepad-inline-error" role="status">
          {saveError}
        </div>
      ) : null}

      <section className="notepad-panel notepad-notes-panel">
        <div className="notepad-toolbar">
          <h3 className="notepad-heading">Notes</h3>
          <button
            type="button"
            className="archive-axis-plus notepad-top-plus"
            aria-label="Add note"
            title="Add note"
            onClick={openNoteDraft}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
        <div className="notepad-notes-list">
          {notes.map((note) => {
            const isEditing = Boolean(editingNoteIds[note.id]);
            return (
              <article key={note.id} className="notepad-note-card">
                <div className="notepad-note-head">
                  {isEditing ? (
                    <input
                      className="notepad-note-title"
                      value={note.title}
                      onChange={(event) => {
                        const nextTitle = event.target.value;
                        setNotes((current) =>
                          current.map((item) =>
                            item.id === note.id
                              ? { ...item, title: nextTitle }
                              : item));

                        const existing = noteTitleTimersRef.current[note.id];
                        if (existing) window.clearTimeout(existing);
                        noteTitleTimersRef.current[note.id] = window.setTimeout(
                          () => {
                            void renameNote({
                              noteId: note.id,
                              title: nextTitle,
                            }).catch(() => {
                              setSaveError("Could not save note title.");
                            });
                          },
                          500,
                        );
                      }}
                      placeholder="Note title"
                      spellCheck={false}
                    />
                  ) : (
                    <h4 className="notepad-note-title-readonly">
                      {note.title}
                    </h4>
                  )}
                  <div className="notepad-note-actions">
                    <button
                      type="button"
                      className="notepad-table-action-btn"
                      aria-label={
                        isEditing ? "Finish editing note" : "Edit note"
                      }
                      title={isEditing ? "Finish editing note" : "Edit note"}
                      onClick={() =>
                        setEditingNoteIds((current) => ({
                          ...current,
                          [note.id]: !isEditing,
                        }))
                      }
                    >
                      {isEditing ? <X size={16} /> : <Pencil size={16} />}
                    </button>
                    <button
                      type="button"
                      className="notepad-table-action-btn danger"
                      aria-label="Delete note"
                      title="Delete note"
                      onClick={() => {
                        const titleTimer = noteTitleTimersRef.current[note.id];
                        const contentTimer =
                          noteContentTimersRef.current[note.id];
                        if (titleTimer) window.clearTimeout(titleTimer);
                        if (contentTimer) window.clearTimeout(contentTimer);
                        delete noteTitleTimersRef.current[note.id];
                        delete noteContentTimersRef.current[note.id];
                        setSaveError(null);
                        setNotes((current) =>
                          current.filter((item) => item.id !== note.id));
                        void deleteNote({ noteId: note.id }).catch(() => {
                          setSaveError("Could not delete note.");
                        });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {isEditing ? (
                  <textarea
                    className="notepad-editor"
                    value={note.content}
                    onChange={(event) => {
                      const nextContent = event.target.value;
                      setSaveError(null);
                      setNotes((current) =>
                        current.map((item) =>
                          item.id === note.id
                            ? { ...item, content: nextContent }
                            : item));

                      const existing = noteContentTimersRef.current[note.id];
                      if (existing) window.clearTimeout(existing);
                      noteContentTimersRef.current[note.id] = window.setTimeout(
                        () => {
                          void saveNoteContent({
                            noteId: note.id,
                            content: nextContent,
                          }).catch(() => {
                            setSaveError(
                              "Could not autosave one or more notes.",
                            );
                          });
                        },
                        500,
                      );
                    }}
                    placeholder="Jot down anything here..."
                    spellCheck={false}
                  />
                ) : (
                  <p className="notepad-note-content-readonly">
                    {note.content}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="notepad-panel notepad-tables-panel">
        <div className="notepad-toolbar">
          <h3 className="notepad-heading">Tables</h3>
          <button
            type="button"
            className="archive-axis-plus notepad-top-plus"
            aria-label="Add table"
            title="Add table"
            onClick={openTableDraft}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
        <div className="notepad-tables-list">
          {tables.map((table) => {
            const rowCount = table.cells.length;
            const colCount = table.cells[0]?.length ?? DEFAULT_COL_COUNT;
            const canRemoveRow = rowCount > 1;
            const canRemoveColumn = colCount > 1;
            const isEditing = Boolean(editingTableIds[table.id]);
            const headers = Array.from({ length: colCount }, (_, index) =>
              columnLabel(index));

            const colWidths = parseNumberArray(
              JSON.stringify(colWidthMap[table.id] ?? []),
              colCount,
              DEFAULT_COL_WIDTH,
              MIN_COL_WIDTH,
            );
            const rowHeights = parseNumberArray(
              JSON.stringify(rowHeightMap[table.id] ?? []),
              rowCount,
              DEFAULT_ROW_HEIGHT,
              MIN_ROW_HEIGHT,
            );

            const beginColResize = (colIndex: number, startClientX: number) => {
              const startWidth = colWidths[colIndex] ?? DEFAULT_COL_WIDTH;
              const onMove = (event: MouseEvent) => {
                const delta = event.clientX - startClientX;
                const nextWidth = Math.max(
                  MIN_COL_WIDTH,
                  Math.round(startWidth + delta),
                );
                setTableColWidth(table.id, colCount, colIndex, nextWidth);
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            };

            const beginRowResize = (rowIndex: number, startClientY: number) => {
              const startHeight = rowHeights[rowIndex] ?? DEFAULT_ROW_HEIGHT;
              const onMove = (event: MouseEvent) => {
                const delta = event.clientY - startClientY;
                const nextHeight = Math.max(
                  MIN_ROW_HEIGHT,
                  Math.round(startHeight + delta),
                );
                setTableRowHeight(table.id, rowCount, rowIndex, nextHeight);
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            };

            return (
              <article key={table.id} className="notepad-table-card">
                <div className="notepad-table-head">
                  {isEditing ? (
                    <input
                      className="notepad-table-title"
                      value={table.title}
                      onChange={(event) => {
                        const nextTitle = event.target.value;
                        setTables((current) =>
                          current.map((item) =>
                            item.id === table.id
                              ? { ...item, title: nextTitle }
                              : item));

                        const existing = tableTitleTimersRef.current[table.id];
                        if (existing) window.clearTimeout(existing);
                        tableTitleTimersRef.current[table.id] =
                          window.setTimeout(() => {
                            void renameTable({
                              tableId: table.id,
                              title: nextTitle,
                            }).catch(() => {
                              setSaveError("Could not save table title.");
                            });
                          }, 500);
                      }}
                      placeholder="Table title"
                      spellCheck={false}
                    />
                  ) : (
                    <h4 className="notepad-table-title-readonly">
                      {table.title}
                    </h4>
                  )}

                  <div className="notepad-table-actions">
                    <button
                      type="button"
                      className="notepad-table-action-btn"
                      aria-label={isEditing ? "Exit edit mode" : "Edit table"}
                      title={isEditing ? "Exit edit mode" : "Edit table"}
                      onClick={() =>
                        setEditingTableIds((current) => ({
                          ...current,
                          [table.id]: !isEditing,
                        }))
                      }
                    >
                      {isEditing ? <X size={16} /> : <Pencil size={16} />}
                    </button>
                    <button
                      type="button"
                      className="notepad-table-action-btn danger"
                      aria-label="Delete table"
                      title="Delete table"
                      onClick={() => {
                        setSaveError(null);
                        setTables((current) =>
                          current.filter((item) => item.id !== table.id));
                        void deleteTable({ tableId: table.id }).catch(() => {
                          setSaveError("Could not delete table.");
                        });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="notepad-grid-wrap">
                  {isEditing ? (
                    <table
                      className="notepad-grid"
                      aria-label="Notepad cells grid"
                    >
                      <thead>
                        <tr>
                          <th className="archive-grid-corner" />
                          {headers.map((header, colIndex) => (
                            <th
                              key={`col-${table.id}-${header}`}
                              className="notepad-grid-header notepad-grid-col-header"
                              style={{ width: `${colWidths[colIndex]}px` }}
                            >
                              <span>{header}</span>
                              <button
                                type="button"
                                className="notepad-col-resize-handle"
                                aria-label={`Resize column ${header}`}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  beginColResize(colIndex, event.clientX);
                                }}
                              />
                            </th>
                          ))}
                          <th className="archive-grid-side-header" />
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: rowCount }, (_, rowIndex) => (
                          <tr key={`row-${table.id}-${rowIndex + 1}`}>
                            <th
                              className="notepad-grid-header notepad-grid-row-header"
                              style={{ height: `${rowHeights[rowIndex]}px` }}
                            >
                              <span>{rowIndex + 1}</span>
                              <button
                                type="button"
                                className="notepad-row-resize-handle"
                                aria-label={`Resize row ${rowIndex + 1}`}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  beginRowResize(rowIndex, event.clientY);
                                }}
                              />
                            </th>
                            {headers.map((header, colIndex) => (
                              <td
                                key={`cell-${table.id}-${rowIndex}-${header}`}
                                style={{
                                  width: `${colWidths[colIndex]}px`,
                                  minWidth: `${colWidths[colIndex]}px`,
                                  height: `${rowHeights[rowIndex]}px`,
                                }}
                              >
                                <input
                                  className="notepad-grid-input"
                                  type="text"
                                  value={
                                    table.cells[rowIndex]?.[colIndex] ?? ""
                                  }
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setSaveError(null);
                                    setTables((current) =>
                                      current.map((item) => {
                                        if (item.id !== table.id) return item;
                                        const nextCells = item.cells.map((
                                          row,
                                        ) => [...row]);
                                        nextCells[rowIndex][colIndex] =
                                          nextValue;
                                        return { ...item, cells: nextCells };
                                      }));
                                  }}
                                  onBlur={(event) => {
                                    const value = event.target.value;
                                    void saveCell({
                                      tableId: table.id,
                                      rowIndex,
                                      colIndex,
                                      value,
                                    }).catch(() => {
                                      setSaveError(
                                        "Could not save one or more cells. Keeping local edits.",
                                      );
                                    });
                                  }}
                                  spellCheck={false}
                                />
                              </td>
                            ))}

                            {rowIndex === 0 ? (
                              <td
                                rowSpan={rowCount}
                                className="archive-add-col-cell"
                              >
                                <div className="archive-axis-col-actions">
                                  <button
                                    type="button"
                                    className="archive-axis-plus archive-axis-plus-col"
                                    aria-label="Add column"
                                    title="Add column"
                                    onClick={() => {
                                      setSaveError(null);
                                      setTables((current) =>
                                        current.map((item) =>
                                          item.id === table.id
                                            ? {
                                                ...item,
                                                cells: item.cells.map((row) => [
                                                  ...row,
                                                  "",
                                                ]),
                                              }
                                            : item));
                                      void addColumn({
                                        tableId: table.id,
                                      }).catch(() => {
                                        setSaveError("Could not add a column.");
                                      });
                                    }}
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    className="archive-axis-plus archive-axis-plus-col"
                                    disabled={!canRemoveColumn}
                                    aria-label="Remove last column"
                                    title="Remove last column"
                                    onClick={() => {
                                      if (!canRemoveColumn) return;
                                      setSaveError(null);
                                      setTables((current) =>
                                        current.map((item) =>
                                          item.id === table.id
                                            ? {
                                                ...item,
                                                cells: item.cells.map((row) =>
                                                  row.slice(0, -1)),
                                              }
                                            : item));
                                      void removeLastColumn({
                                        tableId: table.id,
                                      }).catch(() => {
                                        setSaveError(
                                          "Could not remove last column.",
                                        );
                                      });
                                    }}
                                  >
                                    -
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        ))}

                        <tr>
                          <th className="archive-grid-corner" />
                          <td
                            colSpan={colCount}
                            className="archive-add-row-cell"
                          >
                            <div className="archive-axis-row-actions">
                              <button
                                type="button"
                                className="archive-axis-plus archive-axis-plus-row"
                                aria-label="Add row"
                                title="Add row"
                                onClick={() => {
                                  setSaveError(null);
                                  setTables((current) =>
                                    current.map((item) =>
                                      item.id === table.id
                                        ? {
                                            ...item,
                                            cells: [
                                              ...item.cells,
                                              Array.from(
                                                { length: colCount },
                                                () => "",
                                              ),
                                            ],
                                          }
                                        : item));
                                  void addRow({ tableId: table.id }).catch(
                                    () => {
                                      setSaveError("Could not add a row.");
                                    },
                                  );
                                }}
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="archive-axis-plus archive-axis-plus-row"
                                disabled={!canRemoveRow}
                                aria-label="Remove last row"
                                title="Remove last row"
                                onClick={() => {
                                  if (!canRemoveRow) return;
                                  setSaveError(null);
                                  setTables((current) =>
                                    current.map((item) =>
                                      item.id === table.id
                                        ? {
                                            ...item,
                                            cells: item.cells.slice(0, -1),
                                          }
                                        : item));
                                  void removeLastRow({
                                    tableId: table.id,
                                  }).catch(() => {
                                    setSaveError("Could not remove last row.");
                                  });
                                }}
                              >
                                -
                              </button>
                            </div>
                          </td>
                          <td className="archive-grid-side-header" />
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <table
                      className="notepad-grid notepad-grid-view"
                      aria-label="Notepad cells view"
                    >
                      <tbody>
                        {Array.from({ length: rowCount }, (_, rowIndex) => (
                          <tr key={`view-row-${table.id}-${rowIndex + 1}`}>
                            {headers.map((header, colIndex) => (
                              <td
                                key={`view-cell-${table.id}-${rowIndex}-${header}`}
                                style={{
                                  width: `${colWidths[colIndex]}px`,
                                  minWidth: `${colWidths[colIndex]}px`,
                                  height: `${rowHeights[rowIndex]}px`,
                                }}
                                className="notepad-grid-view-cell"
                              >
                                {table.cells[rowIndex]?.[colIndex] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {createMode === "note" ? (
        <EntryModal
          title="New note"
          subtitle="Write the note here. Nothing is saved until you choose Save note."
          size="compact"
          className="notepad-create-modal"
          onClose={closeCreateModal}
          footer={
            <ModalActions
              onCancel={closeCreateModal}
              onPrimary={() => void handleCreateNote()}
              primaryLabel={creating ? "Saving…" : "Save note"}
              disabled={creating}
              primaryDisabled={!canSaveNote || creating}
            />
          }
        >
          <div className="notepad-note-draft">
            <FormField label="Title">
              <input
                value={draftNoteTitle}
                onChange={(event) => setDraftNoteTitle(event.target.value)}
                placeholder="Note title"
                autoFocus
              />
            </FormField>
            <FormField label="Content">
              <textarea
                value={draftNoteContent}
                onChange={(event) => setDraftNoteContent(event.target.value)}
                placeholder="Write your note…"
                className="notepad-note-draft-content"
              />
            </FormField>
          </div>
        </EntryModal>
      ) : null}

      {createMode === "table" ? (
        <EntryModal
          title="New table"
          subtitle="Build the table locally, then save it when it contains something useful."
          size="wide"
          className="notepad-create-modal notepad-table-create-modal"
          onClose={closeCreateModal}
          footer={
            <ModalActions
              onCancel={closeCreateModal}
              onPrimary={() => void handleCreateTable()}
              primaryLabel={creating ? "Saving…" : "Save table"}
              disabled={creating}
              primaryDisabled={!canSaveTable || creating}
            />
          }
        >
          <FormField label="Table title" optional>
            <input
              value={draftTableTitle}
              onChange={(event) => setDraftTableTitle(event.target.value)}
              placeholder="e.g. Trip checklist"
              autoFocus
            />
          </FormField>
          <div className="notepad-table-draft-wrap">
            <table className="notepad-table-draft">
              <thead>
                <tr>
                  <th aria-hidden="true" />
                  {Array.from({ length: draftTableCells[0]?.length ?? 1 }, (
                    _,
                    colIndex,
                  ) => (
                    <th key={`draft-header-${colIndex}`}>
                      {columnLabel(colIndex)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draftTableCells.map((row, rowIndex) => (
                  <tr key={`draft-row-${rowIndex}`}>
                    <th>{rowIndex + 1}</th>
                    {row.map((cell, colIndex) => (
                      <td key={`draft-cell-${rowIndex}-${colIndex}`}>
                        <input
                          value={cell}
                          aria-label={`Row ${rowIndex + 1}, column ${columnLabel(colIndex)}`}
                          onChange={(event) =>
                            updateDraftTableCell(
                              rowIndex,
                              colIndex,
                              event.target.value,
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="notepad-table-draft-controls">
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={addDraftTableRow}
            >
              <Plus aria-hidden="true" /> Add row
            </button>
            <button
              type="button"
              className="modal-button modal-button-secondary"
              disabled={draftTableCells.length <= 1}
              onClick={() =>
                setDraftTableCells((current) => current.slice(0, -1))
              }
            >
              <Minus aria-hidden="true" /> Remove row
            </button>
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={addDraftTableColumn}
            >
              <Plus aria-hidden="true" /> Add column
            </button>
            <button
              type="button"
              className="modal-button modal-button-secondary"
              disabled={(draftTableCells[0]?.length ?? 1) <= 1}
              onClick={() =>
                setDraftTableCells((current) =>
                  current.map((row) => row.slice(0, -1)))
              }
            >
              <Minus aria-hidden="true" /> Remove column
            </button>
          </div>
        </EntryModal>
      ) : null}
    </div>
  );
}