import XCTest
@testable import Pensive

final class LedgerBreakdownComputingTests: XCTestCase {
    func testMonthYearAbbreviatedLabelUsesYearRatherThanMonthNumber() {
        XCTAssertEqual(MonthYear("2026-07")?.abbreviatedLabel, "Jul '26")
        XCTAssertEqual(MonthYear("2027-01")?.abbreviatedLabel, "Jan '27")
    }

    func testLedgerFiltersApplyAccountAndCategoryAsSeparateFilters() {
        let rows = [
            expense(id: "checking-food", account: "Checking", category: "Food", subcategory: "Groceries", amount: 10, effective: 10),
            expense(id: "savings-food", account: "Savings", category: "Food", subcategory: "Groceries", amount: 20, effective: 20),
            expense(id: "checking-rent", account: "Checking", category: "Rent", subcategory: nil, amount: 30, effective: 30),
            expense(id: "checking-uncategorized", account: "Checking", category: "", subcategory: nil, amount: 40, effective: 40)
        ]

        let filtered = LedgerFiltering.filterExpenses(
            rows,
            deselectedAccounts: ["Savings"],
            deselectedCategories: [],
            searchText: ""
        )

        XCTAssertEqual(filtered.map(\.id), ["checking-food", "checking-rent", "checking-uncategorized"])

        let deselectedCategory = LedgerFiltering.filterExpenses(
            rows,
            deselectedAccounts: ["Savings"],
            deselectedCategories: ["Rent"],
            searchText: ""
        )
        XCTAssertEqual(deselectedCategory.map(\.id), ["checking-food", "checking-uncategorized"])

        let deselectedAccount = LedgerFiltering.filterExpenses(
            rows,
            deselectedAccounts: ["Checking", "Savings"],
            deselectedCategories: [],
            searchText: ""
        )
        XCTAssertTrue(deselectedAccount.isEmpty)
    }

    func testIncomingFiltersUseSubtypeKeysWithoutMatchingAnotherFilterDimension() {
        let rows = [
            incoming(id: "salary", account: "Checking", type: "Salary", subtype: "Monthly", amount: 10, effective: 10),
            incoming(id: "gift", account: "Savings", type: "Gift", subtype: nil, amount: 20, effective: 20)
        ]

        let filtered = LedgerFiltering.filterIncomings(
            rows,
            deselectedAccounts: ["Savings"],
            deselectedCategories: [],
            searchText: ""
        )

        XCTAssertEqual(filtered.map(\.id), ["salary"])
    }

