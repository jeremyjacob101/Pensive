import XCTest

final class PensiveUITests: XCTestCase {
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

        let expandButton = app.buttons["chevron.down"].firstMatch
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
        XCTAssertTrue(app.buttons["chevron.down"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["chevron.down"].firstMatch.tap()
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

        let raw = tabName.lowercased()
        let tabByID = app.tabBars.buttons["tab_\(raw)"]
        if tabByID.waitForExistence(timeout: 1) {
            tabByID.tap()
            return
        }

        let direct = app.tabBars.buttons[tabName]
        if direct.waitForExistence(timeout: 1) {
            direct.tap()
            return
        }

        for _ in 0 ..< 3 {
            let more = app.tabBars.buttons["More"]
            if more.waitForExistence(timeout: 1) {
                more.tap()
            }
            if tapOverflowTab(named: tabName, app: app) {
                return
            }
            scrollOverflowList(app: app)
            dismissBlockingAlertIfPresent(app)
        }

        XCTFail("Could not open tab named \(tabName)")
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

    private func tapOverflowTab(named tabName: String, app: XCUIApplication) -> Bool {
        let predicate = NSPredicate(format: "label == %@", tabName)
        let match = app.descendants(matching: .any).matching(predicate).firstMatch
        if match.waitForExistence(timeout: 1), match.isHittable {
            match.tap()
            return true
        }
        return false
    }

    private func scrollOverflowList(app: XCUIApplication) {
        if app.tables.firstMatch.exists {
            app.tables.firstMatch.swipeUp()
            return
        }
        if app.collectionViews.firstMatch.exists {
            app.collectionViews.firstMatch.swipeUp()
            return
        }
        if app.scrollViews.firstMatch.exists {
            app.scrollViews.firstMatch.swipeUp()
            return
        }
        app.swipeUp()
    }
}
