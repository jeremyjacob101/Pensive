import SwiftUI

enum TrackingTimelineSegmentState: String {
    case paid
    case unpaid
    case buffer
    case empty
}

struct TrackingTimelineSegment: Identifiable {
    let id: String
    let month: String
    let state: TrackingTimelineSegmentState
}

private struct TrackingTimelineRowViewData: Identifiable {
    let id: String
    let key: String
    let source: String
    let label: String
    let colorHex: String
    let paidMonths: Set<String>
    let currentMonth: String
    let availableMonths: [String]
    var startMonth: String
    var trailingBufferMonths: Int
    var segments: [TrackingTimelineSegment]
}

private enum TrackingSelectionKind: String, CaseIterable, Identifiable {
    case expense
    case incoming

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense: return "Expenses"
        case .incoming: return "Incomings"
        }
    }
}

private struct TrackingSelectionOptionRow: Identifiable {
    let kind: OptionsKind
    let value: String
    let color: String
    let parentValue: String?
    let indentationLevel: Int
    let isTracking: Bool

    var id: String { trackingSelectionKey(kind: kind.rawValue, value: value, parentValue: parentValue) }
}

private struct TrackingSelectionChange {
    let row: TrackingSelectionOptionRow
    let isTracking: Bool
}

enum TrackingTimelineLogic {
    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return calendar
    }()

    static func monthDate(_ month: String) -> Date? {
        let comps = month.split(separator: "-")
        guard comps.count == 2, let y = Int(comps[0]), let m = Int(comps[1]), (1 ... 12).contains(m) else { return nil }
        return calendar.date(from: DateComponents(year: y, month: m, day: 1))
    }

    static func monthString(_ date: Date) -> String {
        let comps = calendar.dateComponents([.year, .month], from: date)
        let y = comps.year ?? 1970
        let m = comps.month ?? 1
        return String(format: "%04d-%02d", y, m)
    }

    static func monthRange(start: String, end: String) -> [String] {
        guard let startDate = monthDate(start), let endDate = monthDate(end), startDate <= endDate else { return [] }
        var result: [String] = []
        var cursor = startDate
        while cursor <= endDate {
            result.append(monthString(cursor))
            cursor = calendar.date(byAdding: .month, value: 1, to: cursor) ?? cursor
            if result.count > 2400 { break }
        }
        return result
    }

    static func segments(months: [String], paidMonths: Set<String>, currentMonth: String, trailingBufferMonths: Int) -> [TrackingTimelineSegment] {
        guard let current = monthDate(currentMonth) else {
            return months.map { .init(id: $0, month: $0, state: paidMonths.contains($0) ? .paid : .unpaid) }
        }

        let recentUnpaidBufferMonths: Set<String> = {
            let eligible = months.compactMap { month -> (String, Date)? in
                guard !paidMonths.contains(month), let date = monthDate(month), date <= current else { return nil }
                return (month, date)
            }
            let sorted = eligible.sorted { $0.1 > $1.1 }
            return Set(sorted.prefix(max(0, trailingBufferMonths)).map(\.0))
        }()

        return months.map { month in
            let state: TrackingTimelineSegmentState
            if paidMonths.contains(month) {
                state = .paid
            } else if let monthDate = monthDate(month) {
                if monthDate > current {
                    state = .empty
                } else if recentUnpaidBufferMonths.contains(month) {
                    state = .buffer
                } else {
                    state = .unpaid
                }
            } else {
                state = .empty
            }
            return .init(id: month, month: month, state: state)
        }
    }

    static func monthsFromStart(_ months: [String], startMonth: String) -> [String] {
        guard let startDate = monthDate(startMonth) else { return months }
        return months.filter { month in
            guard let monthDate = monthDate(month) else { return false }
            return monthDate >= startDate
        }
    }
}

private func trackingSelectionKey(kind: String, value: String, parentValue: String?) -> String {
    "\(kind)|\(value)|\(normalizedOptionParent(parentValue))"
}

private func normalizedOptionParent(_ value: String?) -> String {
    value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
}

struct TrackingTimelineRowPersistenceStore {
    private let defaults: UserDefaults
    private let startPrefix = "tracking.timeline.start"
    private let bufferPrefix = "tracking.timeline.buffer"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func startMonth(source: String, key: String) -> String? {
        defaults.string(forKey: "\(startPrefix).\(source).\(key)")
    }

    func trailingBufferMonths(source: String, key: String) -> Int? {
        let value = defaults.object(forKey: "\(bufferPrefix).\(source).\(key)") as? Int
        return value
    }

