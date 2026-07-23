import SwiftUI

private struct RowID: Identifiable {
    let id: String
}

struct RecurringsFeatureView: View {
    @StateObject private var viewModel: RecurringsFeatureViewModel
    @State private var selectedKind: RecurringKind = .expense
    @State private var showCreate = false
    @State private var editingID: RowID?
    @State private var deleteID: String?

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: RecurringsFeatureViewModel(api: api))
    }

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.refresh() } }) {
            List {
                Section {
                    Picker("Kind", selection: $selectedKind) {
                        Text("Expenses").tag(RecurringKind.expense)
                        Text("Incomings").tag(RecurringKind.incoming)
                    }
                    .pickerStyle(.segmented)
                }

                if selectedRows.isEmpty {
                    Text(selectedKind == .expense ? "No expense recurrings" : "No incoming recurrings")
                        .foregroundStyle(.secondary)
                }

                ForEach(selectedRows) { row in
                    recurringRow(row)
                }
            }
            .refreshable { await viewModel.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showCreate = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showCreate) {
                RecurringEditorSheet(
                    viewModel: viewModel,
                    mode: .create,
                    initialDraft: newDraft(kind: selectedKind)
                )
            }
            .sheet(item: $editingID) { id in
                if let draft = viewModel.draft(for: id.id) {
                    RecurringEditorSheet(viewModel: viewModel, mode: .edit, initialDraft: draft)
                }
            }
            .alert("Delete recurring?", isPresented: Binding(get: { deleteID != nil }, set: { if !$0 { deleteID = nil } })) {
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
        .navigationTitle("Recurrings")
        .navigationBarTitleDisplayMode(.large)
    }

    private var selectedRows: [RecurringItemViewData] {
        selectedKind == .expense ? viewModel.expenseRows : viewModel.incomingRows
    }

    private func newDraft(kind: RecurringKind) -> RecurringEditorDraft {
        .init(
            id: nil,
            status: "active",
            kind: kind,
            name: "",
            amount: 0,
            frequency: "Monthly",
            dayOfMonth: 1,
            recurringExpenseAccount: nil,
            recurringExpenseCategory: nil,
            recurringExpenseSubcategory: nil,
            recurringExpensePaidTo: nil,
            recurringIncomingPaidBy: nil,
            recurringIncomingType: nil,
            recurringIncomingSubtype: nil,
            recurringIncomingAccount: nil,
            notes: nil
        )
    }

    private func recurringRow(_ row: RecurringItemViewData) -> some View {
        DisclosureGroup {
            recurringAccountCounterpartyRow(row)

                ForEach(row.details) { detail in
                    HStack(spacing: 4) {
                        if detail.id == "category" || detail.id == "type" {
                            Circle()
                                .fill(color(from: row.categoryColorHex) ?? Color.secondary)
                                .frame(width: 8, height: 8)
                                .overlay {
                                    Circle()
                                        .strokeBorder(Color.primary.opacity(0.12), lineWidth: 1)
                                }
                                .accessibilityHidden(true)
                        }
                        Text(detail.id == "notes" ? detail.value : "\(detail.label): \(detail.value)")

                    if let subvalue = detail.subvalue, !subvalue.isEmpty {
                        Image(systemName: "arrow.right")
                            .font(.caption)
                            .accessibilityHidden(true)
                        Text(subvalue)
                    }
                }
                .font(.footnote)
                .lineLimit(1)
            }
            recurringActionRow(row)
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(color(from: row.categoryColorHex) ?? Color.secondary)
                        .frame(width: 10, height: 10)
                        .overlay {
                            Circle()
                                .strokeBorder(Color.primary.opacity(0.12), lineWidth: 1)
                        }
                        .accessibilityHidden(true)

                    Text(row.title)
                        .font(.headline)

                    Spacer()
                }
                Text(row.amountLine).font(.subheadline.weight(.medium))
                HStack(spacing: 4) {
                    Image(systemName: "repeat")
                        .font(.caption)
                    Text(ordinal(row.dayOfMonth))
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
            .opacity(row.status.lowercased() == "active" ? 1 : 0.4)
        }
        .swipeActions {
            Button("Edit") { editingID = RowID(id: row.id) }.tint(.blue)
            Button(role: .destructive) { deleteID = row.id } label: { Text("Delete") }
        }
    }

    private func recurringAccountCounterpartyRow(_ row: RecurringItemViewData) -> some View {
        VStack(spacing: 6) {
            if row.kind == .expense {
                accountRow(row)
                directionArrow()
                counterpartyRow(row)
            } else {
                counterpartyRow(row)
                directionArrow()
                accountRow(row)
            }
        }
        .frame(maxWidth: .infinity)
        .multilineTextAlignment(.center)
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    private func accountRow(_ row: RecurringItemViewData) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "creditcard.fill")
                .foregroundStyle(color(from: row.accountColorHex) ?? Color.secondary)
            Text(row.accountName)
        }
    }

    private func counterpartyRow(_ row: RecurringItemViewData) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "person.crop.circle")
                .accessibilityHidden(true)
            Text(row.counterpartyName)
        }
    }

    private func directionArrow() -> some View {
        Image(systemName: "arrow.down")
            .font(.caption.weight(.semibold))
            .accessibilityHidden(true)
    }

    private func recurringActionRow(_ row: RecurringItemViewData) -> some View {
        HStack {
            Spacer()
            Toggle(
                "Active",
                isOn: Binding(
                    get: { row.status.lowercased() == "active" },
                    set: { _ in viewModel.toggleStatus(id: row.id, currentStatus: row.status) }
                )
            )
            .labelsHidden()
            .tint(.green)
            .padding(.trailing, 4)
            .disabled(viewModel.statusInFlightIDs.contains(row.id))

            Button {
                editingID = RowID(id: row.id)
            } label: {
                Text("Edit")
            }
            .buttonStyle(.bordered)

            Button(role: .destructive) {
                deleteID = row.id
            } label: {
                Text("Delete")
            }
            .buttonStyle(.bordered)
            .tint(.red)
        }
    }

    private func color(from hex: String?) -> Color? {
        guard let hex else { return nil }
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        return Color(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }

    private func ordinal(_ n: Int) -> String {
        let suffix: String
        let mod100 = n % 100
        if mod100 >= 11 && mod100 <= 13 {
            suffix = "th"
        } else {
            switch n % 10 {
            case 1: suffix = "st"
            case 2: suffix = "nd"
            case 3: suffix = "rd"
            default: suffix = "th"
            }
        }
        return "\(n)\(suffix)"
    }
}

