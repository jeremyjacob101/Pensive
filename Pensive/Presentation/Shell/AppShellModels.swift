import Foundation
import SwiftUI

enum AppTab: String, CaseIterable, Hashable {
    case expenses
    case incomings
    case breakdown
    case recurrings
    case tracking
    case notepad
    case options

    var title: String {
        switch self {
        case .expenses: return "Expenses"
        case .incomings: return "Incomings"
        case .breakdown: return "Breakdown"
        case .recurrings: return "Recurrings"
        case .tracking: return "Tracking"
        case .notepad: return "Notepad"
        case .options: return "Options"
        }
    }

    var systemImage: String {
        switch self {
        case .expenses: return "minus.circle"
        case .incomings: return "plus.circle"
        case .breakdown: return "chart.pie"
        case .recurrings: return "repeat"
        case .tracking: return "scope"
        case .notepad: return "note.text"
        case .options: return "gearshape"
        }
    }

    static let defaultTab: AppTab = .expenses
}

enum ShellRoute: Hashable, Codable {
    case detail(title: String)
}

enum QuickAddKind: String, CaseIterable, Identifiable {
    case expense
    case incoming
    case recurring

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense: return "Expense"
        case .incoming: return "Incoming"
        case .recurring: return "Recurring"
        }
    }
}

struct ShellDeepLink {
    let tab: AppTab?
    let quickAddKind: QuickAddKind?

    static func parse(url: URL) -> ShellDeepLink? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }

        let tab = tabFrom(url: url, components: components)
        let quickAddKind = quickAddFrom(components: components)

        if tab == nil && quickAddKind == nil {
            return nil
        }

        return ShellDeepLink(tab: tab, quickAddKind: quickAddKind)
    }

    private static func tabFrom(url: URL, components: URLComponents) -> AppTab? {
        if url.host == "tab", let name = url.path.split(separator: "/").first {
            return AppTab(rawValue: String(name).lowercased())
        }

        if let tabQuery = components.queryItems?.first(where: { $0.name == "tab" })?.value {
            return AppTab(rawValue: tabQuery.lowercased())
        }

        return nil
    }

    private static func quickAddFrom(components: URLComponents) -> QuickAddKind? {
        guard let add = components.queryItems?.first(where: { $0.name == "add" })?.value else {
            return nil
        }
        return QuickAddKind(rawValue: add.lowercased())
    }
}
