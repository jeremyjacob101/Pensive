import SwiftUI

struct RootView: View {
    @StateObject private var authViewModel: AuthViewModel
    private let container: AppContainer

    init(container: AppContainer) {
        self.container = container
        _authViewModel = StateObject(wrappedValue: AuthViewModel(sessionStore: container.sessionStore))
    }

    var body: some View {
        Group {
            switch authViewModel.state {
            case .launching, .loadingSession:
                ProgressView("Checking session…")
                    .accessibilityIdentifier("auth_loading")

            case .unauthenticated, .authenticating:
                LoginView(viewModel: authViewModel)
                    .accessibilityIdentifier("login_view")

            case .authenticated(let session):
                AppShellView(userId: session.userId, api: container.api, onSignOut: authViewModel.signOut, onDeleteAccount: authViewModel.deleteAccount)

            case .authError(let error):
                VStack(spacing: 12) {
                    Text("We couldn't verify your session")
                        .font(.headline)
                    Text(error.userMessage)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Try Again") {
                        authViewModel.retrySessionCheck()
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .accessibilityIdentifier("auth_error_view")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("root_view")
        .task {
            authViewModel.bootstrapSessionIfNeeded()
        }
    }
}

private struct LoginView: View {
    @ObservedObject var viewModel: AuthViewModel

    var body: some View {
        VStack(spacing: 16) {
            Text("Pensive")
                .font(.largeTitle.weight(.semibold))

            Text(viewModel.entryMode == .signIn ? "Sign in to continue" : "Create your account")
                .foregroundStyle(.secondary)

            Picker("Auth Mode", selection: $viewModel.entryMode) {
                ForEach(AuthViewModel.EntryMode.allCases) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("auth_mode_picker")

            TextField("Username", text: $viewModel.username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textContentType(.username)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier("username_field")

            SecureField("Password", text: $viewModel.password)
                .textContentType(.password)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier("password_field")

            if viewModel.entryMode == .createAccount {
                SecureField("Confirm Password", text: $viewModel.confirmPassword)
                    .textContentType(.newPassword)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("confirm_password_field")
            }

            if let inlineError = viewModel.inlineError, !inlineError.isEmpty {
                Text(inlineError)
                    .foregroundStyle(.red)
                    .font(.footnote)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("auth_inline_error")
            }

            Button {
                viewModel.submitAuth()
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                } else {
                    Text(viewModel.entryMode == .signIn ? "Sign In" : "Create Account")
                }
            }
            .frame(maxWidth: .infinity)
            .buttonStyle(.borderedProminent)
            .disabled(viewModel.isLoading)
            .accessibilityIdentifier("auth_submit_button")
        }
        .padding()
    }
}
