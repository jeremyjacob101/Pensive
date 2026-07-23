import SwiftUI

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

    let accountColorHex: String?
    let categoryColorHex: String?
    let effectiveAmountLine: String
    let dateLine: String
    let accountName: String
    let counterpartyName: String

    var listIdentity: String { "\(scopeStatus.rawValue)-\(id)" }
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
}

struct PaybackLinkViewData: Identifiable {
    let id: String
    let counterpartyTitle: String
    let allocatedAmount: Double
    let notes: String?
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
