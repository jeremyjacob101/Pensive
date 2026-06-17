import SwiftUI

struct NotepadNoteViewData: Identifiable {
    let id: String
    var title: String
    var content: String
}

struct NotepadTableViewData: Identifiable {
    let id: String
    var title: String
    var cells: [[String]]
}

struct NotepadWorkspaceViewData {
    var notes: [NotepadNoteViewData]
    var tables: [NotepadTableViewData]
}

enum NotepadWorkspaceNormalization {
    static func normalize(_ dto: NotepadWorkspaceDTO) -> NotepadWorkspaceViewData {
        let notes = dto.notes.map { note in
            NotepadNoteViewData(
                id: note.id.isEmpty ? UUID().uuidString : note.id,
                title: note.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled Note" : note.title,
                content: note.content
            )
        }

        let tables = dto.tables.map { table in
            let normalizedCells = normalizeCells(table.cells)
            return NotepadTableViewData(
                id: table.id.isEmpty ? UUID().uuidString : table.id,
                title: table.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled Table" : table.title,
                cells: normalizedCells
            )
        }

        return .init(notes: notes, tables: tables)
    }

    static func normalizeCells(_ cells: [[String]]) -> [[String]] {
        if cells.isEmpty {
            return [[""]]
        }
        let width = max(1, cells.map(\.count).max() ?? 1)
        return cells.map { row in
            if row.count == width { return row }
            return row + Array(repeating: "", count: width - row.count)
        }
    }

    static func setCell(cells: [[String]], row: Int, col: Int, value: String) -> [[String]] {
        var next = normalizeCells(cells)
        guard row >= 0, col >= 0, row < next.count, col < next[row].count else { return next }
        next[row][col] = value
        return next
    }
}

@MainActor
private final class NotepadFeatureViewModel: ObservableObject {
    @Published private(set) var state: ViewLoadState = .loading
    @Published private(set) var notes: [NotepadNoteViewData] = []
    @Published private(set) var tables: [NotepadTableViewData] = []
    @Published var saveErrorText: String?

    private let api: ConvexAPI
    private var saveTasks: [String: Task<Void, Never>] = [:]

    init(api: ConvexAPI) {
        self.api = api
    }

    func onAppear() {
        if notes.isEmpty && tables.isEmpty {
            Task { await refresh() }
        }
    }

    func refresh() async {
        let shouldShowFullScreenError = !state.hasLoadedContent
        if shouldShowFullScreenError { state = .loading }
        if let workspace = debugFixtureWorkspaceIfEnabled() {
            apply(workspace: workspace)
            state = .content
            return
        }
        do {
            let workspace = try await api.notepad.getMine()
            apply(workspace: workspace)
            state = .content
        } catch {
            saveErrorText = "Failed to refresh notepad."
            if shouldShowFullScreenError {
                state = .error(message: "Failed to load notepad")
            }
        }
    }

    func addNote() {
        Task {
            do {
                try await api.notepad.addNote(.init(noteId: nil, title: "Untitled Note"))
                await refresh()
            } catch {
                saveErrorText = "Failed to add note."
            }
        }
    }

    func createNote(title: String, content: String) {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty, !trimmedContent.isEmpty else { return }

        let noteID = "note-\(UUID().uuidString.lowercased())"
        Task {
            do {
                try await api.notepad.addNote(.init(noteId: noteID, title: trimmedTitle))
                try await api.notepad.saveNoteContent(.init(noteId: noteID, content: trimmedContent))
                await refresh()
            } catch {
                saveErrorText = "Failed to create note."
            }
        }
    }

    func createTable(title: String, cells: [[String]]) async -> Bool {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedCells = NotepadWorkspaceNormalization.normalizeCells(cells)
        let hasCellContent = normalizedCells.flatMap { $0 }.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !trimmedTitle.isEmpty || hasCellContent else { return false }

        do {
            try await api.notepad.addTable(.init(
                title: trimmedTitle.isEmpty ? "Untitled Table" : trimmedTitle,
                cells: normalizedCells
            ))
            await refresh()
            return true
        } catch {
            saveErrorText = "Failed to create table."
            return false
        }
    }

    func addTable() async {
        do {
            try await api.notepad.addTable(.init(title: nil, cells: nil))
            await refresh()
        } catch {
            saveErrorText = "Failed to add table."
        }
    }

    func cleanupEmptyNotes() {
        Task {
            do {
                try await api.notepad.cleanupEmptyNotes()
                await refresh()
            } catch {
                saveErrorText = "Cleanup failed."
            }
        }
    }

    func renameNote(id: String, title: String) {
        guard let index = notes.firstIndex(where: { $0.id == id }) else { return }
        notes[index].title = title
        debounceSave(key: "note-title-\(id)") { [api] in
            try await api.notepad.renameNote(.init(noteId: id, title: title))
        }
    }

    func saveNoteContent(id: String, content: String) {
        guard let index = notes.firstIndex(where: { $0.id == id }) else { return }
        notes[index].content = content
        debounceSave(key: "note-content-\(id)") { [api] in
            try await api.notepad.saveNoteContent(.init(noteId: id, content: content))
        }
    }

    func updateNote(id: String, title: String, content: String) async -> Bool {
        guard let note = notes.first(where: { $0.id == id }) else { return false }
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextTitle = trimmedTitle.isEmpty ? note.title : trimmedTitle
        let shouldRename = nextTitle != note.title
        let shouldSaveContent = content != note.content
        guard shouldRename || shouldSaveContent else { return true }

        do {
            if shouldRename {
                try await api.notepad.renameNote(.init(noteId: id, title: nextTitle))
            }
            if shouldSaveContent {
                try await api.notepad.saveNoteContent(.init(noteId: id, content: content))
            }
            await refresh()
            return true
        } catch {
            saveErrorText = "Failed to update note."
            return false
        }
    }

    func deleteNote(id: String) {
        Task {
            do {
                try await api.notepad.deleteNote(.init(noteId: id))
                await refresh()
            } catch {
                saveErrorText = "Failed to delete note."
            }
        }
    }

    func renameTable(id: String, title: String) {
        guard let index = tables.firstIndex(where: { $0.id == id }) else { return }
        tables[index].title = title
        debounceSave(key: "table-title-\(id)") { [api] in
            try await api.notepad.renameTable(.init(tableId: id, title: title))
        }
    }

    func deleteTable(id: String) {
        Task {
            do {
                try await api.notepad.deleteTable(.init(tableId: id))
                await refresh()
            } catch {
                saveErrorText = "Failed to delete table."
            }
        }
    }

    func editCell(tableID: String, row: Int, col: Int, value: String) {
        guard let index = tables.firstIndex(where: { $0.id == tableID }) else { return }
        tables[index].cells = NotepadWorkspaceNormalization.setCell(cells: tables[index].cells, row: row, col: col, value: value)
        debounceSave(key: "cell-\(tableID)-\(row)-\(col)") { [api] in
            try await api.notepad.saveCell(.init(tableId: tableID, rowIndex: row, colIndex: col, value: value))
        }
    }

    func updateTable(id: String, title: String, cells: [[String]]) async -> Bool {
        guard let table = tables.first(where: { $0.id == id }) else { return false }
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextTitle = trimmedTitle.isEmpty ? table.title : trimmedTitle
        let nextCells = NotepadWorkspaceNormalization.normalizeCells(cells)
        guard nextTitle != table.title || nextCells != table.cells else { return true }

        do {
            try await api.notepad.updateTable(.init(tableId: id, title: nextTitle, cells: nextCells))
            await refresh()
            return true
        } catch {
            saveErrorText = "Failed to update table."
            return false
        }
    }

    func addRow(tableID: String) {
        Task {
            do {
                try await api.notepad.addRow(.init(tableId: tableID))
                await refresh()
            } catch {
                saveErrorText = "Failed to add row."
            }
        }
    }

    func addColumn(tableID: String) {
        Task {
            do {
                try await api.notepad.addColumn(.init(tableId: tableID))
                await refresh()
            } catch {
                saveErrorText = "Failed to add column."
            }
        }
    }

    func removeLastRow(tableID: String) {
        Task {
            do {
                try await api.notepad.removeLastRow(.init(tableId: tableID))
                await refresh()
            } catch {
                saveErrorText = "Failed to remove row."
            }
        }
    }

    func removeLastColumn(tableID: String) {
        Task {
            do {
                try await api.notepad.removeLastColumn(.init(tableId: tableID))
                await refresh()
            } catch {
                saveErrorText = "Failed to remove column."
            }
        }
    }

    private func apply(workspace: NotepadWorkspaceDTO) {
        let normalized = NotepadWorkspaceNormalization.normalize(workspace)
        notes = normalized.notes
        tables = normalized.tables
    }

    private func debounceSave(key: String, delayNs: UInt64 = 400_000_000, _ operation: @escaping @Sendable () async throws -> Void) {
        saveTasks[key]?.cancel()
        saveTasks[key] = Task { [weak self] in
            try? await Task.sleep(nanoseconds: delayNs)
            guard !Task.isCancelled else { return }
            do {
                try await operation()
                await MainActor.run { self?.saveErrorText = nil }
            } catch {
                await MainActor.run { self?.saveErrorText = "Autosave failed. It will retry on your next edit." }
            }
        }
    }

    private func debugFixtureWorkspaceIfEnabled() -> NotepadWorkspaceDTO? {
        #if DEBUG
        guard ProcessInfo.processInfo.environment["UI_TEST_NOTEPAD_FIXTURE"] == "1" else { return nil }
        return Self.fixtureWorkspace()
        #else
        return nil
        #endif
    }

    #if DEBUG
    private static func fixtureWorkspace() -> NotepadWorkspaceDTO {
        .init(
            _id: nil,
            _creationTime: nil,
            userId: "ui-test",
            notes: [.init(id: "note-1", title: "Today", content: "Initial note content")],
            tables: [.init(id: "table-1", title: "Budget", cells: [["Category", "Amount"], ["Rent", "6000"]])],
            updatedAt: 0
        )
    }
    #endif
}

private struct NotepadFeatureView: View {
    enum Panel: String, CaseIterable {
        case notes = "Notes"
        case tables = "Tables"
    }

    @StateObject private var viewModel: NotepadFeatureViewModel
    @State private var panel: Panel = .notes
    @State private var showingNewNoteSheet = false
    @State private var showingNewTableSheet = false
    @State private var newNoteTitle = ""
    @State private var newNoteContent = ""
    @State private var newTableTitle = ""
    @State private var newTableCells = [[""]]
    @State private var editingNoteTitle = ""
    @State private var editingNoteContent = ""
    @State private var editingTableTitle = ""
    @State private var editingTableCells = [[""]]
    @State private var editingNoteID: String?
    @State private var editingTableID: String?

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: NotepadFeatureViewModel(api: api))
    }

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.refresh() } }) {
            NotepadWorkspaceListView(
                panel: $panel,
                saveErrorText: viewModel.saveErrorText,
                notes: viewModel.notes,
                tables: viewModel.tables,
                onNoteTap: beginEditingNote,
                onTableTap: beginEditingTable
            )
            .listStyle(.insetGrouped)
            .navigationTitle("Notepad")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                addToolbar
            }
            .refreshable { await viewModel.refresh() }
            .sheet(isPresented: $showingNewNoteSheet) {
                newNoteSheet
            }
            .sheet(isPresented: $showingNewTableSheet) {
                newTableSheet
            }
            .sheet(item: editingNoteBinding) { editorID in
                noteEditorSheet(editorID)
            }
            .sheet(item: editingTableBinding) { editorID in
                tableEditorSheet(editorID)
            }
        }
        .task { viewModel.onAppear() }
    }

    @ToolbarContentBuilder
    private var addToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                addCurrentPanelItem()
            } label: {
                Image(systemName: "plus")
            }
            .accessibilityIdentifier("notepad_add_item")
        }
    }

    private func addCurrentPanelItem() {
        switch panel {
        case .notes:
            newNoteTitle = ""
            newNoteContent = ""
            showingNewNoteSheet = true
        case .tables:
            newTableTitle = ""
            newTableCells = [[""]]
            showingNewTableSheet = true
        }
    }

    private func beginEditingNote(_ note: NotepadNoteViewData) {
        editingNoteTitle = note.title
        editingNoteContent = note.content
        editingNoteID = note.id
    }

    private func beginEditingTable(_ table: NotepadTableViewData) {
        editingTableTitle = table.title
        editingTableCells = table.cells
        editingTableID = table.id
    }

    private var editingNoteBinding: Binding<NotepadEditorID?> {
        Binding(
            get: {
                guard let id = editingNoteID else { return nil }
                return NotepadEditorID(rawValue: id)
            },
            set: { editingNoteID = $0?.rawValue }
        )
    }

    private var editingTableBinding: Binding<NotepadEditorID?> {
        Binding(
            get: {
                guard let id = editingTableID else { return nil }
                return NotepadEditorID(rawValue: id)
            },
            set: { editingTableID = $0?.rawValue }
        )
    }

    private var canSaveNewNote: Bool {
        !newNoteTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !newNoteContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSaveNewTable: Bool {
        !newTableTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            newTableCells.flatMap { $0 }.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    private var newNoteSheet: some View {
        NavigationStack {
            Form {
                Section("Title") {
                    TextField("Note title", text: $newNoteTitle)
                }
                Section("Content") {
                    TextEditor(text: $newNoteContent)
                        .frame(minHeight: 200)
                }
            }
            .navigationTitle("New Note")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingNewNoteSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        viewModel.createNote(title: newNoteTitle, content: newNoteContent)
                        showingNewNoteSheet = false
                    }
                    .disabled(!canSaveNewNote)
                }
            }
        }
    }

    private var newTableSheet: some View {
        NavigationStack {
            tableDraftEditor
                .navigationTitle("New Table")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showingNewTableSheet = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            let title = newTableTitle
                            let cells = newTableCells
                            Task {
                                if await viewModel.createTable(title: title, cells: cells) {
                                    showingNewTableSheet = false
                                }
                            }
                        }
                        .disabled(!canSaveNewTable)
                    }
                }
        }
    }

    private var tableDraftEditor: some View {
        List {
            Section {
                TextField("Table Title", text: $newTableTitle)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("notepad_new_table_title")
            }
            Section {
                NotepadEditableTableGrid(
                    table: .init(id: "new-table", title: newTableTitle, cells: newTableCells),
                    onEditCell: { row, col, value in
                        newTableCells = NotepadWorkspaceNormalization.setCell(cells: newTableCells, row: row, col: col, value: value)
                    },
                    onAddRow: {
                        let colCount = max(1, newTableCells.first?.count ?? 1)
                        newTableCells.append(Array(repeating: "", count: colCount))
                    },
                    onRemoveRow: {
                        guard newTableCells.count > 1 else { return }
                        newTableCells.removeLast()
                    },
                    onAddColumn: {
                        newTableCells = newTableCells.map { $0 + [""] }
                    },
                    onRemoveColumn: {
                        guard (newTableCells.first?.count ?? 0) > 1 else { return }
                        newTableCells = newTableCells.map { Array($0.dropLast()) }
                    }
                )
                .accessibilityIdentifier("notepad_new_table_actions")
            }
        }
    }

    @ViewBuilder
    private func noteEditorSheet(_ editorID: NotepadEditorID) -> some View {
        if let note = viewModel.notes.first(where: { $0.id == editorID.rawValue }) {
            NavigationStack {
                Form {
                    Section("Title") {
                        TextField("Title", text: $editingNoteTitle)
                        .accessibilityIdentifier("notepad_note_title_\(note.id)")
                    }
                    Section("Content") {
                        TextEditor(text: $editingNoteContent)
                        .frame(minHeight: 260)
                        .accessibilityIdentifier("notepad_note_content_\(note.id)")
                    }
                    Section {
                        Button("Delete Note", role: .destructive) {
                            viewModel.deleteNote(id: note.id)
                            editingNoteID = nil
                        }
                    }
                }
                .navigationTitle("Edit Note")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { editingNoteID = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            let title = editingNoteTitle
                            let content = editingNoteContent
                            Task {
                                if await viewModel.updateNote(id: note.id, title: title, content: content) {
                                    editingNoteID = nil
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func tableEditorSheet(_ editorID: NotepadEditorID) -> some View {
        if let table = viewModel.tables.first(where: { $0.id == editorID.rawValue }) {
            NavigationStack {
                tableEditorForm(for: table)
            }
        }
    }

    @ViewBuilder
    private func tableEditorForm(for table: NotepadTableViewData) -> some View {
        List {
            Section {
                TextField("Table Title", text: $editingTableTitle)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier("notepad_table_title_\(table.id)")
            }
            Section {
                NotepadEditableTableGrid(
                    table: .init(id: table.id, title: editingTableTitle, cells: editingTableCells),
                    onEditCell: { row, col, value in
                        editingTableCells = NotepadWorkspaceNormalization.setCell(cells: editingTableCells, row: row, col: col, value: value)
                    },
                    onAddRow: {
                        let colCount = max(1, editingTableCells.first?.count ?? 1)
                        editingTableCells.append(Array(repeating: "", count: colCount))
                    },
                    onRemoveRow: {
                        guard editingTableCells.count > 1 else { return }
                        editingTableCells.removeLast()
                    },
                    onAddColumn: {
                        editingTableCells = editingTableCells.map { $0 + [""] }
                    },
                    onRemoveColumn: {
                        guard (editingTableCells.first?.count ?? 0) > 1 else { return }
                        editingTableCells = editingTableCells.map { Array($0.dropLast()) }
                    },
                )
                .accessibilityIdentifier("notepad_table_actions_\(table.id)")
            }
            Section {
                Button("Delete Table", role: .destructive) {
                    viewModel.deleteTable(id: table.id)
                    editingTableID = nil
                }
            }
        }
        .navigationTitle("Edit Table")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { editingTableID = nil }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") {
                    let title = editingTableTitle
                    let cells = editingTableCells
                    Task {
                        if await viewModel.updateTable(id: table.id, title: title, cells: cells) {
                            editingTableID = nil
                        }
                    }
                }
            }
        }
    }
}

private struct NotepadEditorID: Identifiable {
    let rawValue: String
    var id: String { rawValue }
}

private struct NotepadEditableTableGrid: View {
    let table: NotepadTableViewData
    let onEditCell: (Int, Int, String) -> Void
    let onAddRow: () -> Void
    let onRemoveRow: () -> Void
    let onAddColumn: () -> Void
    let onRemoveColumn: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 8) {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(table.cells.enumerated()), id: \.offset) { rowIndex, row in
                            NotepadEditableTableRow(
                                tableID: table.id,
                                rowIndex: rowIndex,
                                row: row,
                                onEditCell: onEditCell
                            )
                        }
                    }

                    HStack(spacing: 8) {
                        tableControlButton(systemName: "minus", action: onRemoveRow)
                        tableControlButton(systemName: "plus", action: onAddRow)
                    }
                }
            }

            VStack(spacing: 8) {
                tableControlButton(systemName: "plus", action: onAddColumn)
                tableControlButton(systemName: "minus", action: onRemoveColumn)
            }
            .padding(.top, 2)
        }
    }

    private func tableControlButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.caption.weight(.semibold))
                .frame(width: 30, height: 30)
        }
        .buttonStyle(.bordered)
    }
}

