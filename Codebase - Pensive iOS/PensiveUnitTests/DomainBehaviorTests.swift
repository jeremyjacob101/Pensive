import XCTest
@testable import Pensive

final class DomainBehaviorTests: XCTestCase {
    func testMonthKeysValidateCalendarMonthBoundariesAndSortLexically() {
        XCTAssertEqual(MonthYear("2026-01")?.rawValue, "2026-01")
        XCTAssertEqual(MonthYear("2026-12")?.rawValue, "2026-12")
        XCTAssertNil(MonthYear("2026-00"))
        XCTAssertNil(MonthYear("2026-13"))
        XCTAssertNil(MonthYear("2026-1"))
        XCTAssertTrue(MonthYear("2026-01")! < MonthYear("2026-12")!)
    }

    func testScopeLogicHandlesLeapYearRangesAndCrossYearMonthRanges() {
        let calendar = LedgerScopeLogic.calendar
        let start = calendar.date(from: DateComponents(year: 2024, month: 12, day: 31))!
        let end = calendar.date(from: DateComponents(year: 2025, month: 2, day: 1))!
        XCTAssertEqual(
            LedgerScopeLogic.targetMonths(startDate: start, endDate: end).map(\.rawValue),
            ["2024-12", "2025-01", "2025-02"]
        )
        XCTAssertEqual(
            LedgerScopeLogic.monthBounds(for: MonthYear("2024-02")!)?.end,
            calendar.date(from: DateComponents(year: 2024, month: 2, day: 29))!
        )
        XCTAssertEqual(LedgerScopeLogic.isoDate(start), "2024-12-31")
        XCTAssertEqual(LedgerScopeLogic.parseISODate("2025-02-01"), end)
        XCTAssertNil(LedgerScopeLogic.parseISODate("2025/02/01"))
    }

    func testScopeContributionsRespectDateOnlyAndMonthOverlapModes() {
        let calendar = LedgerScopeLogic.calendar
        let date = calendar.date(from: DateComponents(year: 2026, month: 6, day: 15))!
        let monthScope = DateScope(
            startDate: calendar.date(from: DateComponents(year: 2026, month: 6, day: 1))!,
            endDate: calendar.date(from: DateComponents(year: 2026, month: 6, day: 30))!,
            includeMonthYearOverlapOutsideDate: true
        )
        let customScope = DateScope(
            startDate: calendar.date(from: DateComponents(year: 2026, month: 6, day: 10))!,
            endDate: calendar.date(from: DateComponents(year: 2026, month: 6, day: 20))!,
            includeMonthYearOverlapOutsideDate: false
        )
        let months = [MonthYear("2026-05")!, MonthYear("2026-06")!]
        XCTAssertEqual(
            LedgerScopeLogic.scopedContribution(amount: 120, date: date, monthYears: months, scope: monthScope),
            60,
            accuracy: 0.0001
        )
        XCTAssertEqual(
            LedgerScopeLogic.scopedContribution(amount: 120, date: date, monthYears: months, scope: customScope),
            120,
            accuracy: 0.0001
        )
        XCTAssertTrue(LedgerScopeLogic.isPartialMatch(date: date, monthYears: months, scope: monthScope))
        XCTAssertFalse(LedgerScopeLogic.isPartialMatch(date: date, monthYears: months, scope: customScope))
    }

