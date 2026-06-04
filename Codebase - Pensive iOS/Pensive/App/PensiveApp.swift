import SwiftUI

@main
struct PensiveApp: App {
    private let container: AppContainer

    init() {
        self.container = AppContainer.bootstrap()
    }

    var body: some Scene {
        WindowGroup {
            RootView(container: container)
        }
    }
}