private struct NotepadEditableTableRow: View {
    let tableID: String
    let rowIndex: Int
    let row: [String]
    let onEditCell: (Int, Int, String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(row.enumerated()), id: \.offset) { colIndex, cell in
                TextField("Cell", text: Binding(
                    get: { cell },
                    set: { onEditCell(rowIndex, colIndex, $0) }
                ))
                .textFieldStyle(.roundedBorder)
                .frame(width: 130)
                .accessibilityIdentifier("notepad_cell_\(tableID)_\(rowIndex)_\(colIndex)")
            }
        }
    }
}

private struct NotepadWorkspaceListView: View {
    @Binding var panel: NotepadFeatureView.Panel
    let saveErrorText: String?
    let notes: [NotepadNoteViewData]
    let tables: [NotepadTableViewData]
    let onNoteTap: (NotepadNoteViewData) -> Void
    let onTableTap: (NotepadTableViewData) -> Void

    var body: some View {
        List {
            NotepadPanelPickerSection(panel: $panel)
            NotepadSaveErrorSection(message: saveErrorText)
            NotepadPanelRowsView(
                panel: panel,
                notes: notes,
                tables: tables,
                onNoteTap: onNoteTap,
                onTableTap: onTableTap
            )
        }
    }
}

private struct NotepadPanelPickerSection: View {
    @Binding var panel: NotepadFeatureView.Panel

    var body: some View {
        Section {
            Picker("Panel", selection: $panel) {
                Text(NotepadFeatureView.Panel.notes.rawValue).tag(NotepadFeatureView.Panel.notes)
                Text(NotepadFeatureView.Panel.tables.rawValue).tag(NotepadFeatureView.Panel.tables)
            }
            .pickerStyle(.segmented)
        }
    }
}

private struct NotepadSaveErrorSection: View {
    let message: String?

    var body: some View {
        if let message {
            Section {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
        }
    }
}

private struct NotepadPanelRowsView: View {
    let panel: NotepadFeatureView.Panel
    let notes: [NotepadNoteViewData]
    let tables: [NotepadTableViewData]
    let onNoteTap: (NotepadNoteViewData) -> Void
    let onTableTap: (NotepadTableViewData) -> Void

    var body: some View {
        switch panel {
        case .notes:
            NotepadNotesListView(notes: notes, onTap: onNoteTap)
        case .tables:
            NotepadTablesListView(tables: tables, onTap: onTableTap)
        }
    }
}

private struct NotepadNotesListView: View {
    let notes: [NotepadNoteViewData]
    let onTap: (NotepadNoteViewData) -> Void

    var body: some View {
        ForEach(notes, id: \.id) { note in
            Button {
                onTap(note)
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(note.title)
                            .font(.headline)
                            .foregroundStyle(.primary)
                        Text(note.content)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .padding(.vertical, 4)
            .accessibilityIdentifier("notepad_note_row_\(note.id)")
        }
    }
}

private struct NotepadTablesListView: View {
    let tables: [NotepadTableViewData]
    let onTap: (NotepadTableViewData) -> Void

    var body: some View {
        ForEach(tables, id: \.id) { table in
            Button {
                onTap(table)
            } label: {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(table.title)
                            .font(.headline)
                            .foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    NotepadTablePreview(cells: table.cells)
                }
            }
            .buttonStyle(.plain)
            .padding(.vertical, 4)
            .accessibilityIdentifier("notepad_table_row_\(table.id)")
        }
    }
}

private struct NotepadTablePreview: View {
    let cells: [[String]]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, row in
                    NotepadTablePreviewRow(cells: row)
                }
            }
        }
    }
}

private struct NotepadTablePreviewRow: View {
    let cells: [String]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(cells.enumerated()), id: \.offset) { _, cell in
                NotepadTablePreviewCell(text: cell)
            }
        }
    }
}

private struct NotepadTablePreviewCell: View {
    let text: String

    var body: some View {
        Text(text.isEmpty ? " " : text)
            .font(.caption)
            .foregroundStyle(.primary)
            .lineLimit(1)
            .frame(width: 120, height: 32, alignment: .leading)
            .padding(.horizontal, 8)
            .overlay(
                Rectangle()
                    .stroke(.secondary.opacity(0.35), lineWidth: 0.5)
            )
    }
}

enum TrackingTimelineSegmentState: String {
    case paid
    case unpaid
    case buffer
    case empty
}

struct TrackingTimelineSegment: Identifiable {
    let id: String
    let month: String
    let state: TrackingTimelineSegmentState
}

private struct TrackingTimelineRowViewData: Identifiable {
    let id: String
    let key: String
    let source: String
    let label: String
    let colorHex: String
    let paidMonths: Set<String>
    let currentMonth: String
    let availableMonths: [String]
    var startMonth: String
    var trailingBufferMonths: Int
    var segments: [TrackingTimelineSegment]
}

private enum TrackingSelectionKind: String, CaseIterable, Identifiable {
    case expense
    case incoming

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense: return "Expenses"
        case .incoming: return "Incomings"
        }
    }
}

private struct TrackingSelectionOptionRow: Identifiable {
    let kind: OptionsKind
    let value: String
    let color: String
    let parentValue: String?
    let indentationLevel: Int
    let isTracking: Bool

    var id: String { trackingSelectionKey(kind: kind.rawValue, value: value, parentValue: parentValue) }
}

private struct TrackingSelectionChange {
    let row: TrackingSelectionOptionRow
    let isTracking: Bool
}

enum TrackingTimelineLogic {
    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return calendar
    }()

    static func monthDate(_ month: String) -> Date? {
        let comps = month.split(separator: "-")
        guard comps.count == 2, let y = Int(comps[0]), let m = Int(comps[1]), (1 ... 12).contains(m) else { return nil }
        return calendar.date(from: DateComponents(year: y, month: m, day: 1))
    }

    static func monthString(_ date: Date) -> String {
        let comps = calendar.dateComponents([.year, .month], from: date)
        let y = comps.year ?? 1970
        let m = comps.month ?? 1
        return String(format: "%04d-%02d", y, m)
    }

    static func monthRange(start: String, end: String) -> [String] {
        guard let startDate = monthDate(start), let endDate = monthDate(end), startDate <= endDate else { return [] }
        var result: [String] = []
        var cursor = startDate
        while cursor <= endDate {
            result.append(monthString(cursor))
            cursor = calendar.date(byAdding: .month, value: 1, to: cursor) ?? cursor
            if result.count > 2400 { break }
        }
        return result
    }

    static func segments(months: [String], paidMonths: Set<String>, currentMonth: String, trailingBufferMonths: Int) -> [TrackingTimelineSegment] {
        guard let current = monthDate(currentMonth) else {
            return months.map { .init(id: $0, month: $0, state: paidMonths.contains($0) ? .paid : .unpaid) }
        }

        let recentUnpaidBufferMonths: Set<String> = {
            let eligible = months.compactMap { month -> (String, Date)? in
                guard !paidMonths.contains(month), let date = monthDate(month), date <= current else { return nil }
                return (month, date)
            }
            let sorted = eligible.sorted { $0.1 > $1.1 }
            return Set(sorted.prefix(max(0, trailingBufferMonths)).map(\.0))
        }()

        return months.map { month in
            let state: TrackingTimelineSegmentState
            if paidMonths.contains(month) {
                state = .paid
            } else if let monthDate = monthDate(month) {
                if monthDate > current {
                    state = .empty
                } else if recentUnpaidBufferMonths.contains(month) {
                    state = .buffer
                } else {
                    state = .unpaid
                }
            } else {
                state = .empty
            }
            return .init(id: month, month: month, state: state)
        }
    }

    static func monthsFromStart(_ months: [String], startMonth: String) -> [String] {
        guard let startDate = monthDate(startMonth) else { return months }
        return months.filter { month in
            guard let monthDate = monthDate(month) else { return false }
            return monthDate >= startDate
        }
    }
}

private func trackingSelectionKey(kind: String, value: String, parentValue: String?) -> String {
    "\(kind)|\(value)|\(normalizedOptionParent(parentValue))"
}

private func normalizedOptionParent(_ value: String?) -> String {
    value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
}

struct TrackingTimelineRowPersistenceStore {
    private let defaults: UserDefaults
    private let startPrefix = "tracking.timeline.start"
    private let bufferPrefix = "tracking.timeline.buffer"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func startMonth(source: String, key: String) -> String? {
        defaults.string(forKey: "\(startPrefix).\(source).\(key)")
    }

    func trailingBufferMonths(source: String, key: String) -> Int? {
        let value = defaults.object(forKey: "\(bufferPrefix).\(source).\(key)") as? Int
        return value
    }

    func setStartMonth(_ value: String, source: String, key: String) {
        defaults.set(value, forKey: "\(startPrefix).\(source).\(key)")
    }

    func setTrailingBufferMonths(_ value: Int, source: String, key: String) {
        defaults.set(max(0, value), forKey: "\(bufferPrefix).\(source).\(key)")
    }
}

@MainActor
private final class TrackingFeatureViewModel: ObservableObject {
    @Published private(set) var state: ViewLoadState = .loading
    @Published private(set) var expenseRows: [TrackingTimelineRowViewData] = []
    @Published private(set) var incomingRows: [TrackingTimelineRowViewData] = []
    @Published private(set) var expenseSelectionRows: [TrackingSelectionOptionRow] = []
    @Published private(set) var incomingSelectionRows: [TrackingSelectionOptionRow] = []

    private let api: ConvexAPI
    private let persistence: TrackingTimelineRowPersistenceStore

    init(api: ConvexAPI, persistence: TrackingTimelineRowPersistenceStore = .init()) {
        self.api = api
        self.persistence = persistence
    }

    func onAppear() {
        if expenseRows.isEmpty && incomingRows.isEmpty {
            Task { await refresh() }
        }
    }

    func refresh() async {
        let shouldShowFullScreenError = !state.hasLoadedContent
        if shouldShowFullScreenError { state = .loading }
        if let tracking = debugFixtureResponseIfEnabled() {
            apply(response: tracking)
            apply(options: Self.fixtureOptions(), tracking: tracking)
            state = .content
            return
        }
        do {
            async let trackingRequest = api.tracking.list()
            async let optionsRequest = api.userOptions.list()
            let tracking = try await trackingRequest
            let options = try await optionsRequest
            apply(response: tracking)
            apply(options: options, tracking: tracking)
            state = .content
        } catch {
            if shouldShowFullScreenError {
                state = .error(message: "Failed to load tracking")
            }
        }
    }

    func saveTrackingSelection(original: [String: Bool], draft: [String: Bool]) async throws {
        let rowByID = Dictionary(uniqueKeysWithValues: (expenseSelectionRows + incomingSelectionRows).map { ($0.id, $0) })
        let changes = draft.compactMap { id, isTracking -> TrackingSelectionChange? in
            guard original[id] != isTracking, let row = rowByID[id] else { return nil }
            return TrackingSelectionChange(row: row, isTracking: isTracking)
        }

        guard !changes.isEmpty else { return }

        if isDebugFixtureEnabled() {
            applyFixtureSelectionChanges(changes)
            return
        }

        for change in changes {
            try await api.userOptions.setTracking(.init(
                kind: change.row.kind.rawValue,
                value: change.row.value,
                isTracking: change.isTracking,
                parentValue: normalizedParent(change.row.parentValue)
            ))
        }
        await refresh()
    }

    func setStartMonth(rowID: String, source: String, key: String, month: String) {
        persistence.setStartMonth(month, source: source, key: key)
        mutateRow(id: rowID, source: source) { row in
            row.startMonth = month
            let visibleMonths = TrackingTimelineLogic.monthsFromStart(row.availableMonths, startMonth: row.startMonth)
            row.segments = TrackingTimelineLogic.segments(
                months: visibleMonths,
                paidMonths: row.paidMonths,
                currentMonth: row.currentMonth,
                trailingBufferMonths: row.trailingBufferMonths
            )
        }
    }

    func setTrailingBufferMonths(rowID: String, source: String, key: String, months: Int) {
        persistence.setTrailingBufferMonths(months, source: source, key: key)
        mutateRow(id: rowID, source: source) { row in
            row.trailingBufferMonths = max(0, months)
            let visibleMonths = TrackingTimelineLogic.monthsFromStart(row.availableMonths, startMonth: row.startMonth)
            row.segments = TrackingTimelineLogic.segments(
                months: visibleMonths,
                paidMonths: row.paidMonths,
                currentMonth: row.currentMonth,
                trailingBufferMonths: row.trailingBufferMonths
            )
        }
    }

    private func apply(response: TrackingResponse) {
        let rows = response.rows.map { dto -> TrackingTimelineRowViewData in
            let source = dto.source.lowercased()
            let persistedStart = persistence.startMonth(source: source, key: dto.key)
            let fallbackStart = dto.rangeMonths.first ?? response.currentMonth
            let start = persistedStart.flatMap { s in dto.rangeMonths.contains(s) ? s : nil } ?? fallbackStart
            let persistedBuffer = persistence.trailingBufferMonths(source: source, key: dto.key) ?? 0
            let months = dto.rangeMonths.isEmpty ? [response.currentMonth] : dto.rangeMonths
            let allMonths = months.last == response.currentMonth ? months : months + [response.currentMonth]
            let clipped = TrackingTimelineLogic.monthsFromStart(allMonths, startMonth: start)
            let segments = TrackingTimelineLogic.segments(
                months: clipped,
                paidMonths: Set(dto.paidMonths),
                currentMonth: response.currentMonth,
                trailingBufferMonths: persistedBuffer
            )
            return .init(
                id: "\(source):\(dto.key)",
                key: dto.key,
                source: source,
                label: dto.label,
                colorHex: dto.color,
                paidMonths: Set(dto.paidMonths),
                currentMonth: response.currentMonth,
                availableMonths: allMonths,
                startMonth: start,
                trailingBufferMonths: persistedBuffer,
                segments: segments
            )
        }

        expenseRows = rows.filter { $0.source == "expense" }
        incomingRows = rows.filter { $0.source == "incoming" }
    }

    private func apply(options: UserOptionsListResponse, tracking: TrackingResponse) {
        let trackedKeys = Set(tracking.rows.map { trackingSelectionKey(kind: $0.kind, value: $0.value, parentValue: $0.parentValue) })
        expenseSelectionRows = nestedSelectionRows(
            parents: options.category,
            parentKind: .category,
            children: options.subcategory,
            childKind: .subcategory,
            trackedKeys: trackedKeys
        )
        incomingSelectionRows = nestedSelectionRows(
            parents: options.incomeType,
            parentKind: .incomeType,
            children: options.incomeSubtype,
            childKind: .incomeSubtype,
            trackedKeys: trackedKeys
        )
    }

