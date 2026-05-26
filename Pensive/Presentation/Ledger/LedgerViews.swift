import SwiftUI

struct ExpensesFeatureView: View {
    @StateObject private var viewModel: LedgerFeatureViewModel

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: LedgerFeatureViewModel(kind: .expense, api: api))
    }

    var body: some View {
        LedgerScreen(viewModel: viewModel)
            .navigationTitle("Expenses")
    }
}

struct IncomingsFeatureView: View {
    @StateObject private var viewModel: LedgerFeatureViewModel

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: LedgerFeatureViewModel(kind: .incoming, api: api))
    }

    var body: some View {
        LedgerScreen(viewModel: viewModel)
            .navigationTitle("Incomings")
    }
}

enum PaybackTarget {
    case expense(String)
    case incoming(String)
}

private struct LedgerScreen: View {
    @ObservedObject var viewModel: LedgerFeatureViewModel

    @State private var showCreate = false
    @State private var editingID: RowID?
    @State private var deleteID: String?
    @State private var selectedPartnerAnchorID: RowID?

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.refresh() } }) {
            List {
                Section {
                    DebouncedSearchField(text: $viewModel.searchText) { viewModel.applySearch($0) }
                    MultiSelectFilterButton(title: "Filters", choices: filterChoices, selected: Binding(get: { viewModel.selectedFilters }, set: { viewModel.updateFilters($0) }))
                    DateRangePickerButton(startDate: $viewModel.scope.startDate, endDate: $viewModel.scope.endDate)
                    Toggle("Include month overlap", isOn: $viewModel.scope.includeMonthYearOverlapOutsideDate)
                        .onChange(of: viewModel.scope) { _, _ in viewModel.updateScope() }
                }

                ForEach(viewModel.rows) { row in
                    DisclosureGroup {
                        HStack {
                            Button {
                                editingID = RowID(id: row.id)
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            .buttonStyle(.bordered)
                            .accessibilityIdentifier("ledger_edit_\(row.id)")

                            Button(role: .destructive) {
                                deleteID = row.id
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                            .buttonStyle(.bordered)
                            .accessibilityIdentifier("ledger_delete_\(row.id)")
                        }

                        ForEach(row.details, id: \.self) { detail in
                            Text(detail).font(.footnote).foregroundStyle(.secondary)
                        }
                        Text("Month Years: \(row.monthYears.joined(separator: ", "))").font(.footnote)

                        HStack {
                            Button("Add partner") { selectedPartnerAnchorID = RowID(id: row.id) }
                            Button("Unlink partner") { viewModel.unlinkPartner(id: row.id) }
                        }

                        if viewModel.kind == .expense {
                            Button("Rename base group") { viewModel.renameExpenseBaseGroup(baseID: row.id, label: row.title) }
                            Button("Remove base group", role: .destructive) { viewModel.removeExpenseBaseGroup(baseID: row.id) }
                        }

                        NavigationLink("Manage Payback Links") {
                            PaybackLinksManagerView(target: viewModel.kind == .expense ? .expense(row.id) : .incoming(row.id), viewModel: viewModel)
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(row.title).font(.headline)
                            Text(row.subtitle).font(.subheadline).foregroundStyle(.secondary)
                            Text(row.amountLine).font(.subheadline.weight(.medium))
                            Text(row.appliedLine).font(.footnote).foregroundStyle(.secondary)
                            if let warning = row.warningText {
                                Text(warning).font(.footnote).foregroundStyle(.orange)
                            }
                        }
                    }
                    .swipeActions {
                        Button("Edit") { editingID = RowID(id: row.id) }.tint(.blue)
                        Button(role: .destructive) { deleteID = row.id } label: { Text("Delete") }
                    }
                }
            }
            .refreshable { await viewModel.refresh() }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showCreate = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showCreate) {
                if viewModel.kind == .expense {
                    ExpenseEditorSheet(viewModel: viewModel, initialDraft: ExpenseEditorDraft(id: nil, expense: "", type: "", account: "", category: "", subcategory: nil, amount: 0, effectiveAmount: 0, effectiveAmountMode: .auto, date: Date(), paidTo: "", notes: nil, comments: nil, expenseId: UUID().uuidString, baseExpenseId: nil, baseExpenseLabel: nil, subExpenseId: nil), mode: .create)
                } else {
                    IncomingEditorSheet(viewModel: viewModel, initialDraft: IncomingEditorDraft(id: nil, incoming: "", paidBy: "", incomeType: "", incomeSubtype: nil, account: "", amount: 0, effectiveAmount: 0, effectiveAmountMode: .auto, date: Date(), notes: nil, comments: nil, incomingId: UUID().uuidString, baseIncomingId: nil, subIncomingId: nil), mode: .create)
                }
            }
            .sheet(item: $editingID) { selected in
                if viewModel.kind == .expense, let draft = viewModel.expenseDraft(id: selected.id) {
                    ExpenseEditorSheet(viewModel: viewModel, initialDraft: draft, mode: .edit)
                } else if viewModel.kind == .incoming, let draft = viewModel.incomingDraft(id: selected.id) {
                    IncomingEditorSheet(viewModel: viewModel, initialDraft: draft, mode: .edit)
                }
            }
            .sheet(item: $selectedPartnerAnchorID) { anchor in
                PartnerPickerSheet(anchorID: anchor.id, viewModel: viewModel)
            }
            .alert("Delete item?", isPresented: Binding(get: { deleteID != nil }, set: { if !$0 { deleteID = nil } })) {
                Button("Delete", role: .destructive) {
                    if let id = deleteID { viewModel.delete(id: id) }
                    deleteID = nil
                }
                Button("Cancel", role: .cancel) { deleteID = nil }
            }
        }
        .task { viewModel.onAppear() }
        .alert("Notice", isPresented: Binding(get: { viewModel.alertText != nil }, set: { if !$0 { viewModel.alertText = nil } })) {
            Button("OK", role: .cancel) { viewModel.alertText = nil }
        } message: {
            Text(viewModel.alertText ?? "")
        }
    }

    private var filterChoices: [String] {
        viewModel.rows.flatMap { row in
            row.subtitle.split(separator: "•").map { String($0).trimmingCharacters(in: .whitespaces) }
        }.reduce(into: Set<String>()) { $0.insert($1) }.sorted()
    }
}