    func setStartMonth(_ value: String, source: String, key: String) {
        defaults.set(value, forKey: "\(startPrefix).\(source).\(key)")
    }

    func setTrailingBufferMonths(_ value: Int, source: String, key: String) {
        defaults.set(max(0, value), forKey: "\(bufferPrefix).\(source).\(key)")
    }
}

@MainActor
private final class TrackingFeatureViewModel: ObservableObject {
    @Published private(set) var state: ViewLoadState = .loading
    @Published private(set) var expenseRows: [TrackingTimelineRowViewData] = []
    @Published private(set) var incomingRows: [TrackingTimelineRowViewData] = []
    @Published private(set) var expenseSelectionRows: [TrackingSelectionOptionRow] = []
    @Published private(set) var incomingSelectionRows: [TrackingSelectionOptionRow] = []

    private let api: ConvexAPI
    private let persistence: TrackingTimelineRowPersistenceStore

    init(api: ConvexAPI, persistence: TrackingTimelineRowPersistenceStore = .init()) {
        self.api = api
        self.persistence = persistence
    }

    func onAppear() {
        if expenseRows.isEmpty && incomingRows.isEmpty {
            Task { await refresh() }
        }
    }

    func refresh() async {
        let shouldShowFullScreenError = !state.hasLoadedContent
        if shouldShowFullScreenError { state = .loading }
        if let tracking = debugFixtureResponseIfEnabled() {
            apply(response: tracking)
            apply(options: Self.fixtureOptions(), tracking: tracking)
            state = .content
            return
        }
        do {
            async let trackingRequest = api.tracking.list()
            async let optionsRequest = api.userOptions.list()
            let tracking = try await trackingRequest
            let options = try await optionsRequest
            apply(response: tracking)
            apply(options: options, tracking: tracking)
            state = .content
        } catch {
            if shouldShowFullScreenError {
                state = .error(message: "Failed to load tracking")
            }
        }
    }

    func saveTrackingSelection(original: [String: Bool], draft: [String: Bool]) async throws {
        let rowByID = Dictionary(uniqueKeysWithValues: (expenseSelectionRows + incomingSelectionRows).map { ($0.id, $0) })
        let changes = draft.compactMap { id, isTracking -> TrackingSelectionChange? in
            guard original[id] != isTracking, let row = rowByID[id] else { return nil }
            return TrackingSelectionChange(row: row, isTracking: isTracking)
        }

        guard !changes.isEmpty else { return }

        if isDebugFixtureEnabled() {
            applyFixtureSelectionChanges(changes)
            return
        }

        for change in changes {
            try await api.userOptions.setTracking(.init(
                kind: change.row.kind.rawValue,
                value: change.row.value,
                isTracking: change.isTracking,
                parentValue: normalizedParent(change.row.parentValue)
            ))
        }
        await refresh()
    }

    func setStartMonth(rowID: String, source: String, key: String, month: String) {
        persistence.setStartMonth(month, source: source, key: key)
        mutateRow(id: rowID, source: source) { row in
            row.startMonth = month
            let visibleMonths = TrackingTimelineLogic.monthsFromStart(row.availableMonths, startMonth: row.startMonth)
            row.segments = TrackingTimelineLogic.segments(
                months: visibleMonths,
                paidMonths: row.paidMonths,
                currentMonth: row.currentMonth,
                trailingBufferMonths: row.trailingBufferMonths
            )
        }
    }

    func setTrailingBufferMonths(rowID: String, source: String, key: String, months: Int) {
        persistence.setTrailingBufferMonths(months, source: source, key: key)
        mutateRow(id: rowID, source: source) { row in
            row.trailingBufferMonths = max(0, months)
            let visibleMonths = TrackingTimelineLogic.monthsFromStart(row.availableMonths, startMonth: row.startMonth)
            row.segments = TrackingTimelineLogic.segments(
                months: visibleMonths,
                paidMonths: row.paidMonths,
                currentMonth: row.currentMonth,
                trailingBufferMonths: row.trailingBufferMonths
            )
        }
    }

