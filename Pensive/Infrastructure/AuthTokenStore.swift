import Foundation
import Security

protocol AuthTokenStoring: AnyObject {
    var currentToken: String? { get }
    var currentRefreshToken: String? { get }
    func setTokens(accessToken: String?, refreshToken: String?)
}

final class AuthTokenStore: AuthTokenStoring {
    private let defaults: UserDefaults
    private let keychain: KeychainStoring
    private let service = "com.pensive.app.auth"
    private let accessKey = "pensive.auth.token"
    private let refreshKey = "pensive.auth.refreshToken"

    init(defaults: UserDefaults = .standard, keychain: KeychainStoring = SystemKeychainStore()) {
        self.defaults = defaults
        self.keychain = keychain
        migrateDefaultsIfNeeded()
    }

    var currentToken: String? {
        keychain.string(service: service, account: accessKey)
    }

    var currentRefreshToken: String? {
        keychain.string(service: service, account: refreshKey)
    }

    func setTokens(accessToken: String?, refreshToken: String?) {
        if let accessToken, !accessToken.isEmpty {
            keychain.set(accessToken, service: service, account: accessKey)
        } else {
            keychain.remove(service: service, account: accessKey)
        }

        if let refreshToken, !refreshToken.isEmpty {
            keychain.set(refreshToken, service: service, account: refreshKey)
        } else {
            keychain.remove(service: service, account: refreshKey)
        }
    }

    private func migrateDefaultsIfNeeded() {
        if currentToken == nil, let accessToken = defaults.string(forKey: accessKey), !accessToken.isEmpty {
            keychain.set(accessToken, service: service, account: accessKey)
        }
        if currentRefreshToken == nil, let refreshToken = defaults.string(forKey: refreshKey), !refreshToken.isEmpty {
            keychain.set(refreshToken, service: service, account: refreshKey)
        }
        defaults.removeObject(forKey: accessKey)
        defaults.removeObject(forKey: refreshKey)
    }
}

protocol KeychainStoring {
    func string(service: String, account: String) -> String?
    func set(_ value: String, service: String, account: String)
    func remove(service: String, account: String)
}

struct SystemKeychainStore: KeychainStoring {
    func string(service: String, account: String) -> String? {
        var query = baseQuery(service: service, account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        return value
    }

    func set(_ value: String, service: String, account: String) {
        let data = Data(value.utf8)
        let query = baseQuery(service: service, account: account)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var newItem = query
            newItem[kSecValueData as String] = data
            newItem[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(newItem as CFDictionary, nil)
        }
    }

    func remove(service: String, account: String) {
        SecItemDelete(baseQuery(service: service, account: account) as CFDictionary)
    }

    private func baseQuery(service: String, account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
