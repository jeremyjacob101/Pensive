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
                        ForEach(activeVM.accountFilterChoices, id: \.self) { account in
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
                            Button("Select All") {
                                updateCategorySelection(selectAll: true)
                            }
                            .disabled(allCategoriesSelected)
                            Spacer()
                            Button("Deselect All") {
                                updateCategorySelection(selectAll: false)
                            }
                            .disabled(noCategoriesSelected)
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
        } set: { isSelected in
            var next = selectedValues
            if isSelected {
                next.insert(value)
            } else {
                next.remove(value)
            }
            updateSelectedValues(next)
        }
    }

    private var selectedValues: Set<String> {
        selectedTab == .account ? activeVM.selectedAccountFilters : activeVM.selectedCategoryFilters
    }

    private func updateSelectedValues(_ values: Set<String>) {
        if selectedTab == .account {
            activeVM.updateAccountFilters(values)
        } else {
            activeVM.updateCategoryFilters(values)
        }
    }

    private var allCategoriesSelected: Bool {
        let categoryValues = Set(activeVM.categoryFilterRows.map(\.filterKey))
        return activeVM.selectedCategoryFilters.isSuperset(of: categoryValues)
    }

    private var noCategoriesSelected: Bool {
        let categoryValues = Set(activeVM.categoryFilterRows.map(\.filterKey))
        return activeVM.selectedCategoryFilters.isDisjoint(with: categoryValues)
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
        let expense = LedgerFeatureViewModel(kind: .expense, api: api)
        let incoming = LedgerFeatureViewModel(kind: .incoming, api: api)
        _expenseVM = StateObject(wrappedValue: expense)
        _incomingVM = StateObject(wrappedValue: incoming)
        _rangeStartDate = State(initialValue: expense.scope.startDate)
        _rangeEndDate = State(initialValue: expense.scope.endDate)
    }

    var body: some View {
        let isLoading = expenseVM.isScopeLoading || incomingVM.isScopeLoading
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
                        total: money(incomingVM.filteredTotalEffective),
                        perMonth: monthly(value: incomingVM.filteredTotalEffective),
                        tint: .green
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 14, bottom: 4, trailing: 14))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                    BreakdownMetricCard(
                        title: "TOTAL EXPENSES",
                        total: money(expenseVM.filteredTotalEffective),
                        perMonth: monthly(value: expenseVM.filteredTotalEffective),
                        tint: .red
                    )
                    .listRowInsets(EdgeInsets(top: 4, leading: 14, bottom: 4, trailing: 14))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                    BreakdownMetricCard(
                        title: "TOTAL SAVINGS",
                        total: money(incomingVM.filteredTotalEffective - expenseVM.filteredTotalEffective),
                        perMonth: monthly(value: incomingVM.filteredTotalEffective - expenseVM.filteredTotalEffective),
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

                if !expenseVM.monthlyFilteredTotals.isEmpty || !incomingVM.monthlyFilteredTotals.isEmpty {
                    Section("Per Month") {
                        let scopeMonths = LedgerScopeLogic.targetMonths(startDate: expenseVM.scope.startDate, endDate: expenseVM.scope.endDate)
                        ForEach(scopeMonths, id: \.self) { month in
                            let incomingTotal = incomingVM.monthlyFilteredTotals.first(where: { $0.month == month })?.total ?? 0
                            let expenseTotal = expenseVM.monthlyFilteredTotals.first(where: { $0.month == month })?.total ?? 0
                            let net = incomingTotal - expenseTotal
                            VStack(alignment: .leading, spacing: 6) {
                                Text(DateScope.monthLabel(month)).font(.headline)
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading) {
                                        Text("Incomings").font(.caption).foregroundStyle(.secondary)
                                        Text(money(incomingTotal)).font(.footnote.weight(.bold))
                                    }
                                    Spacer()
                                    VStack(alignment: .leading) {
                                        Text("Expenses").font(.caption).foregroundStyle(.secondary)
                                        Text(money(expenseTotal)).font(.footnote.weight(.bold))
                                    }
                                    Spacer()
                                    VStack(alignment: .leading) {
                                        Text("Savings").font(.caption).foregroundStyle(.secondary)
                                        Text(money(net)).font(.footnote.weight(.bold))
                                            .foregroundStyle(net >= 0 ? .green : .red)
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
                oldestMonth: expenseVM.oldestMonth,
                newestMonth: expenseVM.newestMonth,
                onApplyRange: { startDate, endDate in
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

    private func monthly(value: Double) -> String {
        let months = expenseVM.scope.isWholeMonthRange
            ? LedgerScopeLogic.targetMonths(startDate: expenseVM.scope.startDate, endDate: expenseVM.scope.endDate).count
            : 1
        guard months > 0 else { return money(value) }
        return money(value / Double(months))
    }

    private func shiftScopeByMonth(_ value: Int) {
        let next = expenseVM.scope.shiftedByMonths(value)
        setScopeOnBoth(next)
    }

    private func setScopeOnBoth(_ scope: DateScope) {
        expenseVM.setScope(scope)
        incomingVM.setScope(scope)
        rangeStartDate = scope.startDate
        rangeEndDate = scope.endDate
    }

    private func refreshCurrent() async {
        await expenseVM.refresh()
        await incomingVM.refresh()
    }
}
