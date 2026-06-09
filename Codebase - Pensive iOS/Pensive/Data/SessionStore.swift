import Foundation

protocol SessionStoring: AnyObject {
    var state: AuthState { get }
    var onStateChange: ((AuthState) -> Void)? { get set }
    var authMessage: String? { get }

    func bootstrapSession()
    func signIn(username: String, password: String)
    func signUp(username: String, password: String)
    func signOut()
    func deleteAccount()
    func recoverProtectedSession() async -> Bool
    func handleProtectedRequestFailure(_ error: Error)
}

final class SessionStore: SessionStoring {
    private let authAPI: AuthAPI
    private let tokenStore: AuthTokenStoring
    private let cookieStorage: HTTPCookieStorage
    private let stateQueue = DispatchQueue(label: "pensive.session-store.state", qos: .userInitiated)

    private(set) var state: AuthState = .launching
    var onStateChange: ((AuthState) -> Void)?
    private(set) var authMessage: String?

    private var bootstrapTask: Task<Void, Never>?
    private var authTask: Task<Void, Never>?
    private var recoveryTask: (id: Int, task: Task<Bool, Never>)?
    private var nextRecoveryTaskID = 0

    init(
        authAPI: AuthAPI,
        tokenStore: AuthTokenStoring = AuthTokenStore(),
        cookieStorage: HTTPCookieStorage = .shared
    ) {
        self.authAPI = authAPI
        self.tokenStore = tokenStore
        self.cookieStorage = cookieStorage
    }

    func bootstrapSession() {
        stateQueue.sync {
            guard bootstrapTask == nil else { return }
            transition(to: .loadingSession)
            bootstrapTask = Task { [weak self] in
                guard let self else { return }
                defer { self.stateQueue.sync { self.bootstrapTask = nil } }

                do {
                    var response = try await self.authAPI.session()
                    if !response.authenticated,
                       let refreshedResponse = try await self.refreshSessionFromStoredToken() {
                        response = refreshedResponse
                    }
                    if response.authenticated, let userId = response.userId, !userId.isEmpty {
                        self.persistTokens(from: response)
                        self.authMessage = nil
                        self.transition(to: .authenticated(UserSession(userId: userId, establishedAt: Date())))
                    } else {
                        self.authMessage = nil
                        self.transition(to: .unauthenticated)
                    }
                } catch {
                    if let apiError = error as? APIError, apiError == .unauthorized {
                        self.expireSession()
                        return
                    }
                    let mapped = self.mapAuthError(error)
                    // Never hard-block launch on session bootstrap errors.
                    // Fall back to unauthenticated so the user can sign in immediately.
                    self.authMessage = mapped.userMessage
                    self.transition(to: .unauthenticated)
                }
            }
        }
    }

    func signIn(username: String, password: String) {
        authenticate(username: username, password: password, mode: .signIn)
    }

    func signUp(username: String, password: String) {
        authenticate(username: username, password: password, mode: .signUp)
    }

    private enum AuthFlowMode {
        case signIn
        case signUp
    }

    private func authenticate(username: String, password: String, mode: AuthFlowMode) {
        let normalizedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalizedUsername.isEmpty, !normalizedPassword.isEmpty else {
            authMessage = AuthError.missingCredentials.userMessage
            transition(to: .unauthenticated)
            return
        }

        stateQueue.sync {
            authTask?.cancel()
            cancelRecoveryTaskLocked()
            transition(to: .authenticating)

            authTask = Task { [weak self] in
                guard let self else { return }
                defer { self.stateQueue.sync { self.authTask = nil } }

                do {
                    let response: SessionResponse
                    switch mode {
                    case .signIn:
                        response = try await self.authAPI.signIn(.init(username: normalizedUsername, password: normalizedPassword))
                    case .signUp:
                        response = try await self.authAPI.signUp(.init(username: normalizedUsername, password: normalizedPassword))
                    }
                    guard response.authenticated, let userId = response.userId, !userId.isEmpty else {
                        let error: AuthError
                        switch mode {
                        case .signIn: error = .invalidCredentials
                        case .signUp: error = .server(message: "Failed to create account.")
                        }
                        self.authMessage = error.userMessage
                        self.transition(to: .unauthenticated)
                        return
                    }

                    self.authMessage = nil
                    self.persistTokens(from: response)
                    self.transition(to: .authenticated(UserSession(userId: userId, establishedAt: Date())))
                } catch {
                    let mapped = self.mapAuthError(error)
                    switch mapped {
                    case .invalidCredentials, .missingCredentials, .networkUnavailable:
                        self.authMessage = mapped.userMessage
                        self.transition(to: .unauthenticated)
                    default:
                        self.transition(to: .authError(mapped))
                    }
                }
            }
        }
    }

