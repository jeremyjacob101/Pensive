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

struct NotepadFeatureView: View {
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
            .scrollDismissesKeyboard(.interactively)
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
        .scrollDismissesKeyboard(.interactively)
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
                .scrollDismissesKeyboard(.interactively)
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
        .scrollDismissesKeyboard(.interactively)
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