    private func nestedSelectionRows(parents: [UserOptionRow], parentKind: OptionsKind, children: [UserOptionRow], childKind: OptionsKind, trackedKeys: Set<String>) -> [TrackingSelectionOptionRow] {
        let sortedParents = parents.sorted { lhs, rhs in
            lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
        }
        let childrenByParent = Dictionary(grouping: children) { row in
            normalizedOptionParent(row.parentValue)
        }
        var displayedChildKeys: Set<String> = []
        var rows: [TrackingSelectionOptionRow] = []

        for parent in sortedParents {
            rows.append(selectionRow(from: parent, kind: parentKind, indentationLevel: 0, trackedKeys: trackedKeys))
            let sortedChildren = (childrenByParent[parent.value] ?? []).sorted { lhs, rhs in
                lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            for child in sortedChildren {
                displayedChildKeys.insert(child.selfKey)
                rows.append(selectionRow(from: child, kind: childKind, indentationLevel: 1, trackedKeys: trackedKeys))
            }
        }

        let orphanChildren = children.filter { !displayedChildKeys.contains($0.selfKey) }.sorted { lhs, rhs in
            if lhs.parentValue == rhs.parentValue {
                return lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            return normalizedOptionParent(lhs.parentValue) < normalizedOptionParent(rhs.parentValue)
        }
        rows.append(contentsOf: orphanChildren.map {
            selectionRow(from: $0, kind: childKind, indentationLevel: 0, trackedKeys: trackedKeys)
        })

        return rows
    }

    private func selectionRow(from row: UserOptionRow, kind: OptionsKind, indentationLevel: Int, trackedKeys: Set<String>) -> TrackingSelectionOptionRow {
        let key = trackingSelectionKey(kind: kind.rawValue, value: row.value, parentValue: row.parentValue)
        return .init(
            kind: kind,
            value: row.value,
            color: row.color,
            parentValue: row.parentValue,
            indentationLevel: indentationLevel,
            isTracking: row.isTracking || trackedKeys.contains(key)
        )
    }

    private func mutateRow(id: String, source: String, _ mutate: (inout TrackingTimelineRowViewData) -> Void) {
        if source == "expense" {
            guard let index = expenseRows.firstIndex(where: { $0.id == id }) else { return }
            var row = expenseRows[index]
            mutate(&row)
            expenseRows[index] = row
        } else {
            guard let index = incomingRows.firstIndex(where: { $0.id == id }) else { return }
            var row = incomingRows[index]
            mutate(&row)
            incomingRows[index] = row
        }
    }

    private func debugFixtureResponseIfEnabled() -> TrackingResponse? {
        #if DEBUG
        guard isDebugFixtureEnabled() else { return nil }
        return Self.fixtureResponse()
        #else
        return nil
        #endif
    }

    private func isDebugFixtureEnabled() -> Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["UI_TEST_TRACKING_FIXTURE"] == "1"
        #else
        false
        #endif
    }

    private func normalizedParent(_ value: String?) -> String? {
        let trimmed = normalizedOptionParent(value)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func applyFixtureSelectionChanges(_ changes: [TrackingSelectionChange]) {
        for change in changes {
            updateFixtureSelectionRow(change.row, isTracking: change.isTracking)
        }
        apply(response: fixtureResponseFromSelectionRows())
    }

    private func updateFixtureSelectionRow(_ target: TrackingSelectionOptionRow, isTracking: Bool) {
        func update(rows: inout [TrackingSelectionOptionRow]) {
            guard let index = rows.firstIndex(where: { $0.id == target.id }) else { return }
            let row = rows[index]
            rows[index] = .init(
                kind: row.kind,
                value: row.value,
                color: row.color,
                parentValue: row.parentValue,
                indentationLevel: row.indentationLevel,
                isTracking: isTracking
            )
        }

        update(rows: &expenseSelectionRows)
        update(rows: &incomingSelectionRows)
    }

    private func fixtureResponseFromSelectionRows() -> TrackingResponse {
        let currentMonth = "2026-05"
        let rows = (expenseSelectionRows + incomingSelectionRows).filter(\.isTracking).map { row in
            let source = row.kind == .category || row.kind == .subcategory ? "expense" : "incoming"
            return TrackingRow(
                key: row.id.lowercased(),
                source: source,
                kind: row.kind.rawValue,
                value: row.value,
                parentValue: row.parentValue,
                color: row.color,
                label: normalizedOptionParent(row.parentValue).isEmpty ? row.value : "\(normalizedOptionParent(row.parentValue)) / \(row.value)",
                paidMonths: row.value == "Housing" || row.value == "Salary" ? ["2026-01", "2026-02", "2026-04"] : [],
                rangeMonths: ["2026-01", "2026-02", "2026-03", "2026-04", currentMonth],
                statusByMonth: [:]
            )
        }
        return .init(currentMonth: currentMonth, rows: rows)
    }

    #if DEBUG
    private static func fixtureResponse() -> TrackingResponse {
        .init(
            currentMonth: "2026-05",
            rows: [
                .init(key: "category|Housing|", source: "expense", kind: "category", value: "Housing", parentValue: nil, color: "#FF5A5F", label: "Housing", paidMonths: ["2026-01", "2026-02", "2026-04"], rangeMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"], statusByMonth: [:]),
                .init(key: "incomeType|Salary|", source: "incoming", kind: "incomeType", value: "Salary", parentValue: nil, color: "#00A699", label: "Salary", paidMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"], rangeMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"], statusByMonth: [:])
            ]
        )
    }
    #endif

    private static func fixtureOptions() -> UserOptionsListResponse {
        .init(
            account: [],
            category: [
                .init(value: "Housing", color: "#FF5A5F", isDefault: false, isTracking: true, parentValue: nil),
                .init(value: "Transport", color: "#FC642D", isDefault: false, isTracking: false, parentValue: nil)
            ],
            subcategory: [
                .init(value: "Rent", color: "#FFB400", isDefault: false, isTracking: false, parentValue: "Housing"),
                .init(value: "Train", color: "#767676", isDefault: false, isTracking: false, parentValue: "Transport")
            ],
            incomeType: [
                .init(value: "Salary", color: "#00A699", isDefault: false, isTracking: true, parentValue: nil),
                .init(value: "Freelance", color: "#007A87", isDefault: false, isTracking: false, parentValue: nil)
            ],
            incomeSubtype: [
                .init(value: "Base", color: "#7B0051", isDefault: false, isTracking: false, parentValue: "Salary"),
                .init(value: "Consulting", color: "#8CE071", isDefault: false, isTracking: false, parentValue: "Freelance")
            ]
        )
    }
}

private struct TrackingFeatureView: View {
    @StateObject private var viewModel: TrackingFeatureViewModel
    @State private var selectedKind = "expense"
    @State private var expandedRowIDs: Set<String> = []
    @State private var showTrackingSelection = false

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: TrackingFeatureViewModel(api: api))
    }

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.refresh() } }) {
            List {
                Section {
                    Picker("Kind", selection: $selectedKind) {
                        Text("Expenses").tag("expense")
                        Text("Incomings").tag("incoming")
                    }
                    .pickerStyle(.segmented)
                }

                if selectedRows.isEmpty {
                    Text(selectedKind == "expense" ? "No expense tracking" : "No incoming tracking")
                        .foregroundStyle(.secondary)
                }

                ForEach(selectedRows) { row in
                    TrackingTimelineRowCard(row: row, isExpanded: expandedBinding(for: row.id), onStartMonth: { month in
                        viewModel.setStartMonth(rowID: row.id, source: row.source, key: row.key, month: month)
                    }, onBuffer: { buffer in
                        viewModel.setTrailingBufferMonths(rowID: row.id, source: row.source, key: row.key, months: buffer)
                    })
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Tracking")
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await viewModel.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showTrackingSelection = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityIdentifier("tracking_manage_toolbar")
                }
            }
            .sheet(isPresented: $showTrackingSelection) {
                TrackingSelectionSheet(viewModel: viewModel)
            }
        }
        .task { viewModel.onAppear() }
    }

    private var selectedRows: [TrackingTimelineRowViewData] {
        selectedKind == "expense" ? viewModel.expenseRows : viewModel.incomingRows
    }

    private func expandedBinding(for id: String) -> Binding<Bool> {
        Binding {
            expandedRowIDs.contains(id)
        } set: { isExpanded in
            if isExpanded {
                expandedRowIDs.insert(id)
            } else {
                expandedRowIDs.remove(id)
            }
        }
    }
}

private struct TrackingSelectionSheet: View {
    @ObservedObject var viewModel: TrackingFeatureViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedKind: TrackingSelectionKind = .expense
    @State private var originalSelection: [String: Bool] = [:]
    @State private var draftSelection: [String: Bool] = [:]
    @State private var inlineError: String?
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Kind", selection: $selectedKind) {
                    ForEach(TrackingSelectionKind.allCases) { kind in
                        Text(kind.title).tag(kind)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .accessibilityIdentifier("tracking_selection_kind_picker")

                List {
                    if selectedRows.isEmpty {
                        Text(selectedKind == .expense ? "No expense options" : "No incoming options")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(selectedRows) { row in
                            TrackingSelectionRowView(
                                row: row,
                                isSelected: binding(for: row)
                            )
                        }
                    }

                    if let inlineError {
                        Text(inlineError)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Tracking")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(isSaving ? "Saving..." : "Done") {
                        Task { await save() }
                    }
                    .disabled(isSaving)
                    .accessibilityIdentifier("tracking_selection_done")
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
        .presentationDetents([.large])
        .onAppear(perform: resetDraft)
        .accessibilityIdentifier("tracking_selection_sheet")
    }

    private var selectedRows: [TrackingSelectionOptionRow] {
        selectedKind == .expense ? viewModel.expenseSelectionRows : viewModel.incomingSelectionRows
    }

    private func binding(for row: TrackingSelectionOptionRow) -> Binding<Bool> {
        Binding {
            draftSelection[row.id, default: row.isTracking]
        } set: { next in
            draftSelection[row.id] = next
            inlineError = nil
        }
    }

    private func resetDraft() {
        let selection = Dictionary(uniqueKeysWithValues: (viewModel.expenseSelectionRows + viewModel.incomingSelectionRows).map { ($0.id, $0.isTracking) })
        originalSelection = selection
        draftSelection = selection
        inlineError = nil
        isSaving = false
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await viewModel.saveTrackingSelection(original: originalSelection, draft: draftSelection)
            dismiss()
        } catch {
            inlineError = "Failed to update tracking."
        }
    }
}

private struct TrackingSelectionRowView: View {
    let row: TrackingSelectionOptionRow
    @Binding var isSelected: Bool

    var body: some View {
        Button {
            isSelected.toggle()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                    .frame(width: 26)
                Circle()
                    .fill(optionColor(from: row.color) ?? .gray)
                    .frame(width: 12, height: 12)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.value)
                        .foregroundStyle(.primary)
                    if let parent = row.parentValue, !parent.isEmpty {
                        Text(parent)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
            .padding(.leading, CGFloat(row.indentationLevel) * 18)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("tracking_selection_row_\(row.id)")
        .accessibilityLabel(row.parentValue.map { "\($0), \(row.value)" } ?? row.value)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
    }

    private func optionColor(from hex: String) -> Color? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }
}

private struct TrackingTimelineRowCard: View {
    let row: TrackingTimelineRowViewData
    @Binding var isExpanded: Bool
    let onStartMonth: (String) -> Void
    let onBuffer: (Int) -> Void

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            HStack(spacing: 24) {
                HStack(spacing: 8) {
                    Text("Start")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Menu {
                        ForEach(row.availableMonths, id: \.self) { month in
                            Button(month) { onStartMonth(month) }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(row.startMonth)
                            Image(systemName: "chevron.down")
                                .font(.caption2.weight(.semibold))
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    }
                    .accessibilityIdentifier("tracking_start_month_\(row.key)")
                }

                HStack(spacing: 8) {
                    Text("Buffer")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Menu {
                        ForEach(0 ... 24, id: \.self) { value in
                            Button("\(value)") { onBuffer(value) }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text("\(row.trailingBufferMonths)")
                            Image(systemName: "chevron.down")
                                .font(.caption2.weight(.semibold))
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    }
                    .accessibilityIdentifier("tracking_buffer_\(row.key)")
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(row.label)
                    .font(.headline)
                    .accessibilityIdentifier("tracking_row_title_\(row.key)")
                TrackingPipelinePreview(segments: row.segments)
            }
            .padding(.bottom, 10)
        }
        .accessibilityIdentifier("tracking_row_expand_\(row.key)")
    }
}

private struct TrackingPipelinePreview: View {
    let segments: [TrackingTimelineSegment]
    private let previewWidth: CGFloat = 276

    var body: some View {
        ScrollViewReader { proxy in
            GeometryReader { geo in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(segments) { segment in
                            VStack(spacing: 2) {
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(color(for: segment.state))
                                    .frame(width: 40, height: 8)
                                Text(monthAbbrev(segment.month))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .id(segment.id)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("\(segment.month), \(segment.state.rawValue)")
                        }
                    }
                    .frame(minWidth: geo.size.width, alignment: .trailing)
                }
                .onAppear {
                    if let newest = segments.last?.id {
                        proxy.scrollTo(newest, anchor: .trailing)
                    }
                }
            }
            .frame(width: previewWidth)
        }
    }

    private func monthAbbrev(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count == 2, let m = Int(parts[1]), (1 ... 12).contains(m) else { return month }
        let labels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        return labels[m - 1]
    }

    private func color(for state: TrackingTimelineSegmentState) -> Color {
        switch state {
        case .paid: return .green
        case .unpaid: return .orange
        case .buffer: return Color(uiColor: .systemGray3)
        case .empty: return Color(uiColor: .systemGray4)
        }
    }
}

private enum OptionsKind: String, CaseIterable, Identifiable {
    case account
    case category
    case subcategory
    case incomeType
    case incomeSubtype

    static let selectableCases: [OptionsKind] = [.account, .category, .incomeType]

    var id: String { rawValue }
    var title: String { rawValue }
    var displayTitle: String {
        switch self {
        case .account: return "Account"
        case .category: return "Category"
        case .subcategory: return "Subcategory"
        case .incomeType: return "Income Type"
        case .incomeSubtype: return "Income Subtype"
        }
    }
    var supportsParent: Bool { self == .subcategory || self == .incomeSubtype }
    var supportsNestedOptions: Bool { self == .category || self == .incomeType }

    var parentKind: OptionsKind? {
        switch self {
        case .subcategory: return .category
        case .incomeSubtype: return .incomeType
        default: return nil
        }
    }
}

@MainActor
private final class OptionsViewModel: ObservableObject {
    @Published private(set) var state: ViewLoadState = .loading
    @Published private(set) var optionsByKind: [OptionsKind: [UserOptionRow]] = [:]
    @Published var selectedKind: OptionsKind = .account
    @Published var inlineError: String?
    @Published var successText: String?
    @Published private(set) var trackingMismatchCount: Int = 0
    @Published private(set) var accountExpenses: [String: [ExpenseDTO]] = [:]
    @Published private(set) var accountIncomings: [String: [IncomingDTO]] = [:]
    @Published private(set) var loadingAccountExpenseIDs: Set<String> = []
    @Published private(set) var loadingAccountIncomingIDs: Set<String> = []
    @Published private(set) var accountExpenseErrors: [String: String] = [:]
    @Published private(set) var accountIncomingErrors: [String: String] = [:]

    private let api: ConvexAPI
    private var trackedKeysFromTrackingRows: Set<String> = []
    private var accountExpenseCursors: [String: String?] = [:]
    private var accountIncomingCursors: [String: String?] = [:]
    private var accountExpenseIsDone: Set<String> = []
    private var accountIncomingIsDone: Set<String> = []

    init(api: ConvexAPI) {
        self.api = api
    }

    func onAppear() {
        if optionsByKind.isEmpty {
            Task { await refresh() }
        }
    }

    func refresh() async {
        let shouldShowFullScreenError = !state.hasLoadedContent
        if shouldShowFullScreenError { state = .loading }
        do {
            async let optionsListRequest = api.userOptions.list()
            async let trackingListRequest = api.tracking.list()
            let list = try await optionsListRequest
            let tracking = try await trackingListRequest
            optionsByKind = [
                .account: list.account,
                .category: list.category,
                .subcategory: list.subcategory,
                .incomeType: list.incomeType,
                .incomeSubtype: list.incomeSubtype
            ]
            trackedKeysFromTrackingRows = Set(tracking.rows.map { trackingKey(kind: $0.kind, value: $0.value, parentValue: $0.parentValue) })
            trackingMismatchCount = countTrackingMismatches()
            state = .content
        } catch {
            if shouldShowFullScreenError {
                state = .error(message: "Failed to load options")
            }
        }
    }

    func loadInitialExpenses(for row: OptionsDisplayRow) async {
        accountExpenses[row.selfKey] = []
        accountExpenseCursors[row.selfKey] = nil
        accountExpenseIsDone.remove(row.selfKey)
        accountExpenseErrors[row.selfKey] = nil
        await loadMoreExpenses(for: row)
    }

