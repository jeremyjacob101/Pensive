import XCTest
@testable import Pensive

final class HTTPAPIContractTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.reset()
        super.tearDown()
    }

    func testURLSessionTransportAndConvexServiceUseTheHTTPRouteContract() async throws {
        StubURLProtocol.responder = { request in
            switch request.url?.path {
            case "/api/auth/session":
                return .json(200, #"{"ok":true,"data":{"authenticated":true,"userId":"alice","token":"access","refreshToken":"refresh"}}"#)
            case "/api/expenses/month-bounds":
                return .json(200, #"{"ok":true,"data":{"newestMonth":"2026-08","oldestMonth":"2026-01"}}"#)
            case "/api/tracking/list":
                return .json(200, #"{"ok":true,"data":{"currentMonth":"2026-08","rows":[]}}"#)
            case "/api/auth/sign-out":
                return .json(200, #"{"ok":true,"data":{}}"#)
            default:
                return .json(404, #"{"ok":false,"error":{"code":"not_found","message":"missing route"}}"#)
            }
        }

        let service = ConvexService(client: makeClient(token: "access"))
        let session = try await service.auth.session()
        XCTAssertTrue(session.authenticated)
        XCTAssertEqual(session.userId, "alice")
        let bounds = try await service.expenses.monthBounds()
        XCTAssertEqual(bounds.newestMonth, "2026-08")
        let tracking = try await service.tracking.list()
        XCTAssertTrue(tracking.rows.isEmpty)
        try await service.auth.signOut()

        XCTAssertEqual(
            StubURLProtocol.requests.map { $0.url?.path },
            [
                "/api/auth/session",
                "/api/expenses/month-bounds",
                "/api/tracking/list",
                "/api/auth/sign-out"
            ]
        )
        XCTAssertEqual(StubURLProtocol.requests.first?.value(forHTTPHeaderField: "Authorization"), "Bearer access")
        XCTAssertEqual(StubURLProtocol.requests.last?.value(forHTTPHeaderField: "Authorization"), "Bearer access")
    }

    func testHTTPClientSupportsDirectPayloadCompatibilityAndObservesCorrelationIDs() async throws {
        StubURLProtocol.responder = { request in
            guard request.url?.path == "/api/summaries/range" else {
                return .json(404, #"{"ok":false,"error":{"code":"not_found","message":"missing route"}}"#)
            }
            return .json(
                200,
                #"{"startDate":"2026-08-01","endDate":"2026-08-31","totals":{"rawExpenses":10,"effectiveExpenses":8,"rawIncomings":20,"effectiveIncomings":20,"rawNet":10,"effectiveNet":12},"monthlyBuckets":[]}"#,
                headers: ["X-Correlation-ID": "corr-123"]
            )
        }
        let observer = RecordingObserver()
        let client = makeClient(observer: observer)
        let service = ConvexService(client: client)
        let summary = try await service.summaries.range(.init(startDate: "2026-08-01", endDate: "2026-08-31"))
        XCTAssertEqual(summary.totals.effectiveNet, 12)
        XCTAssertEqual(observer.endpoint, "api/summaries/range")
        XCTAssertEqual(observer.statusCode, 200)
        XCTAssertEqual(observer.correlationId, "corr-123")
    }

    func testHTTPClientMapsWrappedErrorsToAPIErrorAndDoesNotRecoverAuthRoutes() async throws {
        StubURLProtocol.responder = { _ in
            .json(422, #"{"ok":false,"error":{"code":"validation","message":"Username is invalid"}}"#)
        }
        let recovery = RecoveryRecorder()
        let client = makeClient()
        client.authRecoveryHandler = {
            recovery.count += 1
            return true
        }

        do {
            let _: SessionResponse = try await client.send(
                .init(endpoint: "api/auth/sign-in", method: .post, isIdempotent: false, isMutation: true, allowsAuthRecovery: false),
                body: SignInRequest(username: "bad", password: "bad")
            )
            XCTFail("Expected validation error")
        } catch let error as APIError {
            XCTAssertEqual(error, .validation(message: "Username is invalid"))
        }
        XCTAssertEqual(recovery.count, 0)
    }

    func testProtectedUnauthorizedCanRefreshOnceAndRetryThroughRealURLSessionTransport() async throws {
        StubURLProtocol.responseSequence = [
            .json(401, #"{"ok":false,"error":{"code":"unauthorized","message":"Unauthenticated"}}"#),
            .json(200, #"{"ok":true,"data":{"newestMonth":"2026-08","oldestMonth":"2026-01"}}"#)
        ]
        var recoveryCount = 0
        let client = makeClient()
        client.authRecoveryHandler = {
            recoveryCount += 1
            return true
        }
        let bounds: MonthBoundsResponse = try await client.send(
            .init(endpoint: "api/expenses/month-bounds", method: .get, isIdempotent: true, isMutation: false),
            body: Optional<EmptyBody>.none
        )
        XCTAssertEqual(bounds.newestMonth, "2026-08")
        XCTAssertEqual(recoveryCount, 1)
        XCTAssertEqual(StubURLProtocol.requests.count, 2)
    }

    private func makeClient(
        token: String? = nil,
        observer: HTTPClientObserver? = nil
    ) -> HTTPClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let transport = URLSessionConvexTransport(
            baseURL: URL(string: "https://test.invalid")!,
            session: session,
            authTokenProvider: { token }
        )
        return HTTPClient(transport: transport, observer: observer)
    }
}

private final class RecordingObserver: HTTPClientObserver {
    var endpoint: String?
    var statusCode: Int?
    var correlationId: String?

    func requestCompleted(endpoint: String, statusCode: Int, durationMs: Int, correlationId: String?) {
        self.endpoint = endpoint
        self.statusCode = statusCode
        self.correlationId = correlationId
    }
}

private final class RecoveryRecorder {
    var count = 0
}

private final class StubURLProtocol: URLProtocol {
    struct Response {
        let status: Int
        let data: Data
        let headers: [String: String]

        static func json(_ status: Int, _ body: String, headers: [String: String] = [:]) -> Response {
            Response(status: status, data: Data(body.utf8), headers: ["Content-Type": "application/json"].merging(headers) { _, new in new })
        }
    }

    nonisolated(unsafe) static var responder: ((URLRequest) -> Response)?
    nonisolated(unsafe) static var responseSequence: [Response] = []
    nonisolated(unsafe) static var requests: [URLRequest] = []

    static func reset() {
        responder = nil
        responseSequence = []
        requests = []
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        let response = if !Self.responseSequence.isEmpty {
            Self.responseSequence.removeFirst()
        } else if let responder = Self.responder {
            responder(request)
        } else {
            Response.json(500, #"{"ok":false,"error":{"code":"server","message":"No stub response"}}"#)
        }
        let httpResponse = HTTPURLResponse(
            url: request.url!,
            statusCode: response.status,
            httpVersion: nil,
            headerFields: response.headers
        )!
        client?.urlProtocol(self, didReceive: httpResponse, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: response.data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
