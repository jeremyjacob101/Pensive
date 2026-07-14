import SwiftUI
import UniformTypeIdentifiers

enum OptionsKind: String, CaseIterable, Codable, Identifiable, Sendable {
    case account
    case category
    case subcategory
    case incomeType
    case incomeSubtype

    static let selectableCases: [OptionsKind] = [.account, .category, .incomeType]

    var id: String { rawValue }
    var title: String { rawValue }
    var displayTitle: String {
        switch self {
        case .account: return "Account"
        case .category: return "Category"
        case .subcategory: return "Subcategory"
        case .incomeType: return "Income Type"
        case .incomeSubtype: return "Income Subtype"
        }
    }
    var supportsParent: Bool { self == .subcategory || self == .incomeSubtype }
    var supportsNestedOptions: Bool { self == .category || self == .incomeType }

    var parentKind: OptionsKind? {
        switch self {
        case .subcategory: return .category
        case .incomeSubtype: return .incomeType
        default: return nil
        }
    }
}

@MainActor
final class OptionsViewModel: ObservableObject {
    @Published private(set) var state: ViewLoadState = .loading
    @Published private(set) var optionsByKind: [OptionsKind: [UserOptionRow]] = [:]
    @Published var selectedKind: OptionsKind = .account
    @Published var inlineError: String?
    @Published var successText: String?
    @Published private(set) var trackingMismatchCount: Int = 0
    @Published private(set) var accountExpenses: [String: [ExpenseDTO]] = [:]
    @Published private(set) var accountIncomings: [String: [IncomingDTO]] = [:]
    @Published private(set) var loadingAccountExpenseIDs: Set<String> = []
    @Published private(set) var loadingAccountIncomingIDs: Set<String> = []
    @Published private(set) var accountExpenseErrors: [String: String] = [:]
    @Published private(set) var accountIncomingErrors: [String: String] = [:]

    private let api: ConvexAPI
    private var trackedKeysFromTrackingRows: Set<String> = []
    private var accountExpenseCursors: [String: String?] = [:]
    private var accountIncomingCursors: [String: String?] = [:]
    private var accountExpenseIsDone: Set<String> = []
    private var accountIncomingIsDone: Set<String> = []

    init(api: ConvexAPI) {
        self.api = api
    }

    func onAppear() {
        if optionsByKind.isEmpty {
            Task { await refresh() }
        }
    }

    func refresh() async {
        let shouldShowFullScreenError = !state.hasLoadedContent
        if shouldShowFullScreenError { state = .loading }
        do {
            async let optionsListRequest = api.userOptions.list()
            async let trackingListRequest = api.tracking.list()
            let list = try await optionsListRequest
            let tracking = try await trackingListRequest
            optionsByKind = [
                .account: list.account,
                .category: list.category,
                .subcategory: list.subcategory,
                .incomeType: list.incomeType,
                .incomeSubtype: list.incomeSubtype
            ]
            trackedKeysFromTrackingRows = Set(tracking.rows.map { trackingKey(kind: $0.kind, value: $0.value, parentValue: $0.parentValue) })
            trackingMismatchCount = countTrackingMismatches()
            state = .content
        } catch {
            if shouldShowFullScreenError {
                state = .error(message: "Failed to load options")
            }
        }
    }

    func loadInitialExpenses(for row: OptionsDisplayRow) async {
        accountExpenses[row.selfKey] = []
        accountExpenseCursors[row.selfKey] = nil
        accountExpenseIsDone.remove(row.selfKey)
        accountExpenseErrors[row.selfKey] = nil
        await loadMoreExpenses(for: row)
    }

    func loadInitialIncomings(for row: OptionsDisplayRow) async {
        accountIncomings[row.selfKey] = []
        accountIncomingCursors[row.selfKey] = nil
        accountIncomingIsDone.remove(row.selfKey)
        accountIncomingErrors[row.selfKey] = nil
        await loadMoreIncomings(for: row)
    }

    func loadInitialLedgerIfNeeded(for row: OptionsDisplayRow, tab: AccountLedgerTab) async {
        switch tab {
        case .expenses:
            if !hasLoadedExpenses(for: row) {
                await loadInitialExpenses(for: row)
            }
        case .incomings:
            if !hasLoadedIncomings(for: row) {
                await loadInitialIncomings(for: row)
            }
        }
    }