    func loadInitialIncomings(for row: OptionsDisplayRow) async {
        accountIncomings[row.selfKey] = []
        accountIncomingCursors[row.selfKey] = nil
        accountIncomingIsDone.remove(row.selfKey)
        accountIncomingErrors[row.selfKey] = nil
        await loadMoreIncomings(for: row)
    }

    func loadInitialLedgerIfNeeded(for row: OptionsDisplayRow, tab: AccountLedgerTab) async {
        switch tab {
        case .expenses:
            if !hasLoadedExpenses(for: row) {
                await loadInitialExpenses(for: row)
            }
        case .incomings:
            if !hasLoadedIncomings(for: row) {
                await loadInitialIncomings(for: row)
            }
        }
    }

    func loadMoreExpenses(for row: OptionsDisplayRow) async {
        let key = row.selfKey
        guard !loadingAccountExpenseIDs.contains(key), !accountExpenseIsDone.contains(key) else { return }
        loadingAccountExpenseIDs.insert(key)
        defer { loadingAccountExpenseIDs.remove(key) }

        do {
            let page = try await api.expenses.listByAccount(.init(
                account: row.value,
                paginationOpts: .init(cursor: accountExpenseCursors[key] ?? nil, numItems: 20)
            ))
            accountExpenses[key, default: []].append(contentsOf: page.page)
            accountExpenseCursors[key] = page.continueCursor
            if page.isDone {
                accountExpenseIsDone.insert(key)
            }
            accountExpenseErrors[key] = nil
        } catch {
            if isEmptyAccountLedgerResponse(error) {
                accountExpenses[key, default: []] = []
                accountExpenseCursors[key] = nil
                accountExpenseIsDone.insert(key)
                accountExpenseErrors[key] = nil
            } else {
                accountExpenseErrors[key] = "Failed to load account expenses."
            }
        }
    }

    func loadMoreIncomings(for row: OptionsDisplayRow) async {
        let key = row.selfKey
        guard !loadingAccountIncomingIDs.contains(key), !accountIncomingIsDone.contains(key) else { return }
        loadingAccountIncomingIDs.insert(key)
        defer { loadingAccountIncomingIDs.remove(key) }

        do {
            let page = try await api.incomings.listByAccount(.init(
                account: row.value,
                paginationOpts: .init(cursor: accountIncomingCursors[key] ?? nil, numItems: 20)
            ))
            accountIncomings[key, default: []].append(contentsOf: page.page)
            accountIncomingCursors[key] = page.continueCursor
            if page.isDone {
                accountIncomingIsDone.insert(key)
            }
            accountIncomingErrors[key] = nil
        } catch {
            if isEmptyAccountLedgerResponse(error) {
                accountIncomings[key, default: []] = []
                accountIncomingCursors[key] = nil
                accountIncomingIsDone.insert(key)
                accountIncomingErrors[key] = nil
            } else {
                accountIncomingErrors[key] = "Failed to load account incomings."
            }
        }
    }

    private func isEmptyAccountLedgerResponse(_ error: Error) -> Bool {
        guard let apiError = error as? APIError else { return false }
        switch apiError {
        case .notFound:
            return true
        default:
            return false
        }
    }

    func hasLoadedExpenses(for row: OptionsDisplayRow) -> Bool {
        accountExpenses[row.selfKey] != nil
    }

    func hasLoadedIncomings(for row: OptionsDisplayRow) -> Bool {
        accountIncomings[row.selfKey] != nil
    }

    func expenses(for row: OptionsDisplayRow) -> [ExpenseDTO] {
        accountExpenses[row.selfKey] ?? []
    }

    func incomings(for row: OptionsDisplayRow) -> [IncomingDTO] {
        accountIncomings[row.selfKey] ?? []
    }

    func isLoadingExpenses(for row: OptionsDisplayRow) -> Bool {
        loadingAccountExpenseIDs.contains(row.selfKey)
    }

    func isLoadingIncomings(for row: OptionsDisplayRow) -> Bool {
        loadingAccountIncomingIDs.contains(row.selfKey)
    }

    func isDoneLoadingExpenses(for row: OptionsDisplayRow) -> Bool {
        accountExpenseIsDone.contains(row.selfKey)
    }

    func isDoneLoadingIncomings(for row: OptionsDisplayRow) -> Bool {
        accountIncomingIsDone.contains(row.selfKey)
    }

    func expenseError(for row: OptionsDisplayRow) -> String? {
        accountExpenseErrors[row.selfKey]
    }

    func incomingError(for row: OptionsDisplayRow) -> String? {
        accountIncomingErrors[row.selfKey]
    }

    var parentChoices: [String] {
        parentChoices(for: selectedKind)
    }

    func parentChoices(for kind: OptionsKind) -> [String] {
        guard let parentKind = kind.parentKind else { return [] }
        return (optionsByKind[parentKind] ?? []).map(\.value).sorted()
    }

    func childKind(for kind: OptionsKind) -> OptionsKind? {
        switch kind {
        case .category: return .subcategory
        case .incomeType: return .incomeSubtype
        default: return nil
        }
    }

    func parentChoicesExcluding(kind: OptionsKind, parentValue: String?) -> [String] {
        guard let parentValue = normalized(parentValue), !parentValue.isEmpty else {
            return parentChoices(for: kind)
        }
        return parentChoices(for: kind).filter { $0 != parentValue }
    }

    func moveToSubtypeTargets(kind: OptionsKind, excluding sourceValue: String) -> [String] {
        let values = (optionsByKind[kind] ?? []).map(\.value)
        return values.filter { $0 != sourceValue }.sorted()
    }

    var showsMoveHint: Bool {
        switch selectedKind {
        case .category, .incomeType, .subcategory, .incomeSubtype:
            return true
        default:
            return false
        }
    }

    var supportsTrackingForSelectedKind: Bool {
        supportsTracking(kind: selectedKind)
    }

    func supportsTracking(kind: OptionsKind) -> Bool {
        switch kind {
        case .category, .subcategory, .incomeType, .incomeSubtype:
            return true
        default:
            return false
        }
    }

    var rows: [OptionsDisplayRow] {
        switch selectedKind {
        case .category:
            return nestedRows(parentKind: .category, childKind: .subcategory)
        case .incomeType:
            return nestedRows(parentKind: .incomeType, childKind: .incomeSubtype)
        default:
            return flatRows(kind: selectedKind)
        }
    }

    var rowGroups: [OptionsDisplayGroup] {
        switch selectedKind {
        case .category:
            return nestedGroups(parentKind: .category, childKind: .subcategory)
        case .incomeType:
            return nestedGroups(parentKind: .incomeType, childKind: .incomeSubtype)
        default:
            return flatRows(kind: selectedKind).map { OptionsDisplayGroup(parent: $0, children: []) }
        }
    }

    private func flatRows(kind: OptionsKind) -> [OptionsDisplayRow] {
        (optionsByKind[kind] ?? []).sorted { lhs, rhs in
            if lhs.parentValue == rhs.parentValue {
                return lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            return (lhs.parentValue ?? "") < (rhs.parentValue ?? "")
        }.map { row in
            displayRow(from: row, kind: kind, indentationLevel: 0)
        }
    }

    private func nestedRows(parentKind: OptionsKind, childKind: OptionsKind) -> [OptionsDisplayRow] {
        nestedGroups(parentKind: parentKind, childKind: childKind).flatMap { group in
            [group.parent] + group.children
        }
    }

    private func nestedGroups(parentKind: OptionsKind, childKind: OptionsKind) -> [OptionsDisplayGroup] {
        let parents = (optionsByKind[parentKind] ?? []).sorted { lhs, rhs in
            lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
        }
        let childrenByParent = Dictionary(grouping: optionsByKind[childKind] ?? []) { row in
            normalized(row.parentValue) ?? ""
        }
        var displayedChildKeys: Set<String> = []
        var groups: [OptionsDisplayGroup] = []

        for parent in parents {
            let children = (childrenByParent[parent.value] ?? []).sorted { lhs, rhs in
                lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            let childRows = children.map { child in
                displayedChildKeys.insert(child.selfKey)
                return displayRow(from: child, kind: childKind, indentationLevel: 1)
            }
            groups.append(OptionsDisplayGroup(
                parent: displayRow(from: parent, kind: parentKind, indentationLevel: 0),
                children: childRows
            ))
        }

        let orphanChildren = (optionsByKind[childKind] ?? []).filter { !displayedChildKeys.contains($0.selfKey) }.sorted { lhs, rhs in
            if lhs.parentValue == rhs.parentValue {
                return lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            return (lhs.parentValue ?? "") < (rhs.parentValue ?? "")
        }
        groups.append(contentsOf: orphanChildren.map {
            OptionsDisplayGroup(parent: displayRow(from: $0, kind: childKind, indentationLevel: 0), children: [])
        })
        return groups
    }

    private func displayRow(from row: UserOptionRow, kind: OptionsKind, indentationLevel: Int) -> OptionsDisplayRow {
        let key = trackingKey(kind: kind.rawValue, value: row.value, parentValue: row.parentValue)
        let effectiveIsTracking = row.isTracking || trackedKeysFromTrackingRows.contains(key)
        return OptionsDisplayRow(
            kind: kind,
            value: row.value,
            color: row.color,
            isDefault: row.isDefault,
            isTracking: effectiveIsTracking,
            parentValue: row.parentValue,
            indentationLevel: indentationLevel
        )
    }

    func add(kind: OptionsKind, value: String, parentValue: String?, color: String? = nil) async {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            inlineError = "Option name cannot be empty."
            return
        }

        if kind.supportsParent, (parentValue ?? "").isEmpty {
            inlineError = "Please select a parent."
            return
        }

        let normalizedColor = color.flatMap(sanitizeHexColor)
        if color != nil, normalizedColor == nil {
            inlineError = "Color must be a valid 6-digit hex value."
            return
        }

        do {
            try await api.userOptions.add(.init(kind: kind.rawValue, value: trimmed, parentValue: normalized(parentValue)))
            if let normalizedColor {
                try await api.userOptions.updateColor(.init(
                    kind: kind.rawValue,
                    value: trimmed,
                    color: normalizedColor,
                    parentValue: normalized(parentValue)
                ))
            }
            await refresh()
            successText = "Added \(trimmed)."
            inlineError = nil
        } catch {
            inlineError = "Failed to add option."
        }
    }

    func rename(kind: OptionsKind, value: String, nextValue: String, parentValue: String?) async {
        let trimmed = nextValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            inlineError = "New name cannot be empty."
            return
        }
        do {
            try await api.userOptions.rename(.init(kind: kind.rawValue, value: value, nextValue: trimmed, parentValue: normalized(parentValue)))
            await refresh()
            successText = "Renamed successfully."
            inlineError = nil
        } catch {
            inlineError = "Failed to rename option."
        }
    }

    func updateColor(kind: OptionsKind, value: String, color: String, parentValue: String?) async {
        let normalizedColor = sanitizeHexColor(color)
        guard normalizedColor != nil else {
            inlineError = "Color must be a valid 6-digit hex value."
            return
        }
        do {
            try await api.userOptions.updateColor(.init(kind: kind.rawValue, value: value, color: normalizedColor!, parentValue: normalized(parentValue)))
            await refresh()
            inlineError = nil
        } catch {
            inlineError = "Failed to update color."
        }
    }

    func setDefault(kind: OptionsKind, value: String, isDefault: Bool, parentValue: String?) async {
        do {
            try await api.userOptions.setDefault(.init(kind: kind.rawValue, value: value, isDefault: isDefault, parentValue: normalized(parentValue)))
            await refresh()
            inlineError = nil
        } catch {
            inlineError = "Failed to set default."
        }
    }

    func setTracking(kind: OptionsKind, value: String, isTracking: Bool, parentValue: String?) async {
        do {
            try await api.userOptions.setTracking(.init(kind: kind.rawValue, value: value, isTracking: isTracking, parentValue: normalized(parentValue)))
            await refresh()
            inlineError = nil
        } catch {
            inlineError = "Failed to set tracking."
        }
    }

    func remove(kind: OptionsKind, value: String, parentValue: String?) async {
        do {
            try await api.userOptions.remove(.init(kind: kind.rawValue, value: value, parentValue: normalized(parentValue)))
            await refresh()
            inlineError = nil
        } catch {
            inlineError = "Failed to delete option."
        }
    }

    func moveToSubtype(kind: OptionsKind, sourceValue: String, targetValue: String) async {
        do {
            let request = try OptionsMutationLogic.buildMoveToSubtype(kind: kind.rawValue, sourceValue: sourceValue, targetValue: targetValue)
            try await api.userOptions.moveToSubtype(request)
            await refresh()
            inlineError = nil
        } catch {
            inlineError = message(for: error, fallback: "Failed to move to subtype.")
        }
    }

    func moveSubtype(kind: OptionsKind, value: String, sourceParentValue: String, targetParentValue: String) async {
        do {
            let request = try OptionsMutationLogic.buildMoveSubtype(
                kind: kind.rawValue,
                value: value,
                sourceParentValue: sourceParentValue,
                targetParentValue: targetParentValue
            )
            try await api.userOptions.moveSubtype(request)
            await refresh()
            inlineError = nil
        } catch {
            inlineError = message(for: error, fallback: "Failed to move subtype.")
        }
    }

    func promoteSubtype(kind: OptionsKind, value: String, parentValue: String) async {
        do {
            let request = try OptionsMutationLogic.buildPromoteSubtype(kind: kind.rawValue, value: value, parentValue: parentValue)
            try await api.userOptions.promoteSubtype(request)
            await refresh()
            inlineError = nil
        } catch {
            inlineError = message(for: error, fallback: "Failed to promote subtype.")
        }
    }

    private func normalized(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    private func sanitizeHexColor(_ color: String) -> String? {
        let clean = color.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: "#", with: "")
        guard clean.range(of: #"^[0-9A-F]{6}$"#, options: .regularExpression) != nil else { return nil }
        return "#\(clean)"
    }

    private func trackingKey(kind: String, value: String, parentValue: String?) -> String {
        let parent = normalized(parentValue) ?? ""
        return "\(kind)|\(value)|\(parent)"
    }

    private func countTrackingMismatches() -> Int {
        let candidateKinds: [OptionsKind] = [.category, .subcategory, .incomeType, .incomeSubtype]
        var count = 0
        for kind in candidateKinds {
            for row in optionsByKind[kind] ?? [] {
                let key = trackingKey(kind: kind.rawValue, value: row.value, parentValue: row.parentValue)
                let inTrackingRows = trackedKeysFromTrackingRows.contains(key)
                if inTrackingRows && row.isTracking == false {
                    count += 1
                }
            }
        }
        return count
    }

    private func message(for error: Error, fallback: String) -> String {
        if let apiError = error as? APIError, case let .validation(message) = apiError {
            return message
        }
        return fallback
    }
}

private struct OptionsDisplayRow: Identifiable, Equatable {
    let kind: OptionsKind
    let value: String
    let color: String
    let isDefault: Bool
    let isTracking: Bool
    let parentValue: String?
    let indentationLevel: Int
    var id: String { "\(kind.rawValue)|\(value)|\(parentValue ?? "")" }
}

private struct OptionsDisplayGroup: Identifiable {
    let parent: OptionsDisplayRow
    let children: [OptionsDisplayRow]
    var id: String { parent.id }
}

private struct OptionDragPayload: Equatable {
    let kind: OptionsKind
    let value: String
    let parentValue: String?

    var sourceID: String { "\(kind.rawValue)|\(value)|\(parentValue ?? "")" }

    var isChild: Bool {
        kind == .subcategory || kind == .incomeSubtype
    }
}

private struct OptionDropFrame: Equatable, Identifiable {
    enum Kind: Equatable {
        case row(OptionsDisplayRow)
        case promote
    }

    let id: String
    let kind: Kind
    let rect: CGRect
}

private struct OptionDropFramePreferenceKey: PreferenceKey {
    static var defaultValue: [OptionDropFrame] = []

    static func reduce(value: inout [OptionDropFrame], nextValue: () -> [OptionDropFrame]) {
        value.append(contentsOf: nextValue())
    }
}

private struct OptionScrollViewportHeightPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

private enum OptionAutoScrollAnchor: Equatable {
    case top
    case bottom

    var unitPoint: UnitPoint {
        switch self {
        case .top: return .top
        case .bottom: return .bottom
        }
    }
}

private struct OptionAutoScrollRequest: Equatable {
    let targetID: String
    let anchor: OptionAutoScrollAnchor
    let token: Int
}

private struct OptionRowLongPressInstaller: UIViewRepresentable {
    var isEnabled: Bool
    var locationInOptionSpace: (CGPoint) -> CGPoint?
    var onBegan: (CGPoint) -> Void
    var onChanged: (CGPoint) -> Void
    var onEnded: (CGPoint?) -> Void
    var onCancelled: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> InstallerView {
        let view = InstallerView()
        view.isUserInteractionEnabled = false
        view.coordinator = context.coordinator
        return view
    }

    func updateUIView(_ view: InstallerView, context: Context) {
        context.coordinator.parent = self
        view.coordinator = context.coordinator
        context.coordinator.install(on: view.superview)
        context.coordinator.updateGesture()
    }

    static func dismantleUIView(_ uiView: InstallerView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    final class InstallerView: UIView {
        weak var coordinator: Coordinator?

        override func didMoveToSuperview() {
            super.didMoveToSuperview()
            coordinator?.install(on: superview)
        }
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var parent: OptionRowLongPressInstaller
        private weak var installedView: UIView?
        private let gesture = UILongPressGestureRecognizer()

        init(parent: OptionRowLongPressInstaller) {
            self.parent = parent
            super.init()
            gesture.addTarget(self, action: #selector(handleGesture(_:)))
            gesture.delegate = self
            gesture.cancelsTouchesInView = false
            gesture.delaysTouchesBegan = false
            gesture.delaysTouchesEnded = false
            updateGesture()
        }

        func install(on view: UIView?) {
            guard installedView !== view else { return }
            if let installedView {
                installedView.removeGestureRecognizer(gesture)
            }
            installedView = view
            view?.addGestureRecognizer(gesture)
        }

        func uninstall() {
            installedView?.removeGestureRecognizer(gesture)
            installedView = nil
        }

        func updateGesture() {
            gesture.isEnabled = parent.isEnabled
            gesture.minimumPressDuration = 0.5
            gesture.allowableMovement = 10
        }

        @objc private func handleGesture(_ recognizer: UILongPressGestureRecognizer) {
            guard parent.isEnabled else { return }
            let localLocation = recognizer.location(in: recognizer.view)
            let optionLocation = parent.locationInOptionSpace(localLocation)

            switch recognizer.state {
            case .began:
                if let optionLocation {
                    parent.onBegan(optionLocation)
                }
            case .changed:
                if let optionLocation {
                    parent.onChanged(optionLocation)
                }
            case .ended:
                parent.onEnded(optionLocation)
            case .cancelled, .failed:
                parent.onCancelled()
            default:
                break
            }
        }

        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            parent.isEnabled
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }
    }
}

private enum AccountLedgerTab: String, CaseIterable, Identifiable {
    case expenses
    case incomings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expenses: return "Expenses"
        case .incomings: return "Incomings"
        }
    }
}

private struct AccountLedgerBottomPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = .infinity

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = min(value, nextValue())
    }
}

