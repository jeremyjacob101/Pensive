import XCTest

final class UIWorkflowTests: XCTestCase {
    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    func testUnauthenticatedUserCanValidateSignIn() {
        let app = XCUIApplication()
        configure(app, authenticated: false)
        app.launchEnvironment["UI_TEST_UNAUTHENTICATED"] = "1"
        app.launch()

        XCTAssertTrue(element(id: "root_view", app: app).waitForExistence(timeout: 10))
        XCTAssertTrue(app.textFields["username_field"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.secureTextFields["password_field"].waitForExistence(timeout: 3))
        app.buttons["auth_submit_button"].tap()
        XCTAssertTrue(app.staticTexts["Enter a username."].waitForExistence(timeout: 3))
        XCTAssertFalse(app.segmentedControls["auth_mode_picker"].exists)
        XCTAssertFalse(app.secureTextFields["confirm_password_field"].exists)
        XCTAssertFalse(app.buttons["Create Account"].exists)
        XCTAssertEqual(app.buttons["auth_submit_button"].label, "Sign In")
    }

    func testAuthenticatedUserCanOpenExpenseEditorAndCancelWithoutPersisting() {
        let app = launchedAuthenticatedApp(ledger: true)
        XCTAssertTrue(app.staticTexts["UI Test Expense"].waitForExistence(timeout: 10))
        app.buttons["ledger_add_toolbar"].tap()
        XCTAssertTrue(app.navigationBars["New Expense"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.textFields["Name"].exists)
        XCTAssertTrue(app.textFields["Amount"].exists)
        app.buttons["Cancel"].tap()
        XCTAssertTrue(app.staticTexts["UI Test Expense"].waitForExistence(timeout: 3))
    }

    func testAuthenticatedUserCanUseIncomingBulkEditor() {
        let app = launchedAuthenticatedApp(ledger: true)
        openTab(named: "Incomings", app: app)
        app.buttons["ledger_add_toolbar"].tap()
        XCTAssertTrue(app.navigationBars["New Incoming"].waitForExistence(timeout: 5))
        app.swipeUp()
        XCTAssertTrue(app.buttons["ledger_bulk_add"].waitForExistence(timeout: 3))
        app.buttons["ledger_bulk_add"].tap()
        XCTAssertTrue(app.staticTexts["Entry 1"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Entry 2"].waitForExistence(timeout: 3))
    }

    func testAuthenticatedUserCanNavigateEveryPrimaryFeature() {
        let app = launchedAuthenticatedApp(ledger: true, tracking: true, notepad: true)
        for tab in ["Expenses", "Incomings", "Breakdown", "Recurrings", "Tracking", "Notepad", "Savings", "Options"] {
            openTab(named: tab, app: app)
            XCTAssertTrue(element(id: "tab_\(normalizedTabName(tab))", app: app).exists)
        }
    }

    func testTrackingFeatureExposesPersistentControlsAcrossRelaunch() {
        let app = launchedAuthenticatedApp(ledger: true, tracking: true)
        openTab(named: "Tracking", app: app)
        let rowTitle = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'tracking_row_title_'")
        ).firstMatch
        XCTAssertTrue(rowTitle.waitForExistence(timeout: 10))
        let expandButton = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'tracking_row_expand_'")
        ).firstMatch
        XCTAssertTrue(expandButton.waitForExistence(timeout: 10))
        expandButton.tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'tracking_start_month_'")
        ).firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'tracking_buffer_'")
        ).firstMatch.waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        openTab(named: "Tracking", app: app)
        XCTAssertTrue(app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'tracking_row_title_'")
        ).firstMatch.waitForExistence(timeout: 10))
    }

    func testNotepadFeatureRendersNotesAndTables() {
        let app = launchedAuthenticatedApp(notepad: true)
        openTab(named: "Notepad", app: app)
        XCTAssertTrue(app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'notepad_note_row_'")
        ).firstMatch.waitForExistence(timeout: 10))
        app.segmentedControls.buttons["Tables"].tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'notepad_table_row_'")
        ).firstMatch.waitForExistence(timeout: 10))
    }

    func testSavingsFeatureRendersPreviewAndOpensBalanceEditor() {
        let app = launchedAuthenticatedApp(savings: true)
        openTab(named: "Savings", app: app)

        XCTAssertTrue(element(id: "savings_summary", app: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element(id: "savings_chart", app: app).waitForExistence(timeout: 10))

        let fiveYears = app.buttons["5Y"]
        XCTAssertTrue(fiveYears.waitForExistence(timeout: 3))
        fiveYears.tap()
        XCTAssertTrue(app.staticTexts["Forecast · 5Y"].waitForExistence(timeout: 3))

        let addMenu = app.buttons["savings_add_menu"]
        XCTAssertTrue(addMenu.waitForExistence(timeout: 3))
        addMenu.tap()
        let addBalance = app.buttons["Add balance"]
        XCTAssertTrue(addBalance.waitForExistence(timeout: 3))
        addBalance.tap()
        XCTAssertTrue(app.navigationBars["Add balance"].waitForExistence(timeout: 3))
    }

    private func launchedAuthenticatedApp(
        ledger: Bool = false,
        tracking: Bool = false,
        notepad: Bool = false,
        savings: Bool = false
    ) -> XCUIApplication {
        let app = XCUIApplication()
        configure(app)
        if ledger { app.launchEnvironment["UI_TEST_LEDGER_FIXTURE"] = "1" }
        if tracking { app.launchEnvironment["UI_TEST_TRACKING_FIXTURE"] = "1" }
        if notepad { app.launchEnvironment["UI_TEST_NOTEPAD_FIXTURE"] = "1" }
        if savings { app.launchEnvironment["UI_TEST_SAVINGS_PREVIEW"] = "1" }
        app.launch()
        XCTAssertTrue(element(id: "root_view", app: app).waitForExistence(timeout: 10))
        return app
    }

    private func openTab(named tabName: String, app: XCUIApplication) {
        let normalized = normalizedTabName(tabName)
        if element(id: "tab_\(normalized)", app: app).waitForExistence(timeout: 0.5) { return }
        let menu = element(id: "shell_navigation_menu", app: app)
        XCTAssertTrue(menu.waitForExistence(timeout: 5))
        menu.tap()
        let menuItem = element(id: "menu_tab_\(normalized)", app: app)
        if menuItem.waitForExistence(timeout: 2) {
            menuItem.tap()
        } else {
            XCTAssertTrue(app.buttons[tabName].waitForExistence(timeout: 2))
            app.buttons[tabName].tap()
        }
        XCTAssertTrue(element(id: "tab_\(normalized)", app: app).waitForExistence(timeout: 10))
    }

    private func configure(_ app: XCUIApplication, authenticated: Bool = true) {
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        app.launchEnvironment["APP_ENV_NAME"] = "UITest"
        // UI tests use a loopback target so a missing local backend cannot touch any remote deployment.
        app.launchEnvironment["CONVEX_BASE_URL"] = "http://127.0.0.1:3210"
        app.launchEnvironment["CONVEX_HTTP_ACTION_BASE_URL"] = "http://127.0.0.1:3210"
        app.launchEnvironment["AUTH_CLIENT_ID"] = "pensive-ios-ui-tests"
        app.launchEnvironment["LOG_LEVEL"] = "debug"
        if authenticated {
            app.launchEnvironment["UI_TEST_AUTHENTICATED_USER_ID"] = "ui-test-user"
        }
    }

    private func normalizedTabName(_ tabName: String) -> String {
        tabName.lowercased().replacingOccurrences(of: " ", with: "")
    }

    private func element(id: String, app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }
}