    func loadMoreExpenses(for row: OptionsDisplayRow) async {
        let key = row.selfKey
        guard !loadingAccountExpenseIDs.contains(key), !accountExpenseIsDone.contains(key) else { return }
        loadingAccountExpenseIDs.insert(key)
        defer { loadingAccountExpenseIDs.remove(key) }

        do {
            let page = try await api.expenses.listByAccount(.init(
                account: row.value,
                paginationOpts: .init(cursor: accountExpenseCursors[key] ?? nil, numItems: 20)
            ))
            accountExpenses[key, default: []].append(contentsOf: page.page)
            accountExpenseCursors[key] = page.continueCursor
            if page.isDone {
                accountExpenseIsDone.insert(key)
            }
            accountExpenseErrors[key] = nil
        } catch {
            if isEmptyAccountLedgerResponse(error) {
                accountExpenses[key, default: []] = []
                accountExpenseCursors[key] = nil
                accountExpenseIsDone.insert(key)
                accountExpenseErrors[key] = nil
            } else {
                accountExpenseErrors[key] = "Failed to load account expenses."
            }
        }
    }

    func loadMoreIncomings(for row: OptionsDisplayRow) async {
        let key = row.selfKey
        guard !loadingAccountIncomingIDs.contains(key), !accountIncomingIsDone.contains(key) else { return }
        loadingAccountIncomingIDs.insert(key)
        defer { loadingAccountIncomingIDs.remove(key) }

        do {
            let page = try await api.incomings.listByAccount(.init(
                account: row.value,
                paginationOpts: .init(cursor: accountIncomingCursors[key] ?? nil, numItems: 20)
            ))
            accountIncomings[key, default: []].append(contentsOf: page.page)
            accountIncomingCursors[key] = page.continueCursor
            if page.isDone {
                accountIncomingIsDone.insert(key)
            }
            accountIncomingErrors[key] = nil
        } catch {
            if isEmptyAccountLedgerResponse(error) {
                accountIncomings[key, default: []] = []
                accountIncomingCursors[key] = nil
                accountIncomingIsDone.insert(key)
                accountIncomingErrors[key] = nil
            } else {
                accountIncomingErrors[key] = "Failed to load account incomings."
            }
        }
    }

    private func isEmptyAccountLedgerResponse(_ error: Error) -> Bool {
        guard let apiError = error as? APIError else { return false }
        switch apiError {
        case .notFound:
            return true
        default:
            return false
        }
    }

    func hasLoadedExpenses(for row: OptionsDisplayRow) -> Bool {
        accountExpenses[row.selfKey] != nil
    }

    func hasLoadedIncomings(for row: OptionsDisplayRow) -> Bool {
        accountIncomings[row.selfKey] != nil
    }

    func expenses(for row: OptionsDisplayRow) -> [ExpenseDTO] {
        accountExpenses[row.selfKey] ?? []
    }

    func incomings(for row: OptionsDisplayRow) -> [IncomingDTO] {
        accountIncomings[row.selfKey] ?? []
    }

    func isLoadingExpenses(for row: OptionsDisplayRow) -> Bool {
        loadingAccountExpenseIDs.contains(row.selfKey)
    }

    func isLoadingIncomings(for row: OptionsDisplayRow) -> Bool {
        loadingAccountIncomingIDs.contains(row.selfKey)
    }

    func isDoneLoadingExpenses(for row: OptionsDisplayRow) -> Bool {
        accountExpenseIsDone.contains(row.selfKey)
    }

    func isDoneLoadingIncomings(for row: OptionsDisplayRow) -> Bool {
        accountIncomingIsDone.contains(row.selfKey)
    }

    func expenseError(for row: OptionsDisplayRow) -> String? {
        accountExpenseErrors[row.selfKey]
    }

    func incomingError(for row: OptionsDisplayRow) -> String? {
        accountIncomingErrors[row.selfKey]
    }

    var parentChoices: [String] {
        parentChoices(for: selectedKind)
    }

    func parentChoices(for kind: OptionsKind) -> [String] {
        guard let parentKind = kind.parentKind else { return [] }
        return (optionsByKind[parentKind] ?? []).map(\.value).sorted()
    }

