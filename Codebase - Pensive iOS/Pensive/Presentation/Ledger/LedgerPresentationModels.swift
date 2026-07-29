import SwiftUI

enum LedgerKind: String {
    case expense
    case incoming
}

struct LedgerItemViewData: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let amountLine: String
    let appliedLine: String
    let scopeStatus: ScopeMatchStatus
    let monthYears: [String]
    let warningText: String?
    let details: [String]
    let isGrouped: Bool
    let groupID: String?
    let groupTitle: String?

    let accountColorHex: String?
    let categoryColorHex: String?
    let scopedEffectiveAmount: Double
    let scopedRawAmount: Double
    let rawAmount: Double
    let effectiveAmountLine: String
    let rawAmountSuffix: String?
    let rawAmountBracket: String
    let appliedMonthCount: Int
    let dateLine: String
    let accountName: String
    let counterpartyName: String
    let categoryLabel: String
    let subcategoryLabel: String?
    let paybackLinks: [PaybackLinkViewData]
    let isNetZero: Bool

    var listIdentity: String { "\(scopeStatus.rawValue)-\(id)" }
}

struct LedgerGroupViewData: Identifiable {
    let id: String
    let title: String
    let rows: [LedgerItemViewData]

    var scopedEffectiveAmount: Double {
        rows.reduce(0) { $0 + $1.scopedEffectiveAmount }
    }

    var scopedRawAmount: Double {
        rows.reduce(0) { $0 + $1.scopedRawAmount }
    }

    var rawAmount: Double {
        rows.reduce(0) { $0 + $1.rawAmount }
    }

    var appliedMonthCount: Int {
        rows.map(\.appliedMonthCount).max() ?? 0
    }
}

enum LedgerListItem: Identifiable {
    case row(LedgerItemViewData)
    case groupHeader(LedgerGroupViewData)
    case groupChild(LedgerItemViewData)

    var id: String {
        switch self {
        case .row(let row):
            return "row:\(row.listIdentity)"
        case .groupHeader(let group):
            return "group-header:\(group.id):\(group.rows.first?.listIdentity ?? "")"
        case .groupChild(let row):
            return "group-child:\(row.listIdentity)"
        }
    }

    static func grouping(_ rows: [LedgerItemViewData]) -> [LedgerListItem] {
        let groupedRows = Dictionary(grouping: rows) { row -> String? in
            guard let rawID = row.groupID?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !rawID.isEmpty else {
                return nil
            }
            return rawID
        }
        var emittedGroupIDs: Set<String> = []
        var items: [LedgerListItem] = []

        for row in rows {
            guard let rawID = row.groupID?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !rawID.isEmpty else {
                items.append(.row(row))
                continue
            }
            guard emittedGroupIDs.insert(rawID).inserted,
                  let members = groupedRows[rawID] else {
                continue
            }

            let groupTitle = members
                .compactMap(\.groupTitle)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty })
                ?? members.first?.title
                ?? "Bulk Group"

            let group = LedgerGroupViewData(id: rawID, title: groupTitle, rows: members)
            items.append(.groupHeader(group))
            items.append(contentsOf: members.map(LedgerListItem.groupChild))
        }

        return items
    }
}

enum LedgerRowPresentation {
    static func showsRawAmountBracket(
        appliedMonthCount: Int,
        isInAppliedElsewhereSection: Bool
    ) -> Bool {
        appliedMonthCount > 1 || isInAppliedElsewhereSection
    }
}

extension MonthYear {
    var abbreviatedLabel: String {
        guard let date = LedgerScopeLogic.parseISODate("\(rawValue)-01") else {
            return rawValue
        }
        let twoDigitYear = rawValue.prefix(4).suffix(2)
        return "\(date.formatted(.dateTime.month(.abbreviated))) '\(twoDigitYear)"
    }
}

struct LedgerFilterOptionRow: Identifiable {
    let value: String
    let color: String?
    let parentValue: String?
    let indentationLevel: Int

    var filterKey: String {
        if let parentValue {
            return LedgerFiltering.categoryFilterKey(parent: parentValue, child: value)
        }
        return value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var id: String { filterKey }
}

struct ExpenseEditorDraft {
    var id: String?
    var expense: String
    var account: String
    var category: String
    var subcategory: String?
    var amount: Double
    var effectiveAmount: Double
    var effectiveAmountMode: EffectiveAmountMode
    var monthYears: [MonthYear]
    var date: Date
    var paidTo: String
    var notes: String?
    var comments: String?
    var expenseId: String
    var baseExpenseId: String?
    var baseExpenseLabel: String?
    var subExpenseId: String?
    var paybackLinks: [PaybackLinkDraft]
}

struct IncomingEditorDraft {
    var id: String?
    var incoming: String
    var paidBy: String
    var incomeType: String
    var incomeSubtype: String?
    var account: String
    var amount: Double
    var effectiveAmount: Double
    var effectiveAmountMode: EffectiveAmountMode
    var monthYears: [MonthYear]
    var date: Date
    var notes: String?
    var comments: String?
    var incomingId: String
    var baseIncomingId: String?
    var subIncomingId: String?
    var paybackLinks: [PaybackLinkDraft]
}

struct PaybackLinkViewData: Identifiable, Equatable {
    let id: String
    let counterpartyID: String
    let counterpartyTitle: String
    let allocatedAmount: Double
    let notes: String?
}

struct PaybackCandidate: Identifiable, Equatable {
    let id: String
    let title: String
}

struct PaybackLinkDraft: Identifiable, Equatable {
    let id: UUID
    var persistedID: String?
    var counterpartyID: String?
    var counterpartyTitle: String?
    var amountText: String
    var notes: String?

