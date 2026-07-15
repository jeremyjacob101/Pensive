import SwiftUI

enum EditorMode { case create, edit }

func optionColor(from hex: String?) -> Color? {
    guard let hex else { return nil }
    let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
    guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
    let red = Double((value >> 16) & 0xff) / 255.0
    let green = Double((value >> 8) & 0xff) / 255.0
    let blue = Double(value & 0xff) / 255.0
    return Color(red: red, green: green, blue: blue)
}

struct UserOptionPicker: View {
    let title: String
    let options: [UserOptionRow]
    @Binding var selection: String
    var showNone: Bool = false

    var body: some View {
        Menu {
            if showNone {
                Button("None") { selection = "" }
            }
            ForEach(options, id: \.value) { option in
                Button {
                    selection = option.value
                } label: {
                    HStack(spacing: 6) {
                        if let image = coloredDotUIImage(color: optionColor(from: option.color)) {
                            Image(uiImage: image)
                                .renderingMode(.original)
                        }
                        Text(option.value)
                    }
                }
            }
        } label: {
            HStack {
                Text(title)
                Spacer()
                HStack(spacing: 4) {
                    Text(selection.isEmpty ? "Select" : selection)
                        .foregroundStyle(selection.isEmpty ? .secondary : .primary)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .tint(.primary)
    }
}

private func currentMonthYear() -> MonthYear {
    LedgerScopeLogic.targetMonths(startDate: Date(), endDate: Date()).first!
}

private func shiftedMonthYear(_ month: MonthYear, by value: Int) -> MonthYear? {
    guard let bounds = LedgerScopeLogic.monthBounds(for: month),
          let shifted = LedgerScopeLogic.calendar.date(byAdding: .month, value: value, to: bounds.start) else {
        return nil
    }
    return LedgerScopeLogic.targetMonths(startDate: shifted, endDate: shifted).first
}

struct MonthYearMultiSelect: View {
    let label: String
    @Binding var selection: [MonthYear]

    init(label: String = "Applies to months", selection: Binding<[MonthYear]>) {
        self.label = label
        _selection = selection
    }

    private var normalizedSelection: [MonthYear] {
        let normalized = Array(Set(selection)).sorted()
        return normalized.isEmpty ? [currentMonthYear()] : normalized
    }

    private var timelineMonths: [MonthYear] {
        let current = currentMonthYear()
        let selected = normalizedSelection
        let lower = min(selected.first ?? current, current)
        let upper = max(selected.last ?? current, current)
        guard let start = shiftedMonthYear(lower, by: -24),
              let end = shiftedMonthYear(upper, by: 24) else {
            return selected
        }
        return LedgerScopeLogic.targetMonths(
            startDate: LedgerScopeLogic.monthBounds(for: start)?.start ?? Date(),
            endDate: LedgerScopeLogic.monthBounds(for: end)?.start ?? Date()
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(label)
                Spacer()
                Text(normalizedSelection.count == 1
                    ? normalizedSelection[0].abbreviatedLabel
                    : "\(normalizedSelection.count) selected")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: true) {
                    LazyHStack(spacing: 8) {
                        ForEach(timelineMonths, id: \.rawValue) { month in
                            let isSelected = normalizedSelection.contains(month)
                            Button {
                                toggle(month)
                            } label: {
                                VStack(spacing: 4) {
                                    Text(month.abbreviatedLabel)
                                        .font(.subheadline.weight(.semibold))
                                    if month == currentMonthYear() {
                                        Image(systemName: "circle.fill")
                                            .font(.system(size: 5))
                                            .accessibilityLabel("Current month")
                                    } else {
                                        Color.clear.frame(height: 5)
                                    }
                                }
                                .frame(width: 66, height: 62)
                                .foregroundStyle(isSelected ? Color.accentColor : .primary)
                                .background(
                                    RoundedRectangle(cornerRadius: 10)
                                        .fill(isSelected ? Color.accentColor.opacity(0.16) : Color.secondary.opacity(0.08))
                                )
                                .overlay {
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(isSelected ? Color.accentColor : Color.secondary.opacity(0.2), lineWidth: isSelected ? 1.5 : 1)
                                }
                            }
                            .buttonStyle(.plain)
                            .id(month.rawValue)
                            .accessibilityLabel(month.abbreviatedLabel)
                            .accessibilityValue(isSelected ? "Selected" : "Not selected")
                        }
                    }
                    .padding(.horizontal, 4)
                    .padding(.vertical, 4)
                }
                .frame(height: 78)
                .onAppear {
                    proxy.scrollTo(currentMonthYear().rawValue, anchor: .center)
                }
            }
        }
        .onAppear {
            if selection.isEmpty {
                selection = [currentMonthYear()]
            }
        }
    }

    private func toggle(_ month: MonthYear) {
        var next = normalizedSelection
        if next.contains(month) {
            guard next.count > 1 else { return }
            next.removeAll { $0 == month }
        } else {
            next.append(month)
        }
        selection = Array(Set(next)).sorted()
    }
}

struct SavedMonthSelectionView: View {
    let onSave: ([MonthYear]) async -> Bool