private struct OptionCreateDraft {
    var value = ""
    var parentValue = ""
    var addAsSubtype = false
    var color = "#EC4899"
}

private struct OptionEditDraft {
    var value: String
    var color: String

    init(row: OptionsDisplayRow) {
        value = row.value
        color = row.color
    }
}

private struct OptionCreateSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: OptionsViewModel
    let selectedKind: OptionsKind
    @Binding var draft: OptionCreateDraft

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $draft.value)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)

                    if selectedKind.supportsNestedOptions {
                        Toggle("Add as subtype", isOn: $draft.addAsSubtype)
                            .onChange(of: draft.addAsSubtype) { _, _ in
                                draft.parentValue = ""
                            }
                    }

                    if addKind.supportsParent {
                        Picker("Parent", selection: $draft.parentValue) {
                            Text("Select Parent").tag("")
                            ForEach(viewModel.parentChoices(for: addKind), id: \.self) { parent in
                                Text(parent).tag(parent)
                            }
                        }
                    }

                    ColorPicker(
                        "Color",
                        selection: Binding(
                            get: { optionCreateColor(from: draft.color) ?? .pink },
                            set: { draft.color = optionCreateHex(from: $0) ?? draft.color }
                        ),
                        supportsOpacity: false
                    )
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task {
                            await viewModel.add(
                                kind: addKind,
                                value: draft.value,
                                parentValue: draft.parentValue,
                                color: draft.color
                            )
                            dismiss()
                        }
                    } label: {
                        Text("Create")
                    }
                    .disabled(isCreateDisabled)
                }
            }
        }
    }

    private var addKind: OptionsKind {
        draft.addAsSubtype ? (viewModel.childKind(for: selectedKind) ?? selectedKind) : selectedKind
    }

    private var title: String {
        switch addKind {
        case .account: return "New Account"
        case .category: return "New Category"
        case .subcategory: return "New Subcategory"
        case .incomeType: return "New Income Type"
        case .incomeSubtype: return "New Income Subtype"
        }
    }

    private var isCreateDisabled: Bool {
        let hasName = !draft.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasParent = !addKind.supportsParent || !draft.parentValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return !hasName || !hasParent
    }

    private func optionCreateColor(from hex: String) -> Color? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }

    private func optionCreateHex(from color: Color) -> String? {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard UIColor(color).getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return nil }
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }
}

private struct OptionEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: OptionsViewModel
    let row: OptionsDisplayRow
    @State private var draft: OptionEditDraft
    @State private var showDeleteConfirmation = false
    @State private var addAsSubtype = false
    @State private var selectedSubtypeParent = ""

    init(viewModel: OptionsViewModel, row: OptionsDisplayRow) {
        self.viewModel = viewModel
        self.row = row
        _draft = State(initialValue: OptionEditDraft(row: row))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Name") {
                        TextField("", text: $draft.value)
                            .textInputAutocapitalization(.words)
                            .submitLabel(.done)
                            .multilineTextAlignment(.trailing)
                    }

                    ColorPicker(
                        "Color",
                        selection: Binding(
                            get: { optionEditColor(from: draft.color) ?? .pink },
                            set: { draft.color = optionEditHex(from: $0) ?? draft.color }
                        ),
                        supportsOpacity: false
                    )

                    if canMoveToSubtype {
                        Toggle("Add as subtype", isOn: $addAsSubtype)
                            .onChange(of: addAsSubtype) { _, isEnabled in
                                if !isEnabled {
                                    selectedSubtypeParent = ""
                                }
                            }

                        if addAsSubtype {
                            Picker("Parent", selection: $selectedSubtypeParent) {
                                Text("Select Parent").tag("")
                                ForEach(subtypeTargets, id: \.self) { parent in
                                    Text(parent).tag(parent)
                                }
                            }
                        }
                    }

                    if canPromoteSubtype {
                        Button(promoteButtonTitle) {
                            Task {
                                await viewModel.promoteSubtype(
                                    kind: row.kind,
                                    value: row.value,
                                    parentValue: row.parentValue ?? ""
                                )
                                dismiss()
                            }
                        }
                    }

                    Button("Delete", role: .destructive) {
                        showDeleteConfirmation = true
                    }
                }
            }
            .listSectionSpacing(0)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.height(360), .medium])
            .presentationDragIndicator(.visible)
            .confirmationDialog("Delete option?", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.remove(kind: row.kind, value: row.value, parentValue: row.parentValue)
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task {
                            await saveChanges()
                            dismiss()
                        }
                    } label: {
                        Text("Save")
                    }
                    .disabled(!hasChanges)
                }
            }
        }
    }

    private var title: String {
        switch row.kind {
        case .account: return "Edit Account"
        case .category: return "Edit Category"
        case .subcategory: return "Edit Subcategory"
        case .incomeType: return "Edit Income Type"
        case .incomeSubtype: return "Edit Income Subtype"
        }
    }

    private var hasChanges: Bool {
        let nextName = draft.value.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextColor = normalizedHex(draft.color)
        let hasFieldChanges = nextName != row.value || (nextColor != nil && nextColor != normalizedHex(row.color))
        return !nextName.isEmpty && (hasFieldChanges || hasValidSubtypeTarget)
    }

    private var subtypeTargets: [String] {
        guard row.kind.supportsNestedOptions else { return [] }
        return viewModel.moveToSubtypeTargets(kind: row.kind, excluding: row.value)
    }

    private var canMoveToSubtype: Bool {
        row.kind.supportsNestedOptions && !rowHasChildren && !subtypeTargets.isEmpty
    }

    private var rowHasChildren: Bool {
        guard let childKind = viewModel.childKind(for: row.kind) else { return false }
        return (viewModel.optionsByKind[childKind] ?? []).contains { child in
            (child.parentValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines) == row.value
        }
    }

    private var hasValidSubtypeTarget: Bool {
        addAsSubtype && !selectedSubtypeParent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canPromoteSubtype: Bool {
        row.kind.supportsParent && !(row.parentValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var promoteButtonTitle: String {
        switch row.kind {
        case .subcategory:
            return "Promote to Own Category"
        case .incomeSubtype:
            return "Promote to Own Income Type"
        default:
            return "Promote to Own Category"
        }
    }

    private func saveChanges() async {
        let nextName = draft.value.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextColor = normalizedHex(draft.color) ?? row.color
        let nameChanged = !nextName.isEmpty && nextName != row.value
        let colorChanged = normalizedHex(nextColor) != normalizedHex(row.color)

        if nameChanged {
            await viewModel.rename(kind: row.kind, value: row.value, nextValue: nextName, parentValue: row.parentValue)
        }

        if colorChanged {
            await viewModel.updateColor(kind: row.kind, value: nameChanged ? nextName : row.value, color: nextColor, parentValue: row.parentValue)
        }

        if hasValidSubtypeTarget {
            await viewModel.moveToSubtype(
                kind: row.kind,
                sourceValue: nameChanged ? nextName : row.value,
                targetValue: selectedSubtypeParent
            )
        }
    }

    private func optionEditColor(from hex: String) -> Color? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }

    private func optionEditHex(from color: Color) -> String? {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard UIColor(color).getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return nil }
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }

    private func normalizedHex(_ hex: String) -> String? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: "#", with: "")
        guard clean.range(of: #"^[0-9A-F]{6}$"#, options: .regularExpression) != nil else { return nil }
        return "#\(clean)"
    }
}

