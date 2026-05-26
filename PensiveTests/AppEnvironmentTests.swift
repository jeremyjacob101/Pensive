import XCTest
@testable import Pensive

final class AppEnvironmentTests: XCTestCase {
    func testConfigParserReadsAllExpectedKeys() {
        let values: [String: String] = [
            "CONVEX_BASE_URL": "https://debug.convex.cloud",
            "CONVEX_HTTP_ACTION_BASE_URL": "https://debug-actions.convex.cloud",
            "AUTH_CLIENT_ID": "client-123",
            "APP_ENV_NAME": "Debug",
            "LOG_LEVEL": "debug"
        ]

        let env = AppEnvironment.fromDictionary(values)

        XCTAssertEqual(env.convexBaseURL, "https://debug.convex.cloud")
        XCTAssertEqual(env.convexHTTPActionBaseURL, "https://debug-actions.convex.cloud")
        XCTAssertEqual(env.authClientID, "client-123")
        XCTAssertEqual(env.appEnvName, "Debug")
        XCTAssertEqual(env.logLevel, "debug")
    }
}