    func childKind(for kind: OptionsKind) -> OptionsKind? {
        switch kind {
        case .category: return .subcategory
        case .incomeType: return .incomeSubtype
        default: return nil
        }
    }

    func parentChoicesExcluding(kind: OptionsKind, parentValue: String?) -> [String] {
        guard let parentValue = normalized(parentValue), !parentValue.isEmpty else {
            return parentChoices(for: kind)
        }
        return parentChoices(for: kind).filter { $0 != parentValue }
    }

    func moveToSubtypeTargets(kind: OptionsKind, excluding sourceValue: String) -> [String] {
        let values = (optionsByKind[kind] ?? []).map(\.value)
        return values.filter { $0 != sourceValue }.sorted()
    }

    var showsMoveHint: Bool {
        switch selectedKind {
        case .category, .incomeType, .subcategory, .incomeSubtype:
            return true
        default:
            return false
        }
    }

    var supportsTrackingForSelectedKind: Bool {
        supportsTracking(kind: selectedKind)
    }

    func supportsTracking(kind: OptionsKind) -> Bool {
        switch kind {
        case .category, .subcategory, .incomeType, .incomeSubtype:
            return true
        default:
            return false
        }
    }

    var rows: [OptionsDisplayRow] {
        switch selectedKind {
        case .category:
            return nestedRows(parentKind: .category, childKind: .subcategory)
        case .incomeType:
            return nestedRows(parentKind: .incomeType, childKind: .incomeSubtype)
        default:
            return flatRows(kind: selectedKind)
        }
    }

    var rowGroups: [OptionsDisplayGroup] {
        switch selectedKind {
        case .category:
            return nestedGroups(parentKind: .category, childKind: .subcategory)
        case .incomeType:
            return nestedGroups(parentKind: .incomeType, childKind: .incomeSubtype)
        default:
            return flatRows(kind: selectedKind).map { OptionsDisplayGroup(parent: $0, children: []) }
        }
    }

    private func flatRows(kind: OptionsKind) -> [OptionsDisplayRow] {
        (optionsByKind[kind] ?? []).sorted { lhs, rhs in
            if lhs.parentValue == rhs.parentValue {
                return lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            return (lhs.parentValue ?? "") < (rhs.parentValue ?? "")
        }.map { row in
            displayRow(from: row, kind: kind, indentationLevel: 0)
        }
    }

    private func nestedRows(parentKind: OptionsKind, childKind: OptionsKind) -> [OptionsDisplayRow] {
        nestedGroups(parentKind: parentKind, childKind: childKind).flatMap { group in
            [group.parent] + group.children
        }
    }

    private func nestedGroups(parentKind: OptionsKind, childKind: OptionsKind) -> [OptionsDisplayGroup] {
        let parents = (optionsByKind[parentKind] ?? []).sorted { lhs, rhs in
            lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
        }
        let childrenByParent = Dictionary(grouping: optionsByKind[childKind] ?? []) { row in
            normalized(row.parentValue) ?? ""
        }
        var displayedChildKeys: Set<String> = []
        var groups: [OptionsDisplayGroup] = []

        for parent in parents {
            let children = (childrenByParent[parent.value] ?? []).sorted { lhs, rhs in
                lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            let childRows = children.map { child in
                displayedChildKeys.insert(child.selfKey)
                return displayRow(from: child, kind: childKind, indentationLevel: 1)
            }
            groups.append(OptionsDisplayGroup(
                parent: displayRow(from: parent, kind: parentKind, indentationLevel: 0),
                children: childRows
            ))
        }

        let orphanChildren = (optionsByKind[childKind] ?? []).filter { !displayedChildKeys.contains($0.selfKey) }.sorted { lhs, rhs in
            if lhs.parentValue == rhs.parentValue {
                return lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            return (lhs.parentValue ?? "") < (rhs.parentValue ?? "")
        }
        groups.append(contentsOf: orphanChildren.map {
            OptionsDisplayGroup(parent: displayRow(from: $0, kind: childKind, indentationLevel: 0), children: [])
        })
        return groups
    }

    private func displayRow(from row: UserOptionRow, kind: OptionsKind, indentationLevel: Int) -> OptionsDisplayRow {
        let key = trackingKey(kind: kind.rawValue, value: row.value, parentValue: row.parentValue)
        let effectiveIsTracking = row.isTracking || trackedKeysFromTrackingRows.contains(key)
        return OptionsDisplayRow(
            kind: kind,
            value: row.value,
            color: row.color,
            isDefault: row.isDefault,
            isTracking: effectiveIsTracking,
            parentValue: row.parentValue,
            indentationLevel: indentationLevel
        )
    }

    @discardableResult
    func add(kind: OptionsKind, value: String, parentValue: String?, color: String? = nil) async -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            inlineError = "Option name cannot be empty."
            return false
        }

        if kind.supportsParent, (parentValue ?? "").isEmpty {
            inlineError = "Please select a parent."
            return false
        }

        let normalizedColor = color.flatMap(sanitizeHexColor)
        if color != nil, normalizedColor == nil {
            inlineError = "Color must be a valid 6-digit hex value."
            return false
        }

        do {
            try await api.userOptions.add(.init(kind: kind.rawValue, value: trimmed, parentValue: normalized(parentValue)))
            if let normalizedColor {
                try await api.userOptions.updateColor(.init(
                    kind: kind.rawValue,
                    value: trimmed,
                    color: normalizedColor,
                    parentValue: normalized(parentValue)
                ))
            }
            await refresh()
            successText = "Added \(trimmed)."
            inlineError = nil
            return true
        } catch {
            inlineError = "Failed to add option."
            return false
        }
    }

    @discardableResult
    func rename(kind: OptionsKind, value: String, nextValue: String, parentValue: String?) async -> Bool {
        let trimmed = nextValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            inlineError = "New name cannot be empty."
            return false
        }
        do {
            try await api.userOptions.rename(.init(kind: kind.rawValue, value: value, nextValue: trimmed, parentValue: normalized(parentValue)))
            await refresh()
            successText = "Renamed successfully."
            inlineError = nil
            return true
        } catch {
            inlineError = "Failed to rename option."
            return false
        }
    }