    private func apply(response: TrackingResponse) {
        let rows = response.rows.map { dto -> TrackingTimelineRowViewData in
            let source = dto.source.lowercased()
            let persistedStart = persistence.startMonth(source: source, key: dto.key)
            let fallbackStart = dto.rangeMonths.first ?? response.currentMonth
            let start = persistedStart.flatMap { s in dto.rangeMonths.contains(s) ? s : nil } ?? fallbackStart
            let persistedBuffer = persistence.trailingBufferMonths(source: source, key: dto.key) ?? 0
            let months = dto.rangeMonths.isEmpty ? [response.currentMonth] : dto.rangeMonths
            let allMonths = months.last == response.currentMonth ? months : months + [response.currentMonth]
            let clipped = TrackingTimelineLogic.monthsFromStart(allMonths, startMonth: start)
            let segments = TrackingTimelineLogic.segments(
                months: clipped,
                paidMonths: Set(dto.paidMonths),
                currentMonth: response.currentMonth,
                trailingBufferMonths: persistedBuffer
            )
            return .init(
                id: "\(source):\(dto.key)",
                key: dto.key,
                source: source,
                label: dto.label,
                colorHex: dto.color,
                paidMonths: Set(dto.paidMonths),
                currentMonth: response.currentMonth,
                availableMonths: allMonths,
                startMonth: start,
                trailingBufferMonths: persistedBuffer,
                segments: segments
            )
        }

        expenseRows = rows.filter { $0.source == "expense" }
        incomingRows = rows.filter { $0.source == "incoming" }
    }

    private func apply(options: UserOptionsListResponse, tracking: TrackingResponse) {
        let trackedKeys = Set(tracking.rows.map { trackingSelectionKey(kind: $0.kind, value: $0.value, parentValue: $0.parentValue) })
        expenseSelectionRows = nestedSelectionRows(
            parents: options.category,
            parentKind: .category,
            children: options.subcategory,
            childKind: .subcategory,
            trackedKeys: trackedKeys
        )
        incomingSelectionRows = nestedSelectionRows(
            parents: options.incomeType,
            parentKind: .incomeType,
            children: options.incomeSubtype,
            childKind: .incomeSubtype,
            trackedKeys: trackedKeys
        )
    }

    private func nestedSelectionRows(parents: [UserOptionRow], parentKind: OptionsKind, children: [UserOptionRow], childKind: OptionsKind, trackedKeys: Set<String>) -> [TrackingSelectionOptionRow] {
        let sortedParents = parents.sorted { lhs, rhs in
            lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
        }
        let childrenByParent = Dictionary(grouping: children) { row in
            normalizedOptionParent(row.parentValue)
        }
        var displayedChildKeys: Set<String> = []
        var rows: [TrackingSelectionOptionRow] = []

        for parent in sortedParents {
            rows.append(selectionRow(from: parent, kind: parentKind, indentationLevel: 0, trackedKeys: trackedKeys))
            let sortedChildren = (childrenByParent[parent.value] ?? []).sorted { lhs, rhs in
                lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            for child in sortedChildren {
                displayedChildKeys.insert(child.selfKey)
                rows.append(selectionRow(from: child, kind: childKind, indentationLevel: 1, trackedKeys: trackedKeys))
            }
        }

        let orphanChildren = children.filter { !displayedChildKeys.contains($0.selfKey) }.sorted { lhs, rhs in
            if lhs.parentValue == rhs.parentValue {
                return lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
            }
            return normalizedOptionParent(lhs.parentValue) < normalizedOptionParent(rhs.parentValue)
        }
        rows.append(contentsOf: orphanChildren.map {
            selectionRow(from: $0, kind: childKind, indentationLevel: 0, trackedKeys: trackedKeys)
        })

        return rows
    }

    private func selectionRow(from row: UserOptionRow, kind: OptionsKind, indentationLevel: Int, trackedKeys: Set<String>) -> TrackingSelectionOptionRow {
        let key = trackingSelectionKey(kind: kind.rawValue, value: row.value, parentValue: row.parentValue)
        return .init(
            kind: kind,
            value: row.value,
            color: row.color,
            parentValue: row.parentValue,
            indentationLevel: indentationLevel,
            isTracking: row.isTracking || trackedKeys.contains(key)
        )
    }

    private func mutateRow(id: String, source: String, _ mutate: (inout TrackingTimelineRowViewData) -> Void) {
        if source == "expense" {
            guard let index = expenseRows.firstIndex(where: { $0.id == id }) else { return }
            var row = expenseRows[index]
            mutate(&row)
            expenseRows[index] = row
        } else {
            guard let index = incomingRows.firstIndex(where: { $0.id == id }) else { return }
            var row = incomingRows[index]
            mutate(&row)
            incomingRows[index] = row
        }
    }

    private func debugFixtureResponseIfEnabled() -> TrackingResponse? {
        #if DEBUG
        guard isDebugFixtureEnabled() else { return nil }
        return Self.fixtureResponse()
        #else
        return nil
        #endif
    }

    private func isDebugFixtureEnabled() -> Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["UI_TEST_TRACKING_FIXTURE"] == "1"
        #else
        false
        #endif
    }