    func testFilteringNormalizesAccountsSearchesAllRelevantFieldsAndUsesParentChildKeys() {
        let rows = [
            makeExpense(id: "food", account: " Checking ", category: "Food", subcategory: "Groceries", notes: "weekly"),
            makeExpense(id: "rent", account: "Savings", category: "Rent", subcategory: nil, notes: "monthly"),
            makeExpense(id: "other", account: "Checking", category: "Food", subcategory: nil, notes: "other")
        ]
        XCTAssertEqual(
            LedgerFiltering.filterExpenses(
                rows,
                deselectedAccounts: ["checking"],
                deselectedCategories: [],
                searchText: ""
            ).map(\.id),
            ["rent"]
        )
        XCTAssertEqual(
            LedgerFiltering.filterExpenses(
                rows,
                deselectedAccounts: [],
                deselectedCategories: ["Food|Groceries"],
                searchText: "WEEK"
            ).map(\.id),
            ["food"]
        )
        XCTAssertEqual(LedgerFiltering.categoryFilterKey(parent: " Food ", child: " Groceries "), "Food|Groceries")
        XCTAssertEqual(LedgerFiltering.scopeWarningText(status: .full), nil)
        XCTAssertNotNil(LedgerFiltering.scopeWarningText(status: .monthYearsOnly))
    }

    func testBreakdownUsesEffectiveAmountsAndProportionalMonthShares() {
        let scope = DateScope(
            startDate: date(year: 2026, month: 6, day: 1),
            endDate: date(year: 2026, month: 6, day: 30),
            includeMonthYearOverlapOutsideDate: true
        )
        let rows = [
            makeExpense(id: "rent", category: "Rent", subcategory: nil, amount: 100, effective: 80, months: ["2026-06"]),
            makeExpense(id: "food", category: "Food", subcategory: "Dining", amount: 100, effective: 40, months: ["2026-05", "2026-06"])
        ]
        let summary = LedgerBreakdownComputing.expenses(rows: rows, mode: .category, scope: scope) { key, _ in
            key == "Food" ? "#3366FF" : nil
        }
        XCTAssertEqual(summary.totalRaw, 150, accuracy: 0.0001)
        XCTAssertEqual(summary.totalEffective, 100, accuracy: 0.0001)
        XCTAssertEqual(summary.slices.first?.label, "Rent")
        XCTAssertEqual(summary.slices.first?.amount ?? 0, 80, accuracy: 0.0001)
        XCTAssertEqual(summary.slices.first(where: { $0.label == "Food" })?.colorToken, "#3366FF")
    }

    func testBreakdownPageMathFiltersAccountsAndAllocatesAcrossMonths() {
        let scope = DateScope(
            startDate: date(year: 2026, month: 5, day: 1),
            endDate: date(year: 2026, month: 6, day: 30),
            includeMonthYearOverlapOutsideDate: true
        )
        let expense = makeExpense(id: "expense", account: "Checking", category: "Food", subcategory: nil, amount: 120, effective: 90, months: ["2026-05", "2026-06"])
        let incoming = makeIncoming(id: "income", account: "Checking", type: "Work", subtype: nil, amount: 200, effective: 200, months: ["2026-06"])
        let result = BreakdownPageMath.calculate(
            expenses: [expense],
            incomings: [incoming],
            selectedExpenseAccounts: ["Checking"],
            selectedExpenseCategories: ["Food"],
            selectedIncomingAccounts: ["Checking"],
            selectedIncomingTypes: ["Work"],
            scope: scope
        )
        XCTAssertEqual(result.rows.map(\.month.rawValue), ["2026-05", "2026-06"])
        XCTAssertEqual(result.totalExpenses, 90, accuracy: 0.0001)
        XCTAssertEqual(result.totalIncomings, 200, accuracy: 0.0001)
        XCTAssertEqual(result.totalSavings, 110, accuracy: 0.0001)
    }

