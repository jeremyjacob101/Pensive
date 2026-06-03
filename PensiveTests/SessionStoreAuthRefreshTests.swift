import XCTest
@testable import Pensive

@MainActor
final class SessionStoreAuthRefreshTests: XCTestCase {
    func testBootstrapSessionRefreshesWhenAccessExpiredAndRefreshTokenExists() async throws {
        let tokenStore = InMemoryAuthTokenStore(accessToken: "expired-access", refreshToken: "valid-refresh")
        let authAPI = MockAuthAPI(
            sessionResponses: [
                .init(authenticated: false, userId: nil, token: nil, refreshToken: nil),
                .init(authenticated: true, userId: "alice", token: "new-access", refreshToken: "new-refresh"),
            ],
            refreshResponse: .init(authenticated: true, userId: "alice", token: "new-access", refreshToken: "new-refresh")
        )
        let store = SessionStore(authAPI: authAPI, tokenStore: tokenStore)

        let authenticated = expectation(description: "Transitions to authenticated after refresh")
        store.onStateChange = { state in
            if case .authenticated(let session) = state, session.userId == "alice" {
                authenticated.fulfill()
            }
        }

        store.bootstrapSession()
        await fulfillment(of: [authenticated], timeout: 2.0)

        XCTAssertEqual(authAPI.refreshCallCount, 1)
        XCTAssertEqual(tokenStore.currentToken, "new-access")
        XCTAssertEqual(tokenStore.currentRefreshToken, "new-refresh")
        if case .authenticated(let session) = store.state {
            XCTAssertEqual(session.userId, "alice")
        } else {
            XCTFail("Expected authenticated state.")
        }
    }

    func testBootstrapUsesRefreshResponseWhenSessionReportsUnauthenticated() async throws {
        let tokenStore = InMemoryAuthTokenStore(accessToken: "expired-access", refreshToken: "valid-refresh")
        let authAPI = MockAuthAPI(
            sessionResponses: [
                .init(authenticated: false, userId: nil, token: nil, refreshToken: nil),
            ],
            refreshResponse: .init(authenticated: true, userId: "alice", token: "new-access", refreshToken: "new-refresh")
        )
        let store = SessionStore(authAPI: authAPI, tokenStore: tokenStore)

        let authenticated = expectation(description: "Uses refreshed session without clearing tokens")
        store.onStateChange = { state in
            if case .authenticated(let session) = state, session.userId == "alice" {
                authenticated.fulfill()
            }
        }

        store.bootstrapSession()
        await fulfillment(of: [authenticated], timeout: 2.0)

        XCTAssertEqual(authAPI.refreshCallCount, 1)
        XCTAssertEqual(tokenStore.currentToken, "new-access")
        XCTAssertEqual(tokenStore.currentRefreshToken, "new-refresh")
    }

    func testRecoverProtectedSessionClearsTokensWhenRefreshTokenIsRevoked() async throws {
        let tokenStore = InMemoryAuthTokenStore(accessToken: "expired-access", refreshToken: "revoked-refresh")
        let authAPI = MockAuthAPI(
            sessionResponses: [],
            refreshResponse: .init(authenticated: false, userId: nil, token: nil, refreshToken: nil),
            refreshError: APIError.unauthorized
        )
        let store = SessionStore(authAPI: authAPI, tokenStore: tokenStore)

        let unauthenticated = expectation(description: "Transitions to unauthenticated after revoked refresh")
        store.onStateChange = { state in
            if case .unauthenticated = state {
                unauthenticated.fulfill()
            }
        }

        let recovered = await store.recoverProtectedSession()
        await fulfillment(of: [unauthenticated], timeout: 2.0)

        XCTAssertFalse(recovered)
        XCTAssertNil(tokenStore.currentToken)
        XCTAssertNil(tokenStore.currentRefreshToken)
        XCTAssertEqual(store.authMessage, AuthError.sessionExpired.userMessage)
    }
}

private final class InMemoryAuthTokenStore: AuthTokenStoring {
    private(set) var currentToken: String?
    private(set) var currentRefreshToken: String?

    init(accessToken: String?, refreshToken: String?) {
        self.currentToken = accessToken
        self.currentRefreshToken = refreshToken
    }

    func setTokens(accessToken: String?, refreshToken: String?) {
        currentToken = accessToken
        currentRefreshToken = refreshToken
    }
}

private final class MockAuthAPI: AuthAPI {
    private var sessionResponses: [SessionResponse]
    private let refreshResult: SessionResponse
    private let refreshError: Error?
    private(set) var refreshCallCount = 0

    init(sessionResponses: [SessionResponse], refreshResponse: SessionResponse, refreshError: Error? = nil) {
        self.sessionResponses = sessionResponses
        self.refreshResult = refreshResponse
        self.refreshError = refreshError
    }

    func signIn(_ request: SignInRequest) async throws -> SessionResponse {
        throw APIError.server(message: "Not needed in this test")
    }

    func signUp(_ request: SignInRequest) async throws -> SessionResponse {
        throw APIError.server(message: "Not needed in this test")
    }

    func refresh(refreshToken: String) async throws -> SessionResponse {
        refreshCallCount += 1
        if let refreshError {
            throw refreshError
        }
        return refreshResult
    }

    func signOut() async throws {}

    func session() async throws -> SessionResponse {
        guard !sessionResponses.isEmpty else {
            return .init(authenticated: false, userId: nil, token: nil, refreshToken: nil)
        }
        return sessionResponses.removeFirst()
    }
}
