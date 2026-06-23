import SwiftUI

enum ViewLoadState {
    case loading
    case empty(message: String)
    case error(message: String)
    case content

    var hasLoadedContent: Bool {
        if case .content = self { return true }
        if case .empty = self { return true }
        return false
    }
}

struct LoadStateView<Content: View>: View {
    let state: ViewLoadState
    let retry: (() -> Void)?
    @ViewBuilder let content: Content

    init(state: ViewLoadState, retry: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.state = state
        self.retry = retry
        self.content = content()
    }

    var body: some View {
        switch state {
        case .loading:
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .empty(let message):
            ContentUnavailableView("Nothing here yet", systemImage: "tray", description: Text(message))
        case .error(let message):
            VStack(spacing: 12) {
                ContentUnavailableView("Something went wrong", systemImage: "exclamationmark.triangle", description: Text(message))
                if let retry {
                    Button("Retry", action: retry)
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding()
        case .content:
            content
        }
    }
}