private enum EditorMode { case create, edit }

private struct ExpenseEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel
    @State private var drafts: [ExpenseEditorDraft]
    @State private var selectedIndex = 0
    let mode: EditorMode

    @State private var addType = ""
    @State private var addAccount = ""
    @State private var addCategory = ""

    init(viewModel: LedgerFeatureViewModel, initialDraft: ExpenseEditorDraft, mode: EditorMode) {
        self.viewModel = viewModel
        _drafts = State(initialValue: [initialDraft])
        self.mode = mode
    }

    var body: some View {
        NavigationStack {
            Form {
                if mode == .create {
                    Section("Bulk Group") {
                        Text("Entries: \(drafts.count)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Picker("Editing Entry", selection: $selectedIndex) {
                            ForEach(Array(drafts.indices), id: \.self) { index in
                                Text("Entry \(index + 1)").tag(index)
                            }
                        }
                        Button("Add Another in Bulk Group") {
                            drafts.append(newExpenseDraft(template: drafts[selectedIndex]))
                            selectedIndex = drafts.count - 1
                        }
                        if drafts.count > 1 {
                            Button("Remove Current Entry", role: .destructive) {
                                drafts.remove(at: selectedIndex)
                                selectedIndex = min(selectedIndex, max(0, drafts.count - 1))
                            }
                        }
                    }
                }

                TextField("Name", text: binding(\.expense))
                TextField("Type", text: binding(\.type))
                TextField("Account", text: binding(\.account))
                TextField("Category", text: binding(\.category))
                TextField("Subcategory", text: Binding(get: { currentDraft.subcategory ?? "" }, set: { value in
                    updateCurrent { $0.subcategory = value.isEmpty ? nil : value }
                }))
                TextField("Paid To", text: binding(\.paidTo))
                TextField("Amount", value: binding(\.amount), format: .number)
                TextField("Effective Amount", value: binding(\.effectiveAmount), format: .number)
                Picker("Effective Mode", selection: binding(\.effectiveAmountMode)) {
                    Text("Auto").tag(EffectiveAmountMode.auto)
                    Text("Manual").tag(EffectiveAmountMode.manual)
                }
                DatePicker("Date", selection: binding(\.date), displayedComponents: .date)
                TextField("Notes", text: Binding(get: { currentDraft.notes ?? "" }, set: { value in
                    updateCurrent { $0.notes = value.isEmpty ? nil : value }
                }))
                TextField("Comments", text: Binding(get: { currentDraft.comments ?? "" }, set: { value in
                    updateCurrent { $0.comments = value.isEmpty ? nil : value }
                }))

                Section("Add missing option") {
                    TextField("New type", text: $addType)
                    Button("Add type") { Task { await viewModel.addMissingOption(kind: "expenseType", value: addType); addType = "" } }
                    TextField("New account", text: $addAccount)
                    Button("Add account") { Task { await viewModel.addMissingOption(kind: "account", value: addAccount); addAccount = "" } }
                    TextField("New category", text: $addCategory)
                    Button("Add category") { Task { await viewModel.addMissingOption(kind: "category", value: addCategory); addCategory = "" } }
                }
            }
            .navigationTitle(mode == .create ? "New Expense" : "Edit Expense")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(mode == .create ? "Create" : "Save") {
                        if mode == .create {
                            submitCreate()
                        } else {
                            viewModel.updateExpense(currentDraft)
                        }
                        dismiss()
                    }
                    .disabled(isSubmitDisabled)
                }
            }
        }
    }

    private var currentDraft: ExpenseEditorDraft { drafts[selectedIndex] }

    private var isSubmitDisabled: Bool {
        if mode == .edit {
            return currentDraft.expense.isEmpty || currentDraft.type.isEmpty || currentDraft.account.isEmpty || currentDraft.category.isEmpty || currentDraft.paidTo.isEmpty || currentDraft.amount <= 0
        }
        return drafts.isEmpty || drafts.contains { $0.expense.isEmpty || $0.type.isEmpty || $0.account.isEmpty || $0.category.isEmpty || $0.paidTo.isEmpty || $0.amount <= 0 }
    }

    private func submitCreate() {
        if drafts.count == 1 {
            viewModel.createExpense(drafts[0])
            return
        }
        let baseExpenseId = UUID().uuidString
        let groupLabel = drafts[0].expense
        let rows = drafts.map { draft -> ExpenseEditorDraft in
            var next = draft
            next.baseExpenseId = baseExpenseId
            next.baseExpenseLabel = groupLabel
            next.subExpenseId = UUID().uuidString
            if next.expenseId.isEmpty { next.expenseId = UUID().uuidString }
            return next
        }
        viewModel.bulkCreateExpenses(rows)
    }

    private func binding<Value>(_ keyPath: WritableKeyPath<ExpenseEditorDraft, Value>) -> Binding<Value> {
        Binding(get: { drafts[selectedIndex][keyPath: keyPath] }, set: { value in
            drafts[selectedIndex][keyPath: keyPath] = value
        })
    }

    private func updateCurrent(_ mutate: (inout ExpenseEditorDraft) -> Void) {
        var next = drafts[selectedIndex]
        mutate(&next)
        drafts[selectedIndex] = next
    }

    private func newExpenseDraft(template: ExpenseEditorDraft) -> ExpenseEditorDraft {
        ExpenseEditorDraft(
            id: nil,
            expense: "",
            type: template.type,
            account: template.account,
            category: template.category,
            subcategory: template.subcategory,
            amount: 0,
            effectiveAmount: 0,
            effectiveAmountMode: template.effectiveAmountMode,
            date: template.date,
            paidTo: template.paidTo,
            notes: template.notes,
            comments: template.comments,
            expenseId: UUID().uuidString,
            baseExpenseId: nil,
            baseExpenseLabel: nil,
            subExpenseId: nil
        )
    }
}

