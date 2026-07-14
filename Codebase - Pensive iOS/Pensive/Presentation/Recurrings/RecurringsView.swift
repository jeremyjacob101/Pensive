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
            frequency: "monthly",
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
            Text(row.scheduleLine).font(.footnote)
            ForEach(row.details, id: \.self) { detail in
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
            HStack {
                Button("Edit") { editingID = RowID(id: row.id) }
                Button(viewModel.statusInFlightIDs.contains(row.id) ? "Updating…" : (row.status.lowercased() == "active" ? "Set inactive" : "Set active")) {
                    viewModel.toggleStatus(id: row.id, currentStatus: row.status)
                }
                .disabled(viewModel.statusInFlightIDs.contains(row.id))
                Button("Delete", role: .destructive) { deleteID = row.id }
            }
            .buttonStyle(.borderless)
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Image(systemName: "creditcard.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(color(from: row.accountColorHex) ?? Color.secondary)
                        .accessibilityHidden(true)

                    Text(row.title)
                        .font(.headline)

                    Circle()
                        .fill(color(from: row.categoryColorHex) ?? Color.secondary)
                        .frame(width: 10, height: 10)
                        .overlay {
                            Circle()
                                .strokeBorder(Color.primary.opacity(0.12), lineWidth: 1)
                        }
                        .accessibilityHidden(true)

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

    init(viewModel: RecurringsFeatureViewModel, mode: RecurringEditorMode, initialDraft: RecurringEditorDraft) {
        self.viewModel = viewModel
        self.mode = mode
        _draft = State(initialValue: initialDraft)
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Kind", selection: $draft.kind) {
                    Text("Expense").tag(RecurringKind.expense)
                    Text("Incoming").tag(RecurringKind.incoming)
                }
                Picker("Status", selection: $draft.status) {
                    Text("Active").tag("active")
                    Text("Inactive").tag("inactive")
                }
                TextField("Name", text: $draft.name)
                TextField("Amount", value: $draft.amount, format: .number)
                TextField("Frequency", text: $draft.frequency)
                Stepper("Day of Month: \(draft.dayOfMonth)", value: $draft.dayOfMonth, in: 1 ... 31)

                if draft.kind == .expense {
                    TextField("Expense Account", text: bindingOptional(\.recurringExpenseAccount))
                    TextField("Expense Category", text: bindingOptional(\.recurringExpenseCategory))
                    TextField("Expense Subcategory", text: bindingOptional(\.recurringExpenseSubcategory))
                    TextField("Paid To", text: bindingOptional(\.recurringExpensePaidTo))
                } else {
                    TextField("Paid By", text: bindingOptional(\.recurringIncomingPaidBy))
                    TextField("Incoming Type", text: bindingOptional(\.recurringIncomingType))
                    TextField("Incoming Subtype", text: bindingOptional(\.recurringIncomingSubtype))
                    TextField("Incoming Account", text: bindingOptional(\.recurringIncomingAccount))
                }

                TextField("Notes", text: bindingOptional(\.notes))
            }
            .navigationTitle(mode == .create ? "New Recurring" : "Edit Recurring")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(mode == .create ? "Create" : "Save") {
                        Task { await save() }
                    }
                    .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
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