    @State private var selection: [MonthYear]
    @State private var isSaving = false
    @State private var errorText: String?

    init(initialSelection: [MonthYear], onSave: @escaping ([MonthYear]) async -> Bool) {
        self.onSave = onSave
        _selection = State(initialValue: initialSelection.isEmpty ? [currentMonthYear()] : initialSelection)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            MonthYearMultiSelect(selection: $selection)
            Button {
                Task {
                    isSaving = true
                    let didSave = await onSave(selection)
                    isSaving = false
                    errorText = didSave ? nil : "Couldn't save the selected months."
                }
            } label: {
                Label(isSaving ? "Saving…" : "Save Months", systemImage: "checkmark")
            }
            .buttonStyle(.bordered)
            .disabled(isSaving)

            if let errorText {
                Text(errorText)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding(.vertical, 4)
    }
}

struct FormFieldRow<Content: View>: View {
    let label: String
    @ViewBuilder let content: Content

    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.primary)
            Spacer(minLength: 8)
            content
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct BulkGroupSection: View {
    let entryCount: Int
    @Binding var selectedIndex: Int
    let onAdd: () -> Void
    let onRemove: () -> Void

    var body: some View {
        Section("Bulk Group") {
            Text("Entries: \(entryCount)")
                .accessibilityIdentifier("ledger_bulk_entry_count")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Picker("Editing Entry", selection: $selectedIndex) {
                ForEach(0..<entryCount, id: \.self) { index in
                    Text("Entry \(index + 1)").tag(index)
                }
            }
            Button("Add Another in Bulk Group", action: onAdd)
                .accessibilityIdentifier("ledger_bulk_add")
            if entryCount > 1 {
                Button("Remove Current Entry", role: .destructive, action: onRemove)
            }
        }
    }
}

struct ExpenseEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel
    @State private var drafts: [ExpenseEditorDraft]
    @State private var selectedIndex = 0
    @State private var isSaving = false
    @State private var saveError: String?
    let mode: EditorMode

    init(viewModel: LedgerFeatureViewModel, initialDraft: ExpenseEditorDraft, mode: EditorMode) {
        self.viewModel = viewModel
        _drafts = State(initialValue: [initialDraft])
        self.mode = mode
    }