private struct IncomingEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel
    @State private var drafts: [IncomingEditorDraft]
    @State private var selectedIndex = 0
    let mode: EditorMode

    @State private var addType = ""
    @State private var addAccount = ""

    init(viewModel: LedgerFeatureViewModel, initialDraft: IncomingEditorDraft, mode: EditorMode) {
        self.viewModel = viewModel
        _drafts = State(initialValue: [initialDraft])
        self.mode = mode
    }

    var body: some View {
        NavigationStack {
            Form {
                if mode == .create {
                    Section("Bulk Group") {
                        Text("Entries: \(drafts.count)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Picker("Editing Entry", selection: $selectedIndex) {
                            ForEach(Array(drafts.indices), id: \.self) { index in
                                Text("Entry \(index + 1)").tag(index)
                            }
                        }
                        Button("Add Another in Bulk Group") {
                            drafts.append(newIncomingDraft(template: drafts[selectedIndex]))
                            selectedIndex = drafts.count - 1
                        }
                        if drafts.count > 1 {
                            Button("Remove Current Entry", role: .destructive) {
                                drafts.remove(at: selectedIndex)
                                selectedIndex = min(selectedIndex, max(0, drafts.count - 1))
                            }
                        }
                    }
                }

                TextField("Name", text: binding(\.incoming))
                TextField("Paid By", text: binding(\.paidBy))
                TextField("Type", text: binding(\.incomeType))
                TextField("Subtype", text: Binding(get: { currentDraft.incomeSubtype ?? "" }, set: { value in
                    updateCurrent { $0.incomeSubtype = value.isEmpty ? nil : value }
                }))
                TextField("Account", text: binding(\.account))
                TextField("Amount", value: binding(\.amount), format: .number)
                TextField("Effective Amount", value: binding(\.effectiveAmount), format: .number)
                Picker("Effective Mode", selection: binding(\.effectiveAmountMode)) {
                    Text("Auto").tag(EffectiveAmountMode.auto)
                    Text("Manual").tag(EffectiveAmountMode.manual)
                }
                DatePicker("Date", selection: binding(\.date), displayedComponents: .date)
                TextField("Notes", text: Binding(get: { currentDraft.notes ?? "" }, set: { value in
                    updateCurrent { $0.notes = value.isEmpty ? nil : value }
                }))
                TextField("Comments", text: Binding(get: { currentDraft.comments ?? "" }, set: { value in
                    updateCurrent { $0.comments = value.isEmpty ? nil : value }
                }))

                Section("Add missing option") {
                    TextField("New income type", text: $addType)
                    Button("Add type") { Task { await viewModel.addMissingOption(kind: "incomeType", value: addType); addType = "" } }
                    TextField("New account", text: $addAccount)
                    Button("Add account") { Task { await viewModel.addMissingOption(kind: "account", value: addAccount); addAccount = "" } }
                }
            }
            .navigationTitle(mode == .create ? "New Incoming" : "Edit Incoming")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(mode == .create ? "Create" : "Save") {
                        if mode == .create {
                            submitCreate()
                        } else {
                            viewModel.updateIncoming(currentDraft)
                        }
                        dismiss()
                    }
                    .disabled(isSubmitDisabled)
                }
            }
        }
    }

    private var currentDraft: IncomingEditorDraft { drafts[selectedIndex] }

    private var isSubmitDisabled: Bool {
        if mode == .edit {
            return currentDraft.incoming.isEmpty || currentDraft.paidBy.isEmpty || currentDraft.incomeType.isEmpty || currentDraft.account.isEmpty || currentDraft.amount <= 0
        }
        return drafts.isEmpty || drafts.contains { $0.incoming.isEmpty || $0.paidBy.isEmpty || $0.incomeType.isEmpty || $0.account.isEmpty || $0.amount <= 0 }
    }

    private func submitCreate() {
        if drafts.count == 1 {
            viewModel.createIncoming(drafts[0])
            return
        }
        let baseIncomingId = UUID().uuidString
        let rows = drafts.map { draft -> IncomingEditorDraft in
            var next = draft
            next.baseIncomingId = baseIncomingId
            next.subIncomingId = UUID().uuidString
            if next.incomingId.isEmpty { next.incomingId = UUID().uuidString }
            return next
        }
        viewModel.bulkCreateIncomings(rows)
    }

    private func binding<Value>(_ keyPath: WritableKeyPath<IncomingEditorDraft, Value>) -> Binding<Value> {
        Binding(get: { drafts[selectedIndex][keyPath: keyPath] }, set: { value in
            drafts[selectedIndex][keyPath: keyPath] = value
        })
    }

    private func updateCurrent(_ mutate: (inout IncomingEditorDraft) -> Void) {
        var next = drafts[selectedIndex]
        mutate(&next)
        drafts[selectedIndex] = next
    }

    private func newIncomingDraft(template: IncomingEditorDraft) -> IncomingEditorDraft {
        IncomingEditorDraft(
            id: nil,
            incoming: "",
            paidBy: template.paidBy,
            incomeType: template.incomeType,
            incomeSubtype: template.incomeSubtype,
            account: template.account,
            amount: 0,
            effectiveAmount: 0,
            effectiveAmountMode: template.effectiveAmountMode,
            date: template.date,
            notes: template.notes,
            comments: template.comments,
            incomingId: UUID().uuidString,
            baseIncomingId: nil,
            subIncomingId: nil
        )
    }
}

