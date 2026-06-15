import SwiftUI
import Charts

struct ExpensesFeatureView: View {
    @StateObject private var viewModel: LedgerFeatureViewModel

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: LedgerFeatureViewModel(kind: .expense, api: api))
    }

    var body: some View {
        LedgerScreen(viewModel: viewModel)
            .navigationTitle("Expenses")
            .navigationBarTitleDisplayMode(.large)
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
            .navigationBarTitleDisplayMode(.large)
    }
}

enum PaybackTarget {
    case expense(String)
    case incoming(String)
}

private struct LedgerScreen: View {
    @ObservedObject var viewModel: LedgerFeatureViewModel

    @State private var showCreate = false
    @State private var showSearch = false
    @State private var showFilters = false
    @State private var showDateRange = false
    @State private var editingID: RowID?
    @State private var deleteID: String?
    @State private var selectedPartnerAnchorID: RowID?
    @State private var showAppliedThisMonthPaidDifferent = false
    @State private var showPaidThisMonthAppliedDifferent = false

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.refresh() } }) {
            List {
                Section {
                    DateScopeNavigatorRow(
                        scope: viewModel.scope,
                        onCalendar: { showDateRange = true },
                        onShiftMonth: shiftScopeByMonth,
                        onFilter: { showFilters = true },
                        isLoading: viewModel.isScopeLoading
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 0, trailing: 0))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                    LedgerBreakdownCard(viewModel: viewModel)
                        .opacity(viewModel.isScopeLoading ? 0.58 : 1)
                        .overlay {
                            if viewModel.isScopeLoading {
                                ProgressView()
                                    .controlSize(.large)
                            }
                        }
                        .animation(.easeInOut(duration: 0.18), value: viewModel.isScopeLoading)
                        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                        .listRowBackground(Color.clear)
                }

                if !appliedThisMonthPaidDifferentRows.isEmpty {
                    Section {
                        DisclosureGroup(
                            isExpanded: $showAppliedThisMonthPaidDifferent,
                            content: {
                                ForEach(appliedThisMonthPaidDifferentRows, id: \.listIdentity) { row in
                                    ledgerRow(row)
                                }
                            },
                            label: {
                                HStack {
                                    Text("Paid Elsewhere")
                                    Spacer()
                                    Text("(\(appliedThisMonthPaidDifferentRows.count))")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        )
                    }
                }

                if !paidThisMonthAppliedDifferentRows.isEmpty {
                    Section {
                        DisclosureGroup(
                            isExpanded: $showPaidThisMonthAppliedDifferent,
                            content: {
                                ForEach(paidThisMonthAppliedDifferentRows, id: \.listIdentity) { row in
                                    ledgerRow(row)
                                }
                            },
                            label: {
                                HStack {
                                    Text("Applied Elsewhere")
                                    Spacer()
                                    Text("(\(paidThisMonthAppliedDifferentRows.count))")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        )
                    }
                }

                ForEach(regularRows, id: \.listIdentity) { row in
                    ledgerRow(row)
                }

                if viewModel.rows.isEmpty {
                    ContentUnavailableView(
                        "No results",
                        systemImage: "line.3.horizontal.decrease.circle",
                        description: Text("Try clearing filters, changing date scope, or editing search.")
                    )
                }
            }
            .refreshable { await viewModel.refresh() }
        }
        .toolbar {
            LedgerToolbarControls(
                onSearch: { showSearch = true },
                onAdd: { showCreate = true },
                addTitle: viewModel.kind == .expense ? "Add Expense" : "Add Incoming"
            )
        }
        .sheet(isPresented: $showSearch) {
            SearchSheet(text: $viewModel.searchText) { viewModel.applySearch($0) }
        }
        .sheet(isPresented: $showFilters) {
            LedgerFilterSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showDateRange) {
            DateRangePickerSheet(
                startDate: $viewModel.scope.startDate,
                endDate: $viewModel.scope.endDate,
                oldestMonth: viewModel.oldestMonth,
                newestMonth: viewModel.newestMonth,
                onApplyRange: { startDate, endDate in
                viewModel.setScope(DateScope(
                    startDate: startDate,
                    endDate: endDate,
                    includeMonthYearOverlapOutsideDate: false
                ))
                }
            )
        }
        .sheet(isPresented: $showCreate) {
            if viewModel.kind == .expense {
                ExpenseEditorSheet(viewModel: viewModel, initialDraft: ExpenseEditorDraft(id: nil, expense: "", account: "", category: "", subcategory: nil, amount: 0, effectiveAmount: 0, effectiveAmountMode: .auto, date: Date(), paidTo: "", notes: nil, comments: nil, expenseId: UUID().uuidString, baseExpenseId: nil, baseExpenseLabel: nil, subExpenseId: nil), mode: .create)
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
        .task { viewModel.onAppear() }
        .alert("Notice", isPresented: Binding(get: { viewModel.alertText != nil }, set: { if !$0 { viewModel.alertText = nil } })) {
            Button("OK", role: .cancel) { viewModel.alertText = nil }
        } message: {
            Text(viewModel.alertText ?? "")
        }
    }

    private var appliedThisMonthPaidDifferentRows: [LedgerItemViewData] {
        viewModel.rows.filter { $0.scopeStatus == .monthYearsOnly }
    }

    private var paidThisMonthAppliedDifferentRows: [LedgerItemViewData] {
        viewModel.rows.filter { $0.scopeStatus == .dateOnly }
    }

    private var regularRows: [LedgerItemViewData] {
        viewModel.rows.filter { $0.scopeStatus == .full }
    }

    private func shiftScopeByMonth(_ value: Int) {
        showAppliedThisMonthPaidDifferent = false
        showPaidThisMonthAppliedDifferent = false
        viewModel.setScope(viewModel.scope.shiftedByMonths(value))
    }

    @ViewBuilder
    private func ledgerRow(_ row: LedgerItemViewData) -> some View {
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
            }
        }
        .swipeActions {
            Button("Edit") { editingID = RowID(id: row.id) }.tint(.blue)
            Button(role: .destructive) { deleteID = row.id } label: { Text("Delete") }
        }
    }
}

private enum LedgerFilterTab: String, CaseIterable, Identifiable {
    case account = "Account"
    case category = "Category"

    var id: String { rawValue }
}

private struct LedgerFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel

    @State private var selectedTab: LedgerFilterTab = .account

    var body: some View {
        NavigationStack {
            List {
                Picker("Filter", selection: $selectedTab) {
                    ForEach(LedgerFilterTab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                if selectedTab == .account {
                    Section {
                        ForEach(viewModel.accountFilterChoices, id: \.self) { account in
                            LedgerAccountFilterRow(
                                value: account,
                                isSelected: isSelectedBinding(for: account)
                            )
                        }
                    }
                } else {
                    Section {
                        HStack {
                            Button("Select All") {
                                updateCategorySelection(selectAll: true)
                            }
                            Spacer()
                            Button("Deselect All") {
                                updateCategorySelection(selectAll: false)
                            }
                        }

                        ForEach(viewModel.categoryFilterRows) { row in
                            LedgerCategoryFilterRow(
                                row: row,
                                isSelected: isSelectedBinding(for: row.value)
                            )
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Clear") { viewModel.updateFilters(Set<String>()) }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func isSelectedBinding(for value: String) -> Binding<Bool> {
        Binding {
            viewModel.selectedFilters.contains(value)
        } set: { isSelected in
            var next = viewModel.selectedFilters
            if isSelected {
                next.insert(value)
            } else {
                next.remove(value)
            }
            viewModel.updateFilters(next)
        }
    }

    private func updateCategorySelection(selectAll: Bool) {
        var next = viewModel.selectedFilters
        let values = Set(viewModel.categoryFilterRows.map(\.value))
        if selectAll {
            next.formUnion(values)
        } else {
            next.subtract(values)
        }
        viewModel.updateFilters(next)
    }
}

private struct LedgerAccountFilterRow: View {
    let value: String
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
                Text(value)
                    .foregroundStyle(.primary)
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct LedgerCategoryFilterRow: View {
    let row: LedgerFilterOptionRow
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
    }

    private func optionColor(from hex: String?) -> Color? {
        guard let hex else { return nil }
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }
}

private struct LedgerBreakdownCard: View {
    @ObservedObject var viewModel: LedgerFeatureViewModel
    private let moneyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "ILS"
        formatter.locale = Locale(identifier: "he_IL")
        return formatter
    }()

    private let fallbackPalette: [Color] = [
        Color(red: 0.71, green: 0.00, blue: 0.00),
        Color(red: 0.18, green: 0.25, blue: 0.91),
        Color(red: 0.16, green: 0.61, blue: 0.88),
        Color(red: 0.92, green: 0.33, blue: 0.34),
        Color(red: 0.98, green: 0.11, blue: 0.10),
        Color(red: 0.10, green: 0.74, blue: 0.11),
        Color(red: 0.82, green: 0.30, blue: 0.78),
        Color(red: 0.29, green: 0.75, blue: 0.88),
        Color(red: 0.53, green: 0.22, blue: 0.92),
        Color(red: 0.35, green: 0.86, blue: 0.68),
        Color(red: 0.95, green: 0.63, blue: 0.10),
        Color(red: 0.84, green: 0.89, blue: 0.14)
    ]

    var body: some View {
        let summary = viewModel.breakdownSummary
        let chartSlices = summary.slices.filter { $0.amount.isFinite && $0.amount > 0 }
        let chartTotal = chartSlices.reduce(0) { $0 + $1.amount }
        let chartIdentity = [
            viewModel.scope.displayLabel,
            viewModel.breakdownMode.rawValue,
            chartSlices.map { "\($0.key):\($0.amount)" }.joined(separator: "|")
        ].joined(separator: "-")
        VStack(alignment: .leading, spacing: 16) {
            Picker("Breakdown Mode", selection: Binding(get: { viewModel.breakdownMode }, set: { viewModel.updateBreakdownMode($0) })) {
                Text("Category").tag(LedgerFeatureViewModel.BreakdownMode.category)
                Text("Subcategory").tag(LedgerFeatureViewModel.BreakdownMode.subcategory)
            }
            .pickerStyle(.segmented)

            if chartSlices.isEmpty || !chartTotal.isFinite || chartTotal <= 0 {
                Text("No rows available for this scope.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Chart(chartSlices) { slice in
                    SectorMark(
                        angle: .value("Amount", slice.amount),
                        innerRadius: .ratio(0.58),
                        outerRadius: .inset(0)
                    )
                    .foregroundStyle(color(for: slice))
                }
                .id(chartIdentity)
                .transaction { transaction in
                    transaction.animation = nil
                }
                .frame(height: 240)
                .chartBackground { _ in
                    VStack(spacing: 4) {
                        Text("TOTAL").font(.caption).foregroundStyle(.secondary)
                        Text(money(summary.totalEffective)).font(.title3.weight(.bold))
                    }
                }

                Divider()

                VStack(spacing: 8) {
                    ForEach(Array(chartSlices.enumerated()), id: \.element.id) { index, slice in
                        HStack {
                            Circle().fill(color(for: slice, fallbackIndex: index)).frame(width: 10, height: 10)
                            Text(slice.label)
                            Spacer()
                            Text(money(slice.amount)).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            HStack {
                Text("Raw: \(money(summary.totalRaw))")
                Spacer()
                Text("Effective: \(money(summary.totalEffective))")
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
        )
    }

    private func money(_ value: Double) -> String {
        moneyFormatter.string(from: NSNumber(value: value)) ?? "₪\(value)"
    }

    private func color(for slice: LedgerBreakdownSlice, fallbackIndex: Int = 0) -> Color {
        if let token = slice.colorToken, let parsed = Color(hex: token) {
            return parsed
        }
        return fallbackPalette[fallbackIndex % fallbackPalette.count]
    }
}

private extension Color {
    init?(hex: String) {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        self.init(red: red, green: green, blue: blue)
    }
}

private enum EditorMode { case create, edit }

private struct ExpenseEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel
    @State private var drafts: [ExpenseEditorDraft]
    @State private var selectedIndex = 0
    let mode: EditorMode

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
            return currentDraft.expense.isEmpty || currentDraft.account.isEmpty || currentDraft.category.isEmpty || currentDraft.paidTo.isEmpty || currentDraft.amount <= 0
        }
        return drafts.isEmpty || drafts.contains { $0.expense.isEmpty || $0.account.isEmpty || $0.category.isEmpty || $0.paidTo.isEmpty || $0.amount <= 0 }
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