    @discardableResult
    func updateColor(kind: OptionsKind, value: String, color: String, parentValue: String?) async -> Bool {
        let normalizedColor = sanitizeHexColor(color)
        guard normalizedColor != nil else {
            inlineError = "Color must be a valid 6-digit hex value."
            return false
        }
        do {
            try await api.userOptions.updateColor(.init(kind: kind.rawValue, value: value, color: normalizedColor!, parentValue: normalized(parentValue)))
            await refresh()
            inlineError = nil
            return true
        } catch {
            inlineError = "Failed to update color."
            return false
        }
    }

    func setDefault(kind: OptionsKind, value: String, isDefault: Bool, parentValue: String?) async {
        do {
            try await api.userOptions.setDefault(.init(kind: kind.rawValue, value: value, isDefault: isDefault, parentValue: normalized(parentValue)))
            await refresh()
            inlineError = nil
        } catch {
            inlineError = "Failed to set default."
        }
    }

    func setTracking(kind: OptionsKind, value: String, isTracking: Bool, parentValue: String?) async {
        do {
            try await api.userOptions.setTracking(.init(kind: kind.rawValue, value: value, isTracking: isTracking, parentValue: normalized(parentValue)))
            await refresh()
            inlineError = nil
        } catch {
            inlineError = "Failed to set tracking."
        }
    }

    @discardableResult
    func remove(kind: OptionsKind, value: String, parentValue: String?) async -> Bool {
        do {
            try await api.userOptions.remove(.init(kind: kind.rawValue, value: value, parentValue: normalized(parentValue)))
            await refresh()
            inlineError = nil
            return true
        } catch {
            inlineError = "Failed to delete option."
            return false
        }
    }

    @discardableResult
    func moveToSubtype(kind: OptionsKind, sourceValue: String, targetValue: String) async -> Bool {
        do {
            let request = try OptionsMutationLogic.buildMoveToSubtype(kind: kind.rawValue, sourceValue: sourceValue, targetValue: targetValue)
            try await api.userOptions.moveToSubtype(request)
            await refresh()
            inlineError = nil
            return true
        } catch {
            inlineError = message(for: error, fallback: "Failed to move to subtype.")
            return false
        }
    }

