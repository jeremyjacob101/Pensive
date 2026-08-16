import XCTest

final class LiveNonProductionContractTests: XCTestCase {
    func testConfiguredNonProductionAuthSessionRouteReturnsTheExpectedEnvelope() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let rawBaseURL = environment["PENSIVE_IOS_TEST_HTTP_URL"], !rawBaseURL.isEmpty else {
            throw XCTSkip("Set PENSIVE_IOS_TEST_HTTP_URL to a disposable staging/test HTTP action URL to run live iOS contract tests.")
        }
        let lowered = rawBaseURL.lowercased()
        XCTAssertFalse(lowered.contains("frugal-mosquito-712"), "Live iOS tests must never target production.")
        XCTAssertFalse(lowered.contains("production"), "Live iOS tests must never target a production URL.")

        let baseURL = try XCTUnwrap(URL(string: rawBaseURL))
        XCTAssertTrue(["http", "https"].contains(baseURL.scheme?.lowercased()), "Live iOS tests require an HTTP(S) target.")
        XCTAssertFalse(lowered.contains("prod"), "Live iOS tests must never target a production-looking URL.")
        var request = URLRequest(url: baseURL.appendingPathComponent("api/auth/session"))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = try XCTUnwrap(response as? HTTPURLResponse)
        XCTAssertEqual(httpResponse.statusCode, 200)

        let envelope = try JSONDecoder().decode(LiveEnvelope.self, from: data)
        XCTAssertTrue(envelope.ok)
        XCTAssertNotNil(envelope.data)
        XCTAssertEqual(envelope.data?.authenticated, false)
    }
}

private struct LiveEnvelope: Decodable {
    let ok: Bool
    let data: LiveSession?
}

private struct LiveSession: Decodable {
    let authenticated: Bool
}
