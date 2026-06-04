import Foundation

struct AppEnvironment: Equatable {
    let convexBaseURL: String
    let convexHTTPActionBaseURL: String
    let authClientID: String
    let appEnvName: String
    let logLevel: String

    enum Key: String, CaseIterable {
        case convexBaseURL = "CONVEX_BASE_URL"
        case convexHTTPActionBaseURL = "CONVEX_HTTP_ACTION_BASE_URL"
        case authClientID = "AUTH_CLIENT_ID"
        case appEnvName = "APP_ENV_NAME"
        case logLevel = "LOG_LEVEL"
    }

    static func load(from bundle: Bundle) -> AppEnvironment {
        AppEnvironment(
            convexBaseURL: require(key: .convexBaseURL, from: bundle),
            convexHTTPActionBaseURL: require(key: .convexHTTPActionBaseURL, from: bundle),
            authClientID: require(key: .authClientID, from: bundle),
            appEnvName: require(key: .appEnvName, from: bundle),
            logLevel: require(key: .logLevel, from: bundle)
        )
    }

    static func fromDictionary(_ values: [String: String]) -> AppEnvironment {
        func value(_ key: Key) -> String {
            values[key.rawValue]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }
        return AppEnvironment(
            convexBaseURL: value(.convexBaseURL),
            convexHTTPActionBaseURL: value(.convexHTTPActionBaseURL),
            authClientID: value(.authClientID),
            appEnvName: value(.appEnvName),
            logLevel: value(.logLevel)
        )
    }

    private static func require(key: Key, from bundle: Bundle) -> String {
        let envValue = ProcessInfo.processInfo.environment[key.rawValue]?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !envValue.isEmpty { return envValue }

        let bundleValue = (bundle.object(forInfoDictionaryKey: key.rawValue) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !bundleValue.isEmpty { return bundleValue }

        let message = "Missing required app config key: \(key.rawValue). Set it in the active .xcconfig."
        #if DEBUG
        if isRunningTests {
            // Keep tests deterministic without crashing the app host.
            return "missing-in-tests"
        }
        preconditionFailure(message)
        #else
        assertionFailure(message)
        #endif
        return ""
    }

    private static var isRunningTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }
}