private struct OptionsFeatureView: View {
    @StateObject private var viewModel: OptionsViewModel
    @State private var createDraft = OptionCreateDraft()
    @State private var showCreateOption = false
    @State private var renameByRow: [String: String] = [:]
    @State private var colorByRow: [String: String] = [:]
    @State private var rowPendingDelete: OptionsDisplayRow?
    @State private var accountEditorContext: OptionsDisplayRow?
    @State private var selectedAccountID: String?
    @State private var selectedAccountLedgerTab: AccountLedgerTab = .expenses
    @State private var accountPagerResetToken = 0
    @State private var optionEditorContext: OptionsDisplayRow?
    @State private var draggedOption: OptionDragPayload?
    @State private var dropTargetRowID: String?
    @State private var isPromoteDropTargeted = false
    @State private var optionDropFrames: [OptionDropFrame] = []
    @State private var optionDragPreviewRow: OptionsDisplayRow?
    @State private var optionDragPreviewLocation: CGPoint?
    @State private var activeOptionDragSourceID: String?
    @State private var optionDragSessionGeneration = 0
    @State private var optionRowTapSuppressedUntil = Date.distantPast
    @State private var optionScrollViewportHeight: CGFloat = 0
    @State private var optionAutoScrollDirection = 0
    @State private var optionAutoScrollGeneration = 0
    @State private var optionAutoScrollRequestToken = 0
    @State private var optionAutoScrollRequest: OptionAutoScrollRequest?
    private let optionDropCoordinateSpace = "options-option-drop-space"
    private let optionPromoteDropZoneID = "promote-zone"

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: OptionsViewModel(api: api))
    }

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.refresh() } }) {
            optionsContent()
            .navigationTitle("Options")
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await viewModel.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        createDraft = OptionCreateDraft()
                        viewModel.inlineError = nil
                        viewModel.successText = nil
                        showCreateOption = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityIdentifier("options_add_toolbar")
                }
            }
            .alert("Delete option?", isPresented: Binding(get: { rowPendingDelete != nil }, set: { if !$0 { rowPendingDelete = nil } })) {
                Button("Delete", role: .destructive) {
                    if let row = rowPendingDelete {
                        Task {
                            await viewModel.remove(kind: row.kind, value: row.value, parentValue: row.parentValue)
                            rowPendingDelete = nil
                        }
                    }
                }
                Button("Cancel", role: .cancel) { rowPendingDelete = nil }
            }
            .sheet(isPresented: $showCreateOption) {
                OptionCreateSheet(
                    viewModel: viewModel,
                    selectedKind: viewModel.selectedKind,
                    draft: $createDraft
                )
            }
            .sheet(item: $optionEditorContext) { row in
                OptionEditSheet(viewModel: viewModel, row: row)
            }
            .sheet(item: $accountEditorContext) { row in
                NavigationStack {
                    Form {
                        Section(row.value) {
                            TextField("Rename", text: Binding(get: { renameByRow[row.selfKey, default: row.value] }, set: { renameByRow[row.selfKey] = $0 }))
                            ColorPicker(
                                "Color",
                                selection: colorSelectionBinding(for: row),
                                supportsOpacity: false
                            )
                        }

                        Section {
                            Button("Delete Account", role: .destructive) {
                                rowPendingDelete = row
                                accountEditorContext = nil
                            }
                        }
                    }
                    .navigationTitle("Edit Account")
                    .navigationBarTitleDisplayMode(.inline)
                    .presentationDetents([.height(300)])
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Cancel") { accountEditorContext = nil }
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Save") {
                                Task {
                                    await saveAccountChanges(for: row)
                                    accountEditorContext = nil
                                }
                            }
                            .disabled(!accountHasChanges(row))
                        }
                    }
                }
            }
        }
        .task { viewModel.onAppear() }
        .onChange(of: viewModel.selectedKind) {
            createDraft = OptionCreateDraft()
            showCreateOption = false
            accountEditorContext = nil
            optionEditorContext = nil
            resetOptionDrag()
            selectedAccountID = nil
            selectedAccountLedgerTab = .expenses
            accountPagerResetToken = 0
        }
        .onChange(of: selectedAccountID) { _, _ in
            guard let selectedAccountRow else { return }
            Task { await viewModel.loadInitialLedgerIfNeeded(for: selectedAccountRow, tab: selectedAccountLedgerTab) }
        }
    }

    @ViewBuilder
    private func optionsContent() -> some View {
        ScrollViewReader { scrollProxy in
            ScrollView {
                LazyVStack(spacing: 14) {
                    optionsKindPicker()
                        .padding(12)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color(uiColor: .secondarySystemGroupedBackground))
                        )
                        .padding(.horizontal, 16)
                        .padding(.top, 12)

                    if viewModel.selectedKind == .account {
                        accountOptionsContent()
                    } else {
                        nonAccountOptionsContent()
                    }

                    accountStatusMessages()
                        .padding(.horizontal, 16)
                }
                .padding(.bottom, 24)
            }
            .scrollDisabled(draggedOption != nil)
            .coordinateSpace(name: optionDropCoordinateSpace)
            .overlay(alignment: .topLeading) {
                optionDragPreviewOverlay()
            }
            .background {
                GeometryReader { proxy in
                    Color(uiColor: .systemGroupedBackground)
                        .preference(key: OptionScrollViewportHeightPreferenceKey.self, value: proxy.size.height)
                }
            }
            .onPreferenceChange(OptionScrollViewportHeightPreferenceKey.self) { height in
                optionScrollViewportHeight = height
            }
            .onChange(of: optionAutoScrollRequest) { _, request in
                guard let request else { return }
                withAnimation(.linear(duration: 0.12)) {
                    scrollProxy.scrollTo(request.targetID, anchor: request.anchor.unitPoint)
                }
            }
        }
    }

    private func optionsKindPicker() -> some View {
        Picker("Options", selection: $viewModel.selectedKind) {
            ForEach(OptionsKind.selectableCases) { kind in
                Text(kind.displayTitle).tag(kind)
            }
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private func nonAccountOptionsContent() -> some View {
        LazyVStack(spacing: 14) {
            if viewModel.selectedKind.supportsNestedOptions {
                if shouldShowPromoteDropZone {
                    optionPromoteDropZone()
                        .id(optionPromoteDropZoneID)
                }

                ForEach(viewModel.rowGroups) { group in
                    VStack(spacing: 0) {
                        optionCompactRow(for: group.parent)
                        ForEach(group.children, id: \.selfKey) { child in
                            Divider()
                                .padding(.leading, 42)
                            optionCompactRow(for: child, dropTarget: group.parent)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color(uiColor: .secondarySystemGroupedBackground))
                    )
                }
            } else {
                ForEach(viewModel.rowGroups) { group in
                    optionCompactRow(for: group.parent)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color(uiColor: .secondarySystemGroupedBackground))
                        )
                }
            }
        }
        .padding(.horizontal, 24)
        .onPreferenceChange(OptionDropFramePreferenceKey.self) { frames in
            optionDropFrames = frames
        }
    }

    private var shouldShowPromoteDropZone: Bool {
        guard let draggedOption, draggedOption.isChild else { return false }
        return (viewModel.selectedKind == .category && draggedOption.kind == .subcategory)
            || (viewModel.selectedKind == .incomeType && draggedOption.kind == .incomeSubtype)
    }

    private func optionPromoteDropZone() -> some View {
        HStack(spacing: 10) {
            Image(systemName: "arrow.up.to.line")
                .font(.subheadline.weight(.semibold))
            Text(promoteDropZoneTitle)
                .font(.subheadline.weight(.semibold))
        }
        .foregroundStyle(isPromoteDropTargeted ? Color.accentColor : Color.secondary)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(isPromoteDropTargeted ? Color.accentColor.opacity(0.14) : Color(uiColor: .secondarySystemGroupedBackground))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(
                    isPromoteDropTargeted ? Color.accentColor.opacity(0.65) : Color.secondary.opacity(0.28),
                    style: StrokeStyle(lineWidth: 1.2, dash: [6, 5])
                )
        }
        .scaleEffect(isPromoteDropTargeted ? 1.015 : 1)
        .animation(.easeInOut(duration: 0.16), value: isPromoteDropTargeted)
        .background(optionDropFrameReader(id: optionPromoteDropZoneID, kind: .promote))
    }

    private var promoteDropZoneTitle: String {
        viewModel.selectedKind == .category ? "Drop here to promote to Category" : "Drop here to promote to Income Type"
    }

    private func accountOptionsContent() -> some View {
        LazyVStack(spacing: 14) {
            if selectedAccountID == nil {
                accountStackOverview()
            } else {
                accountDetailScroller()
            }
        }
    }

    @ViewBuilder
    private func optionsStatusSections() -> some View {
        if viewModel.trackingMismatchCount > 0 {
            Section("Tracking Data Warning") {
                Text("Detected \(viewModel.trackingMismatchCount) tracking rows not reflected in option flags. Showing effective tracking state.")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
        }

        if let inlineError = viewModel.inlineError {
            Section("Error") {
                Text(inlineError).foregroundStyle(.red).font(.footnote)
            }
        }
        if let successText = viewModel.successText {
            Section("Status") {
                Text(successText).font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func accountStatusMessages() -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if viewModel.trackingMismatchCount > 0 {
                Text("Detected \(viewModel.trackingMismatchCount) tracking rows not reflected in option flags. Showing effective tracking state.")
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let inlineError = viewModel.inlineError {
                Text(inlineError)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let successText = viewModel.successText {
                Text(successText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var selectedAccountRow: OptionsDisplayRow? {
        guard let selectedAccountID else { return nil }
        return viewModel.rowGroups.map(\.parent).first { $0.id == selectedAccountID }
    }

    private func accountHasChanges(_ row: OptionsDisplayRow) -> Bool {
        let nextName = renameByRow[row.selfKey, default: row.value].trimmingCharacters(in: .whitespacesAndNewlines)
        let nextColor = normalizedHex(colorByRow[row.selfKey, default: row.color])
        let currentColor = normalizedHex(row.color)
        return !nextName.isEmpty && (nextName != row.value || (nextColor != nil && nextColor != currentColor))
    }

    private func saveAccountChanges(for row: OptionsDisplayRow) async {
        let nextName = renameByRow[row.selfKey, default: row.value].trimmingCharacters(in: .whitespacesAndNewlines)
        let nextColor = normalizedHex(colorByRow[row.selfKey, default: row.color]) ?? row.color
        let nameChanged = !nextName.isEmpty && nextName != row.value
        let colorChanged = normalizedHex(nextColor) != normalizedHex(row.color)

        if nameChanged {
            await viewModel.rename(
                kind: row.kind,
                value: row.value,
                nextValue: nextName,
                parentValue: row.parentValue
            )
        }

        if colorChanged {
            await viewModel.updateColor(
                kind: row.kind,
                value: nameChanged ? nextName : row.value,
                color: nextColor,
                parentValue: row.parentValue
            )
        }
    }

    @ViewBuilder
    private func accountStackOverview() -> some View {
        let rows = viewModel.rowGroups.map(\.parent)
        let cardHeight: CGFloat = 202

        VStack(alignment: .leading, spacing: 14) {
            if rows.isEmpty {
                Text("No accounts yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 12)
            } else {
                VStack(spacing: -148) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                        accountStackCard(for: row, index: index)
                            .frame(height: cardHeight)
                            .zIndex(Double(index))
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(.top, 2)
        .padding(.horizontal, 24)
        .padding(.bottom, 18)
    }

    @ViewBuilder
    private func accountDetailScroller() -> some View {
        let rows = viewModel.rowGroups.map(\.parent)
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Button {
                    withAnimation(.easeInOut(duration: 0.22)) {
                        selectedAccountID = nil
                        selectedAccountLedgerTab = .expenses
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)

                Spacer()
                Text(selectedAccountRow?.value ?? "Account")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                Spacer()
                Button {
                    if let selectedAccountRow {
                        accountEditorContext = selectedAccountRow
                    }
                } label: {
                    Image(systemName: "pencil")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 4)

            TabView(selection: Binding(get: { selectedAccountID ?? "" }, set: { next in
                guard !next.isEmpty, next != selectedAccountID else { return }
                selectedAccountID = next
                selectedAccountLedgerTab = .expenses
            })) {
                ForEach(rows) { row in
                    accountHeroCard(for: row, isFocused: selectedAccountID == row.id)
                        .padding(.horizontal, 2)
                        .tag(row.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .id("account-pager-\(accountPagerResetToken)")
            .frame(height: 202)

            accountPageDots(rows: rows)
                .frame(maxWidth: .infinity)
                .padding(.top, -12)

            if let selectedAccount = selectedAccountRow {
                accountLedgerTabs(for: selectedAccount)
                    .id("account-ledger-\(selectedAccount.id)")
            }
        }
        .animation(.easeInOut(duration: 0.22), value: selectedAccountID == nil)
        .padding(.top, 8)
        .padding(.horizontal, 24)
        .padding(.bottom, 18)
    }

    @ViewBuilder
    private func accountStackCard(for row: OptionsDisplayRow, index: Int) -> some View {
        accountCardSurface(for: row, isFocused: index == 0, compact: true)
            .background(alignment: .top) {
                if index > 0 {
                    accountStackTopShadow()
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: 20))
            .onTapGesture {
                withAnimation(.easeInOut(duration: 0.24)) {
                    openAccountDetail(for: row)
                }
            }
    }

    private func openAccountDetail(for row: OptionsDisplayRow) {
        accountPagerResetToken += 1
        selectedAccountID = row.id
        selectedAccountLedgerTab = .expenses
        Task { await viewModel.loadInitialLedgerIfNeeded(for: row, tab: .expenses) }
    }

    private func accountStackTopShadow() -> some View {
        RoundedRectangle(cornerRadius: 20)
            .fill(Color.black.opacity(0.24))
            .frame(height: 30)
            .padding(.horizontal, 8)
            .blur(radius: 10)
            .offset(y: -8)
            .allowsHitTesting(false)
    }

    @ViewBuilder
    private func accountHeroCard(for row: OptionsDisplayRow, isFocused: Bool) -> some View {
        accountCardSurface(for: row, isFocused: isFocused, compact: false)
            .frame(height: 202)
            .onTapGesture {
                accountEditorContext = row
            }
    }

    private func accountPageDots(rows: [OptionsDisplayRow]) -> some View {
        HStack(spacing: 7) {
            ForEach(rows) { row in
                Circle()
                    .fill(row.id == selectedAccountID ? Color.primary.opacity(0.72) : Color.secondary.opacity(0.28))
                    .frame(width: row.id == selectedAccountID ? 7 : 6, height: row.id == selectedAccountID ? 7 : 6)
            }
        }
        .animation(.easeInOut(duration: 0.18), value: selectedAccountID)
    }

    @ViewBuilder
    private func accountCardSurface(for row: OptionsDisplayRow, isFocused: Bool, compact: Bool) -> some View {
        let accountColor = color(from: row.color) ?? .gray
        let palette = accountPalette(for: accountColor, index: Int(row.id.hashValue.magnitude % 10_000))
        let cornerRadius: CGFloat = compact ? 20 : 22

        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        colors: palette,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Circle()
                .fill(.white.opacity(compact ? 0.13 : 0.18))
                .frame(width: compact ? 136 : 188, height: compact ? 136 : 188)
                .offset(x: compact ? -42 : -34, y: compact ? -68 : -58)

            RoundedRectangle(cornerRadius: 42)
                .fill(.white.opacity(compact ? 0.10 : 0.14))
                .frame(width: compact ? 190 : 236, height: compact ? 116 : 146)
                .rotationEffect(.degrees(-21))
                .offset(x: compact ? 132 : 158, y: compact ? -46 : -56)

            RoundedRectangle(cornerRadius: 52)
                .stroke(.white.opacity(compact ? 0.10 : 0.14), lineWidth: compact ? 20 : 24)
                .frame(width: compact ? 220 : 268, height: compact ? 142 : 178)
                .rotationEffect(.degrees(-24))
                .offset(x: compact ? -82 : -58, y: compact ? 64 : 74)

            VStack(alignment: .leading, spacing: compact ? 14 : 24) {
                HStack(alignment: .center) {
                    accountGlyph(for: row, color: .white.opacity(0.58))
                    Spacer()
                    Text(row.value)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.94))
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }

                if compact {
                    Spacer(minLength: 0)
                    VStack(alignment: .center, spacing: 6) {
                        Text(row.value)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.82))
                            .lineLimit(1)
                            .minimumScaleFactor(0.78)
                        Text("Account")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.98))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    Spacer(minLength: 2)
                } else {
                    Spacer(minLength: 0)

                    VStack(alignment: .center, spacing: 7) {
                        Text(row.value)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.82))
                            .lineLimit(1)
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("ILS")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.72))
                            Text("Account")
                                .font(.largeTitle.weight(.semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                        }
                        Text(isFocused ? "Transactions" : "Account")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(compact ? 18 : 20)

            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(
                    LinearGradient(colors: [.white.opacity(0.34), .white.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing),
                    lineWidth: 1
                )
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .shadow(color: palette[0].opacity(0.26), radius: compact ? 16 : 22, x: 0, y: compact ? 10 : 14)
    }

    private func accountGlyph(for row: OptionsDisplayRow, color: Color) -> some View {
        ZStack {
            Circle()
                .stroke(color, lineWidth: 2)
                .frame(width: 24, height: 24)
            Text(String(row.value.prefix(1)).uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(color)
        }
    }

    private func accountPalette(for color: Color, index: Int) -> [Color] {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0
        guard UIColor(color).getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
            return [
                color.opacity(0.82),
                Color(red: 0.58, green: 0.45, blue: 0.68),
                Color(red: 0.16, green: 0.17, blue: 0.34)
            ]
        }

        let hueShift = CGFloat((index % 3) - 1) * 0.028
        let companionHue = hue + hueShift < 0 ? hue + hueShift + 1 : (hue + hueShift > 1 ? hue + hueShift - 1 : hue + hueShift)
        let vividSaturation = max(0.44, min(0.82, saturation + 0.18))
        let softSaturation = max(0.34, min(0.68, saturation + 0.08))
        let topBrightness = max(0.66, min(0.92, brightness + 0.18))
        let midBrightness = max(0.48, min(0.78, brightness + 0.02))
        let bottomBrightness = max(0.24, min(0.48, brightness - 0.22))

        return [
            Color(hue: Double(companionHue), saturation: Double(softSaturation), brightness: Double(topBrightness)),
            Color(hue: Double(hue), saturation: Double(vividSaturation), brightness: Double(midBrightness)),
            Color(hue: Double(hue), saturation: Double(max(0.38, saturation)), brightness: Double(bottomBrightness))
        ]
    }

    @ViewBuilder
    private func accountLedgerTabs(for row: OptionsDisplayRow) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Picker("Account Ledger", selection: $selectedAccountLedgerTab) {
                ForEach(AccountLedgerTab.allCases) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: selectedAccountLedgerTab) { _, tab in
                Task { await viewModel.loadInitialLedgerIfNeeded(for: row, tab: tab) }
            }
            .task(id: "\(row.selfKey)|\(selectedAccountLedgerTab.rawValue)") {
                await viewModel.loadInitialLedgerIfNeeded(for: row, tab: selectedAccountLedgerTab)
            }

            switch selectedAccountLedgerTab {
            case .expenses:
                accountExpenseFeed(for: row)
            case .incomings:
                accountIncomingFeed(for: row)
            }
        }
        .transaction { transaction in
            transaction.animation = nil
        }
    }

    @ViewBuilder
    private func accountExpenseFeed(for row: OptionsDisplayRow) -> some View {
        let expenses = viewModel.expenses(for: row)
        VStack(alignment: .leading, spacing: 12) {
            Text("Last transactions")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)

            if !viewModel.hasLoadedExpenses(for: row) || (expenses.isEmpty && viewModel.isLoadingExpenses(for: row)) {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 52)
            } else if let error = viewModel.expenseError(for: row) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 1.0, green: 0.55, blue: 0.58))
                    Button("Try Again") {
                        Task { await viewModel.loadMoreExpenses(for: row) }
                    }
                    .font(.footnote.weight(.semibold))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 8)
            } else if expenses.isEmpty {
                Text("No expenses yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(expenses.enumerated()), id: \.element._id) { index, expense in
                        accountExpenseRow(expense)
                        if index < expenses.count - 1 {
                            Divider().padding(.leading, 4)
                        }
                    }
                    if viewModel.isLoadingExpenses(for: row) {
                        ProgressView()
                            .padding(.vertical, 14)
                    } else if !viewModel.isDoneLoadingExpenses(for: row) {
                        Button("Load More") {
                            Task { await viewModel.loadMoreExpenses(for: row) }
                        }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    accountLedgerBottomSentinel()
                }
                .onPreferenceChange(AccountLedgerBottomPreferenceKey.self) { minY in
                    guard shouldLoadAccountLedgerPage(bottomMinY: minY),
                          !viewModel.isLoadingExpenses(for: row),
                          !viewModel.isDoneLoadingExpenses(for: row) else { return }
                    Task { await viewModel.loadMoreExpenses(for: row) }
                }
            }
        }
    }

    @ViewBuilder
    private func accountIncomingFeed(for row: OptionsDisplayRow) -> some View {
        let incomings = viewModel.incomings(for: row)
        VStack(alignment: .leading, spacing: 12) {
            Text("Last transactions")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)

            if !viewModel.hasLoadedIncomings(for: row) || (incomings.isEmpty && viewModel.isLoadingIncomings(for: row)) {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 52)
            } else if let error = viewModel.incomingError(for: row) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 1.0, green: 0.55, blue: 0.58))
                    Button("Try Again") {
                        Task { await viewModel.loadMoreIncomings(for: row) }
                    }
                    .font(.footnote.weight(.semibold))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 8)
            } else if incomings.isEmpty {
                Text("No incomings yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(incomings.enumerated()), id: \.element._id) { index, incoming in
                        accountIncomingRow(incoming)
                        if index < incomings.count - 1 {
                            Divider().padding(.leading, 4)
                        }
                    }
                    if viewModel.isLoadingIncomings(for: row) {
                        ProgressView()
                            .padding(.vertical, 14)
                    } else if !viewModel.isDoneLoadingIncomings(for: row) {
                        Button("Load More") {
                            Task { await viewModel.loadMoreIncomings(for: row) }
                        }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    accountLedgerBottomSentinel()
                }
                .onPreferenceChange(AccountLedgerBottomPreferenceKey.self) { minY in
                    guard shouldLoadAccountLedgerPage(bottomMinY: minY),
                          !viewModel.isLoadingIncomings(for: row),
                          !viewModel.isDoneLoadingIncomings(for: row) else { return }
                    Task { await viewModel.loadMoreIncomings(for: row) }
                }
            }
        }
    }

    private func shouldLoadAccountLedgerPage(bottomMinY: CGFloat) -> Bool {
        bottomMinY > 0 && bottomMinY < UIScreen.main.bounds.height - 48
    }

    private func accountLedgerBottomSentinel() -> some View {
        Color.clear
            .frame(height: 1)
            .background(
                GeometryReader { proxy in
                    Color.clear.preference(
                        key: AccountLedgerBottomPreferenceKey.self,
                        value: proxy.frame(in: .global).minY
                    )
                }
            )
    }

    private func accountExpenseRow(_ expense: ExpenseDTO) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(expense.expense)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text([expense.category, expense.date].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " • "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(expense.amount, format: .currency(code: Locale.current.currency?.identifier ?? "USD"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 4)
    }

    private func accountIncomingRow(_ incoming: IncomingDTO) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(incoming.incoming)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text([incoming.incomeType, incoming.date].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " • "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(incoming.amount, format: .currency(code: Locale.current.currency?.identifier ?? "USD"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 4)
    }

    private func resetOptionDrag() {
        stopOptionAutoScroll()
        draggedOption = nil
        dropTargetRowID = nil
        isPromoteDropTargeted = false
        optionDragPreviewRow = nil
        optionDragPreviewLocation = nil
        activeOptionDragSourceID = nil
    }

    private func beginOptionDrag(_ payload: OptionDragPayload, row: OptionsDisplayRow) -> Int {
        optionDragSessionGeneration += 1
        activeOptionDragSourceID = payload.sourceID
        suppressOptionRowTap()
        draggedOption = payload
        optionDragPreviewRow = row
        if let rowFrame = optionRowDropFrame(for: row)?.rect {
            optionDragPreviewLocation = CGPoint(x: rowFrame.midX, y: rowFrame.midY)
            updateOptionAutoScroll(for: CGPoint(x: rowFrame.midX, y: rowFrame.midY))
        }
        dropTargetRowID = nil
        isPromoteDropTargeted = false
        return optionDragSessionGeneration
    }

    private func updateOptionDragHover(_ payload: OptionDragPayload, row: OptionsDisplayRow, at location: CGPoint) {
        ensureOptionDragStarted(payload, row: row)
        optionDragPreviewLocation = location
        updateOptionAutoScroll(for: location)

        let target = optionDropFrame(at: location, for: payload)
        withAnimation(.easeInOut(duration: 0.16)) {
            switch target?.kind {
            case let .row(row):
                isPromoteDropTargeted = false
                dropTargetRowID = canDropOption(payload, on: row) ? row.id : nil
            case .promote:
                dropTargetRowID = nil
                isPromoteDropTargeted = canPromoteOption(payload)
            case nil:
                dropTargetRowID = nil
                isPromoteDropTargeted = false
            }
        }
    }

    private func completeOptionDrag(_ payload: OptionDragPayload, at location: CGPoint?) {
        defer {
            withAnimation(.easeInOut(duration: 0.16)) {
                resetOptionDrag()
            }
            suppressOptionRowTap(for: 0.25)
        }

        guard activeOptionDragSourceID == payload.sourceID || draggedOption?.sourceID == payload.sourceID else { return }
        guard let location, let target = optionDropFrame(at: location, for: payload) else { return }

        switch target.kind {
        case let .row(row):
            guard canDropOption(payload, on: row) else { return }
            performOptionDrop(payload, on: row)
        case .promote:
            guard canPromoteOption(payload) else { return }
            performPromoteDrop(payload)
        }
    }

    private func ensureOptionDragStarted(_ payload: OptionDragPayload, row: OptionsDisplayRow) {
        guard activeOptionDragSourceID != payload.sourceID || draggedOption?.sourceID != payload.sourceID else { return }
        withAnimation(.easeInOut(duration: 0.16)) {
            _ = beginOptionDrag(payload, row: row)
        }
    }

    private func optionDropFrame(at location: CGPoint, for payload: OptionDragPayload) -> OptionDropFrame? {
        optionDropFrames
            .reversed()
            .first { frame in
                let hitRect = frame.rect.insetBy(dx: -8, dy: -4)
                guard hitRect.contains(location) else { return false }
                switch frame.kind {
                case let .row(row):
                    return canDropOption(payload, on: row)
                case .promote:
                    return canPromoteOption(payload)
                }
            }
    }

    private func optionRowDropFrame(for row: OptionsDisplayRow) -> OptionDropFrame? {
        optionDropFrames.last { $0.id == optionRowScrollID(for: row) }
    }

    private func optionRowScrollID(for row: OptionsDisplayRow) -> String {
        "row:\(row.id)"
    }

    private var optionScrollTargetIDs: [String] {
        var ids: [String] = []
        if viewModel.selectedKind.supportsNestedOptions, shouldShowPromoteDropZone {
            ids.append(optionPromoteDropZoneID)
        }
        for group in viewModel.rowGroups {
            ids.append(optionRowScrollID(for: group.parent))
            ids.append(contentsOf: group.children.map { optionRowScrollID(for: $0) })
        }
        return ids
    }

    private func updateOptionAutoScroll(for location: CGPoint) {
        guard draggedOption != nil || activeOptionDragSourceID != nil else {
            stopOptionAutoScroll()
            return
        }
        guard optionScrollViewportHeight > 0 else { return }

        let edgeBand: CGFloat = 84
        let direction: Int
        if location.y < edgeBand {
            direction = -1
        } else if location.y > optionScrollViewportHeight - edgeBand {
            direction = 1
        } else {
            direction = 0
        }

        guard direction != optionAutoScrollDirection else { return }
        optionAutoScrollDirection = direction
        optionAutoScrollGeneration += 1

        if direction != 0 {
            scheduleOptionAutoScrollTick(generation: optionAutoScrollGeneration)
        }
    }

    private func stopOptionAutoScroll() {
        guard optionAutoScrollDirection != 0 else { return }
        optionAutoScrollDirection = 0
        optionAutoScrollGeneration += 1
    }

    private func scheduleOptionAutoScrollTick(generation: Int) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.11) {
            guard optionAutoScrollGeneration == generation else { return }
            guard optionAutoScrollDirection != 0 else { return }
            guard draggedOption != nil || activeOptionDragSourceID != nil else {
                stopOptionAutoScroll()
                return
            }

            optionAutoScrollStep(direction: optionAutoScrollDirection)
            scheduleOptionAutoScrollTick(generation: generation)
        }
    }

    private func optionAutoScrollStep(direction: Int) {
        let targetIDs = optionScrollTargetIDs
        guard !targetIDs.isEmpty else { return }
        let targetIDSet = Set(targetIDs)
        let visibleFrames = optionDropFrames.filter { frame in
            targetIDSet.contains(frame.id)
                && frame.rect.maxY >= 0
                && frame.rect.minY <= optionScrollViewportHeight
        }
        let currentFrame = direction > 0
            ? visibleFrames.max(by: { $0.rect.maxY < $1.rect.maxY })
            : visibleFrames.min(by: { $0.rect.minY < $1.rect.minY })
        guard let currentFrame, let currentIndex = targetIDs.firstIndex(of: currentFrame.id) else { return }

        let targetIndex = min(max(currentIndex + direction, 0), targetIDs.count - 1)
        guard targetIndex != currentIndex else { return }

        optionAutoScrollRequestToken += 1
        optionAutoScrollRequest = OptionAutoScrollRequest(
            targetID: targetIDs[targetIndex],
            anchor: direction > 0 ? .bottom : .top,
            token: optionAutoScrollRequestToken
        )
    }

    private func optionDropFrameReader(id: String, kind: OptionDropFrame.Kind) -> some View {
        GeometryReader { proxy in
            Color.clear.preference(
                key: OptionDropFramePreferenceKey.self,
                value: [
                    OptionDropFrame(
                        id: id,
                        kind: kind,
                        rect: proxy.frame(in: .named(optionDropCoordinateSpace))
                    )
                ]
            )
        }
    }

    @ViewBuilder
    private func optionDragPreviewOverlay() -> some View {
        if let row = optionDragPreviewRow, let location = optionDragPreviewLocation {
            HStack(spacing: 8) {
                Circle()
                    .fill(color(from: row.color) ?? .gray)
                    .frame(width: 12, height: 12)

                Text(row.value)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .foregroundStyle(.primary)

                Image(systemName: optionDragHasActionableTarget ? "plus.circle.fill" : "nosign")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(optionDragHasActionableTarget ? Color.accentColor : Color.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .frame(maxWidth: 190, alignment: .leading)
            .background(.regularMaterial, in: Capsule())
            .overlay {
                Capsule()
                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 6)
            .scaleEffect(0.96)
            .position(x: location.x + 54, y: location.y - 22)
            .allowsHitTesting(false)
            .transition(.opacity.combined(with: .scale(scale: 0.94)))
        }
    }

    private var optionDragHasActionableTarget: Bool {
        dropTargetRowID != nil || isPromoteDropTargeted
    }

    private func suppressOptionRowTap(for interval: TimeInterval = 0.55) {
        optionRowTapSuppressedUntil = Date().addingTimeInterval(interval)
    }

    private func openOptionEditorFromRowTap(_ row: OptionsDisplayRow) {
        if Date() < optionRowTapSuppressedUntil || draggedOption != nil || activeOptionDragSourceID != nil {
            resetOptionDrag()
            suppressOptionRowTap(for: 0.25)
            return
        }
        resetOptionDrag()
        optionEditorContext = row
    }

    private func optionRowLocation(from localLocation: CGPoint, row: OptionsDisplayRow) -> CGPoint? {
        guard let rowFrame = optionRowDropFrame(for: row)?.rect else { return nil }
        return CGPoint(x: rowFrame.minX + localLocation.x, y: rowFrame.minY + localLocation.y)
    }

    private var canStartOptionRowLongPress: Bool {
        optionEditorContext == nil && accountEditorContext == nil && !showCreateOption
    }

    private func optionRowLongPressInstaller(for payload: OptionDragPayload, row: OptionsDisplayRow) -> some View {
        OptionRowLongPressInstaller(
            isEnabled: canStartOptionRowLongPress,
            locationInOptionSpace: { localLocation in
                optionRowLocation(from: localLocation, row: row)
            },
            onBegan: { location in
                guard canStartOptionRowLongPress else { return }
                ensureOptionDragStarted(payload, row: row)
                updateOptionDragHover(payload, row: row, at: location)
            },
            onChanged: { location in
                guard activeOptionDragSourceID == payload.sourceID || draggedOption?.sourceID == payload.sourceID else { return }
                updateOptionDragHover(payload, row: row, at: location)
            },
            onEnded: { location in
                guard activeOptionDragSourceID == payload.sourceID || draggedOption?.sourceID == payload.sourceID else {
                    resetOptionDrag()
                    return
                }
                completeOptionDrag(payload, at: location)
            },
            onCancelled: {
                resetOptionDrag()
            }
        )
    }

    private func canDropOption(_ payload: OptionDragPayload, on target: OptionsDisplayRow) -> Bool {
        switch (payload.kind, target.kind) {
        case (.category, .category):
            return payload.value != target.value
        case (.subcategory, .category):
            return payload.parentValue != nil && payload.parentValue != target.value
        case (.incomeType, .incomeType):
            return payload.value != target.value
        case (.incomeSubtype, .incomeType):
            return payload.parentValue != nil && payload.parentValue != target.value
        default:
            return false
        }
    }

    private func performOptionDrop(_ payload: OptionDragPayload, on target: OptionsDisplayRow) {
        Task {
            switch (payload.kind, target.kind) {
            case (.category, .category):
                guard payload.value != target.value else { return }
                await viewModel.moveToSubtype(kind: payload.kind, sourceValue: payload.value, targetValue: target.value)
            case (.subcategory, .category):
                if let sourceParent = payload.parentValue, sourceParent != target.value {
                    await viewModel.moveSubtype(kind: payload.kind, value: payload.value, sourceParentValue: sourceParent, targetParentValue: target.value)
                }
            case (.incomeType, .incomeType):
                guard payload.value != target.value else { return }
                await viewModel.moveToSubtype(kind: payload.kind, sourceValue: payload.value, targetValue: target.value)
            case (.incomeSubtype, .incomeType):
                if let sourceParent = payload.parentValue, sourceParent != target.value {
                    await viewModel.moveSubtype(kind: payload.kind, value: payload.value, sourceParentValue: sourceParent, targetParentValue: target.value)
                }
            default:
                break
            }
        }
    }

    private func canPromoteOption(_ payload: OptionDragPayload) -> Bool {
        guard payload.parentValue != nil else { return false }
        return (viewModel.selectedKind == .category && payload.kind == .subcategory)
            || (viewModel.selectedKind == .incomeType && payload.kind == .incomeSubtype)
    }

    private func performPromoteDrop(_ payload: OptionDragPayload) {
        guard let sourceParent = payload.parentValue else { return }
        Task {
            await viewModel.promoteSubtype(kind: payload.kind, value: payload.value, parentValue: sourceParent)
        }
    }

    private func optionCompactRow(for row: OptionsDisplayRow, dropTarget: OptionsDisplayRow? = nil) -> some View {
        let resolvedDropTarget = dropTarget ?? row
        let payload = OptionDragPayload(kind: row.kind, value: row.value, parentValue: row.parentValue)
        let isDragged = draggedOption?.sourceID == row.id
        let isDropTarget = dropTargetRowID == resolvedDropTarget.id

        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Button {
                    Task { await viewModel.setDefault(kind: row.kind, value: row.value, isDefault: !row.isDefault, parentValue: row.parentValue) }
                } label: {
                    ZStack {
                        Circle()
                            .fill(color(from: row.color) ?? .gray)
                            .frame(width: row.isDefault ? 18 : 14, height: row.isDefault ? 18 : 14)
                        Circle()
                            .stroke((color(from: row.color) ?? .gray).opacity(row.isDefault ? 0.35 : 0), lineWidth: 7)
                            .frame(width: 24, height: 24)
                    }
                    .frame(width: 32, height: 32)
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(row.isDefault ? "Unset default \(row.value)" : "Set default \(row.value)")
                .accessibilityValue(row.isDefault ? "Default" : "Not default")

                VStack(alignment: .leading, spacing: 2) {
                    Text(row.value)
                        .font(row.indentationLevel == 0 ? .headline : .body.weight(.medium))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                    if row.indentationLevel == 0, row.parentValue?.isEmpty == false, let parent = row.parentValue {
                        Text(parent)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)

                if viewModel.supportsTracking(kind: row.kind) {
                    Button {
                        Task { await viewModel.setTracking(kind: row.kind, value: row.value, isTracking: !row.isTracking, parentValue: row.parentValue) }
                    } label: {
                        Image("lucide-finance-tracking")
                            .renderingMode(.template)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 18, height: 18)
                            .foregroundStyle(row.isTracking ? Color.accentColor : Color.secondary)
                            .frame(width: 34, height: 34)
                            .background(
                                Circle()
                                    .fill(row.isTracking ? Color.accentColor.opacity(0.13) : Color(uiColor: .tertiarySystemGroupedBackground))
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(row.isTracking ? "Disable tracking for \(row.value)" : "Enable tracking for \(row.value)")
                    .accessibilityValue(row.isTracking ? "Tracking enabled" : "Tracking disabled")
                }

                Button {
                    optionEditorContext = row
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit \(row.value)")
            }
            .padding(.leading, CGFloat(row.indentationLevel) * 18)
            .padding(.vertical, 10)
            .padding(.horizontal, 12)
            .contentShape(Rectangle())
        }
        .background {
            ZStack {
                optionDropFrameReader(id: optionRowScrollID(for: row), kind: .row(resolvedDropTarget))
                if isDropTarget {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.accentColor.opacity(0.12))
                }
            }
        }
        .id(optionRowScrollID(for: row))
        .opacity(isDragged ? 0.58 : 1)
        .scaleEffect(isDragged ? 0.985 : 1)
        .animation(.easeInOut(duration: 0.16), value: isDragged)
        .animation(.easeInOut(duration: 0.16), value: isDropTarget)
        .onTapGesture {
            openOptionEditorFromRowTap(row)
        }
        .overlay {
            optionRowLongPressInstaller(for: payload, row: row)
                .allowsHitTesting(false)
        }
    }

    private func color(from hex: String) -> Color? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }

    private func colorSelectionBinding(for row: OptionsDisplayRow) -> Binding<Color> {
        let rowKey = row.selfKey
        return Binding(
            get: { color(from: colorByRow[rowKey, default: row.color]) ?? .gray },
            set: { colorByRow[rowKey] = hex(from: $0) ?? row.color }
        )
    }

    private func hex(from color: Color) -> String? {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard UIColor(color).getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return nil }
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }

    private func normalizedHex(_ hex: String) -> String? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: "#", with: "")
        guard clean.range(of: #"^[0-9A-F]{6}$"#, options: .regularExpression) != nil else { return nil }
        return "#\(clean)"
    }
}

