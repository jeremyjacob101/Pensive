import SwiftUI

enum LedgerFiltering {
    static func filterExpenses(_ rows: [Expense], selected: Set<String>, searchText: String) -> [Expense] {
        let normalized = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return rows.filter { row in
            let filterHit = selected.isEmpty || selected.contains(row.account) || selected.contains(row.category) || selected.contains(row.subcategory ?? "")
            guard filterHit else { return false }
            guard !normalized.isEmpty else { return true }
            let blob = [row.name, row.account, row.category, row.subcategory ?? "", row.paidTo, row.notes ?? "", row.comments ?? "", row.monthYears.map(\.rawValue).joined(separator: " ")].joined(separator: " ").lowercased()
            return blob.contains(normalized)
        }
    }

    static func filterIncomings(_ rows: [Incoming], selected: Set<String>, searchText: String) -> [Incoming] {
        let normalized = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return rows.filter { row in
            let filterHit = selected.isEmpty || selected.contains(row.account) || selected.contains(row.incomeType) || selected.contains(row.incomeSubtype ?? "")
            guard filterHit else { return false }
            guard !normalized.isEmpty else { return true }
            let blob = [row.name, row.paidBy, row.account, row.incomeType, row.incomeSubtype ?? "", row.notes ?? "", row.comments ?? "", row.monthYears.map(\.rawValue).joined(separator: " ")].joined(separator: " ").lowercased()
            return blob.contains(normalized)
        }
    }

    static func scopeWarningText(status: ScopeMatchStatus) -> String? {
        switch status {
        case .full: return nil
        case .monthYearsOnly: return "applied this month/s, paid in different month"
        case .dateOnly: return "paid this month, applied to different month/s"
        }
    }
}