    func testExpenseCategoryBreakdownUsesEffectiveAmountTotals() {
        let rows = [
            expense(id: "1", category: "Rent", subcategory: "Apartment", amount: 6000, effective: 5800),
            expense(id: "2", category: "Food", subcategory: "Grocery", amount: 1500, effective: 1040.6),
            expense(id: "3", category: "Food", subcategory: "Dining", amount: 500, effective: 300)
        ]

        let summary = LedgerBreakdownComputing.expenses(rows: rows, mode: .category, scope: may2026Scope) { key, _ in
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

    func testExpenseSubcategoryBreakdownFallsBackToCategoryForRowsWithoutSubcategory() {
        let rows = [
            expense(id: "1", category: "Rent", subcategory: nil, amount: 6000, effective: 5800),
            expense(id: "2", category: "Food", subcategory: "", amount: 1500, effective: 1040.6),
            expense(id: "3", category: "Food", subcategory: "Dining", amount: 500, effective: 300)
        ]

        let summary = LedgerBreakdownComputing.expenses(rows: rows, mode: .subcategory, scope: may2026Scope) { _, _ in nil }

        XCTAssertEqual(summary.totalRaw, 8000, accuracy: 0.0001)
        XCTAssertEqual(summary.totalEffective, 7140.6, accuracy: 0.0001)
        XCTAssertNil(summary.slices.first(where: { $0.label == "Unspecified Subcategory" }))
        let rent = summary.slices.first(where: { $0.label == "Rent" })
        XCTAssertEqual(rent?.amount ?? 0, 5800, accuracy: 0.0001)
        let food = summary.slices.first(where: { $0.label == "Food" })
        XCTAssertEqual(food?.amount ?? 0, 1040.6, accuracy: 0.0001)
        let dining = summary.slices.first(where: { $0.label == "Dining" })
        XCTAssertEqual(dining?.amount ?? 0, 300, accuracy: 0.0001)
    }

    func testIncomingSubtypeBreakdownFallsBackToIncomeTypeForRowsWithoutSubtype() {
        let rows = [
            incoming(id: "a", type: "Salary", subtype: nil, amount: 10000, effective: 10000),
            incoming(id: "b", type: "Salary", subtype: "", amount: 3000, effective: 2800),
            incoming(id: "c", type: "Gift", subtype: "Family", amount: 1000, effective: 1000)
        ]

        let summary = LedgerBreakdownComputing.incomings(rows: rows, mode: .subcategory, scope: may2026Scope) { _, _ in nil }

        XCTAssertEqual(summary.totalRaw, 14000, accuracy: 0.0001)
        XCTAssertEqual(summary.totalEffective, 13800, accuracy: 0.0001)
        XCTAssertNil(summary.slices.first(where: { $0.label == "Unspecified Subtype" }))
        let salary = summary.slices.first(where: { $0.label == "Salary" })
        XCTAssertEqual(salary?.amount ?? 0, 12800, accuracy: 0.0001)
        let family = summary.slices.first(where: { $0.label == "Family" })
        XCTAssertEqual(family?.amount ?? 0, 1000, accuracy: 0.0001)
    }

    private func expense(id: String, account: String = "Checking", category: String, subcategory: String?, amount: Double, effective: Double) -> Expense {
        Expense(
            id: id,
            name: "Expense \(id)",
            account: account,
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

    private func incoming(id: String, account: String = "Checking", type: String, subtype: String?, amount: Double, effective: Double) -> Incoming {
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
            monthYears: [MonthYear("2026-05")!],
            date: Date(timeIntervalSince1970: 0),
            notes: nil,
            comments: nil,
            incomingId: id,
            baseIncomingId: nil,
            subIncomingId: nil
        )
    }

    private var may2026Scope: DateScope {
        DateScope(
            startDate: date(year: 2026, month: 5, day: 1),
            endDate: date(year: 2026, month: 5, day: 31),
            includeMonthYearOverlapOutsideDate: true
        )
    }

    private func date(year: Int, month: Int, day: Int) -> Date {
        DateComponents(calendar: Calendar(identifier: .gregorian), year: year, month: month, day: day).date!
    }

    func testTrackingMonthRangeIsInclusiveAndOrdered() {
        let months = TrackingTimelineLogic.monthRange(start: "2026-01", end: "2026-04")
        XCTAssertEqual(months, ["2026-01", "2026-02", "2026-03", "2026-04"])
    }

    func testTrackingSegmentsApplyPaidBufferUnpaidAndEmptyStates() {
        let months = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]
        let segments = TrackingTimelineLogic.segments(
            months: months,
            paidMonths: ["2026-03", "2026-05"],
            currentMonth: "2026-05",
            trailingBufferMonths: 1
        )

        XCTAssertEqual(segments[0].state, .paid)
        XCTAssertEqual(segments[1].state, .buffer)
        XCTAssertEqual(segments[2].state, .paid)
        XCTAssertEqual(segments[3].state, .empty)
        XCTAssertEqual(segments[4].state, .empty)
    }

    func testTrackingPersistenceStoreRoundTripsPerRowValues() {
        let suiteName = "tracking.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = TrackingTimelineRowPersistenceStore(defaults: defaults)
        store.setStartMonth("2026-02", source: "expense", key: "housing")
        store.setTrailingBufferMonths(3, source: "expense", key: "housing")

        XCTAssertEqual(store.startMonth(source: "expense", key: "housing"), "2026-02")
        XCTAssertEqual(store.trailingBufferMonths(source: "expense", key: "housing"), 3)
    }

    func testNotepadNormalizationPadsRaggedRowsAndDefaultsNames() {
        let dto = NotepadWorkspaceDTO(
            _id: nil,
            _creationTime: nil,
            userId: nil,
            notes: [.init(id: "n1", title: "", content: "A")],
            tables: [.init(id: "t1", title: "", cells: [["x"], ["y", "z"]])],
            updatedAt: 0
        )

        let normalized = NotepadWorkspaceNormalization.normalize(dto)
        XCTAssertEqual(normalized.notes.first?.title, "Untitled Note")
        XCTAssertEqual(normalized.tables.first?.title, "Untitled Table")
        XCTAssertEqual(normalized.tables.first?.cells.count, 2)
        XCTAssertEqual(normalized.tables.first?.cells[0].count, 2)
        XCTAssertEqual(normalized.tables.first?.cells[0][1], "")
    }

    func testNotepadSetCellEditsExpectedCellOnly() {
        let start = [["A", "B"], ["C", "D"]]
        let changed = NotepadWorkspaceNormalization.setCell(cells: start, row: 1, col: 0, value: "X")
        XCTAssertEqual(changed[0][0], "A")
        XCTAssertEqual(changed[1][0], "X")
        XCTAssertEqual(changed[1][1], "D")
    }

    func testOptionsMoveToSubtypeBuilderRejectsSelfMove() {
        XCTAssertThrowsError(try OptionsMutationLogic.buildMoveToSubtype(kind: "category", sourceValue: "Rent", targetValue: "Rent")) { error in
            guard let apiError = error as? APIError, case .validation(let message) = apiError else {
                XCTFail("Expected validation error.")
                return
            }
            XCTAssertEqual(message, "Cannot move an option under itself.")
        }
    }

    func testOptionsMoveSubtypeBuilderRejectsSameParentMove() {
        XCTAssertThrowsError(try OptionsMutationLogic.buildMoveSubtype(kind: "subcategory", value: "Utilities", sourceParentValue: "Housing", targetParentValue: "Housing")) { error in
            guard let apiError = error as? APIError, case .validation(let message) = apiError else {
                XCTFail("Expected validation error.")
                return
            }
            XCTAssertEqual(message, "Subtype is already under the selected parent.")
        }
    }

    func testOptionsPromoteSubtypeBuilderReturnsRequest() throws {
        let request = try OptionsMutationLogic.buildPromoteSubtype(kind: "subcategory", value: "Utilities", parentValue: "Housing")
        XCTAssertEqual(request.kind, "subcategory")
        XCTAssertEqual(request.value, "Utilities")
        XCTAssertEqual(request.parentValue, "Housing")
    }

    func testOptionDragPayloadRoundTripsThroughSystemTransferEncoding() throws {
        let payload = OptionDragPayload(kind: .incomeSubtype, value: "Bonus", parentValue: "Salary")

        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(OptionDragPayload.self, from: data)

        XCTAssertEqual(decoded, payload)
    }

    func testOptionDragItemProviderPublishesPayloadAndEndsWhenReleased() {
        let payload = OptionDragPayload(kind: .subcategory, value: "Utilities", parentValue: "Housing")
        let dataLoaded = expectation(description: "Drag payload loaded")
        var didEnd = false

        autoreleasepool {
            let provider = OptionDragItemProvider(payload: payload) {
                didEnd = true
            }

            XCTAssertTrue(provider.hasItemConformingToTypeIdentifier(OptionDragPayload.contentType.identifier))
            provider.loadDataRepresentation(forTypeIdentifier: OptionDragPayload.contentType.identifier) { data, error in
                XCTAssertNil(error)
                let decoded = data.flatMap { try? JSONDecoder().decode(OptionDragPayload.self, from: $0) }
                XCTAssertEqual(decoded, payload)
                dataLoaded.fulfill()
            }
        }

        wait(for: [dataLoaded], timeout: 1)
        XCTAssertTrue(didEnd)
    }
}