    init(
        id: UUID = UUID(),
        persistedID: String? = nil,
        counterpartyID: String? = nil,
        counterpartyTitle: String? = nil,
        amountText: String = "",
        notes: String? = nil
    ) {
        self.id = id
        self.persistedID = persistedID
        self.counterpartyID = counterpartyID
        self.counterpartyTitle = counterpartyTitle
        self.amountText = amountText
        self.notes = notes
    }

    init(summary: PaybackLinkSummary) {
        self.init(
            persistedID: summary.id,
            counterpartyID: summary.counterpartyID,
            counterpartyTitle: summary.counterpartyTitle,
            amountText: summary.allocatedAmount.formatted(
                .number.precision(.fractionLength(0...2))
            ),
            notes: summary.notes
        )
    }

    static var blank: PaybackLinkDraft {
        PaybackLinkDraft()
    }

    var allocatedAmount: Double? {
        let normalized = amountText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard !normalized.isEmpty else { return nil }
        return Double(normalized)
    }

    var isBlank: Bool {
        counterpartyID == nil
            && amountText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

enum PaybackLinkDraftValidation {
    static func message(for links: [PaybackLinkDraft]) -> String? {
        var selectedCounterparties: Set<String> = []

        for link in links where !link.isBlank {
            guard let counterpartyID = link.counterpartyID else {
                return "Select a payback name for every amount."
            }
            guard let amount = link.allocatedAmount, amount.isFinite, amount > 0 else {
                return "Enter a payback amount greater than 0."
            }
            guard selectedCounterparties.insert(counterpartyID).inserted else {
                return "The same item cannot be linked more than once."
            }
        }

        return nil
    }
}

struct LedgerBreakdownSlice: Identifiable, Equatable {
    let key: String
    let label: String
    let amount: Double
    let colorToken: String?

    var id: String { key }
}

struct LedgerBreakdownSummary: Equatable {
    let totalRaw: Double
    let totalEffective: Double
    let slices: [LedgerBreakdownSlice]
}

struct BreakdownPageMonthTotals: Identifiable, Equatable {
    let month: MonthYear
    let incomings: Double
    let expenses: Double

    var id: MonthYear { month }
    var savings: Double { incomings - expenses }
}

struct BreakdownPageSummary: Equatable {
    let rows: [BreakdownPageMonthTotals]

    var totalIncomings: Double { rows.reduce(0) { $0 + $1.incomings } }
    var totalExpenses: Double { rows.reduce(0) { $0 + $1.expenses } }
    var totalSavings: Double { rows.reduce(0) { $0 + $1.savings } }
}

enum BreakdownPageMath {
    static func calculate(
        expenses: [Expense],
        incomings: [Incoming],
        selectedExpenseAccounts: Set<String>,
        selectedExpenseCategories: Set<String>,
        selectedIncomingAccounts: Set<String>,
        selectedIncomingTypes: Set<String>,
        scope: DateScope
    ) -> BreakdownPageSummary {
        let months = LedgerScopeLogic.targetMonths(startDate: scope.startDate, endDate: scope.endDate)
        let targetMonths = Set(months)
        var expenseTotals = Dictionary(uniqueKeysWithValues: months.map { ($0, 0.0) })
        var incomingTotals = Dictionary(uniqueKeysWithValues: months.map { ($0, 0.0) })

        let expenseAccounts = normalizedAccounts(selectedExpenseAccounts)
        let incomingAccounts = normalizedAccounts(selectedIncomingAccounts)
        let expenseCategories = normalizedCategoryKeys(selectedExpenseCategories)
        let incomingTypes = normalizedCategoryKeys(selectedIncomingTypes)

        for row in expenses {
            let account = normalizedAccount(row.account)
            let category = LedgerFiltering.categoryFilterKey(parent: row.category, child: row.subcategory)
            guard expenseAccounts.contains(account), expenseCategories.contains(category) else { continue }
            add(
                amount: row.effectiveAmount,
                date: row.date,
                monthYears: row.monthYears,
                targetMonths: targetMonths,
                totals: &expenseTotals
            )
        }

        for row in incomings {
            let account = normalizedAccount(row.account)
            let type = LedgerFiltering.categoryFilterKey(parent: row.incomeType, child: row.incomeSubtype)
            guard incomingAccounts.contains(account), incomingTypes.contains(type) else { continue }
            add(
                amount: row.effectiveAmount,
                date: row.date,
                monthYears: row.monthYears,
                targetMonths: targetMonths,
                totals: &incomingTotals
            )
        }

        return BreakdownPageSummary(rows: months.map { month in
            BreakdownPageMonthTotals(
                month: month,
                incomings: incomingTotals[month] ?? 0,
                expenses: expenseTotals[month] ?? 0
            )
        })
    }

    private static func add(
        amount: Double,
        date: Date,
        monthYears: [MonthYear],
        targetMonths: Set<MonthYear>,
        totals: inout [MonthYear: Double]
    ) {
        guard amount.isFinite else { return }
        let rowMonths = LedgerScopeLogic.normalizedRowMonths(date: date, monthYears: monthYears)
        guard !rowMonths.isEmpty else { return }
        let perMonth = amount / Double(rowMonths.count)
        for month in rowMonths where targetMonths.contains(month) {
            totals[month, default: 0] += perMonth
        }
    }

    private static func normalizedAccounts(_ values: Set<String>) -> Set<String> {
        Set(values.map(normalizedAccount).filter { !$0.isEmpty })
    }

    private static func normalizedAccount(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func normalizedCategoryKeys(_ values: Set<String>) -> Set<String> {
        Set(values.map { value in
            value.hasPrefix("|") ? String(value.dropFirst()) : value
        })
    }
}

enum LedgerBreakdownComputing {
    static func expenses(rows: [Expense], mode: LedgerFeatureViewModel.BreakdownMode, scope: DateScope, colorTokenForKey: (String, LedgerFeatureViewModel.BreakdownMode) -> String?) -> LedgerBreakdownSummary {
        let totalRaw = rows.reduce(0) { partial, row in
            partial + LedgerScopeLogic.scopedContribution(amount: row.amount, date: row.date, monthYears: row.monthYears, scope: scope)
        }
        let totalEffective = rows.reduce(0) { partial, row in
            partial + LedgerScopeLogic.scopedContribution(amount: row.effectiveAmount, date: row.date, monthYears: row.monthYears, scope: scope)
        }
        let grouped: [String: Double] = Dictionary(grouping: rows) { expense in
            switch mode {
            case .category:
                return expense.category.isEmpty ? "Uncategorized" : expense.category
            case .subcategory:
                if let subcategory = expense.subcategory, !subcategory.isEmpty {
                    return subcategory
                }
                return expense.category.isEmpty ? "Uncategorized" : expense.category
            }
        }.mapValues { groupedRows in
            groupedRows.reduce(0) { partial, row in
                partial + LedgerScopeLogic.scopedContribution(amount: row.effectiveAmount, date: row.date, monthYears: row.monthYears, scope: scope)
            }
        }
        let slices = grouped
            .filter { $0.value.isFinite && $0.value > 0 }
            .map { key, amount in
                LedgerBreakdownSlice(key: key, label: key, amount: amount, colorToken: colorTokenForKey(key, mode))
            }
            .sorted { $0.amount > $1.amount }
        return LedgerBreakdownSummary(
            totalRaw: totalRaw.isFinite ? totalRaw : 0,
            totalEffective: totalEffective.isFinite ? totalEffective : 0,
            slices: slices
        )
    }

    static func incomings(rows: [Incoming], mode: LedgerFeatureViewModel.BreakdownMode, scope: DateScope, colorTokenForKey: (String, LedgerFeatureViewModel.BreakdownMode) -> String?) -> LedgerBreakdownSummary {
        let totalRaw = rows.reduce(0) { partial, row in
            partial + LedgerScopeLogic.scopedContribution(amount: row.amount, date: row.date, monthYears: row.monthYears, scope: scope)
        }
        let totalEffective = rows.reduce(0) { partial, row in
            partial + LedgerScopeLogic.scopedContribution(amount: row.effectiveAmount, date: row.date, monthYears: row.monthYears, scope: scope)
        }
        let grouped: [String: Double] = Dictionary(grouping: rows) { incoming in
            switch mode {
            case .category:
                return incoming.incomeType.isEmpty ? "Uncategorized" : incoming.incomeType
            case .subcategory:
                if let subtype = incoming.incomeSubtype, !subtype.isEmpty {
                    return subtype
                }
                return incoming.incomeType.isEmpty ? "Uncategorized" : incoming.incomeType
            }
        }.mapValues { groupedRows in
            groupedRows.reduce(0) { partial, row in
                partial + LedgerScopeLogic.scopedContribution(amount: row.effectiveAmount, date: row.date, monthYears: row.monthYears, scope: scope)
            }
        }
        let slices = grouped
            .filter { $0.value.isFinite && $0.value > 0 }
            .map { key, amount in
                LedgerBreakdownSlice(key: key, label: key, amount: amount, colorToken: colorTokenForKey(key, mode))
            }
            .sorted { $0.amount > $1.amount }
        return LedgerBreakdownSummary(
            totalRaw: totalRaw.isFinite ? totalRaw : 0,
            totalEffective: totalEffective.isFinite ? totalEffective : 0,
            slices: slices
        )
    }
}
