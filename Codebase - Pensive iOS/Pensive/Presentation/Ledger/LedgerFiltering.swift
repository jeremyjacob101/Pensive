import SwiftUI

enum LedgerFiltering {
    static func filterExpenses(_ rows: [Expense], deselectedAccounts: Set<String>, deselectedCategories: Set<String>, searchText: String) -> [Expense] {
        let normalized = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedDeselectedAccounts = Set(deselectedAccounts.map(normalizedAccount))
        return rows.filter { row in
            guard !normalizedDeselectedAccounts.contains(normalizedAccount(row.account)) else { return false }
            guard !deselectedCategories.contains(categoryFilterKey(parent: row.category, child: row.subcategory)) else { return false }
            guard !normalized.isEmpty else { return true }
            let blob = [row.name, row.account, row.category, row.subcategory ?? "", row.paidTo, row.notes ?? "", row.comments ?? "", row.monthYears.map(\.rawValue).joined(separator: " ")].joined(separator: " ").lowercased()
            return blob.contains(normalized)
        }
    }

    static func filterIncomings(_ rows: [Incoming], deselectedAccounts: Set<String>, deselectedCategories: Set<String>, searchText: String) -> [Incoming] {
        let normalized = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedDeselectedAccounts = Set(deselectedAccounts.map(normalizedAccount))
        return rows.filter { row in
            guard !normalizedDeselectedAccounts.contains(normalizedAccount(row.account)) else { return false }
            guard !deselectedCategories.contains(categoryFilterKey(parent: row.incomeType, child: row.incomeSubtype)) else { return false }
            guard !normalized.isEmpty else { return true }
            let blob = [row.name, row.paidBy, row.account, row.incomeType, row.incomeSubtype ?? "", row.notes ?? "", row.comments ?? "", row.monthYears.map(\.rawValue).joined(separator: " ")].joined(separator: " ").lowercased()
            return blob.contains(normalized)
        }
    }

    static func categoryFilterKey(parent: String, child: String?) -> String {
        let parent = parent.trimmingCharacters(in: .whitespacesAndNewlines)
        let child = child?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return child.isEmpty ? parent : "\(parent)|\(child)"
    }

    static func normalizedAccount(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func scopeWarningText(status: ScopeMatchStatus) -> String? {
        switch status {
        case .full: return nil
        case .monthYearsOnly: return "applied this month/s, paid in different month"
        case .dateOnly: return "paid this month, applied to different month/s"
        }
    }
}
