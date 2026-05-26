import Foundation

protocol AuthTokenStoring: AnyObject {
    var currentToken: String? { get }
    func setToken(_ token: String?)
}

final class AuthTokenStore: AuthTokenStoring {
    private let defaults: UserDefaults
    private let key = "pensive.auth.token"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var currentToken: String? {
        defaults.string(forKey: key)
    }

    func setToken(_ token: String?) {
        if let token, !token.isEmpty {
            defaults.set(token, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}
