import SwiftUI

@MainActor
final class LedgerFeatureViewModel: ObservableObject {
    @Published private(set) var state: ViewLoadState = .loading
    @Published private(set) var rows: [LedgerItemViewData] = []
    @Published var searchText: String = ""
    @Published var selectedFilters: Set<String> = []
    @Published var scope: DateScope
    @Published var isSaving = false
    @Published private(set) var isScopeLoading = false
    @Published var alertText: String?
    @Published private(set) var optionsByKind: [String: [UserOptionRow]] = [:]
    @Published var breakdownMode: BreakdownMode = .category
    @Published private(set) var oldestMonth: MonthYear?
    @Published private(set) var newestMonth: MonthYear?

    let kind: LedgerKind
    let api: ConvexAPI

    private let filterStore: LedgerFilterStoring
    private let calendar: Calendar
    private let currencyFormatter: NumberFormatter
    private let filterKey: String

    private var expenses: [Expense] = []
    private var incomings: [Incoming] = []
    private var scopeRefreshTask: Task<Void, Never>?
    private var activeRefreshID = UUID()

    enum BreakdownMode: String, CaseIterable {
        case category
        case subcategory
    }

    init(kind: LedgerKind, api: ConvexAPI, filterStore: LedgerFilterStoring = LedgerFilterStore(), calendar: Calendar = LedgerScopeLogic.calendar) {
        self.kind = kind
        self.api = api
        self.filterStore = filterStore
        self.calendar = calendar
        self.filterKey = "ledger.filters.\(kind.rawValue)"
        self.selectedFilters = filterStore.load(for: filterKey)

        let today = Date()
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: today)) ?? today
        let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? today
        self.scope = DateScope(startDate: monthStart, endDate: monthEnd, includeMonthYearOverlapOutsideDate: true)

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "ILS"
        formatter.locale = Locale(identifier: "he_IL")
        self.currencyFormatter = formatter
    }

    func onAppear() {
        if rows.isEmpty {
            Task {
                await refresh()
                await loadMonthBounds()
                await loadOptions()
            }
        }
    }

    func refresh() async {
        let refreshID = UUID()
        activeRefreshID = refreshID
        let hadRenderableState: Bool
        switch state {
        case .content, .empty:
            hadRenderableState = true
        default:
            hadRenderableState = false
        }
        if !hadRenderableState {
            state = .loading
        } else {
            isScopeLoading = true
        }
        defer {
            if activeRefreshID == refreshID {
                isScopeLoading = false
            }
        }
        do {
            switch kind {
            case .expense:
                let loadedExpenses = try await api.expenses.listByDateScope(scope.request(calendar: calendar)).map(Expense.init)
                guard !Task.isCancelled, activeRefreshID == refreshID else { return }
                expenses = loadedExpenses
            case .incoming:
                let loadedIncomings = try await api.incomings.listByDateScope(scope.request(calendar: calendar)).map(Incoming.init)
                guard !Task.isCancelled, activeRefreshID == refreshID else { return }
                incomings = loadedIncomings
            }
            applyFiltersAndSearch()
        } catch {
            if isCancellationLike(error) {
                return
            }
            state = .error(message: message(for: error))
        }
    }

    func loadMonthBounds() async {
        do {
            let bounds: MonthBoundsResponse
            switch kind {
            case .expense:
                bounds = try await api.expenses.monthBounds()
            case .incoming:
                bounds = try await api.incomings.monthBounds()
            }
            oldestMonth = bounds.oldestMonth.flatMap(MonthYear.init)
            newestMonth = bounds.newestMonth.flatMap(MonthYear.init)
        } catch {
            alertText = message(for: error)
        }
    }

    func loadOptions() async {
        do {
            let options = try await api.userOptions.list()
            optionsByKind = [
                "account": options.account,
                "category": options.category,
                "subcategory": options.subcategory,
                "incomeType": options.incomeType,
                "incomeSubtype": options.incomeSubtype
            ]
            if selectedFilters.isEmpty {
                selectedFilters = Set(filterChoices)
            }
        } catch {
            alertText = message(for: error)
        }
    }

    func addMissingOption(kind: String, value: String, parentValue: String? = nil) async {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            alertText = "Option name cannot be empty."
            return
        }

        do {
            try await api.userOptions.add(.init(kind: kind, value: trimmed, parentValue: parentValue))
            await loadOptions()
        } catch {
            alertText = message(for: error)
        }
    }

    func updateScope() {
        setScope(scope)
    }

    func setScope(_ nextScope: DateScope) {
        let next = normalizedScope(nextScope)
        let didChange = next != scope
        scope = next

        scopeRefreshTask?.cancel()
        scopeRefreshTask = Task { await refresh() }

        if !didChange, !isScopeLoading {
            isScopeLoading = true
        }
    }

    func updateFilters(_ values: Set<String>) {
        selectedFilters = values
        filterStore.save(values, for: filterKey)
        applyFiltersAndSearch()
    }

    func applySearch(_ value: String) {
        searchText = value
        applyFiltersAndSearch()
    }

    func updateBreakdownMode(_ mode: BreakdownMode) {
        breakdownMode = mode
    }

    func jumpToOldestMonth() {
        guard let oldestMonth else { return }
        updateScope(to: oldestMonth)
    }

    func jumpToNewestMonth() {
        guard let newestMonth else { return }
        updateScope(to: newestMonth)
    }

    var breakdownSummary: LedgerBreakdownSummary {
        switch kind {
        case .expense:
            let filtered = LedgerFiltering.filterExpenses(expenses, selected: selectedFilters, searchText: searchText)
            return makeExpenseBreakdownSummary(rows: filtered, mode: breakdownMode)
        case .incoming:
            let filtered = LedgerFiltering.filterIncomings(incomings, selected: selectedFilters, searchText: searchText)
            return makeIncomingBreakdownSummary(rows: filtered, mode: breakdownMode)
        }
    }

    var filteredTotalEffective: Double {
        breakdownSummary.totalEffective
    }

    struct MonthlyBreakdownRow {
        let month: MonthYear
        let total: Double
    }

    var monthlyFilteredTotals: [MonthlyBreakdownRow] {
        let months = LedgerScopeLogic.targetMonths(startDate: scope.startDate, endDate: scope.endDate)
        let rawRows: [(amount: Double, date: Date, monthYears: [MonthYear])]
        switch kind {
        case .expense:
            let filtered = LedgerFiltering.filterExpenses(expenses, selected: selectedFilters, searchText: searchText)
            rawRows = filtered.map { ($0.effectiveAmount, $0.date, $0.monthYears) }
        case .incoming:
            let filtered = LedgerFiltering.filterIncomings(incomings, selected: selectedFilters, searchText: searchText)
            rawRows = filtered.map { ($0.effectiveAmount, $0.date, $0.monthYears) }
        }
        return months.map { month in
            let monthBounds = LedgerScopeLogic.monthBounds(for: month)!
            let monthScope = DateScope(startDate: monthBounds.start, endDate: monthBounds.end, includeMonthYearOverlapOutsideDate: true)
            let total = rawRows.reduce(0) { partial, row in
                partial + LedgerScopeLogic.proportionalContribution(amount: row.amount, date: row.date, monthYears: row.monthYears, scope: monthScope)
            }
            return MonthlyBreakdownRow(month: month, total: total.isFinite ? total : 0)
        }
    }

    var totalEffectiveInScope: Double {
        let rows: [Double]
        switch kind {
        case .expense:
            rows = expenses.map { LedgerScopeLogic.proportionalContribution(amount: $0.effectiveAmount, date: $0.date, monthYears: $0.monthYears, scope: scope) }
        case .incoming:
            rows = incomings.map { LedgerScopeLogic.proportionalContribution(amount: $0.effectiveAmount, date: $0.date, monthYears: $0.monthYears, scope: scope) }
        }
        return rows.filter { $0.isFinite }.reduce(0, +)
    }

    var filterChoices: [String] {
        Array(Set(accountFilterChoices + categoryFilterRows.map(\.value))).sorted()
    }

    var accountFilterChoices: [String] {
        let fromData: Set<String>
        switch kind {
        case .expense:
            fromData = Set(expenses.map(\.account).filter { !$0.isEmpty })
        case .incoming:
            fromData = Set(incomings.map(\.account).filter { !$0.isEmpty })
        }
        let fromOptions = Set((optionsByKind["account"] ?? []).map(\.value))
        return Array(fromData.union(fromOptions)).sorted()
    }

    func accountColor(for value: String) -> String? {
        optionsByKind["account"]?.first(where: { $0.value == value })?.color
    }

    var categoryFilterRows: [LedgerFilterOptionRow] {
        switch kind {
        case .expense:
            return nestedFilterRows(parents: optionsByKind["category"] ?? [], children: optionsByKind["subcategory"] ?? [])
        case .incoming:
            return nestedFilterRows(parents: optionsByKind["incomeType"] ?? [], children: optionsByKind["incomeSubtype"] ?? [])
        }
    }

    func createExpense(_ draft: ExpenseEditorDraft) {
        guard kind == .expense else { return }
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                _ = try await api.expenses.create(expenseCreateDTO(from: draft))
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func updateExpense(_ draft: ExpenseEditorDraft) {
        guard kind == .expense, let id = draft.id else { return }
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                _ = try await api.expenses.update(expenseUpdateDTO(from: draft, id: id))
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func bulkCreateExpenses(_ drafts: [ExpenseEditorDraft]) {
        guard kind == .expense else { return }
        Task {
            do {
                _ = try await api.expenses.bulkCreate(rows: drafts.map(expenseCreateDTO))
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func createIncoming(_ draft: IncomingEditorDraft) {
        guard kind == .incoming else { return }
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                _ = try await api.incomings.create(incomingCreateDTO(from: draft))
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func updateIncoming(_ draft: IncomingEditorDraft) {
        guard kind == .incoming, let id = draft.id else { return }
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                _ = try await api.incomings.update(incomingUpdateDTO(from: draft, id: id))
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func bulkCreateIncomings(_ drafts: [IncomingEditorDraft]) {
        guard kind == .incoming else { return }
        Task {
            do {
                _ = try await api.incomings.bulkCreate(rows: drafts.map(incomingCreateDTO))
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func delete(id: String) {
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                switch kind {
                case .expense:
                    _ = try await api.expenses.remove(id: DocumentID(id))
                case .incoming:
                    _ = try await api.incomings.remove(id: DocumentID(id))
                }
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func addPartner(anchorID: String, partnerID: String) {
        Task {
            do {
                switch kind {
                case .expense:
                    _ = try await api.expenses.addPartnerExpense(.init(anchorExpenseId: anchorID, partnerExpenseId: partnerID))
                case .incoming:
                    _ = try await api.incomings.addPartnerIncoming(.init(anchorIncomingId: anchorID, partnerIncomingId: partnerID))
                }
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func unlinkPartner(id: String) {
        Task {
            do {
                switch kind {
                case .expense:
                    _ = try await api.expenses.unlinkExpenseFromPartners(.init(expenseId: id))
                case .incoming:
                    _ = try await api.incomings.unlinkIncomingFromPartners(.init(incomingId: id))
                }
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func renameExpenseBaseGroup(baseID: String, label: String) {
        guard kind == .expense else { return }
        Task {
            do {
                _ = try await api.expenses.renameBaseExpense(.init(baseExpenseId: baseID, baseExpenseLabel: label))
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func removeExpenseBaseGroup(baseID: String) {
        guard kind == .expense else { return }
        Task {
            do {
                _ = try await api.expenses.removeBaseExpense(.init(baseExpenseId: baseID))
                await refresh()
            } catch {
                alertText = message(for: error)
            }
        }
    }

    func partnerCandidates(excluding id: String) -> [LedgerItemViewData] {
        rows.filter { $0.id != id }
    }

    func loadPaybackLinks(for target: PaybackTarget) async throws -> [PaybackLinkViewData] {
        switch target {
        case .expense(let id):
            return try await api.paybackLinks.listForExpense(.init(expenseId: id)).map {
                PaybackLinkViewData(id: $0._id, counterpartyTitle: $0.incoming.incoming, allocatedAmount: $0.allocatedAmount, notes: $0.notes)
            }
        case .incoming(let id):
            return try await api.paybackLinks.listForIncoming(.init(incomingId: id)).map {
                PaybackLinkViewData(id: $0._id, counterpartyTitle: $0.expense.expense, allocatedAmount: $0.allocatedAmount, notes: $0.notes)
            }
        }
    }

    func paybackCandidates(for target: PaybackTarget) async throws -> [(id: String, title: String)] {
        switch target {
        case .expense:
            return try await api.paybackLinks.listIncomingCandidates().map { ($0._id, $0.incoming) }
        case .incoming:
            return try await api.paybackLinks.listExpenseCandidates().map { ($0._id, $0.expense) }
        }
    }

    func createPaybackLink(target: PaybackTarget, otherId: String, amount: Double, notes: String?) async throws {
        switch target {
        case .expense(let expenseId):
            _ = try await api.paybackLinks.create(.init(expenseId: expenseId, incomingId: otherId, allocatedAmount: amount, notes: notes))
        case .incoming(let incomingId):
            _ = try await api.paybackLinks.create(.init(expenseId: otherId, incomingId: incomingId, allocatedAmount: amount, notes: notes))
        }
        await refresh()
    }

    func updatePaybackLink(id: String, amount: Double, notes: String?) async throws {
        _ = try await api.paybackLinks.update(.init(id: id, allocatedAmount: amount, notes: notes))
        await refresh()
    }

    func removePaybackLink(id: String) async throws {
        _ = try await api.paybackLinks.remove(.init(id: id))
        await refresh()
    }

    func expenseDraft(id: String) -> ExpenseEditorDraft? {
        guard let item = expenses.first(where: { $0.id == id }) else { return nil }
        return ExpenseEditorDraft(
            id: item.id,
            expense: item.name,
            account: item.account,
            category: item.category,
            subcategory: item.subcategory,
            amount: item.amount,
            effectiveAmount: item.effectiveAmount,
            effectiveAmountMode: item.effectiveAmountMode,
            date: item.date,
            paidTo: item.paidTo,
            notes: item.notes,
            comments: item.comments,
            expenseId: item.expenseId,
            baseExpenseId: item.baseExpenseId,
            baseExpenseLabel: item.baseExpenseLabel,
            subExpenseId: item.subExpenseId
        )
    }

    func incomingDraft(id: String) -> IncomingEditorDraft? {
        guard let item = incomings.first(where: { $0.id == id }) else { return nil }
        return IncomingEditorDraft(
            id: item.id,
            incoming: item.name,
            paidBy: item.paidBy,
            incomeType: item.incomeType,
            incomeSubtype: item.incomeSubtype,
            account: item.account,
            amount: item.amount,
            effectiveAmount: item.effectiveAmount,
            effectiveAmountMode: item.effectiveAmountMode,
            date: item.date,
            notes: item.notes,
            comments: item.comments,
            incomingId: item.incomingId,
            baseIncomingId: item.baseIncomingId,
            subIncomingId: item.subIncomingId
        )
    }

    private func applyFiltersAndSearch() {
        switch kind {
        case .expense:
            rows = LedgerFiltering.filterExpenses(expenses, selected: selectedFilters, searchText: searchText).map(expenseRow)
        case .incoming:
            rows = LedgerFiltering.filterIncomings(incomings, selected: selectedFilters, searchText: searchText).map(incomingRow)
        }
        state = .content
    }

    private func nestedFilterRows(parents: [UserOptionRow], children: [UserOptionRow]) -> [LedgerFilterOptionRow] {
        let sortedParents = parents.sorted { lhs, rhs in
            lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
        }
        let childrenByParent = Dictionary(grouping: children) { row in
            row.parentValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }
        var displayedChildKeys: Set<String> = []
        var rows: [LedgerFilterOptionRow] = []

        for parent in sortedParents {
            rows.append(.init(value: parent.value, color: parent.color, parentValue: nil, indentationLevel: 0))
            let sortedChildren = (childrenByParent[parent.value] ?? []).sorted { lhs, rhs in
                lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            for child in sortedChildren {
                displayedChildKeys.insert("\(child.parentValue ?? "")|\(child.value)")
                rows.append(.init(value: child.value, color: child.color, parentValue: child.parentValue, indentationLevel: 1))
            }
        }

        let orphanChildren = children
            .filter { !displayedChildKeys.contains("\($0.parentValue ?? "")|\($0.value)") }
            .sorted { lhs, rhs in
                if lhs.parentValue == rhs.parentValue {
                    return lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
                }
                return (lhs.parentValue ?? "") < (rhs.parentValue ?? "")
            }
        rows.append(contentsOf: orphanChildren.map {
            LedgerFilterOptionRow(value: $0.value, color: $0.color, parentValue: $0.parentValue, indentationLevel: 0)
        })

        return rows
    }


    private func updateScope(to month: MonthYear) {
        guard let bounds = LedgerScopeLogic.monthBounds(for: month, calendar: calendar) else { return }
        setScope(DateScope(
            startDate: bounds.start,
            endDate: bounds.end,
            includeMonthYearOverlapOutsideDate: true
        ))
    }

    private func normalizedScope(_ scope: DateScope) -> DateScope {
        let start = min(scope.startDate, scope.endDate)
        let end = max(scope.startDate, scope.endDate)
        let candidate = DateScope(
            startDate: start,
            endDate: end,
            includeMonthYearOverlapOutsideDate: scope.includeMonthYearOverlapOutsideDate
        )
        return DateScope(
            startDate: start,
            endDate: end,
            includeMonthYearOverlapOutsideDate: candidate.isWholeMonthRange
        )
    }

    private func expenseRow(_ item: Expense) -> LedgerItemViewData {
        let status = LedgerScopeLogic.scopeStatus(date: item.date, monthYears: item.monthYears, scope: scope, calendar: calendar)
        let scopedRaw = LedgerScopeLogic.proportionalContribution(amount: item.amount, date: item.date, monthYears: item.monthYears, scope: scope, calendar: calendar)
        let scopedEffective = LedgerScopeLogic.proportionalContribution(amount: item.effectiveAmount, date: item.date, monthYears: item.monthYears, scope: scope, calendar: calendar)
        let partial = LedgerScopeLogic.isPartialMatch(date: item.date, monthYears: item.monthYears, scope: scope, calendar: calendar)
        return LedgerItemViewData(
            id: item.id,
            title: item.name,
            subtitle: [item.account, item.category].filter { !$0.isEmpty }.joined(separator: " • "),
            amountLine: "Raw \(money(scopedRaw)) / Effective \(money(scopedEffective))\(partial ? " (partial)" : "")",
            appliedLine: "Paid: \(date(item.date))",
            scopeStatus: status,
            monthYears: item.monthYears.map(\.rawValue),
            warningText: LedgerFiltering.scopeWarningText(status: status),
            details: ["Paid To: \(item.paidTo)", item.notes.map { "Notes: \($0)" }, item.comments.map { "Comments: \($0)" }].compactMap { $0 },
            isGrouped: item.isGrouped
        )
    }

    private func incomingRow(_ item: Incoming) -> LedgerItemViewData {
        let status = LedgerScopeLogic.scopeStatus(date: item.date, monthYears: item.monthYears, scope: scope, calendar: calendar)
        let scopedRaw = LedgerScopeLogic.proportionalContribution(amount: item.amount, date: item.date, monthYears: item.monthYears, scope: scope, calendar: calendar)
        let scopedEffective = LedgerScopeLogic.proportionalContribution(amount: item.effectiveAmount, date: item.date, monthYears: item.monthYears, scope: scope, calendar: calendar)
        let partial = LedgerScopeLogic.isPartialMatch(date: item.date, monthYears: item.monthYears, scope: scope, calendar: calendar)
        return LedgerItemViewData(
            id: item.id,
            title: item.name,
            subtitle: [item.paidBy, item.incomeType, item.account].filter { !$0.isEmpty }.joined(separator: " • "),
            amountLine: "Raw \(money(scopedRaw)) / Effective \(money(scopedEffective))\(partial ? " (partial)" : "")",
            appliedLine: "Paid: \(date(item.date))",
            scopeStatus: status,
            monthYears: item.monthYears.map(\.rawValue),
            warningText: LedgerFiltering.scopeWarningText(status: status),
            details: [item.notes.map { "Notes: \($0)" }, item.comments.map { "Comments: \($0)" }].compactMap { $0 },
            isGrouped: item.isGrouped
        )
    }

    private func expenseCreateDTO(from draft: ExpenseEditorDraft) -> ExpenseMutationDTO {
        let iso = LedgerScopeLogic.isoDate(draft.date)
        let month = String(iso.prefix(7))
        return ExpenseMutationDTO(expense: draft.expense, account: draft.account, category: draft.category, subcategory: draft.subcategory, amount: draft.amount, effectiveAmount: draft.effectiveAmount, effectiveAmountMode: draft.effectiveAmountMode.rawValue, monthYears: [month], date: iso, paidTo: draft.paidTo, notes: draft.notes, comments: draft.comments, expenseId: draft.expenseId, baseExpenseId: draft.baseExpenseId, baseExpenseLabel: draft.baseExpenseLabel, subExpenseId: draft.subExpenseId)
    }

    private func expenseUpdateDTO(from draft: ExpenseEditorDraft, id: String) -> ExpenseUpdateDTO {
        let create = expenseCreateDTO(from: draft)
        return ExpenseUpdateDTO(id: id, expense: create.expense, account: create.account, category: create.category, subcategory: create.subcategory, amount: create.amount, effectiveAmount: create.effectiveAmount, effectiveAmountMode: create.effectiveAmountMode, monthYears: create.monthYears, date: create.date, paidTo: create.paidTo, notes: create.notes, comments: create.comments, expenseId: create.expenseId, baseExpenseId: create.baseExpenseId, baseExpenseLabel: create.baseExpenseLabel, subExpenseId: create.subExpenseId)
    }

    private func incomingCreateDTO(from draft: IncomingEditorDraft) -> IncomingMutationDTO {
        let iso = LedgerScopeLogic.isoDate(draft.date)
        let month = String(iso.prefix(7))
        return IncomingMutationDTO(incoming: draft.incoming, paidBy: draft.paidBy, incomeType: draft.incomeType, incomeSubtype: draft.incomeSubtype, account: draft.account, amount: draft.amount, effectiveAmount: draft.effectiveAmount, effectiveAmountMode: draft.effectiveAmountMode.rawValue, date: iso, monthYears: [month], notes: draft.notes, comments: draft.comments, incomingId: draft.incomingId, baseIncomingId: draft.baseIncomingId, subIncomingId: draft.subIncomingId)
    }

    private func incomingUpdateDTO(from draft: IncomingEditorDraft, id: String) -> IncomingUpdateDTO {
        let create = incomingCreateDTO(from: draft)
        return IncomingUpdateDTO(id: id, incoming: create.incoming, paidBy: create.paidBy, incomeType: create.incomeType, incomeSubtype: create.incomeSubtype, account: create.account, amount: create.amount, effectiveAmount: create.effectiveAmount, effectiveAmountMode: create.effectiveAmountMode, date: create.date, monthYears: create.monthYears, notes: create.notes, comments: create.comments, incomingId: create.incomingId, baseIncomingId: create.baseIncomingId, subIncomingId: create.subIncomingId)
    }

    private func money(_ value: Double) -> String {
        currencyFormatter.string(from: NSNumber(value: value)) ?? "₪\(value)"
    }

    private func date(_ value: Date) -> String {
        value.formatted(date: .abbreviated, time: .omitted)
    }

    private func message(for error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .validation(let message): return message
            case .unauthorized: return "Your session expired. Please sign in again."
            case .networkUnavailable: return "Network unavailable. Try again."
            case .server(let message): return message
            default: return "Request failed. Try again."
            }
        }
        return "Unexpected error."
    }

    private func isCancellationLike(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled { return true }
        return false
    }

    private func makeExpenseBreakdownSummary(rows: [Expense], mode: BreakdownMode) -> LedgerBreakdownSummary {
        LedgerBreakdownComputing.expenses(rows: rows, mode: mode, scope: scope) { [weak self] key, resolvedMode in
            self?.colorToken(for: key, mode: resolvedMode)
        }
    }

    private func makeIncomingBreakdownSummary(rows: [Incoming], mode: BreakdownMode) -> LedgerBreakdownSummary {
        LedgerBreakdownComputing.incomings(rows: rows, mode: mode, scope: scope) { [weak self] key, resolvedMode in
            self?.colorToken(for: key, mode: resolvedMode)
        }
    }

    private func colorToken(for key: String, mode: BreakdownMode) -> String? {
        switch kind {
        case .expense:
            switch mode {
            case .category:
                return optionsByKind["category"]?.first(where: { $0.value == key })?.color
            case .subcategory:
                return optionsByKind["subcategory"]?.first(where: { $0.value == key })?.color
                    ?? optionsByKind["category"]?.first(where: { $0.value == key })?.color
            }
        case .incoming:
            switch mode {
            case .category:
                return optionsByKind["incomeType"]?.first(where: { $0.value == key })?.color
            case .subcategory:
                return optionsByKind["incomeSubtype"]?.first(where: { $0.value == key })?.color
                    ?? optionsByKind["incomeType"]?.first(where: { $0.value == key })?.color
            }
        }
    }
}
