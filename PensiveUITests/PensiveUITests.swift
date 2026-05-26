import XCTest

final class PensiveUITests: XCTestCase {
    func testLaunchShowsRootView() {
        let app = XCUIApplication()
        app.launchEnvironment["APP_ENV_NAME"] = "UITest"
        app.launchEnvironment["CONVEX_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["CONVEX_HTTP_ACTION_BASE_URL"] = "https://ui-test.convex.cloud"
        app.launchEnvironment["AUTH_CLIENT_ID"] = "ui-test-client"
        app.launchEnvironment["LOG_LEVEL"] = "debug"
        app.launch()

        XCTAssertTrue(app.otherElements["root_view"].waitForExistence(timeout: 10))
    }
}
