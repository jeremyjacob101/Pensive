import Foundation

final class SessionStore {
    private(set) var status: AuthStatus = .checking
    var onStatusChange: ((AuthStatus) -> Void)?

    func bootstrapSession() {
        // Part 2 shell: deterministic startup routes to signed-out pending auth integration.
        transition(to: .signedOut)
    }

    private func transition(to next: AuthStatus) {
        status = next
        onStatusChange?(next)
    }
}
