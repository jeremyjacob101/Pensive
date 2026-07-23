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

private struct PaybackLinksSheetTarget: Identifiable {
    let target: PaybackTarget

    var id: String {
        switch target {
        case .expense(let id): return "expense-\(id)"
        case .incoming(let id): return "incoming-\(id)"
        }
    }
}

private struct LedgerScreen: View {
    @ObservedObject var viewModel: LedgerFeatureViewModel

    @State private var showCreate = false
    @State private var showSearch = false
    @State private var showFilters = false
    @State private var showDateRange = false
    @State private var editingID: LedgerRowID?
    @State private var deleteID: String?
    @State private var selectedPartnerAnchorID: LedgerRowID?
    @State private var selectedPaybackLinksTarget: PaybackLinksSheetTarget?
    @State private var showAppliedThisMonthPaidDifferent = false
    @State private var showPaidThisMonthAppliedDifferent = false
    @State private var showNetZero = false

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

                if !appliedThisMonthPaidDifferentRows.isEmpty || !paidThisMonthAppliedDifferentRows.isEmpty || !netZeroRows.isEmpty {
                    Section {
                        if !appliedThisMonthPaidDifferentRows.isEmpty {
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

                        if !paidThisMonthAppliedDifferentRows.isEmpty {
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

                        if !netZeroRows.isEmpty {
                            DisclosureGroup(
                                isExpanded: $showNetZero,
                                content: {
                                    ForEach(netZeroRows, id: \.listIdentity) { row in
                                        ledgerRow(row)
                                    }
                                },
                                label: {
                                    HStack {
                                        Text("Net Zero")
                                        Spacer()
                                        Text("(\(netZeroRows.count))")
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            )
                        }
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
                initialMode: viewModel.scope.includeMonthYearOverlapOutsideDate ? .months : .custom,
                onApplyRange: { startDate, endDate, mode in
                    viewModel.setScope(DateScope(
                        startDate: startDate,
                        endDate: endDate,
                        includeMonthYearOverlapOutsideDate: mode == .months
                    ))
                }
            )
        }
        .sheet(isPresented: $showCreate) {
            if viewModel.kind == .expense {
                ExpenseEditorSheet(viewModel: viewModel, initialDraft: ExpenseEditorDraft(id: nil, expense: "", account: "", category: "", subcategory: nil, amount: 0, effectiveAmount: 0, effectiveAmountMode: .auto, monthYears: LedgerScopeLogic.targetMonths(startDate: Date(), endDate: Date()), date: Date(), paidTo: "", notes: nil, comments: nil, expenseId: UUID().uuidString, baseExpenseId: nil, baseExpenseLabel: nil, subExpenseId: nil), mode: .create)
            } else {
                IncomingEditorSheet(viewModel: viewModel, initialDraft: IncomingEditorDraft(id: nil, incoming: "", paidBy: "", incomeType: "", incomeSubtype: nil, account: "", amount: 0, effectiveAmount: 0, effectiveAmountMode: .auto, monthYears: LedgerScopeLogic.targetMonths(startDate: Date(), endDate: Date()), date: Date(), notes: nil, comments: nil, incomingId: UUID().uuidString, baseIncomingId: nil, subIncomingId: nil), mode: .create)
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
        .sheet(item: $selectedPaybackLinksTarget) { selection in
            PaybackLinksManagerView(target: selection.target, viewModel: viewModel)
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
        viewModel.rows.filter { $0.scopeStatus == .full && !$0.isNetZero }
    }

    private var netZeroRows: [LedgerItemViewData] {
        viewModel.rows.filter { $0.isNetZero }
    }

    private func shiftScopeByMonth(_ value: Int) {
        showAppliedThisMonthPaidDifferent = false
        showPaidThisMonthAppliedDifferent = false
        viewModel.setScope(viewModel.scope.shiftedByMonths(value))
    }

    @ViewBuilder
    private func ledgerRow(_ row: LedgerItemViewData) -> some View {
        DisclosureGroup {
            accountCounterpartyRow(row)

            HStack(spacing: 4) {
                Circle()
                    .fill(color(from: row.categoryColorHex) ?? Color.secondary)
                    .frame(width: 8, height: 8)
                    .overlay {
                        Circle()
                            .strokeBorder(Color.primary.opacity(0.12), lineWidth: 1)
                    }
                    .accessibilityHidden(true)
                Text("\(viewModel.kind == .expense ? "Category" : "Type"): \(row.categoryLabel)")
            }
            .font(.footnote)

            ForEach(row.details, id: \.self) { detail in
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }

            HStack {
                Spacer()
                Button {
                    editingID = LedgerRowID(id: row.id)
                } label: {
                    Text("Edit")
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("ledger_edit_\(row.id)")

                Button(role: .destructive) {
                    deleteID = row.id
                } label: {
                    Text("Delete")
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .accessibilityIdentifier("ledger_delete_\(row.id)")
            }
            .alignmentGuide(.listRowSeparatorLeading) { $0[.leading] + 16 }
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
                HStack(spacing: 2) {
                    Text(row.effectiveAmountLine).font(.subheadline.weight(.medium))
                    if let suffix = row.rawAmountSuffix {
                        Text(suffix).font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                    }
                    if let bracket = row.totalRawBracket {
                        Text(bracket).font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                    }
                }
                Text(row.dateLine).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .swipeActions {
            Button("Edit") { editingID = LedgerRowID(id: row.id) }.tint(.blue)
            Button(role: .destructive) { deleteID = row.id } label: { Text("Delete") }
        }
    }

    private func accountCounterpartyRow(_ row: LedgerItemViewData) -> some View {
        VStack(spacing: 6) {
            if viewModel.kind == .expense {
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

    private func accountRow(_ row: LedgerItemViewData) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "creditcard.fill")
                .foregroundStyle(color(from: row.accountColorHex) ?? Color.secondary)
            Text(row.accountName)
        }
    }

    private func counterpartyRow(_ row: LedgerItemViewData) -> some View {
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
}