    private func normalizedParent(_ value: String?) -> String? {
        let trimmed = normalizedOptionParent(value)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func applyFixtureSelectionChanges(_ changes: [TrackingSelectionChange]) {
        for change in changes {
            updateFixtureSelectionRow(change.row, isTracking: change.isTracking)
        }
        apply(response: fixtureResponseFromSelectionRows())
    }

    private func updateFixtureSelectionRow(_ target: TrackingSelectionOptionRow, isTracking: Bool) {
        func update(rows: inout [TrackingSelectionOptionRow]) {
            guard let index = rows.firstIndex(where: { $0.id == target.id }) else { return }
            let row = rows[index]
            rows[index] = .init(
                kind: row.kind,
                value: row.value,
                color: row.color,
                parentValue: row.parentValue,
                indentationLevel: row.indentationLevel,
                isTracking: isTracking
            )
        }

        update(rows: &expenseSelectionRows)
        update(rows: &incomingSelectionRows)
    }

    private func fixtureResponseFromSelectionRows() -> TrackingResponse {
        let currentMonth = "2026-05"
        let rows = (expenseSelectionRows + incomingSelectionRows).filter(\.isTracking).map { row in
            let source = row.kind == .category || row.kind == .subcategory ? "expense" : "incoming"
            return TrackingRow(
                key: row.id.lowercased(),
                source: source,
                kind: row.kind.rawValue,
                value: row.value,
                parentValue: row.parentValue,
                color: row.color,
                label: normalizedOptionParent(row.parentValue).isEmpty ? row.value : "\(normalizedOptionParent(row.parentValue)) / \(row.value)",
                paidMonths: row.value == "Housing" || row.value == "Salary" ? ["2026-01", "2026-02", "2026-04"] : [],
                rangeMonths: ["2026-01", "2026-02", "2026-03", "2026-04", currentMonth],
                statusByMonth: [:]
            )
        }
        return .init(currentMonth: currentMonth, rows: rows)
    }

    #if DEBUG
    private static func fixtureResponse() -> TrackingResponse {
        .init(
            currentMonth: "2026-05",
            rows: [
                .init(key: "category|Housing|", source: "expense", kind: "category", value: "Housing", parentValue: nil, color: "#FF5A5F", label: "Housing", paidMonths: ["2026-01", "2026-02", "2026-04"], rangeMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"], statusByMonth: [:]),
                .init(key: "incomeType|Salary|", source: "incoming", kind: "incomeType", value: "Salary", parentValue: nil, color: "#00A699", label: "Salary", paidMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"], rangeMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"], statusByMonth: [:])
            ]
        )
    }
    #endif

    private static func fixtureOptions() -> UserOptionsListResponse {
        .init(
            account: [],
            category: [
                .init(value: "Housing", color: "#FF5A5F", isDefault: false, isTracking: true, parentValue: nil),
                .init(value: "Transport", color: "#FC642D", isDefault: false, isTracking: false, parentValue: nil)
            ],
            subcategory: [
                .init(value: "Rent", color: "#FFB400", isDefault: false, isTracking: false, parentValue: "Housing"),
                .init(value: "Train", color: "#767676", isDefault: false, isTracking: false, parentValue: "Transport")
            ],
            incomeType: [
                .init(value: "Salary", color: "#00A699", isDefault: false, isTracking: true, parentValue: nil),
                .init(value: "Freelance", color: "#007A87", isDefault: false, isTracking: false, parentValue: nil)
            ],
            incomeSubtype: [
                .init(value: "Base", color: "#7B0051", isDefault: false, isTracking: false, parentValue: "Salary"),
                .init(value: "Consulting", color: "#8CE071", isDefault: false, isTracking: false, parentValue: "Freelance")
            ]
        )
    }
}

struct TrackingFeatureView: View {
    @StateObject private var viewModel: TrackingFeatureViewModel
    @State private var selectedKind = "expense"
    @State private var expandedRowIDs: Set<String> = []
    @State private var showTrackingSelection = false

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: TrackingFeatureViewModel(api: api))
    }

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.refresh() } }) {
            List {
                Section {
                    Picker("Kind", selection: $selectedKind) {
                        Text("Expenses").tag("expense")
                        Text("Incomings").tag("incoming")
                    }
                    .pickerStyle(.segmented)
                }

                if selectedRows.isEmpty {
                    Text(selectedKind == "expense" ? "No expense tracking" : "No incoming tracking")
                        .foregroundStyle(.secondary)
                }

                ForEach(selectedRows) { row in
                    TrackingTimelineRowCard(row: row, isExpanded: expandedBinding(for: row.id), onStartMonth: { month in
                        viewModel.setStartMonth(rowID: row.id, source: row.source, key: row.key, month: month)
                    }, onBuffer: { buffer in
                        viewModel.setTrailingBufferMonths(rowID: row.id, source: row.source, key: row.key, months: buffer)
                    })
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Tracking")
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await viewModel.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showTrackingSelection = true
                    } label: {
                        Image(systemName: "line.3.horizontal")
                    }
                    .accessibilityLabel("Manage Tracking")
                    .accessibilityIdentifier("tracking_manage_toolbar")
                }
            }
            .sheet(isPresented: $showTrackingSelection) {
                TrackingSelectionSheet(viewModel: viewModel)
            }
        }
        .task { viewModel.onAppear() }
    }

    private var selectedRows: [TrackingTimelineRowViewData] {
        selectedKind == "expense" ? viewModel.expenseRows : viewModel.incomingRows
    }

    private func expandedBinding(for id: String) -> Binding<Bool> {
        Binding {
            expandedRowIDs.contains(id)
        } set: { isExpanded in
            if isExpanded {
                expandedRowIDs.insert(id)
            } else {
                expandedRowIDs.remove(id)
            }
        }
    }
}

