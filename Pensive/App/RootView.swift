import SwiftUI

struct RootView: View {
    @ObservedObject var container: SessionStoreBridge
    let appEnvironment: AppEnvironment

    init(container: AppContainer) {
        self.container = SessionStoreBridge(store: container.sessionStore)
        self.appEnvironment = container.environment
    }

    var body: some View {
        VStack {
            switch container.status {
            case .checking:
                ProgressView("Checking session…")
            case .signedOut:
                VStack(spacing: 12) {
                    Text("Pensive")
                        .font(.title)
                    Text("Please sign in to continue")
                        .foregroundStyle(.secondary)
                }
                .padding()
            case .signedIn:
                Text("Pensive Home")
                    .font(.title2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("root_view")
        .task {
            container.bootstrapSession()
        }
    }
}

final class SessionStoreBridge: ObservableObject {
    @Published private(set) var status: AuthStatus
    private let store: SessionStore

    init(store: SessionStore) {
        self.store = store
        self.status = store.status
        store.onStatusChange = { [weak self] next in
            DispatchQueue.main.async {
                self?.status = next
            }
        }
    }

    func bootstrapSession() {
        store.bootstrapSession()
    }
}
