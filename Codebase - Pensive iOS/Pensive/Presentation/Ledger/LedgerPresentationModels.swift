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

    var listIdentity: String { "\(scopeStatus.rawValue)-\(id)" }
}

struct LedgerFilterOptionRow: Identifiable {
    let value: String
    let color: String?
    let parentValue: String?
    let indentationLevel: Int

    var id: String { [parentValue ?? "", value, "\(indentationLevel)"].joined(separator: "|") }
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

enum LedgerBreakdownComputing {
    static func expenses(rows: [Expense], mode: LedgerFeatureViewModel.BreakdownMode, scope: DateScope, colorTokenForKey: (String, LedgerFeatureViewModel.BreakdownMode) -> String?) -> LedgerBreakdownSummary {
        let totalRaw = rows.reduce(0) { partial, row in
            partial + LedgerScopeLogic.proportionalContribution(amount: row.amount, date: row.date, monthYears: row.monthYears, scope: scope)
        }
        let totalEffective = rows.reduce(0) { partial, row in
            partial + LedgerScopeLogic.proportionalContribution(amount: row.effectiveAmount, date: row.date, monthYears: row.monthYears, scope: scope)
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
                partial + LedgerScopeLogic.proportionalContribution(amount: row.effectiveAmount, date: row.date, monthYears: row.monthYears, scope: scope)
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
            partial + LedgerScopeLogic.proportionalContribution(amount: row.amount, date: row.date, monthYears: row.monthYears, scope: scope)
        }
        let totalEffective = rows.reduce(0) { partial, row in
            partial + LedgerScopeLogic.proportionalContribution(amount: row.effectiveAmount, date: row.date, monthYears: row.monthYears, scope: scope)
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
                partial + LedgerScopeLogic.proportionalContribution(amount: row.effectiveAmount, date: row.date, monthYears: row.monthYears, scope: scope)
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