private extension UserOptionRow {
    var selfKey: String { "\(value)|\(parentValue ?? "")" }
}

private extension OptionsDisplayRow {
    var selfKey: String { id }
}

@MainActor
final class QuickAddFormViewModel: ObservableObject {
    @Published var kind: QuickAddKind = .expense
    @Published var title: String = ""
    @Published var amountText: String = ""
    @Published var selectedOption: String = "General"
    @Published var newOptionName: String = ""
    @Published private(set) var inlineError: String?
    @Published private(set) var optionChoices: [String] = ["General", "Home", "Work"]

    func submit() -> Bool {
        inlineError = nil

        let normalizedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedTitle.isEmpty else {
            inlineError = "Title is required."
            return false
        }

        guard let amount = Decimal(string: amountText), amount > 0 else {
            inlineError = "Amount must be greater than zero."
            return false
        }

        return true
    }

    func addOptionIfNeeded() {
        let normalized = newOptionName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            inlineError = "Option name cannot be empty."
            return
        }
        guard !optionChoices.contains(normalized) else {
            inlineError = "Option already exists."
            selectedOption = normalized
            return
        }
        optionChoices.append(normalized)
        optionChoices.sort()
        selectedOption = normalized
        newOptionName = ""
        inlineError = nil
    }

    func reset() {
        title = ""
        amountText = ""
        selectedOption = optionChoices.first ?? "General"
        inlineError = nil
    }
}