    var body: some View {
        NavigationStack {
            Form {
                FormFieldRow(label: "Name") {
                    TextField("Name", text: binding(\.expense))
                }
                UserOptionPicker(title: "Account", options: viewModel.optionsByKind["account"] ?? [], selection: binding(\.account))
                UserOptionPicker(title: "Category", options: viewModel.optionsByKind["category"] ?? [], selection: binding(\.category))
                let subcategories = (viewModel.optionsByKind["subcategory"] ?? []).filter { $0.parentValue == currentDraft.category }
                if !subcategories.isEmpty {
                    UserOptionPicker(title: "Subcategory", options: subcategories, selection: Binding(get: { currentDraft.subcategory ?? "" }, set: { value in
                        updateCurrent { $0.subcategory = value.isEmpty ? nil : value }
                    }), showNone: true)
                }
                FormFieldRow(label: "Paid To") {
                    TextField("Paid To", text: binding(\.paidTo))
                }
                FormFieldRow(label: "Amount") {
                    TextField("Amount", text: Binding(get: {
                        let val = currentDraft.amount
                        return val == 0 ? "" : val.formatted(.number.precision(.fractionLength(0...2)))
                    }, set: { str in
                        let val = Double(str) ?? 0
                        updateCurrent { draft in
                            draft.amount = val
                            if draft.effectiveAmountMode == .auto {
                                draft.effectiveAmount = val
                            }
                        }
                    }))
                    .keyboardType(.decimalPad)
                }
                FormFieldRow(label: "Effective Amount") {
                    TextField("Effective Amount", text: Binding(get: {
                        let val = currentDraft.effectiveAmount
                        return val == 0 ? "" : val.formatted(.number.precision(.fractionLength(0...2)))
                    }, set: { str in
                        updateCurrent { draft in
                            draft.effectiveAmount = Double(str) ?? 0
                            draft.effectiveAmountMode = .manual
                        }
                    }))
                    .keyboardType(.decimalPad)
                }
                DatePicker("Date", selection: binding(\.date), displayedComponents: .date)
                Section("Applies to") {
                    MonthYearMultiSelect(selection: binding(\.monthYears))
                }
                TextField("Notes", text: Binding(get: { currentDraft.notes ?? "" }, set: { value in
                    updateCurrent { $0.notes = value.isEmpty ? nil : value }
                }))
                TextField("Comments", text: Binding(get: { currentDraft.comments ?? "" }, set: { value in
                    updateCurrent { $0.comments = value.isEmpty ? nil : value }
                }))

                if mode == .create {
                    BulkGroupSection(
                        entryCount: drafts.count,
                        selectedIndex: $selectedIndex,
                        onAdd: {
                            drafts.append(newExpenseDraft(template: drafts[selectedIndex]))
                            selectedIndex = drafts.count - 1
                        },
                        onRemove: {
                            drafts.remove(at: selectedIndex)
                            selectedIndex = min(selectedIndex, max(0, drafts.count - 1))
                        }
                    )
                }
            }
            .navigationTitle(mode == .create ? "New Expense" : "Edit Expense")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(mode == .create ? "Create" : "Save") {
                        Task { await save() }
                    }
                    .disabled(isSubmitDisabled || isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
        .alert("Couldn't save expense", isPresented: Binding(get: { saveError != nil }, set: { if !$0 { saveError = nil } })) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private var currentDraft: ExpenseEditorDraft { drafts[selectedIndex] }

    private var isSubmitDisabled: Bool {
        if mode == .edit {
            return currentDraft.expense.isEmpty || currentDraft.account.isEmpty || currentDraft.category.isEmpty || currentDraft.paidTo.isEmpty || currentDraft.amount <= 0
        }
        return drafts.isEmpty || drafts.contains { $0.expense.isEmpty || $0.account.isEmpty || $0.category.isEmpty || $0.paidTo.isEmpty || $0.amount <= 0 }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let didSave: Bool
        if drafts.count == 1 {
            didSave = mode == .create
                ? await viewModel.createExpense(drafts[0])
                : await viewModel.updateExpense(currentDraft)
        } else {
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
            didSave = await viewModel.bulkCreateExpenses(rows)
        }
        if didSave {
            dismiss()
        } else {
            saveError = viewModel.alertText ?? "Please check your connection and try again."
            viewModel.alertText = nil
        }
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
            account: template.account,
            category: template.category,
            subcategory: template.subcategory,
            amount: 0,
            effectiveAmount: 0,
            effectiveAmountMode: template.effectiveAmountMode,
            monthYears: template.monthYears,
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

struct IncomingEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel
    @State private var drafts: [IncomingEditorDraft]
    @State private var selectedIndex = 0
    @State private var isSaving = false
    @State private var saveError: String?
    let mode: EditorMode

    init(viewModel: LedgerFeatureViewModel, initialDraft: IncomingEditorDraft, mode: EditorMode) {
        self.viewModel = viewModel
        _drafts = State(initialValue: [initialDraft])
        self.mode = mode
    }

    var body: some View {
        NavigationStack {
            Form {
                FormFieldRow(label: "Name") {
                    TextField("Name", text: binding(\.incoming))
                }
                FormFieldRow(label: "Paid By") {
                    TextField("Paid By", text: binding(\.paidBy))
                }
                UserOptionPicker(title: "Type", options: viewModel.optionsByKind["incomeType"] ?? [], selection: binding(\.incomeType))
                let subtypes = (viewModel.optionsByKind["incomeSubtype"] ?? []).filter { $0.parentValue == currentDraft.incomeType }
                if !subtypes.isEmpty {
                    UserOptionPicker(title: "Subtype", options: subtypes, selection: Binding(get: { currentDraft.incomeSubtype ?? "" }, set: { value in
                        updateCurrent { $0.incomeSubtype = value.isEmpty ? nil : value }
                    }), showNone: true)
                }
                UserOptionPicker(title: "Account", options: viewModel.optionsByKind["account"] ?? [], selection: binding(\.account))
                FormFieldRow(label: "Amount") {
                    TextField("Amount", text: Binding(get: {
                        let val = currentDraft.amount
                        return val == 0 ? "" : val.formatted(.number.precision(.fractionLength(0...2)))
                    }, set: { str in
                        let val = Double(str) ?? 0
                        updateCurrent { draft in
                            draft.amount = val
                            if draft.effectiveAmountMode == .auto {
                                draft.effectiveAmount = val
                            }
                        }
                    }))
                    .keyboardType(.decimalPad)
                }
                FormFieldRow(label: "Effective Amount") {
                    TextField("Effective Amount", text: Binding(get: {
                        let val = currentDraft.effectiveAmount
                        return val == 0 ? "" : val.formatted(.number.precision(.fractionLength(0...2)))
                    }, set: { str in
                        updateCurrent { draft in
                            draft.effectiveAmount = Double(str) ?? 0
                            draft.effectiveAmountMode = .manual
                        }
                    }))
                    .keyboardType(.decimalPad)
                }
                DatePicker("Date", selection: binding(\.date), displayedComponents: .date)
                Section("Applies to") {
                    MonthYearMultiSelect(selection: binding(\.monthYears))
                }
                TextField("Notes", text: Binding(get: { currentDraft.notes ?? "" }, set: { value in
                    updateCurrent { $0.notes = value.isEmpty ? nil : value }
                }))
                TextField("Comments", text: Binding(get: { currentDraft.comments ?? "" }, set: { value in
                    updateCurrent { $0.comments = value.isEmpty ? nil : value }
                }))

                if mode == .create {
                    BulkGroupSection(
                        entryCount: drafts.count,
                        selectedIndex: $selectedIndex,
                        onAdd: {
                            drafts.append(newIncomingDraft(template: drafts[selectedIndex]))
                            selectedIndex = drafts.count - 1
                        },
                        onRemove: {
                            drafts.remove(at: selectedIndex)
                            selectedIndex = min(selectedIndex, max(0, drafts.count - 1))
                        }
                    )
                }
            }
            .navigationTitle(mode == .create ? "New Incoming" : "Edit Incoming")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(mode == .create ? "Create" : "Save") {
                        Task { await save() }
                    }
                    .disabled(isSubmitDisabled || isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
        .alert("Couldn't save incoming", isPresented: Binding(get: { saveError != nil }, set: { if !$0 { saveError = nil } })) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private var currentDraft: IncomingEditorDraft { drafts[selectedIndex] }

    private var isSubmitDisabled: Bool {
        if mode == .edit {
            return currentDraft.incoming.isEmpty || currentDraft.paidBy.isEmpty || currentDraft.incomeType.isEmpty || currentDraft.account.isEmpty || currentDraft.amount <= 0
        }
        return drafts.isEmpty || drafts.contains { $0.incoming.isEmpty || $0.paidBy.isEmpty || $0.incomeType.isEmpty || $0.account.isEmpty || $0.amount <= 0 }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let didSave: Bool
        if drafts.count == 1 {
            didSave = mode == .create
                ? await viewModel.createIncoming(drafts[0])
                : await viewModel.updateIncoming(currentDraft)
        } else {
            let baseIncomingId = UUID().uuidString
            let rows = drafts.map { draft -> IncomingEditorDraft in
                var next = draft
                next.baseIncomingId = baseIncomingId
                next.subIncomingId = UUID().uuidString
                if next.incomingId.isEmpty { next.incomingId = UUID().uuidString }
                return next
            }
            didSave = await viewModel.bulkCreateIncomings(rows)
        }
        if didSave {
            dismiss()
        } else {
            saveError = viewModel.alertText ?? "Please check your connection and try again."
            viewModel.alertText = nil
        }
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
            monthYears: template.monthYears,
            date: template.date,
            notes: template.notes,
            comments: template.comments,
            incomingId: UUID().uuidString,
            baseIncomingId: nil,
            subIncomingId: nil
        )
    }
}

struct PartnerPickerSheet: View {
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

struct PaybackLinksManagerView: View {
    @Environment(\.dismiss) private var dismiss
    let target: PaybackTarget
    @ObservedObject var viewModel: LedgerFeatureViewModel

    @State private var rows: [PaybackLinkViewData] = []
    @State private var candidates: [(id: String, title: String)] = []
    @State private var selectedCandidate: String = ""
    @State private var amount: String = ""
    @State private var notes: String = ""
    @State private var loading = false

    var body: some View {
        NavigationStack {
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
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
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

struct LedgerRowID: Identifiable {
    let id: String
}
