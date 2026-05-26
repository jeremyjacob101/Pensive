import XCTest
@testable import Pensive

final class LedgerBreakdownComputingTests: XCTestCase {
    func testExpenseCategoryBreakdownUsesEffectiveAmountTotals() {
        let rows = [
            expense(id: "1", category: "Rent", subcategory: "Apartment", amount: 6000, effective: 5800),
            expense(id: "2", category: "Food", subcategory: "Grocery", amount: 1500, effective: 1040.6),
            expense(id: "3", category: "Food", subcategory: "Dining", amount: 500, effective: 300)
        ]

        let summary = LedgerBreakdownComputing.expenses(rows: rows, mode: .category) { key, _ in
            key == "Food" ? "#3366FF" : nil
        }

        XCTAssertEqual(summary.totalRaw, 8000, accuracy: 0.0001)
        XCTAssertEqual(summary.totalEffective, 7140.6, accuracy: 0.0001)
        XCTAssertEqual(summary.slices.count, 2)
        XCTAssertEqual(summary.slices.first?.label, "Rent")
        XCTAssertEqual(summary.slices.first?.amount ?? 0, 5800, accuracy: 0.0001)
        let food = summary.slices.first(where: { $0.label == "Food" })
        XCTAssertEqual(food?.amount ?? 0, 1340.6, accuracy: 0.0001)
        XCTAssertEqual(food?.colorToken, "#3366FF")
    }

    func testIncomingSubtypeBreakdownFallsBackToUnspecified() {
        let rows = [
            incoming(id: "a", type: "Salary", subtype: nil, amount: 10000, effective: 10000),
            incoming(id: "b", type: "Salary", subtype: "", amount: 3000, effective: 2800),
            incoming(id: "c", type: "Gift", subtype: "Family", amount: 1000, effective: 1000)
        ]

        let summary = LedgerBreakdownComputing.incomings(rows: rows, mode: .subcategory) { _, _ in nil }

        XCTAssertEqual(summary.totalRaw, 14000, accuracy: 0.0001)
        XCTAssertEqual(summary.totalEffective, 13800, accuracy: 0.0001)
        let unspecified = summary.slices.first(where: { $0.label == "Unspecified Subtype" })
        XCTAssertEqual(unspecified?.amount ?? 0, 12800, accuracy: 0.0001)
        let family = summary.slices.first(where: { $0.label == "Family" })
        XCTAssertEqual(family?.amount ?? 0, 1000, accuracy: 0.0001)
    }

    private func expense(id: String, category: String, subcategory: String?, amount: Double, effective: Double) -> Expense {
        Expense(
            id: id,
            name: "Expense \(id)",
            type: "Type",
            account: "Checking",
            category: category,
            subcategory: subcategory,
            amount: amount,
            effectiveAmount: effective,
            effectiveAmountMode: .auto,
            monthYears: [MonthYear("2026-05")!],
            date: Date(timeIntervalSince1970: 0),
            paidTo: "Vendor",
            notes: nil,
            comments: nil,
            expenseId: id,
            baseExpenseId: nil,
            baseExpenseLabel: nil,
            subExpenseId: nil
        )
    }

    private func incoming(id: String, type: String, subtype: String?, amount: Double, effective: Double) -> Incoming {
        Incoming(
            id: id,
            name: "Incoming \(id)",
            paidBy: "Employer",
            incomeType: type,
            incomeSubtype: subtype,
            account: "Checking",
            amount: amount,
            effectiveAmount: effective,
            effectiveAmountMode: .auto,
            monthYears: [MonthYear("2026-05")!],
            date: Date(timeIntervalSince1970: 0),
            notes: nil,
            comments: nil,
            incomingId: id,
            baseIncomingId: nil,
            subIncomingId: nil
        )
    }
}