    func testTrackingTimelineAndNotepadNormalizationCoverEmptyAndRaggedData() {
        XCTAssertEqual(TrackingTimelineLogic.monthRange(start: "2026-01", end: "2026-04"), ["2026-01", "2026-02", "2026-03", "2026-04"])
        XCTAssertEqual(TrackingTimelineLogic.monthRange(start: "2026-04", end: "2026-01"), [])
        let segments = TrackingTimelineLogic.segments(
            months: ["2026-01", "2026-02", "2026-03"],
            paidMonths: ["2026-01"],
            currentMonth: "2026-03",
            trailingBufferMonths: 1
        )
        XCTAssertEqual(segments.map(\.state), [.paid, .unpaid, .buffer])

        let dto = NotepadWorkspaceDTO(
            _id: nil,
            _creationTime: nil,
            userId: nil,
            notes: [.init(id: "", title: "", content: "text")],
            tables: [.init(id: "", title: "", cells: [["A"], ["B", "C"]])],
            updatedAt: 0
        )
        let normalized = NotepadWorkspaceNormalization.normalize(dto)
        XCTAssertEqual(normalized.notes.first?.title, "Untitled Note")
        XCTAssertEqual(normalized.tables.first?.title, "Untitled Table")
        XCTAssertEqual(normalized.tables.first?.cells, [["A", ""], ["B", "C"]])
        XCTAssertEqual(NotepadWorkspaceNormalization.setCell(cells: [["A"]], row: 4, col: 4, value: "X"), [["A"]])
    }

    func testOptionsMutationBuildersTrimValuesAndRejectInvalidMoves() throws {
        let move = try OptionsMutationLogic.buildMoveToSubtype(kind: "category", sourceValue: " Food ", targetValue: " Meals ")
        XCTAssertEqual(move.sourceValue, "Food")
        XCTAssertEqual(move.targetValue, "Meals")
        let subtype = try OptionsMutationLogic.buildMoveSubtype(kind: "subcategory", value: " Dining ", sourceParentValue: " Food ", targetParentValue: " Meals ")
        XCTAssertEqual(subtype.value, "Dining")
        let promoted = try OptionsMutationLogic.buildPromoteSubtype(kind: "subcategory", value: " Dining ", parentValue: " Food ")
        XCTAssertEqual(promoted.parentValue, "Food")
        XCTAssertThrowsError(try OptionsMutationLogic.buildMoveToSubtype(kind: "category", sourceValue: "Same", targetValue: "Same"))
        XCTAssertThrowsError(try OptionsMutationLogic.buildMoveSubtype(kind: "subcategory", value: "x", sourceParentValue: "Food", targetParentValue: "Food"))
        XCTAssertThrowsError(try OptionsMutationLogic.buildPromoteSubtype(kind: "subcategory", value: " ", parentValue: "Food"))
    }

    private func date(year: Int, month: Int, day: Int) -> Date {
        LedgerScopeLogic.calendar.date(from: DateComponents(year: year, month: month, day: day))!
    }

    private func makeExpense(
        id: String,
        account: String = "Checking",
        category: String,
        subcategory: String?,
        amount: Double = 10,
        effective: Double = 10,
        months: [String] = ["2026-06"],
        notes: String? = nil
    ) -> Expense {
        Expense(
            id: id,
            name: "Expense \(id)",
            account: account,
            category: category,
            subcategory: subcategory,
            amount: amount,
            effectiveAmount: effective,
            effectiveAmountMode: .auto,
            monthYears: months.compactMap(MonthYear.init),
            date: date(year: 2026, month: 6, day: 15),
            paidTo: "Vendor",
            notes: notes,
            comments: nil,
            expenseId: id,
            baseExpenseId: nil,
            baseExpenseLabel: nil,
            subExpenseId: nil
        )
    }

    private func makeIncoming(
        id: String,
        account: String,
        type: String,
        subtype: String?,
        amount: Double,
        effective: Double,
        months: [String]
    ) -> Incoming {
        Incoming(
            id: id,
            name: "Incoming \(id)",
            paidBy: "Employer",
            incomeType: type,
            incomeSubtype: subtype,
            account: account,
            amount: amount,
            effectiveAmount: effective,
            effectiveAmountMode: .auto,
            monthYears: months.compactMap(MonthYear.init),
            date: date(year: 2026, month: 6, day: 15),
            notes: nil,
            comments: nil,
            incomingId: id,
            baseIncomingId: nil,
            subIncomingId: nil
        )
    }
}