private enum RecurringEditorMode { case create, edit }

private struct RecurringEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: RecurringsFeatureViewModel
    let mode: RecurringEditorMode
    @State private var draft: RecurringEditorDraft
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var showDayWarning = false

    init(viewModel: RecurringsFeatureViewModel, mode: RecurringEditorMode, initialDraft: RecurringEditorDraft) {
        self.viewModel = viewModel
        self.mode = mode
        _draft = State(initialValue: initialDraft)
    }

    var body: some View {
        NavigationStack {
            Form {
                if mode == .create {
                    Picker("Type", selection: $draft.kind) {
                        Text("Expense").tag(RecurringKind.expense)
                        Text("Incoming").tag(RecurringKind.incoming)
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    .onChange(of: draft.kind) { _, newKind in
                        clearFields(for: newKind)
                    }
                }
                Toggle(
                    "Active",
                    isOn: Binding(
                        get: { draft.status.lowercased() == "active" },
                        set: { draft.status = $0 ? "active" : "inactive" }
                    )
                )
                .tint(.green)
                FormFieldRow(label: "Name") {
                    TextField("Name", text: $draft.name)
                }
                FormFieldRow(label: "Amount") {
                    TextField("Amount", text: amountBinding)
                        .keyboardType(.decimalPad)
                }
                FormFieldRow(label: "Day of Month") {
                    TextField("1–31", text: dayOfMonthBinding)
                        .keyboardType(.numberPad)
                }
                UserOptionPicker(
                    title: "Account",
                    options: viewModel.accountOptions,
                    selection: accountBinding
                )

                if draft.kind == .expense {
                    UserOptionPicker(
                        title: "Category",
                        options: viewModel.categoryOptions,
                        selection: expenseCategoryBinding
                    )
                    let subcategories = viewModel.subcategoryOptions.filter {
                        $0.parentValue == draft.recurringExpenseCategory
                    }
                    if !subcategories.isEmpty {
                        UserOptionPicker(
                            title: "Subcategory",
                            options: subcategories,
                            selection: bindingOptional(\.recurringExpenseSubcategory),
                            showNone: true
                        )
                    }
                } else {
                    UserOptionPicker(
                        title: "Type",
                        options: viewModel.incomeTypeOptions,
                        selection: incomeTypeBinding
                    )
                    let subtypes = viewModel.incomeSubtypeOptions.filter {
                        $0.parentValue == draft.recurringIncomingType
                    }
                    if !subtypes.isEmpty {
                        UserOptionPicker(
                            title: "Subtype",
                            options: subtypes,
                            selection: bindingOptional(\.recurringIncomingSubtype),
                            showNone: true
                        )
                    }
                }

                if draft.kind == .expense {
                    FormFieldRow(label: "Paid To") {
                        TextField("Paid To", text: bindingOptional(\.recurringExpensePaidTo))
                    }
                } else {
                    FormFieldRow(label: "Paid By") {
                        TextField("Paid By", text: bindingOptional(\.recurringIncomingPaidBy))
                    }
                }

                FormFieldRow(label: "Notes") {
                    TextField("Notes", text: bindingOptional(\.notes))
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(mode == .create ? "New Recurring" : "Edit Recurring")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(mode == .create ? "Create" : "Save") {
                        submit()
                    }
                    .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .confirmationDialog(
                "Day \(draft.dayOfMonth) warning",
                isPresented: $showDayWarning,
                titleVisibility: .visible
            ) {
                Button(mode == .create ? "Still Create" : "Still Save") {
                    Task { await save() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Recurring expenses on day \(draft.dayOfMonth) will not apply in months with fewer than \(draft.dayOfMonth) days.")
            }
        }
        .alert("Couldn't save recurring", isPresented: Binding(get: { saveError != nil }, set: { if !$0 { saveError = nil } })) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private func bindingOptional(_ keyPath: WritableKeyPath<RecurringEditorDraft, String?>) -> Binding<String> {
        Binding(get: { draft[keyPath: keyPath] ?? "" }, set: { draft[keyPath: keyPath] = $0.isEmpty ? nil : $0 })
    }

    private var accountBinding: Binding<String> {
        if draft.kind == .expense {
            return bindingOptional(\.recurringExpenseAccount)
        }
        return bindingOptional(\.recurringIncomingAccount)
    }

    private var amountBinding: Binding<String> {
        Binding(
            get: {
                draft.amount == 0
                    ? ""
                    : draft.amount.formatted(.number.precision(.fractionLength(0 ... 2)))
            },
            set: { draft.amount = Double($0) ?? 0 }
        )
    }

    private var dayOfMonthBinding: Binding<String> {
        Binding(
            get: { draft.dayOfMonth == 0 ? "" : String(draft.dayOfMonth) },
            set: { value in
                let digits = value.filter(\.isNumber)
                draft.dayOfMonth = Int(digits) ?? 0
            }
        )
    }

    private var expenseCategoryBinding: Binding<String> {
        Binding(
            get: { draft.recurringExpenseCategory ?? "" },
            set: { value in
                draft.recurringExpenseCategory = value.isEmpty ? nil : value
                if let subcategory = draft.recurringExpenseSubcategory,
                   !viewModel.subcategoryOptions.contains(where: {
                       $0.value == subcategory && $0.parentValue == value
                   }) {
                    draft.recurringExpenseSubcategory = nil
                }
            }
        )
    }

    private var incomeTypeBinding: Binding<String> {
        Binding(
            get: { draft.recurringIncomingType ?? "" },
            set: { value in
                draft.recurringIncomingType = value.isEmpty ? nil : value
                if let subtype = draft.recurringIncomingSubtype,
                   !viewModel.incomeSubtypeOptions.contains(where: {
                       $0.value == subtype && $0.parentValue == value
                   }) {
                    draft.recurringIncomingSubtype = nil
                }
            }
        )
    }

    private func clearFields(for kind: RecurringKind) {
        if kind == .expense {
            draft.recurringIncomingPaidBy = nil
            draft.recurringIncomingType = nil
            draft.recurringIncomingSubtype = nil
            draft.recurringIncomingAccount = nil
        } else {
            draft.recurringExpenseAccount = nil
            draft.recurringExpenseCategory = nil
            draft.recurringExpenseSubcategory = nil
            draft.recurringExpensePaidTo = nil
        }
    }

    private func submit() {
        if draft.kind == .expense, draft.dayOfMonth > 28 {
            showDayWarning = true
        } else {
            Task { await save() }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let didSave = mode == .create
            ? await viewModel.create(draft)
            : await viewModel.update(draft)
        if didSave {
            dismiss()
        } else {
            saveError = viewModel.alertText ?? "Please check your connection and try again."
            viewModel.alertText = nil
        }
    }
}
