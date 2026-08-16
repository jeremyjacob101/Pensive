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
    let showHeader: Bool
    @Binding var selection: [MonthYear]

    init(label: String = "Applies to months", showHeader: Bool = true, selection: Binding<[MonthYear]>) {
        self.label = label
        self.showHeader = showHeader
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
            if showHeader {
                HStack {
                    Text(label)
                    Spacer()
                    Text(normalizedSelection.count == 1
                        ? normalizedSelection[0].abbreviatedLabel
                        : "\(normalizedSelection.count) selected")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: true) {
                    LazyHStack(spacing: 8) {
                        ForEach(timelineMonths, id: \.rawValue) { month in
                            let isSelected = normalizedSelection.contains(month)
                            Button {
                                toggle(month)
                            } label: {
                                    VStack(spacing: 2) {
                                        Text(month.abbreviatedLabel)
                                            .font(.subheadline.weight(.semibold))
                                        if month == currentMonthYear() {
                                            Image(systemName: "circle.fill")
                                                .font(.system(size: 4))
                                                .accessibilityLabel("Current month")
                                        } else {
                                            Color.clear.frame(height: 4)
                                        }
                                    }
                                    .frame(width: 66, height: 44)
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
                .frame(height: 60)
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

private struct PaybackLinksSection: View {
    @Binding var links: [PaybackLinkDraft]
    let candidates: [PaybackCandidate]
    let isLoadingCandidates: Bool
    let candidateError: String?

    var body: some View {
        Section {
            ForEach($links) { $link in
                HStack(spacing: 8) {
                    Menu {
                        let available = availableCandidates(for: link)
                        if available.isEmpty {
                            Text(isLoadingCandidates ? "Loading…" : "No items available")
                        } else {
                            ForEach(available) { candidate in
                                Button(candidate.title) {
                                    link.counterpartyID = candidate.id
                                    link.counterpartyTitle = candidate.title
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(link.counterpartyTitle ?? "Payback Name")
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .foregroundStyle(
                                    link.counterpartyID == nil
                                        ? Color.secondary
                                        : Color.primary
                                )
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoadingCandidates && candidates.isEmpty)
                    .accessibilityLabel("Payback name")
                    .accessibilityIdentifier("payback_name_\(link.id.uuidString)")

                    TextField("Amount", text: $link.amountText)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 82)
                        .accessibilityLabel("Payback amount")
                        .accessibilityIdentifier("payback_amount_\(link.id.uuidString)")

                    Button(role: .destructive) {
                        links.removeAll { $0.id == link.id }
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .font(.title3)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove payback link")
                }
            }
        } header: {
            HStack {
                Text("Payback Links")
                Spacer()
                Button {
                    links.append(.blank)
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add payback link")
                .accessibilityIdentifier("payback_add")
            }
        } footer: {
            if let candidateError {
                Text(candidateError)
                    .foregroundStyle(.red)
            }
        }
    }

    private func availableCandidates(for link: PaybackLinkDraft) -> [PaybackCandidate] {
        let selectedElsewhere = Set(
            links
                .filter { $0.id != link.id }
                .compactMap(\.counterpartyID)
        )
        return candidates.filter {
            $0.id == link.counterpartyID || !selectedElsewhere.contains($0.id)
        }
    }
}

private struct BulkGroupSection: View {
    let entryCount: Int
    @Binding var selectedIndex: Int
    let singledOutIndices: Set<Int>
    let onAdd: () -> Void
    let onRemoveEntry: (Int) -> Void
    let onToggleSingle: (Int) -> Void

    private var bulkIndices: [Int] {
        guard entryCount > 1 else { return [] }
        return (0..<entryCount).filter { !singledOutIndices.contains($0) }
    }

    private var singleIndices: [Int] {
        guard entryCount > 1 else { return [] }
        return (0..<entryCount).filter { singledOutIndices.contains($0) }
    }

    var body: some View {
        Section {
            ForEach(bulkIndices, id: \.self) { index in
                entryRow(index)
            }
        } header: {
            HStack {
                Text("Bulk Group")
                Spacer()
                Button { onAdd() } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add entry")
                .accessibilityIdentifier("ledger_bulk_add")
            }
        }

        if !singleIndices.isEmpty {
            Section("Single Entries") {
                ForEach(singleIndices, id: \.self) { index in
                    entryRow(index)
                }
            }
        }
    }

    private func entryRow(_ index: Int) -> some View {
        HStack {
            Text("Entry \(index + 1)")
                .foregroundStyle(index == selectedIndex ? Color.accentColor : .primary)
            Spacer()
            if index == selectedIndex {
                Image(systemName: "checkmark")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
            }
            if entryCount > 1 {
                Button {
                    onToggleSingle(index)
                } label: {
                    Image(systemName: singledOutIndices.contains(index)
                        ? "square.stack.3d.down.right"
                        : "square.stack.3d.down.right.fill")
                        .font(.subheadline)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(singledOutIndices.contains(index) ? "Move to bulk" : "Move to single")
                Button(role: .destructive) {
                    onRemoveEntry(index)
                } label: {
                    Image(systemName: "minus.circle.fill")
                        .font(.title3)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove entry \(index + 1)")
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            selectedIndex = index
        }
    }
}

struct ExpenseEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel
    @State private var drafts: [ExpenseEditorDraft]
    @State private var selectedIndex = 0
    @State private var singledOutIndices: Set<Int> = []
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var paybackCandidates: [PaybackCandidate] = []
    @State private var isLoadingPaybackCandidates = false
    @State private var paybackCandidateError: String?
    let mode: EditorMode

    init(viewModel: LedgerFeatureViewModel, initialDraft: ExpenseEditorDraft, mode: EditorMode) {
        self.viewModel = viewModel
        _drafts = State(initialValue: [initialDraft])
        self.mode = mode
    }

    init(viewModel: LedgerFeatureViewModel, initialDrafts: [ExpenseEditorDraft], selectedID: String, mode: EditorMode) {
        self.viewModel = viewModel
        _drafts = State(initialValue: initialDrafts)
        _selectedIndex = State(initialValue: initialDrafts.firstIndex { $0.id == selectedID } ?? 0)
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
                Section {
                    MonthYearMultiSelect(showHeader: false, selection: binding(\.monthYears))
                } header: {
                    HStack {
                        Text("Applies to")
                        Spacer()
                        Text(monthSummaryLabel(currentDraft.monthYears))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                TextField("Notes", text: Binding(get: { currentDraft.notes ?? "" }, set: { value in
                    updateCurrent { $0.notes = value.isEmpty ? nil : value }
                }))
                TextField("Comments", text: Binding(get: { currentDraft.comments ?? "" }, set: { value in
                    updateCurrent { $0.comments = value.isEmpty ? nil : value }
                }))

                PaybackLinksSection(
                    links: binding(\.paybackLinks),
                    candidates: paybackCandidates,
                    isLoadingCandidates: isLoadingPaybackCandidates,
                    candidateError: paybackCandidateError
                )

                BulkGroupSection(
                    entryCount: drafts.count,
                    selectedIndex: $selectedIndex,
                    singledOutIndices: singledOutIndices,
                    onAdd: {
                        drafts.append(newExpenseDraft(template: drafts[selectedIndex]))
                        selectedIndex = drafts.count - 1
                    },
                    onRemoveEntry: { index in
                        if singledOutIndices.contains(index) {
                            singledOutIndices.remove(index)
                        }
                        let i = drafts.index(drafts.startIndex, offsetBy: index)
                        drafts.remove(at: i)
                        selectedIndex = min(selectedIndex, max(0, drafts.count - 1))
                        singledOutIndices = Set(singledOutIndices.map { $0 > index ? $0 - 1 : $0 }.filter { $0 < drafts.count })
                    },
                    onToggleSingle: { index in
                        if singledOutIndices.contains(index) {
                            singledOutIndices.remove(index)
                        } else {
                            singledOutIndices.insert(index)
                        }
                    }
                )
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(mode == .create ? "New Expense" : "Edit Expense")
            .navigationBarTitleDisplayMode(.inline)
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
        .task { await loadPaybackCandidates() }
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
        if let message = paybackValidationMessage {
            saveError = message
            return
        }

        isSaving = true
        defer { isSaving = false }
        let didSave: Bool

        let singleIndices = singledOutIndices.sorted()
        let bulkIndices = Set(0..<drafts.count).subtracting(singledOutIndices).sorted()

        if bulkIndices.isEmpty && singleIndices.count == 1 {
            didSave = await persist(drafts[singleIndices[0]])
        } else if singleIndices.isEmpty && bulkIndices.count == 1 {
            didSave = await persist(drafts[bulkIndices[0]])
        } else {
            var success = true

            for i in singleIndices {
                success = await persist(drafts[i])
                if !success { break }
            }

            if success, !bulkIndices.isEmpty {
                let bulkDrafts = bulkIndices.map { drafts[$0] }
                if bulkDrafts.count == 1 {
                    success = await persist(bulkDrafts[0])
                } else {
                    let baseExpenseId = bulkDrafts
                        .compactMap(\.baseExpenseId)
                        .first { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                        ?? UUID().uuidString
                    let groupLabel = bulkDrafts
                        .compactMap(\.baseExpenseLabel)
                        .first { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                        ?? bulkDrafts[0].expense
                    let rows = bulkDrafts.map { draft -> ExpenseEditorDraft in
                        var next = draft
                        next.baseExpenseId = baseExpenseId
                        next.baseExpenseLabel = groupLabel
                        next.subExpenseId = next.subExpenseId ?? UUID().uuidString
                        if next.expenseId.isEmpty { next.expenseId = UUID().uuidString }
                        return next
                    }
                    if rows.allSatisfy({ $0.id == nil }) {
                        success = await viewModel.bulkCreateExpenses(rows)
                    } else {
                        for row in rows {
                            success = await persist(row)
                            if !success { break }
                        }
                    }
                }
            }

            didSave = success
        }

        if didSave {
            dismiss()
        } else {
            saveError = viewModel.alertText ?? "Please check your connection and try again."
            viewModel.alertText = nil
        }
    }

    private func persist(_ draft: ExpenseEditorDraft) async -> Bool {
        if draft.id == nil {
            return await viewModel.createExpense(draft)
        }
        return await viewModel.updateExpense(draft)
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

    private var paybackValidationMessage: String? {
        for (index, draft) in drafts.enumerated() {
            if let message = PaybackLinkDraftValidation.message(for: draft.paybackLinks) {
                return drafts.count == 1 ? message : "Entry \(index + 1): \(message)"
            }
        }
        return nil
    }

    private func loadPaybackCandidates() async {
        guard paybackCandidates.isEmpty, !isLoadingPaybackCandidates else { return }
        isLoadingPaybackCandidates = true
        defer { isLoadingPaybackCandidates = false }

        do {
            let loaded = try await viewModel.paybackCandidates()
            var seenIDs: Set<String> = []
            var merged: [PaybackCandidate] = []

            for link in drafts.flatMap(\.paybackLinks) {
                guard let id = link.counterpartyID,
                      let title = link.counterpartyTitle,
                      seenIDs.insert(id).inserted else {
                    continue
                }
                merged.append(.init(id: id, title: title))
            }
            merged.append(contentsOf: loaded.filter { seenIDs.insert($0.id).inserted })
            paybackCandidates = merged
            paybackCandidateError = nil
        } catch is CancellationError {
            return
        } catch {
            paybackCandidateError = "Couldn't load payback names. Check your connection and try again."
        }
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
            subExpenseId: nil,
            paybackLinks: []
        )
    }
}

struct IncomingEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel
    @State private var drafts: [IncomingEditorDraft]
    @State private var selectedIndex = 0
    @State private var singledOutIndices: Set<Int> = []
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var paybackCandidates: [PaybackCandidate] = []
    @State private var isLoadingPaybackCandidates = false
    @State private var paybackCandidateError: String?
    let mode: EditorMode

    init(viewModel: LedgerFeatureViewModel, initialDraft: IncomingEditorDraft, mode: EditorMode) {
        self.viewModel = viewModel
        _drafts = State(initialValue: [initialDraft])
        self.mode = mode
    }

    init(viewModel: LedgerFeatureViewModel, initialDrafts: [IncomingEditorDraft], selectedID: String, mode: EditorMode) {
        self.viewModel = viewModel
        _drafts = State(initialValue: initialDrafts)
        _selectedIndex = State(initialValue: initialDrafts.firstIndex { $0.id == selectedID } ?? 0)
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
                Section {
                    MonthYearMultiSelect(showHeader: false, selection: binding(\.monthYears))
                } header: {
                    HStack {
                        Text("Applies to")
                        Spacer()
                        Text(monthSummaryLabel(currentDraft.monthYears))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                TextField("Notes", text: Binding(get: { currentDraft.notes ?? "" }, set: { value in
                    updateCurrent { $0.notes = value.isEmpty ? nil : value }
                }))
                TextField("Comments", text: Binding(get: { currentDraft.comments ?? "" }, set: { value in
                    updateCurrent { $0.comments = value.isEmpty ? nil : value }
                }))

                PaybackLinksSection(
                    links: binding(\.paybackLinks),
                    candidates: paybackCandidates,
                    isLoadingCandidates: isLoadingPaybackCandidates,
                    candidateError: paybackCandidateError
                )

                BulkGroupSection(
                    entryCount: drafts.count,
                    selectedIndex: $selectedIndex,
                    singledOutIndices: singledOutIndices,
                    onAdd: {
                        drafts.append(newIncomingDraft(template: drafts[selectedIndex]))
                        selectedIndex = drafts.count - 1
                    },
                    onRemoveEntry: { index in
                        if singledOutIndices.contains(index) {
                            singledOutIndices.remove(index)
                        }
                        drafts.remove(at: index)
                        selectedIndex = min(selectedIndex, max(0, drafts.count - 1))
                        singledOutIndices = Set(singledOutIndices.map { $0 > index ? $0 - 1 : $0 }.filter { $0 < drafts.count })
                    },
                    onToggleSingle: { index in
                        if singledOutIndices.contains(index) {
                            singledOutIndices.remove(index)
                        } else {
                            singledOutIndices.insert(index)
                        }
                    }
                )
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(mode == .create ? "New Incoming" : "Edit Incoming")
            .navigationBarTitleDisplayMode(.inline)
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
        .task { await loadPaybackCandidates() }
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
        if let message = paybackValidationMessage {
            saveError = message
            return
        }

        isSaving = true
        defer { isSaving = false }
        let didSave: Bool

        let singleIndices = singledOutIndices.sorted()
        let bulkIndices = Set(0..<drafts.count).subtracting(singledOutIndices).sorted()

        if bulkIndices.isEmpty && singleIndices.count == 1 {
            didSave = await persist(drafts[singleIndices[0]])
        } else if singleIndices.isEmpty && bulkIndices.count == 1 {
            didSave = await persist(drafts[bulkIndices[0]])
        } else {
            var success = true

            for i in singleIndices {
                success = await persist(drafts[i])
                if !success { break }
            }

            if success, !bulkIndices.isEmpty {
                let bulkDrafts = bulkIndices.map { drafts[$0] }
                if bulkDrafts.count == 1 {
                    success = await persist(bulkDrafts[0])
                } else {
                    let baseIncomingId = bulkDrafts
                        .compactMap(\.baseIncomingId)
                        .first { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                        ?? UUID().uuidString
                    let rows = bulkDrafts.map { draft -> IncomingEditorDraft in
                        var next = draft
                        next.baseIncomingId = baseIncomingId
                        next.subIncomingId = next.subIncomingId ?? UUID().uuidString
                        if next.incomingId.isEmpty { next.incomingId = UUID().uuidString }
                        return next
                    }
                    if rows.allSatisfy({ $0.id == nil }) {
                        success = await viewModel.bulkCreateIncomings(rows)
                    } else {
                        for row in rows {
                            success = await persist(row)
                            if !success { break }
                        }
                    }
                }
            }

            didSave = success
        }

        if didSave {
            dismiss()
        } else {
            saveError = viewModel.alertText ?? "Please check your connection and try again."
            viewModel.alertText = nil
        }
    }

    private func persist(_ draft: IncomingEditorDraft) async -> Bool {
        if draft.id == nil {
            return await viewModel.createIncoming(draft)
        }
        return await viewModel.updateIncoming(draft)
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

    private var paybackValidationMessage: String? {
        for (index, draft) in drafts.enumerated() {
            if let message = PaybackLinkDraftValidation.message(for: draft.paybackLinks) {
                return drafts.count == 1 ? message : "Entry \(index + 1): \(message)"
            }
        }
        return nil
    }

    private func loadPaybackCandidates() async {
        guard paybackCandidates.isEmpty, !isLoadingPaybackCandidates else { return }
        isLoadingPaybackCandidates = true
        defer { isLoadingPaybackCandidates = false }

        do {
            let loaded = try await viewModel.paybackCandidates()
            var seenIDs: Set<String> = []
            var merged: [PaybackCandidate] = []

            for link in drafts.flatMap(\.paybackLinks) {
                guard let id = link.counterpartyID,
                      let title = link.counterpartyTitle,
                      seenIDs.insert(id).inserted else {
                    continue
                }
                merged.append(.init(id: id, title: title))
            }
            merged.append(contentsOf: loaded.filter { seenIDs.insert($0.id).inserted })
            paybackCandidates = merged
            paybackCandidateError = nil
        } catch is CancellationError {
            return
        } catch {
            paybackCandidateError = "Couldn't load payback names. Check your connection and try again."
        }
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
            subIncomingId: nil,
            paybackLinks: []
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

struct LedgerRowID: Identifiable {
    let id: String
}

private func monthSummaryLabel(_ months: [MonthYear]) -> String {
    let sorted = months.sorted()
    guard let first = sorted.first, let last = sorted.last else { return "—" }
    guard first != last else { return first.abbreviatedLabel }
    let total = LedgerScopeLogic.targetMonths(startDate: LedgerScopeLogic.monthBounds(for: first)!.start, endDate: LedgerScopeLogic.monthBounds(for: last)!.start).count
    let label = "\(first.abbreviatedLabel) – \(last.abbreviatedLabel)"
    if sorted.count < total {
        return "\(label) (\(sorted.count) of \(total))"
    }
    return label
}
