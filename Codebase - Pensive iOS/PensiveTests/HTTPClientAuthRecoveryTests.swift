import XCTest
@testable import Pensive

final class HTTPClientAuthRecoveryTests: XCTestCase {
    func testProtectedUnauthorizedRefreshesAndRetriesOnce() async throws {
        let transport = QueuedTransport(responses: [
            .unauthorized,
            .okString("done"),
        ])
        var recoveryCallCount = 0
        let client = HTTPClient(transport: transport, authRecoveryHandler: {
            recoveryCallCount += 1
            return true
        })

        let result: String = try await client.send(
            .init(endpoint: "api/expenses/month-bounds", method: .get, isIdempotent: true, isMutation: false),
            body: Optional<EmptyBody>.none
        )

        XCTAssertEqual(result, "done")
        XCTAssertEqual(recoveryCallCount, 1)
        XCTAssertEqual(transport.performedEndpoints, ["api/expenses/month-bounds", "api/expenses/month-bounds"])
    }

    func testAuthUnauthorizedDoesNotAttemptRecovery() async throws {
        let transport = QueuedTransport(responses: [.unauthorized])
        var recoveryCallCount = 0
        let client = HTTPClient(transport: transport, authRecoveryHandler: {
            recoveryCallCount += 1
            return true
        })

        do {
            let _: SessionResponse = try await client.send(
                .init(
                    endpoint: "api/auth/sign-in",
                    method: .post,
                    isIdempotent: false,
                    isMutation: true,
                    allowsAuthRecovery: false
                ),
                body: SignInRequest(username: "alice", password: "bad-password")
            )
            XCTFail("Expected unauthorized error.")
        } catch let error as APIError {
            XCTAssertEqual(error, .unauthorized)
        }

        XCTAssertEqual(recoveryCallCount, 0)
        XCTAssertEqual(transport.performedEndpoints, ["api/auth/sign-in"])
    }

    func testProtectedUnauthorizedDoesNotRetryWhenRecoveryFails() async throws {
        let transport = QueuedTransport(responses: [.unauthorized])
        var recoveryCallCount = 0
        let client = HTTPClient(transport: transport, authRecoveryHandler: {
            recoveryCallCount += 1
            return false
        })

        do {
            let _: String = try await client.send(
                .init(endpoint: "api/expenses/month-bounds", method: .get, isIdempotent: true, isMutation: false),
                body: Optional<EmptyBody>.none
            )
            XCTFail("Expected unauthorized error.")
        } catch let error as APIError {
            XCTAssertEqual(error, .unauthorized)
        }

        XCTAssertEqual(recoveryCallCount, 1)
        XCTAssertEqual(transport.performedEndpoints, ["api/expenses/month-bounds"])
    }
}

private final class QueuedTransport: ConvexTransport {
    private var responses: [HTTPTransportResponse]
    private(set) var performedEndpoints: [String] = []

    init(responses: [HTTPTransportResponse]) {
        self.responses = responses
    }

    func perform<B: Encodable>(spec: HTTPRequestSpec, body: B?, timeout: TimeInterval) async throws -> HTTPTransportResponse {
        performedEndpoints.append(spec.endpoint)
        guard !responses.isEmpty else {
            throw APIError.server(message: "No queued response for \(spec.endpoint)")
        }
        return responses.removeFirst()
    }
}

private extension HTTPTransportResponse {
    static var unauthorized: HTTPTransportResponse {
        HTTPTransportResponse(
            data: Data(#"{"ok":false,"error":{"code":"unauthorized","message":"Unauthenticated"}}"#.utf8),
            statusCode: 401,
            headers: [:],
            durationMs: 1
        )
    }

    static func okString(_ value: String) -> HTTPTransportResponse {
        HTTPTransportResponse(
            data: Data(#"{"ok":true,"data":"\#(value)"}"#.utf8),
            statusCode: 200,
            headers: [:],
            durationMs: 1
        )
    }
}