private struct TrackingSelectionSheet: View {
    @ObservedObject var viewModel: TrackingFeatureViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedKind: TrackingSelectionKind = .expense
    @State private var originalSelection: [String: Bool] = [:]
    @State private var draftSelection: [String: Bool] = [:]
    @State private var inlineError: String?
    @State private var isSaving = false
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Kind", selection: $selectedKind) {
                    ForEach(TrackingSelectionKind.allCases) { kind in
                        Text(kind.title).tag(kind)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 6)
                .accessibilityIdentifier("tracking_selection_kind_picker")

                List {
                    if selectedRows.isEmpty {
                        Text(emptyMessage)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(selectedRows) { row in
                            TrackingSelectionRowView(
                                row: row,
                                isSelected: binding(for: row)
                            )
                        }
                    }

                    if let inlineError {
                        Text(inlineError)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
                .listStyle(.insetGrouped)
                .contentMargins(.top, 18, for: .scrollContent)
            }
            .navigationTitle("Tracking")
            .navigationBarTitleDisplayMode(.inline)
            .trackingSelectionSearchable(text: $searchText)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        Task { await save() }
                    }
                    .disabled(isSaving)
                    .accessibilityIdentifier("tracking_selection_done")
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
        .presentationDetents([.large])
        .onAppear(perform: resetDraft)
        .accessibilityIdentifier("tracking_selection_sheet")
    }

    private var selectedRows: [TrackingSelectionOptionRow] {
        let rows = selectedKind == .expense ? viewModel.expenseSelectionRows : viewModel.incomingSelectionRows
        return filteredRows(rows, matching: searchText)
    }

    private var emptyMessage: String {
        if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return selectedKind == .expense ? "No matching categories" : "No matching income types"
        }
        return selectedKind == .expense ? "No expense options" : "No incoming options"
    }

    private func filteredRows(_ rows: [TrackingSelectionOptionRow], matching searchText: String) -> [TrackingSelectionOptionRow] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return rows }

        let parentRows = rows.filter { $0.indentationLevel == 0 && !$0.kind.supportsParent }
        let parentValues = Set(parentRows.map(\.value))
        var matches: [TrackingSelectionOptionRow] = []

        for parent in parentRows {
            let children = rows.filter {
                $0.indentationLevel > 0 && $0.parentValue == parent.value
            }
            if parent.value.localizedCaseInsensitiveContains(query) {
                matches.append(parent)
                matches.append(contentsOf: children)
            } else {
                let matchingChildren = children.filter {
                    $0.value.localizedCaseInsensitiveContains(query)
                }
                if !matchingChildren.isEmpty {
                    matches.append(parent)
                    matches.append(contentsOf: matchingChildren)
                }
            }
        }

        matches.append(contentsOf: rows.filter {
            $0.kind.supportsParent
                && !parentValues.contains($0.parentValue ?? "")
                && $0.value.localizedCaseInsensitiveContains(query)
        })
        return matches
    }

    private func binding(for row: TrackingSelectionOptionRow) -> Binding<Bool> {
        Binding {
            draftSelection[row.id, default: row.isTracking]
        } set: { next in
            draftSelection[row.id] = next
            inlineError = nil
        }
    }

    private func resetDraft() {
        let selection = Dictionary(uniqueKeysWithValues: (viewModel.expenseSelectionRows + viewModel.incomingSelectionRows).map { ($0.id, $0.isTracking) })
        originalSelection = selection
        draftSelection = selection
        inlineError = nil
        isSaving = false
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await viewModel.saveTrackingSelection(original: originalSelection, draft: draftSelection)
            dismiss()
        } catch {
            inlineError = "Failed to update tracking."
        }
    }
}

