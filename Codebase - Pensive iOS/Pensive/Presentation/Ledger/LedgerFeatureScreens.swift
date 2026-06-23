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
    @State private var editingID: LedgerRowID?
    @State private var deleteID: String?
    @State private var selectedPartnerAnchorID: LedgerRowID?
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
                    editingID = LedgerRowID(id: row.id)
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
                Button("Add partner") { selectedPartnerAnchorID = LedgerRowID(id: row.id) }
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
            Button("Edit") { editingID = LedgerRowID(id: row.id) }.tint(.blue)
            Button(role: .destructive) { deleteID = row.id } label: { Text("Delete") }
        }
    }
}
