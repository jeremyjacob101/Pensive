import Foundation

struct AppContainer {
    let environment: AppEnvironment
    let sessionStore: SessionStore

    static func bootstrap(bundle: Bundle = .main) -> AppContainer {
        let env = AppEnvironment.load(from: bundle)
        return AppContainer(environment: env, sessionStore: SessionStore())
    }
}
