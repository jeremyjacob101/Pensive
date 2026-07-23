import SwiftUI

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

private struct BreakdownFilterSheet: View {
    private struct SelectionState {
        let availableValues: Set<String>
        let selectedValues: Set<String>

        private var selectedAvailableValues: Set<String> {
            selectedValues.intersection(availableValues)
        }

        var canSelectAll: Bool {
            !availableValues.isEmpty && selectedAvailableValues.count < availableValues.count
        }

        var canDeselectAll: Bool {
            !selectedAvailableValues.isEmpty
        }
    }

    @Environment(\.dismiss) private var dismiss
    @ObservedObject var expenseVM: LedgerFeatureViewModel
    @ObservedObject var incomingVM: LedgerFeatureViewModel

    @State private var filterKind: LedgerKind = .expense
    @State private var selectedTab: LedgerFilterTab = .account

    private var activeVM: LedgerFeatureViewModel {
        filterKind == .expense ? expenseVM : incomingVM
    }

    var body: some View {
        NavigationStack {
            List {
                Picker("Type", selection: $filterKind) {
                    Text("Expenses").tag(LedgerKind.expense)
                    Text("Incomings").tag(LedgerKind.incoming)
                }
                .pickerStyle(.segmented)

                Picker("Filter", selection: $selectedTab) {
                    Text("Account").tag(LedgerFilterTab.account)
                    Text(activeVM.kind == .incoming ? "Income Type" : "Category").tag(LedgerFilterTab.category)
                }
                .pickerStyle(.segmented)

                if selectedTab == .account {
                    Section {
                        HStack {
                            if accountSelectionState.canSelectAll {
                                Button("Select All") {
                                    updateAccountSelection(selectAll: true)
                                }
                                .buttonStyle(.borderless)
                            } else {
                                Text("Select All")
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if accountSelectionState.canDeselectAll {
                                Button("Deselect All") {
                                    updateAccountSelection(selectAll: false)
                                }
                                .buttonStyle(.borderless)
                            } else {
                                Text("Deselect All")
                                    .foregroundStyle(.secondary)
                            }
                        }

                        ForEach(accountValues, id: \.self) { account in
                            LedgerAccountFilterRow(
                                value: account,
                                colorHex: activeVM.accountColor(for: account),
                                isSelected: isSelectedBinding(for: account)
                            )
                        }
                    }
                } else {
                    Section {
                        HStack {
                            if categorySelectionState.canSelectAll {
                                Button("Select All") {
                                    updateCategorySelection(selectAll: true)
                                }
                                .buttonStyle(.borderless)
                            } else {
                                Text("Select All")
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if categorySelectionState.canDeselectAll {
                                Button("Deselect All") {
                                    updateCategorySelection(selectAll: false)
                                }
                                .buttonStyle(.borderless)
                            } else {
                                Text("Deselect All")
                                    .foregroundStyle(.secondary)
                            }
                        }

                        ForEach(activeVM.categoryFilterRows) { row in
                            LedgerCategoryFilterRow(
                                row: row,
                                isSelected: isSelectedBinding(for: row.filterKey)
                            )
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func isSelectedBinding(for value: String) -> Binding<Bool> {
        Binding {
            selectedValues.contains(value)
        } set: { _ in
            var next = selectedValues
            if next.contains(value) {
                next.remove(value)
            } else {
                next.insert(value)
            }
            updateSelectedValues(next)
        }
    }

    private var selectedValues: Set<String> {
        if selectedTab == .account {
            return Set(activeVM.selectedAccountFilters.map(normalizedAccount).filter { !$0.isEmpty })
        }
        return activeVM.selectedCategoryFilters
    }

    private func updateSelectedValues(_ values: Set<String>) {
        if selectedTab == .account {
            activeVM.updateAccountFilters(Set(values.map(normalizedAccount).filter { !$0.isEmpty }))
        } else {
            activeVM.updateCategoryFilters(values)
        }
    }

    private var accountValues: [String] {
        Array(Set(activeVM.accountFilterChoices.map(normalizedAccount).filter { !$0.isEmpty })).sorted()
    }

    private func normalizedAccount(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var accountSelectionState: SelectionState {
        SelectionState(availableValues: Set(accountValues), selectedValues: selectedValues)
    }

    private func updateAccountSelection(selectAll: Bool) {
        var next = selectedValues
        let values = Set(accountValues)
        if selectAll {
            next.formUnion(values)
        } else {
            next.subtract(values)
        }
        activeVM.updateAccountFilters(next)
    }

    private var categorySelectionState: SelectionState {
        SelectionState(
            availableValues: Set(activeVM.categoryFilterRows.map(\.filterKey)),
            selectedValues: activeVM.selectedCategoryFilters
        )
    }

    private func updateCategorySelection(selectAll: Bool) {
        var next = activeVM.selectedCategoryFilters
        let values = Set(activeVM.categoryFilterRows.map(\.filterKey))
        if selectAll {
            next.formUnion(values)
        } else {
            next.subtract(values)
        }
        activeVM.updateCategoryFilters(next)
    }
}

struct BreakdownFeatureView: View {
    @StateObject private var expenseVM: LedgerFeatureViewModel
    @StateObject private var incomingVM: LedgerFeatureViewModel

    @State private var showDateRange = false
    @State private var showFilters = false
    @State private var rangeStartDate: Date
    @State private var rangeEndDate: Date

    private let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "ILS"
        f.locale = Locale(identifier: "he_IL")
        return f
    }()

    init(api: ConvexAPI) {
        // Breakdown selections are independent for expenses and incomings, like the web page.
        let expense = LedgerFeatureViewModel(kind: .expense, api: api, filterNamespace: "breakdown")
        let incoming = LedgerFeatureViewModel(kind: .incoming, api: api, filterNamespace: "breakdown")
        _expenseVM = StateObject(wrappedValue: expense)
        _incomingVM = StateObject(wrappedValue: incoming)
        _rangeStartDate = State(initialValue: expense.scope.startDate)
        _rangeEndDate = State(initialValue: expense.scope.endDate)
    }

    var body: some View {
        let isLoading = expenseVM.isScopeLoading || incomingVM.isScopeLoading
        let breakdown = BreakdownPageMath.calculate(
            expenses: expenseVM.breakdownExpenses,
            incomings: incomingVM.breakdownIncomings,
            selectedExpenseAccounts: expenseVM.selectedAccountFilters,
            selectedExpenseCategories: expenseVM.selectedCategoryFilters,
            selectedIncomingAccounts: incomingVM.selectedAccountFilters,
            selectedIncomingTypes: incomingVM.selectedCategoryFilters,
            scope: expenseVM.scope
        )
        let loadingState: ViewLoadState = {
            if case .loading = expenseVM.state { return .loading }
            if case .loading = incomingVM.state { return .loading }
            return expenseVM.state
        }()
        LoadStateView(state: loadingState) {
            List {
                Section {
                    DateScopeNavigatorRow(
                        scope: expenseVM.scope,
                        onCalendar: { showDateRange = true },
                        onShiftMonth: shiftScopeByMonth,
                        onFilter: { showFilters = true },
                        isLoading: isLoading
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 0, trailing: 0))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                    BreakdownMetricCard(
                        title: "TOTAL INCOMINGS",
                        total: money(breakdown.totalIncomings),
                        perMonth: monthly(value: breakdown.totalIncomings, monthCount: breakdown.rows.count),
                        tint: .green
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 14, bottom: 4, trailing: 14))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                    BreakdownMetricCard(
                        title: "TOTAL EXPENSES",
                        total: money(breakdown.totalExpenses),
                        perMonth: monthly(value: breakdown.totalExpenses, monthCount: breakdown.rows.count),
                        tint: .red
                    )
                    .listRowInsets(EdgeInsets(top: 4, leading: 14, bottom: 4, trailing: 14))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                    BreakdownMetricCard(
                        title: "TOTAL SAVINGS",
                        total: money(breakdown.totalSavings),
                        perMonth: monthly(value: breakdown.totalSavings, monthCount: breakdown.rows.count),
                        tint: .blue
                    )
                    .listRowInsets(EdgeInsets(top: 4, leading: 14, bottom: 8, trailing: 14))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
                .listSectionSpacing(16)
                .opacity(isLoading ? 0.66 : 1)
                .overlay {
                    if isLoading {
                        ProgressView()
                            .controlSize(.large)
                    }
                }
                .animation(.easeInOut(duration: 0.18), value: isLoading)

                if !breakdown.rows.isEmpty {
                    Section("Per Month") {
                        ForEach(breakdown.rows) { row in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(DateScope.monthLabel(row.month)).font(.headline)
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading) {
                                        Text("Incomings").font(.caption).foregroundStyle(.secondary)
                                        Text(money(row.incomings)).font(.footnote.weight(.bold))
                                    }
                                    Spacer()
                                    VStack(alignment: .leading) {
                                        Text("Expenses").font(.caption).foregroundStyle(.secondary)
                                        Text(money(row.expenses)).font(.footnote.weight(.bold))
                                    }
                                    Spacer()
                                    VStack(alignment: .leading) {
                                        Text("Savings").font(.caption).foregroundStyle(.secondary)
                                        Text(money(row.savings)).font(.footnote.weight(.bold))
                                            .foregroundStyle(row.savings >= 0 ? .green : .red)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Breakdown")
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await refreshCurrent() }
        }
        .sheet(isPresented: $showFilters) {
            BreakdownFilterSheet(expenseVM: expenseVM, incomingVM: incomingVM)
        }
        .sheet(isPresented: $showDateRange) {
            DateRangePickerSheet(
                startDate: $rangeStartDate,
                endDate: $rangeEndDate,
                oldestMonth: oldestAvailableMonth,
                newestMonth: newestAvailableMonth,
                onApplyRange: { startDate, endDate, _ in
                    let scope = DateScope(startDate: startDate, endDate: endDate, includeMonthYearOverlapOutsideDate: false)
                    setScopeOnBoth(scope)
                    rangeStartDate = startDate
                    rangeEndDate = endDate
                }
            )
        }
        .task {
            expenseVM.onAppear()
            incomingVM.onAppear()
        }
    }

    private func money(_ value: Double) -> String {
        formatter.string(from: NSNumber(value: value)) ?? "₪\(value)"
    }

    private func monthly(value: Double, monthCount: Int) -> String {
        // The web breakdown averages across every calendar month touched by the range,
        // including custom ranges that start or end mid-month.
        guard monthCount > 0 else { return money(value) }
        return money(value / Double(monthCount))
    }

    private func shiftScopeByMonth(_ value: Int) {
        let next = expenseVM.scope.shiftedByMonths(value)
        setScopeOnBoth(next)
    }

    private func setScopeOnBoth(_ scope: DateScope) {
        // Breakdown intentionally includes rows applied to the selected month(s) even when
        // their paid date falls outside a custom date window, matching the web calculation.
        expenseVM.setScope(scope, includeMonthYearOverlapOutsideDate: true)
        incomingVM.setScope(scope, includeMonthYearOverlapOutsideDate: true)
        rangeStartDate = scope.startDate
        rangeEndDate = scope.endDate
    }

    private var oldestAvailableMonth: MonthYear? {
        [expenseVM.oldestMonth, incomingVM.oldestMonth].compactMap { $0 }.min()
    }

    private var newestAvailableMonth: MonthYear? {
        [expenseVM.newestMonth, incomingVM.newestMonth].compactMap { $0 }.max()
    }

    private func refreshCurrent() async {
        await expenseVM.refresh()
        await incomingVM.refresh()
    }
}