private extension View {
    @ViewBuilder
    func trackingSelectionSearchable(text: Binding<String>) -> some View {
        if #available(iOS 26.0, *) {
            searchable(text: text, prompt: "Categories and subcategories")
                .searchToolbarBehavior(.minimize)
        } else {
            searchable(text: text, prompt: "Categories and subcategories")
        }
    }
}

private struct TrackingSelectionRowView: View {
    let row: TrackingSelectionOptionRow
    @Binding var isSelected: Bool

    var body: some View {
        Button {
            isSelected.toggle()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                    .frame(width: 26)
                Circle()
                    .fill(optionColor(from: row.color) ?? .gray)
                    .frame(width: 12, height: 12)
                Text(row.value)
                    .foregroundStyle(.primary)
                Spacer()
            }
            .padding(.leading, CGFloat(row.indentationLevel) * 18)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("tracking_selection_row_\(row.id)")
        .accessibilityLabel(row.parentValue.map { "\($0), \(row.value)" } ?? row.value)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
    }

    private func optionColor(from hex: String) -> Color? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }
}

private struct TrackingTimelineRowCard: View {
    let row: TrackingTimelineRowViewData
    @Binding var isExpanded: Bool
    let onStartMonth: (String) -> Void
    let onBuffer: (Int) -> Void

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            HStack(spacing: 24) {
                HStack(spacing: 8) {
                    Text("Start")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Menu {
                        ForEach(row.availableMonths, id: \.self) { month in
                            Button(month) { onStartMonth(month) }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(row.startMonth)
                            Image(systemName: "chevron.down")
                                .font(.caption2.weight(.semibold))
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    }
                    .accessibilityIdentifier("tracking_start_month_\(row.key)")
                }

                HStack(spacing: 8) {
                    Text("Buffer")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Menu {
                        ForEach(0 ... 24, id: \.self) { value in
                            Button("\(value)") { onBuffer(value) }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text("\(row.trailingBufferMonths)")
                            Image(systemName: "chevron.down")
                                .font(.caption2.weight(.semibold))
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    }
                    .accessibilityIdentifier("tracking_buffer_\(row.key)")
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(optionColor(from: row.colorHex) ?? .gray)
                        .frame(width: 10, height: 10)
                        .accessibilityHidden(true)
                    Text(row.label)
                        .font(.headline)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .layoutPriority(1)
                        .accessibilityIdentifier("tracking_row_title_\(row.key)")
                }
                TrackingPipelinePreview(segments: row.segments)
            }
            .padding(.bottom, 10)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("tracking_row_expand_\(row.key)")
    }
}

private struct TrackingPipelinePreview: View {
    let segments: [TrackingTimelineSegment]

    var body: some View {
        ScrollViewReader { proxy in
            GeometryReader { geo in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(segments) { segment in
                            VStack(spacing: 2) {
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(color(for: segment.state))
                                    .frame(width: 40, height: 8)
                                Text(monthAbbrev(segment.month))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .id(segment.id)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("\(segment.month), \(segment.state.rawValue)")
                        }
                    }
                    .frame(minWidth: geo.size.width, alignment: .trailing)
                }
                .onAppear {
                    if let newest = segments.last?.id {
                        proxy.scrollTo(newest, anchor: .trailing)
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func monthAbbrev(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count == 2, let m = Int(parts[1]), (1 ... 12).contains(m) else { return month }
        let labels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        return labels[m - 1]
    }

    private func color(for state: TrackingTimelineSegmentState) -> Color {
        switch state {
        case .paid: return .green
        case .unpaid: return .orange
        case .buffer: return Color(uiColor: .systemGray3)
        case .empty: return Color(uiColor: .systemGray4)
        }
    }
}
