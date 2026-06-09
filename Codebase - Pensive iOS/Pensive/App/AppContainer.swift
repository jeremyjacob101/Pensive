import Foundation

struct AppContainer {
    let environment: AppEnvironment
    let sessionStore: SessionStoring
    let api: ConvexAPI

    static func bootstrap(bundle: Bundle = .main) -> AppContainer {
        let env = AppEnvironment.load(from: bundle)
        #if DEBUG
        print("AppEnvironment[\(env.appEnvName)] base=\(env.convexBaseURL) http=\(env.convexHTTPActionBaseURL)")
        #endif
        if let userId = ProcessInfo.processInfo.environment["UI_TEST_AUTHENTICATED_USER_ID"], !userId.isEmpty {
            let tokenStore = AuthTokenStore()
            let configuredAPI = AppContainer.makeAPI(environment: env, tokenStore: tokenStore)
            let api = configuredAPI.api
            return AppContainer(environment: env, sessionStore: UITestSessionStore(userId: userId), api: api)
        }
        let tokenStore = AuthTokenStore()
        let configuredAPI = AppContainer.makeAPI(environment: env, tokenStore: tokenStore)
        let api = configuredAPI.api
        let sessionStore = SessionStore(authAPI: api.auth, tokenStore: tokenStore)
        configuredAPI.httpClient.authRecoveryHandler = { [weak sessionStore] in
            await sessionStore?.recoverProtectedSession() ?? false
        }
        return AppContainer(environment: env, sessionStore: sessionStore, api: api)
    }

    private static func makeAPI(environment: AppEnvironment, tokenStore: AuthTokenStoring) -> (api: ConvexAPI, httpClient: HTTPClient) {
        let base = URL(string: environment.convexHTTPActionBaseURL) ?? URL(string: environment.convexBaseURL)!
        let transport = URLSessionConvexTransport(baseURL: base, authTokenProvider: { tokenStore.currentToken })
        let httpClient = HTTPClient(transport: transport)
        return (ConvexService(client: httpClient), httpClient)
    }
}

private final class UITestSessionStore: SessionStoring {
    private(set) var state: AuthState
    var onStateChange: ((AuthState) -> Void)?
    private(set) var authMessage: String?

    init(userId: String) {
        self.state = .authenticated(UserSession(userId: userId, establishedAt: Date()))
        self.authMessage = nil
    }

    func bootstrapSession() {}

    func signIn(username: String, password: String) {}
    func signUp(username: String, password: String) {}

    func signOut() {
        state = .unauthenticated
        onStateChange?(state)
    }

    func deleteAccount() {
        signOut()
    }

    func recoverProtectedSession() async -> Bool { true }

    func handleProtectedRequestFailure(_ error: Error) {}
}
