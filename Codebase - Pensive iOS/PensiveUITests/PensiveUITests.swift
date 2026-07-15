import XCTest

final class PensiveUITests: XCTestCase {
    func testUnauthenticatedUserCanReachAndValidateSignInForm() {
        let app = XCUIApplication()
        configure(app, authenticated: false)
        app.launchEnvironment["UI_TEST_UNAUTHENTICATED"] = "1"
        app.launch()

        XCTAssertTrue(element(id: "root_view", app: app).waitForExistence(timeout: 10))
        XCTAssertTrue(app.textFields["username_field"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.secureTextFields["password_field"].waitForExistence(timeout: 3))

        let submitButton = app.buttons["auth_submit_button"]
        XCTAssertTrue(submitButton.waitForExistence(timeout: 3))
        XCTAssertTrue(submitButton.isEnabled)
        submitButton.tap()
        XCTAssertTrue(app.staticTexts["Enter a username."].waitForExistence(timeout: 3))

        app.segmentedControls["auth_mode_picker"].buttons["Create Account"].tap()
        XCTAssertTrue(app.secureTextFields["confirm_password_field"].waitForExistence(timeout: 3))
    }

    func testAuthenticatedUserCanOpenExpenseLedgerAndNewExpenseForm() {
        let app = XCUIApplication()
        configure(app)
        app.launchEnvironment["UI_TEST_LEDGER_FIXTURE"] = "1"
        app.launch()

        XCTAssertTrue(app.staticTexts["UI Test Expense"].waitForExistence(timeout: 10))
        let addExpense = app.buttons["ledger_add_toolbar"]
        XCTAssertTrue(addExpense.waitForExistence(timeout: 3))
        addExpense.tap()
        XCTAssertTrue(app.navigationBars["New Expense"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.textFields["Name"].exists)
        XCTAssertTrue(app.textFields["Amount"].exists)
    }

    func testAuthenticatedUserCanOpenIncomingBulkForm() {
        let app = XCUIApplication()
        configure(app)
        app.launchEnvironment["UI_TEST_LEDGER_FIXTURE"] = "1"
        app.launch()

        openTab(named: "Incomings", app: app)
        let addIncoming = app.buttons["ledger_add_toolbar"]
        XCTAssertTrue(addIncoming.waitForExistence(timeout: 10))
        addIncoming.tap()

        XCTAssertTrue(app.navigationBars["New Incoming"].waitForExistence(timeout: 3))
        app.swipeUp()
        let bulkAdd = app.buttons["ledger_bulk_add"]
        XCTAssertTrue(bulkAdd.waitForExistence(timeout: 3))
        let entryCount = app.staticTexts["ledger_bulk_entry_count"]
        XCTAssertEqual(entryCount.label, "Entries: 1")

        bulkAdd.tap()
        XCTAssertTrue(entryCount.waitForExistence(timeout: 3))
        XCTAssertEqual(entryCount.label, "Entries: 2")
    }

    func testLaunchShowsRootView() {
        let app = XCUIApplication()
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        app.launchEnvironment["APP_ENV_NAME"] = "UITest"
        app.launchEnvironment["CONVEX_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["CONVEX_HTTP_ACTION_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["AUTH_CLIENT_ID"] = "ui-test-client"
        app.launchEnvironment["LOG_LEVEL"] = "debug"
        app.launchEnvironment["UI_TEST_AUTHENTICATED_USER_ID"] = "ui-test-user"
        app.launchEnvironment["UI_TEST_TRACKING_FIXTURE"] = "1"
        app.launchEnvironment["UI_TEST_NOTEPAD_FIXTURE"] = "1"
        app.launch()

        XCTAssertTrue(app.otherElements["root_view"].waitForExistence(timeout: 10))
        XCTAssertTrue(element(id: "shell_navigation_menu", app: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element(id: "tab_expenses", app: app).waitForExistence(timeout: 10))
    }

    func testTrackingRowPersistsStartMonthAndBufferWithinSession() {
        let app = XCUIApplication()
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        app.launchEnvironment["APP_ENV_NAME"] = "UITest"
        app.launchEnvironment["CONVEX_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["CONVEX_HTTP_ACTION_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["AUTH_CLIENT_ID"] = "ui-test-client"
        app.launchEnvironment["LOG_LEVEL"] = "debug"
        app.launchEnvironment["UI_TEST_AUTHENTICATED_USER_ID"] = "ui-test-user"
        app.launchEnvironment["UI_TEST_TRACKING_FIXTURE"] = "1"
        app.launchEnvironment["UI_TEST_NOTEPAD_FIXTURE"] = "1"
        app.launch()

        openTab(named: "Tracking", app: app)
        let rowTitle = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tracking_row_title_'")).firstMatch
        XCTAssertTrue(rowTitle.waitForExistence(timeout: 10))

        let expandButton = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tracking_row_expand_'")).firstMatch
        XCTAssertTrue(expandButton.waitForExistence(timeout: 10))
        expandButton.tap()
        let picker = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tracking_start_month_'")).firstMatch
        XCTAssertTrue(picker.waitForExistence(timeout: 10))
        let bufferMenu = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tracking_buffer_'")).firstMatch
        XCTAssertTrue(bufferMenu.waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        openTab(named: "Tracking", app: app)
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tracking_row_title_'")).firstMatch.waitForExistence(timeout: 10))
        let relaunchedExpandButton = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tracking_row_expand_'")).firstMatch
        XCTAssertTrue(relaunchedExpandButton.waitForExistence(timeout: 10))
        relaunchedExpandButton.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tracking_start_month_'")).firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tracking_buffer_'")).firstMatch.waitForExistence(timeout: 10))
    }

    func testNotepadNotesAndTablesWorkflow() {
        let app = XCUIApplication()
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        app.launchEnvironment["APP_ENV_NAME"] = "UITest"
        app.launchEnvironment["CONVEX_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["CONVEX_HTTP_ACTION_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["AUTH_CLIENT_ID"] = "ui-test-client"
        app.launchEnvironment["LOG_LEVEL"] = "debug"
        app.launchEnvironment["UI_TEST_AUTHENTICATED_USER_ID"] = "ui-test-user"
        app.launchEnvironment["UI_TEST_NOTEPAD_FIXTURE"] = "1"
        app.launch()

        openTab(named: "Notepad", app: app)

        let firstNoteRow = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'notepad_note_row_'")).firstMatch
        XCTAssertTrue(firstNoteRow.waitForExistence(timeout: 10))

        app.segmentedControls.buttons["Tables"].tap()
        let firstTableRow = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'notepad_table_row_'")).firstMatch
        XCTAssertTrue(firstTableRow.waitForExistence(timeout: 10))
    }

    private func openTab(named tabName: String, app: XCUIApplication) {
        dismissBlockingAlertIfPresent(app)

        let raw = normalizedTabName(tabName)
        if element(id: "tab_\(raw)", app: app).waitForExistence(timeout: 0.5) {
            return
        }

        let menu = element(id: "shell_navigation_menu", app: app)
        XCTAssertTrue(menu.waitForExistence(timeout: 5))
        menu.tap()

        let menuItemByID = element(id: "menu_tab_\(raw)", app: app)
        if menuItemByID.waitForExistence(timeout: 2) {
            menuItemByID.tap()
        } else {
            let menuItemByTitle = app.buttons[tabName]
            XCTAssertTrue(menuItemByTitle.waitForExistence(timeout: 2))
            menuItemByTitle.tap()
        }

        XCTAssertTrue(element(id: "tab_\(raw)", app: app).waitForExistence(timeout: 10))
    }

    private func dismissBlockingAlertIfPresent(_ app: XCUIApplication) {
        let alert = app.alerts.firstMatch
        guard alert.waitForExistence(timeout: 0.5) else { return }
        if alert.buttons["OK"].exists {
            alert.buttons["OK"].tap()
        } else if alert.buttons["Cancel"].exists {
            alert.buttons["Cancel"].tap()
        } else if alert.buttons.firstMatch.exists {
            alert.buttons.firstMatch.tap()
        }
    }

    private func normalizedTabName(_ tabName: String) -> String {
        tabName.lowercased().replacingOccurrences(of: " ", with: "")
    }

    private func configure(_ app: XCUIApplication, authenticated: Bool = true) {
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        app.launchEnvironment["APP_ENV_NAME"] = "UITest"
        app.launchEnvironment["CONVEX_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["CONVEX_HTTP_ACTION_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["AUTH_CLIENT_ID"] = "ui-test-client"
        app.launchEnvironment["LOG_LEVEL"] = "debug"
        if authenticated {
            app.launchEnvironment["UI_TEST_AUTHENTICATED_USER_ID"] = "ui-test-user"
            app.launchEnvironment["UI_TEST_TRACKING_FIXTURE"] = "1"
            app.launchEnvironment["UI_TEST_NOTEPAD_FIXTURE"] = "1"
        }
    }

    private func element(id: String, app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }
}
