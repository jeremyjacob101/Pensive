import Foundation

protocol LedgerFilterStoring {
    func load(for key: String) -> Set<String>
    func save(_ values: Set<String>, for key: String)
    func contains(_ key: String) -> Bool
}

final class LedgerFilterStore: LedgerFilterStoring {
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load(for key: String) -> Set<String> {
        Set(defaults.stringArray(forKey: key) ?? [])
    }

    func save(_ values: Set<String>, for key: String) {
        defaults.set(Array(values).sorted(), forKey: key)
    }

    func contains(_ key: String) -> Bool {
        defaults.object(forKey: key) != nil
    }
}