    func moveSubtype(kind: OptionsKind, value: String, sourceParentValue: String, targetParentValue: String) async {
        do {
            let request = try OptionsMutationLogic.buildMoveSubtype(
                kind: kind.rawValue,
                value: value,
                sourceParentValue: sourceParentValue,
                targetParentValue: targetParentValue
            )
            try await api.userOptions.moveSubtype(request)
            await refresh()
            inlineError = nil
        } catch {
            inlineError = message(for: error, fallback: "Failed to move subtype.")
        }
    }

    @discardableResult
    func promoteSubtype(kind: OptionsKind, value: String, parentValue: String) async -> Bool {
        do {
            let request = try OptionsMutationLogic.buildPromoteSubtype(kind: kind.rawValue, value: value, parentValue: parentValue)
            try await api.userOptions.promoteSubtype(request)
            await refresh()
            inlineError = nil
            return true
        } catch {
            inlineError = message(for: error, fallback: "Failed to promote subtype.")
            return false
        }
    }

    private func normalized(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    private func sanitizeHexColor(_ color: String) -> String? {
        let clean = color.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: "#", with: "")
        guard clean.range(of: #"^[0-9A-F]{6}$"#, options: .regularExpression) != nil else { return nil }
        return "#\(clean)"
    }

    private func trackingKey(kind: String, value: String, parentValue: String?) -> String {
        let parent = normalized(parentValue) ?? ""
        return "\(kind)|\(value)|\(parent)"
    }

    private func countTrackingMismatches() -> Int {
        let candidateKinds: [OptionsKind] = [.category, .subcategory, .incomeType, .incomeSubtype]
        var count = 0
        for kind in candidateKinds {
            for row in optionsByKind[kind] ?? [] {
                let key = trackingKey(kind: kind.rawValue, value: row.value, parentValue: row.parentValue)
                let inTrackingRows = trackedKeysFromTrackingRows.contains(key)
                if inTrackingRows && row.isTracking == false {
                    count += 1
                }
            }
        }
        return count
    }

    private func message(for error: Error, fallback: String) -> String {
        if let apiError = error as? APIError, case let .validation(message) = apiError {
            return message
        }
        return fallback
    }
}

struct OptionsDisplayRow: Identifiable, Equatable {
    let kind: OptionsKind
    let value: String
    let color: String
    let isDefault: Bool
    let isTracking: Bool
    let parentValue: String?
    let indentationLevel: Int
    var id: String { "\(kind.rawValue)|\(value)|\(parentValue ?? "")" }
}

struct OptionsDisplayGroup: Identifiable {
    let parent: OptionsDisplayRow
    let children: [OptionsDisplayRow]
    var id: String { parent.id }
}

struct OptionDragPayload: Codable, Equatable, Sendable, Transferable {
    let kind: OptionsKind
    let value: String
    let parentValue: String?

    static let contentType = UTType(exportedAs: "com.pensive.option")

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: contentType)
    }
}

final class OptionDragItemProvider: NSItemProvider {
    private let onDeinit: () -> Void

    init(payload: OptionDragPayload, onDeinit: @escaping () -> Void) {
        self.onDeinit = onDeinit
        let data = try? JSONEncoder().encode(payload)
        super.init()

        if let data {
            registerDataRepresentation(
                forTypeIdentifier: OptionDragPayload.contentType.identifier,
                visibility: .ownProcess
            ) { completion in
                completion(data, nil)
                return nil
            }
        }
    }

    deinit {
        onDeinit()
    }
}

enum AccountLedgerTab: String, CaseIterable, Identifiable {
    case expenses
    case incomings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expenses: return "Expenses"
        case .incomings: return "Incomings"
        }
    }
}

struct AccountLedgerBottomPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = .infinity

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = min(value, nextValue())
    }
}

struct OptionCreateDraft {
    var value = ""
    var parentValue = ""
    var addAsSubtype = false
    var color = "#EC4899"
}

struct OptionEditDraft {
    var value: String
    var color: String

    init(row: OptionsDisplayRow) {
        value = row.value
        color = row.color
    }
}

extension UserOptionRow {
    var selfKey: String { "\(value)|\(parentValue ?? "")" }
}

extension OptionsDisplayRow {
    var selfKey: String { id }
}