private struct FeatureRootView: View {
    let tab: AppTab
    let userId: String
    let api: ConvexAPI
    let onSignOut: () -> Void
    let onDeleteAccount: () -> Void
    let onQuickAdd: () -> Void

    @State private var searchText = ""
    @State private var debouncedSearch = ""
    @State private var selectedFilters: Set<String> = []
    @State private var selectedMonth = Date()
    @State private var rangeStart = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
    @State private var rangeEnd = Date()

    var body: some View {
        Group {
            if tab == .expenses {
                ExpensesFeatureView(api: api)
            } else if tab == .incomings {
                IncomingsFeatureView(api: api)
            } else if tab == .breakdown {
                BreakdownFeatureView(api: api)
            } else if tab == .recurrings {
                RecurringsFeatureView(api: api)
            } else if tab == .tracking {
                TrackingFeatureView(api: api)
            } else if tab == .notepad {
                NotepadFeatureView(api: api)
            } else if tab == .options {
                OptionsFeatureView(api: api)
            } else if tab == .user {
                UserFeatureView(userId: userId, onSignOut: onSignOut, onDeleteAccount: onDeleteAccount)
            } else {
                List {
            Section {
                DebouncedSearchField(text: $searchText) { value in
                    debouncedSearch = value
                }
                MultiSelectFilterButton(
                    title: "Filters",
                    choices: ["Personal", "Business", "Shared", "Archived"],
                    selected: $selectedFilters
                )
                MonthNavigator(month: $selectedMonth)
                DateRangePickerButton(startDate: $rangeStart, endDate: $rangeEnd)
            }

            Section("State") {
                Text("Search: \(debouncedSearch.isEmpty ? "None" : debouncedSearch)")
                Text("Filters: \(selectedFilters.sorted().joined(separator: ", ").isEmpty ? "None" : selectedFilters.sorted().joined(separator: ", "))")
            }

            Section("Navigation") {
                NavigationLink(value: ShellRoute.detail(title: "\(tab.title) Details")) {
                    Label("Open detail", systemImage: "arrow.right.circle")
                }
            }

            if tab == .options {
                Section("Session") {
                    Text("Signed in as \(userId)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Sign Out", role: .destructive, action: onSignOut)
                        .accessibilityIdentifier("sign_out_button")
                }
            }
        }
                .listStyle(.insetGrouped)
                .navigationTitle(tab.title)
                .navigationDestination(for: ShellRoute.self) { route in
            switch route {
            case .detail(let title):
                LoadStateView(state: .content) {
                    Text(title)
                        .font(.title3.weight(.medium))
                        .padding()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
                }
                .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    onQuickAdd()
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityIdentifier("quick_add_button")
                .accessibilityLabel("Quick Add")
            }
                }
            }
        }
    }
}

private struct UserFeatureView: View {
    let userId: String
    let onSignOut: () -> Void
    let onDeleteAccount: () -> Void

    @State private var accountActionsPresented = false
    @State private var deleteAccountConfirmationPresented = false

    var body: some View {
        List {
            Section("Account") {
                LabeledContent("Username", value: userId)
                    .accessibilityIdentifier("user_username_value")
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    accountActionsPresented = true
                }
                    .accessibilityIdentifier("sign_out_button")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("User")
        .navigationBarTitleDisplayMode(.large)
        .confirmationDialog("Account", isPresented: $accountActionsPresented, titleVisibility: .visible) {
            Button("Sign Out", role: .destructive, action: onSignOut)
                .accessibilityIdentifier("account_actions_sign_out_button")
            Button("Delete Account", role: .destructive) {
                deleteAccountConfirmationPresented = true
            }
                .accessibilityIdentifier("account_actions_delete_account_button")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Choose what you want to do with this account.")
        }
        .alert("Delete Account", isPresented: $deleteAccountConfirmationPresented) {
            Button("Cancel", role: .cancel) {}
            Button("Delete Account", role: .destructive, action: onDeleteAccount)
        } message: {
            Text("This action is irrevocable and all data will be irretrievable. Are you sure?")
        }
    }
}

private struct BreakdownMetricCard: View {
    let title: String
    let total: String
    let perMonth: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline) {
                Text(total).font(.title2.weight(.bold))
                Spacer()
                Text("\(perMonth) /month").font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(tint.opacity(0.45), lineWidth: 1)
        )
    }
}

@MainActor
private final class BreakdownViewModel: ObservableObject {
    @Published var state: ViewLoadState = .loading
    @Published var searchText = ""
    @Published var selectedFilters: Set<String> = []
    @Published var month = Date()
    @Published var startDate = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: Date())) ?? Date()
    @Published var endDate = Date()
    @Published var summary: SummaryRangeResponse?
    @Published private(set) var isScopeLoading = false

    private let api: ConvexAPI
    private let calendar = LedgerScopeLogic.calendar

    init(api: ConvexAPI) {
        self.api = api
        let today = Date()
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: today)) ?? today
        let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? today
        startDate = monthStart
        endDate = monthEnd
    }

    func onAppear() {
        Task {
            await load()
        }
    }

    func syncMonthToRange() {
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: month)) ?? month
        let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? monthStart
        startDate = monthStart
        endDate = monthEnd
        Task { await load() }
    }

    func load() async {
        let shouldShowFullScreenError = !state.hasLoadedContent
        if shouldShowFullScreenError {
            state = .loading
        } else {
            isScopeLoading = true
        }
        defer { isScopeLoading = false }
        do {
            summary = try await api.summaries.range(.init(startDate: LedgerScopeLogic.isoDate(startDate), endDate: LedgerScopeLogic.isoDate(endDate)))
            state = .content
        } catch {
            if shouldShowFullScreenError {
                state = .error(message: "Failed to load breakdown")
            }
        }
    }
}

private struct BreakdownFeatureView: View {
    @StateObject private var viewModel: BreakdownViewModel
    @State private var showDateRange = false
    @State private var showSearch = false
    @State private var showFilters = false

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: BreakdownViewModel(api: api))
    }

    private let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "ILS"
        f.locale = Locale(identifier: "he_IL")
        return f
    }()

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.load() } }) {
            List {
                if let summary = viewModel.summary {
                    Section {
                        BreakdownMetricCard(title: "TOTAL INCOMINGS", total: money(summary.totals.effectiveIncomings), perMonth: monthly(value: summary.totals.effectiveIncomings, count: summary.monthlyBuckets.count), tint: .green)
                        BreakdownMetricCard(title: "TOTAL EXPENSES", total: money(summary.totals.effectiveExpenses), perMonth: monthly(value: summary.totals.effectiveExpenses, count: summary.monthlyBuckets.count), tint: .red)
                        BreakdownMetricCard(title: "TOTAL SAVINGS", total: money(summary.totals.effectiveNet), perMonth: monthly(value: summary.totals.effectiveNet, count: summary.monthlyBuckets.count), tint: .blue)
                        DateScopeNavigatorRow(
                            scope: breakdownScope,
                            onCalendar: { showDateRange = true },
                            onShiftMonth: shiftScopeByMonth,
                            onFilter: { showFilters = true },
                            isLoading: viewModel.isScopeLoading
                        )
                        .listRowSeparator(.hidden)
                    }
                    .opacity(viewModel.isScopeLoading ? 0.66 : 1)
                    .overlay {
                        if viewModel.isScopeLoading {
                            ProgressView()
                                .controlSize(.large)
                        }
                    }
                    .animation(.easeInOut(duration: 0.18), value: viewModel.isScopeLoading)
                }

                if let summary = viewModel.summary {
                    Section("Per Month") {
                        ForEach(summary.monthlyBuckets, id: \.month) { row in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(row.month).font(.headline)
                                HStack {
                                    Text("Incomings \(money(row.effectiveIncomings))")
                                    Spacer()
                                    Text("Expenses \(money(row.effectiveExpenses))")
                                    Spacer()
                                    Text("Savings \(money(row.effectiveNet))").foregroundStyle(row.effectiveNet >= 0 ? .green : .red)
                                }
                                .font(.footnote)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Breakdown")
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await viewModel.load() }
        }
        .onChange(of: viewModel.startDate) { _, _ in Task { await viewModel.load() } }
        .onChange(of: viewModel.endDate) { _, _ in Task { await viewModel.load() } }
        .toolbar {
            LedgerToolbarControls(
                onSearch: { showSearch = true }
            )
        }
        .sheet(isPresented: $showSearch) {
            SearchSheet(text: $viewModel.searchText) { viewModel.searchText = $0 }
        }
        .sheet(isPresented: $showFilters) {
            MultiSelectFilterSheet(title: "Filters", choices: [], selected: $viewModel.selectedFilters)
        }
        .sheet(isPresented: $showDateRange) {
            DateRangePickerSheet(startDate: $viewModel.startDate, endDate: $viewModel.endDate)
        }
        .task { viewModel.onAppear() }
    }

    private func money(_ value: Double) -> String {
        formatter.string(from: NSNumber(value: value)) ?? "₪\(value)"
    }

    private func monthly(value: Double, count: Int) -> String {
        guard count > 0 else { return money(value) }
        return money(value / Double(count))
    }

    private var breakdownScope: DateScope {
        DateScope(
            startDate: viewModel.startDate,
            endDate: viewModel.endDate,
            includeMonthYearOverlapOutsideDate: false
        )
    }

    private func shiftScopeByMonth(_ value: Int) {
        let shifted = breakdownScope.shiftedByMonths(value)
        viewModel.startDate = shifted.startDate
        viewModel.endDate = shifted.endDate
    }
}

struct AppShellView: View {
    let userId: String
    let api: ConvexAPI
    let onSignOut: () -> Void
    let onDeleteAccount: () -> Void

    @SceneStorage("shell.selectedTab") private var selectedTabRaw = AppTab.defaultTab.rawValue
    @SceneStorage("shell.path.expenses") private var expensesPathData: Data?
    @SceneStorage("shell.path.incomings") private var incomingsPathData: Data?
    @SceneStorage("shell.path.breakdown") private var breakdownPathData: Data?
    @SceneStorage("shell.path.recurrings") private var recurringsPathData: Data?
    @SceneStorage("shell.path.tracking") private var trackingPathData: Data?
    @SceneStorage("shell.path.notepad") private var notepadPathData: Data?
    @SceneStorage("shell.path.options") private var optionsPathData: Data?
    @SceneStorage("shell.path.user") private var userPathData: Data?

    @State private var selectedTab: AppTab = .defaultTab
    @State private var pathByTab: [AppTab: NavigationPath] = [:]
    @State private var quickAddPresented = false
    @StateObject private var quickAddVM = QuickAddFormViewModel()

    var body: some View {
        ZStack(alignment: .topLeading) {
            NavigationStack(path: binding(for: selectedTab)) {
                FeatureRootView(tab: selectedTab, userId: userId, api: api, onSignOut: onSignOut, onDeleteAccount: onDeleteAccount) {
                    quickAddPresented = true
                }
            }
            .id(selectedTab)
            .accessibilityIdentifier("tab_\(selectedTab.rawValue)")

            ShellNavigationMenu(selectedTab: $selectedTab)
                .padding(.leading, 12)
                .padding(.top, 2)

            Rectangle()
                .fill(.clear)
                .frame(width: 1, height: 1)
                .accessibilityElement(children: .ignore)
                .accessibilityIdentifier("tab_\(selectedTab.rawValue)")
                .accessibilityLabel(selectedTab.title)
                .accessibilityHidden(false)
                .allowsHitTesting(false)
        }
        .sheet(isPresented: $quickAddPresented, onDismiss: {
            quickAddVM.reset()
        }) {
            QuickAddSheet(viewModel: quickAddVM) {
                quickAddPresented = false
            }
            .presentationDetents([.medium, .large])
            .accessibilityIdentifier("quick_add_sheet")
        }
        .onAppear {
            restoreSelectedTabIfNeeded()
            restorePathsIfNeeded()
        }
        .onChange(of: selectedTab) { _, newValue in
            selectedTabRaw = newValue.rawValue
        }
        .onOpenURL { url in
            apply(deepLink: ShellDeepLink.parse(url: url))
        }
    }

    private func binding(for tab: AppTab) -> Binding<NavigationPath> {
        Binding {
            pathByTab[tab, default: NavigationPath()]
        } set: { newValue in
            pathByTab[tab] = newValue
            persist(path: newValue, for: tab)
        }
    }

    private func restoreSelectedTabIfNeeded() {
        selectedTab = AppTab(rawValue: selectedTabRaw) ?? .defaultTab
    }

    private func restorePathsIfNeeded() {
        for tab in AppTab.allCases {
            pathByTab[tab] = restorePath(for: tab)
        }
    }

    private func apply(deepLink: ShellDeepLink?) {
        guard let deepLink else { return }
        if let tab = deepLink.tab {
            selectedTab = tab
        }
        if let quickAddKind = deepLink.quickAddKind {
            quickAddVM.kind = quickAddKind
            quickAddPresented = true
        }
    }

    private func persist(path: NavigationPath, for tab: AppTab) {
        guard let codable = path.codable else {
            setPathData(nil, for: tab)
            return
        }

        do {
            let data = try JSONEncoder().encode(codable)
            setPathData(data, for: tab)
        } catch {
            setPathData(nil, for: tab)
        }
    }

    private func restorePath(for tab: AppTab) -> NavigationPath {
        guard let data = pathData(for: tab) else { return NavigationPath() }

        do {
            let codable = try JSONDecoder().decode(NavigationPath.CodableRepresentation.self, from: data)
            return NavigationPath(codable)
        } catch {
            return NavigationPath()
        }
    }

    private func pathData(for tab: AppTab) -> Data? {
        switch tab {
        case .expenses: return expensesPathData
        case .incomings: return incomingsPathData
        case .breakdown: return breakdownPathData
        case .recurrings: return recurringsPathData
        case .tracking: return trackingPathData
        case .notepad: return notepadPathData
        case .options: return optionsPathData
        case .user: return userPathData
        }
    }

    private func setPathData(_ value: Data?, for tab: AppTab) {
        switch tab {
        case .expenses: expensesPathData = value
        case .incomings: incomingsPathData = value
        case .breakdown: breakdownPathData = value
        case .recurrings: recurringsPathData = value
        case .tracking: trackingPathData = value
        case .notepad: notepadPathData = value
        case .options: optionsPathData = value
        case .user: userPathData = value
        }
    }
}

private struct ShellNavigationMenu: View {
    @Binding var selectedTab: AppTab

    var body: some View {
        Menu {
            Button {
                selectedTab = selectedTab
            } label: {
                Label(menuTitle(for: selectedTab), image: selectedTab.assetName)
            }
            .accessibilityIdentifier("menu_tab_\(selectedTab.rawValue)")

            Divider()

            ForEach(AppTab.allCases.filter { $0 != selectedTab }, id: \.self) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    Label(menuTitle(for: tab), image: tab.assetName)
                }
                .accessibilityIdentifier("menu_tab_\(tab.rawValue)")
            }
        } label: {
            Image(selectedTab.assetName)
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 24, height: 24)
                .foregroundStyle(selectedTab.color)
                .frame(width: 48, height: 48)
                .shellNavigationGlassCircle()
                .contentShape(Circle())
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Navigation Menu")
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("shell_navigation_menu")
        .accessibilityLabel("Navigation Menu")
    }

    private func menuTitle(for tab: AppTab) -> String {
        tab == .user ? "Sign Out" : tab.title
    }
}

private extension View {
    @ViewBuilder
    func shellNavigationGlassCircle() -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular.interactive(), in: Circle())
        } else {
            shellNavigationMaterialCircle()
        }
        #else
        shellNavigationMaterialCircle()
        #endif
    }

    func shellNavigationMaterialCircle() -> some View {
        background(.ultraThinMaterial, in: Circle())
            .overlay(
                Circle()
                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.12), radius: 14, y: 6)
    }
}

private struct QuickAddSheet: View {
    @ObservedObject var viewModel: QuickAddFormViewModel
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Picker("Type", selection: $viewModel.kind) {
                    ForEach(QuickAddKind.allCases) { kind in
                        Text(kind.title).tag(kind)
                    }
                }

                TextField("Title", text: $viewModel.title)
                TextField("Amount", text: $viewModel.amountText)
                    .keyboardType(.decimalPad)

                Picker("Option", selection: $viewModel.selectedOption) {
                    ForEach(viewModel.optionChoices, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }

                Section("Add missing option") {
                    TextField("New option", text: $viewModel.newOptionName)
                    Button("Add Option") {
                        viewModel.addOptionIfNeeded()
                    }
                }

                if let inlineError = viewModel.inlineError, !inlineError.isEmpty {
                    Text(inlineError)
                        .foregroundStyle(.red)
                        .font(.footnote)
                        .accessibilityIdentifier("quick_add_inline_error")
                }
            }
            .navigationTitle("Quick Add")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close", action: onClose)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") {
                        if viewModel.submit() {
                            onClose()
                        }
                    }
                    .accessibilityIdentifier("quick_add_create")
                }
            }
        }
    }
}
