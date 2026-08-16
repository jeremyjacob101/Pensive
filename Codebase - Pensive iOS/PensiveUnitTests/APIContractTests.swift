import XCTest
@testable import Pensive

final class APIContractTests: XCTestCase {
    func testDateAndMonthValueObjectsRejectMalformedValues() throws {
        XCTAssertEqual(try ISODateString(" 2026-08-16 ").rawValue, "2026-08-16")
        XCTAssertEqual(try MonthKey(" 2026-08 ").rawValue, "2026-08")
        XCTAssertThrowsError(try ISODateString("2026/08/16"))
        XCTAssertThrowsError(try ISODateString("2026-8-16"))
        XCTAssertThrowsError(try MonthKey("2026-00"))
        XCTAssertThrowsError(try MonthKey("2026-13"))
    }

    func testPaginationRequestEncodesNullCursorAndPreservesPageSize() throws {
        let request = PaginationRequest(paginationOpts: PaginationOpts(cursor: nil, numItems: 50))
        let data = try JSONEncoder().encode(request)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let pagination = try XCTUnwrap(object["paginationOpts"] as? [String: Any])
        XCTAssertTrue(pagination["cursor"] is NSNull)
        XCTAssertEqual(pagination["numItems"] as? Int, 50)
    }

    func testDateScopeAndMutationRequestsEncodeOptionalFieldsWithoutChangingRequiredContract() throws {
        let request = DateScopeRequest(
            startDate: "2026-08-01",
            endDate: "2026-08-31",
            targetMonths: ["2026-08"],
            includeMonthYearOverlapOutsideDate: true
        )
        let data = try JSONEncoder().encode(request)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["startDate"] as? String, "2026-08-01")
        XCTAssertEqual(json["targetMonths"] as? [String], ["2026-08"])
        XCTAssertEqual(json["includeMonthYearOverlapOutsideDate"] as? Bool, true)

        let auth = try JSONDecoder().decode(
            SessionResponse.self,
            from: Data(#"{"authenticated":true,"userId":"alice","token":"access"}"#.utf8)
        )
        XCTAssertTrue(auth.authenticated)
        XCTAssertEqual(auth.userId, "alice")
        XCTAssertNil(auth.refreshToken)
    }

    func testDTOConversionUsesSafeFallbacksAndPreservesPaybackSummaries() {
        let dto = ExpenseDTO(
            _id: "expense-1",
            _creationTime: nil,
            expense: "Lunch",
            account: nil,
            category: nil,
            subcategory: nil,
            amount: 100,
            effectiveAmount: nil,
            effectiveAmountMode: "unknown",
            monthYears: ["2026-08", "invalid"],
            date: "bad-date",
            paidTo: nil,
            notes: "note",
            comments: nil,
            expenseId: "expense-1",
            baseExpenseId: nil,
            baseExpenseLabel: nil,
            subExpenseId: nil,
            paybackLinks: [
                PaybackLinkSummaryDTO(
                    id: "link-1",
                    counterpartyId: "incoming-1",
                    counterpartyTitle: "Salary",
                    allocatedAmount: 20,
                    notes: "reimbursement"
                )
            ]
        )
        let expense = Expense(dto: dto)
        XCTAssertEqual(expense.account, "")
        XCTAssertEqual(expense.category, "")
        XCTAssertEqual(expense.effectiveAmount, 100)
        XCTAssertEqual(expense.effectiveAmountMode, .auto)
        XCTAssertEqual(expense.monthYears.map(\.rawValue), ["2026-08"])
        XCTAssertEqual(expense.paidTo, "")
        XCTAssertEqual(expense.paybackLinks.first?.allocatedAmount, 20)
    }

    func testEnvironmentAndAuthErrorsHaveDeterministicUserFacingMessages() {
        let environment = AppEnvironment.fromDictionary([
            "CONVEX_BASE_URL": " https://staging.example.invalid ",
            "CONVEX_HTTP_ACTION_BASE_URL": "https://staging.example.invalid/site",
            "AUTH_CLIENT_ID": "client",
            "APP_ENV_NAME": "Staging",
            "LOG_LEVEL": "debug"
        ])
        XCTAssertEqual(environment.convexBaseURL, "https://staging.example.invalid")
        XCTAssertEqual(environment.appEnvName, "Staging")
        XCTAssertEqual(AuthError.missingCredentials.userMessage, "Enter both username and password.")
        XCTAssertEqual(AuthError.invalidCredentials.userMessage, "Username or password is incorrect.")
        XCTAssertEqual(AuthError.server(message: "Backend unavailable").userMessage, "Backend unavailable")
    }

    func testFilterAndTimelinePersistenceRoundTripValuesInIsolation() {
        let suiteName = "pensive.unit.filters.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let filters = LedgerFilterStore(defaults: defaults)
        XCTAssertFalse(filters.contains("accounts"))
        filters.save(["Savings", "Checking"], for: "accounts")
        XCTAssertTrue(filters.contains("accounts"))
        XCTAssertEqual(filters.load(for: "accounts"), ["Checking", "Savings"])

        let tracking = TrackingTimelineRowPersistenceStore(defaults: defaults)
        tracking.setStartMonth("2026-01", source: "expense", key: "Food")
        tracking.setTrailingBufferMonths(-3, source: "expense", key: "Food")
        XCTAssertEqual(tracking.startMonth(source: "expense", key: "Food"), "2026-01")
        XCTAssertEqual(tracking.trailingBufferMonths(source: "expense", key: "Food"), 0)
    }
}