    func signOut() {
        stateQueue.sync {
            authTask?.cancel()
            cancelRecoveryTaskLocked()
            authTask = Task { [weak self] in
                guard let self else { return }
                defer { self.stateQueue.sync { self.authTask = nil } }

                do {
                    try await self.authAPI.signOut()
                } catch {
                    // Sign-out must still clear local auth state even if backend call fails.
                }

                self.clearSessionArtifacts()
                self.authMessage = nil
                self.transition(to: .unauthenticated)
            }
        }
    }

    func deleteAccount() {
        stateQueue.sync {
            authTask?.cancel()
            cancelRecoveryTaskLocked()
            transition(to: .authenticating)

            authTask = Task { [weak self] in
                guard let self else { return }
                defer { self.stateQueue.sync { self.authTask = nil } }

                do {
                    try await self.authAPI.deleteAccount()
                    self.clearSessionArtifacts()
                    self.authMessage = nil
                    self.transition(to: .unauthenticated)
                } catch {
                    let mapped = self.mapAuthError(error)
                    self.authMessage = mapped.userMessage
                    self.transition(to: .authError(mapped))
                }
            }
        }
    }

    func handleProtectedRequestFailure(_ error: Error) {
        guard let apiError = error as? APIError, apiError == .unauthorized else { return }

        Task { [weak self] in
            guard let self else { return }
            _ = await self.recoverProtectedSession()
        }
    }

    func recoverProtectedSession() async -> Bool {
        let recovery = stateQueue.sync { () -> (id: Int, task: Task<Bool, Never>) in
            if let recoveryTask {
                return recoveryTask
            }

            let id = nextRecoveryTaskID
            nextRecoveryTaskID += 1
            let task = Task { [weak self] in
                guard let self else { return false }
                return await self.performProtectedSessionRecovery()
            }
            recoveryTask = (id, task)
            return (id, task)
        }

        let recovered = await recovery.task.value
        stateQueue.sync {
            if recoveryTask?.id == recovery.id {
                recoveryTask = nil
            }
        }
        return recovered
    }

    private func performProtectedSessionRecovery() async -> Bool {
        guard let refreshToken = tokenStore.currentRefreshToken, !refreshToken.isEmpty else {
            expireSession()
            return false
        }

        do {
            let response = try await refreshSession(using: refreshToken)
            guard !Task.isCancelled else { return false }
            authMessage = nil
            if response.authenticated, let userId = response.userId, !userId.isEmpty {
                transition(to: .authenticated(UserSession(userId: userId, establishedAt: Date())))
            }
            return tokenStore.currentToken?.isEmpty == false
        } catch {
            if Task.isCancelled { return false }
            if let apiError = error as? APIError, apiError == .unauthorized {
                expireSession()
            } else {
                authMessage = mapAuthError(error).userMessage
            }
            return false
        }
    }

    private func cancelRecoveryTaskLocked() {
        recoveryTask?.task.cancel()
        recoveryTask = nil
    }

    private func clearSessionArtifacts() {
        cookieStorage.cookies?.forEach { cookieStorage.deleteCookie($0) }
        tokenStore.setTokens(accessToken: nil, refreshToken: nil)
    }

    private func persistTokens(from response: SessionResponse) {
        tokenStore.setTokens(
            accessToken: response.token ?? tokenStore.currentToken,
            refreshToken: response.refreshToken ?? tokenStore.currentRefreshToken
        )
    }

    private func refreshSessionFromStoredToken() async throws -> SessionResponse? {
        guard let refreshToken = tokenStore.currentRefreshToken, !refreshToken.isEmpty else {
            return nil
        }
        return try await refreshSession(using: refreshToken)
    }

    private func refreshSession(using refreshToken: String) async throws -> SessionResponse {
        let refreshed = try await authAPI.refresh(refreshToken: refreshToken)
        persistTokens(from: refreshed)
        if refreshed.authenticated, let userId = refreshed.userId, !userId.isEmpty {
            return refreshed
        }
        return try await authAPI.session()
    }

    private func expireSession() {
        clearSessionArtifacts()
        authMessage = AuthError.sessionExpired.userMessage
        transition(to: .unauthenticated)
    }

    private func transition(to next: AuthState) {
        state = next
        DispatchQueue.main.async { [onStateChange] in
            onStateChange?(next)
        }
    }

    private func mapAuthError(_ error: Error) -> AuthError {
        guard let apiError = error as? APIError else {
            return .unknown
        }

        switch apiError {
        case .unauthorized:
            return .invalidCredentials
        case .networkUnavailable:
            return .networkUnavailable
        case .notFound:
            return .server(message: "Auth endpoint not found. Verify CONVEX_HTTP_ACTION_BASE_URL and deployed HTTP auth routes.")
        case .decoding(let message):
            return .server(message: "Auth response format mismatch. \(message)")
        case .validation(let message):
            return .server(message: message)
        case .server(let message):
            return .server(message: message)
        case .forbidden:
            return .unknown
        }
    }
}
