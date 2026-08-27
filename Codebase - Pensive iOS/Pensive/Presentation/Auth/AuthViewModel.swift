import Foundation

@MainActor
final class AuthViewModel: ObservableObject {
    @Published private(set) var state: AuthState
    @Published var username: String = ""
    @Published var password: String = ""
    @Published private(set) var inlineError: String?

    private let sessionStore: SessionStoring

    init(sessionStore: SessionStoring) {
        self.sessionStore = sessionStore
        self.state = sessionStore.state
        self.inlineError = sessionStore.authMessage

        sessionStore.onStateChange = { [weak self] next in
            guard let self else { return }
            Task { @MainActor in
                self.state = next
                self.inlineError = self.sessionStore.authMessage
                self.handleStateTransition(next)
            }
        }
    }

    func bootstrapSessionIfNeeded() {
        guard case .launching = state else { return }
        state = .loadingSession
        sessionStore.bootstrapSession()
    }

    func signIn() {
        inlineError = nil
        sessionStore.signIn(username: username, password: password)
    }

    func submitAuth() {
        inlineError = nil

        let normalizedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalizedUsername.isEmpty else {
            inlineError = "Enter a username."
            return
        }
        guard normalizedUsername.range(of: #"^[a-z0-9._-]{3,32}$"#, options: .regularExpression) != nil else {
            inlineError = "Username must be 3-32 chars: letters, numbers, ., _, -."
            return
        }

        guard normalizedPassword.count >= 8 else {
            inlineError = "Password must be at least 8 characters."
            return
        }

        sessionStore.signIn(username: username, password: password)
    }

    func signOut() {
        clearCredentials()
        inlineError = nil
        sessionStore.signOut()
    }

    func deleteAccount() {
        clearCredentials()
        inlineError = nil
        sessionStore.deleteAccount()
    }

    func retrySessionCheck() {
        inlineError = nil
        sessionStore.bootstrapSession()
    }

    var isLoading: Bool {
        switch state {
        case .loadingSession, .authenticating:
            return true
        default:
            return false
        }
    }

    private func handleStateTransition(_ next: AuthState) {
        switch next {
        case .authenticated:
            clearCredentials()
            inlineError = nil
        case .unauthenticated:
            clearCredentials()
        default:
            break
        }
    }

    private func clearCredentials() {
        username = ""
        password = ""
    }
}