private struct PartnerPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let anchorID: String
    @ObservedObject var viewModel: LedgerFeatureViewModel

    var body: some View {
        NavigationStack {
            List(viewModel.partnerCandidates(excluding: anchorID)) { row in
                Button(row.title) {
                    viewModel.addPartner(anchorID: anchorID, partnerID: row.id)
                    dismiss()
                }
            }
            .navigationTitle("Select Partner")
        }
    }
}

private struct PaybackLinksManagerView: View {
    let target: PaybackTarget
    @ObservedObject var viewModel: LedgerFeatureViewModel

    @State private var rows: [PaybackLinkViewData] = []
    @State private var candidates: [(id: String, title: String)] = []
    @State private var selectedCandidate: String = ""
    @State private var amount: String = ""
    @State private var notes: String = ""
    @State private var loading = false

    var body: some View {
        List {
            Section("Create link") {
                Picker("Counterparty", selection: $selectedCandidate) {
                    ForEach(candidates, id: \.id) { item in
                        Text(item.title).tag(item.id)
                    }
                }
                TextField("Amount", text: $amount)
                    .keyboardType(.decimalPad)
                TextField("Notes", text: $notes)
                Button("Create") {
                    guard let parsed = Double(amount), !selectedCandidate.isEmpty else { return }
                    Task {
                        try? await viewModel.createPaybackLink(target: target, otherId: selectedCandidate, amount: parsed, notes: notes.isEmpty ? nil : notes)
                        await load()
                    }
                }
            }

            Section("Links") {
                ForEach(rows) { row in
                    VStack(alignment: .leading) {
                        Text(row.counterpartyTitle)
                        Text("Allocated: \(row.allocatedAmount)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        if let notes = row.notes, !notes.isEmpty {
                            Text(notes).font(.footnote)
                        }
                    }
                    .swipeActions {
                        Button(role: .destructive) {
                            Task {
                                try? await viewModel.removePaybackLink(id: row.id)
                                await load()
                            }
                        } label: { Text("Delete") }
                    }
                }
            }
        }
        .overlay { if loading { ProgressView() } }
        .navigationTitle("Payback Links")
        .task { await load() }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            rows = try await viewModel.loadPaybackLinks(for: target)
            candidates = try await viewModel.paybackCandidates(for: target)
            if selectedCandidate.isEmpty { selectedCandidate = candidates.first?.id ?? "" }
        } catch {
            rows = []
            candidates = []
        }
    }
}

private struct RowID: Identifiable {
    let id: String
}
