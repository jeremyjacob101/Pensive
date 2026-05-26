import SwiftUI

@MainActor
final class QuickAddFormViewModel: ObservableObject {
    @Published var kind: QuickAddKind = .expense
    @Published var title: String = ""
    @Published var amountText: String = ""
    @Published var selectedOption: String = "General"
    @Published var newOptionName: String = ""
    @Published private(set) var inlineError: String?
    @Published private(set) var optionChoices: [String] = ["General", "Home", "Work"]

    func submit() -> Bool {
        inlineError = nil

        let normalizedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedTitle.isEmpty else {
            inlineError = "Title is required."
            return false
        }

        guard let amount = Decimal(string: amountText), amount > 0 else {
            inlineError = "Amount must be greater than zero."
            return false
        }

        return true
    }

    func addOptionIfNeeded() {
        let normalized = newOptionName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            inlineError = "Option name cannot be empty."
            return
        }
        guard !optionChoices.contains(normalized) else {
            inlineError = "Option already exists."
            selectedOption = normalized
            return
        }
        optionChoices.append(normalized)
        optionChoices.sort()
        selectedOption = normalized
        newOptionName = ""
        inlineError = nil
    }

    func reset() {
        title = ""
        amountText = ""
        selectedOption = optionChoices.first ?? "General"
        inlineError = nil
    }
}

private struct FeatureRootView: View {
    let tab: AppTab
    let userId: String
    let api: ConvexAPI
    let onSignOut: () -> Void
    let onQuickAdd: () -> Void

    @State private var searchText = ""
    @State private var debouncedSearch = ""
    @State private var selectedFilters: Set<String> = []
    @State private var selectedMonth = Date()
    @State private var rangeStart = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
    @State private var rangeEnd = Date()

    var body: some View {
        Group {
            if tab == .expenses {
                ExpensesFeatureView(api: api)
            } else if tab == .incomings {
                IncomingsFeatureView(api: api)
            } else if tab == .breakdown {
                BreakdownFeatureView(api: api)
            } else if tab == .recurrings {
                RecurringsFeatureView(api: api)
            } else {
                List {
            Section {
                DebouncedSearchField(text: $searchText) { value in
                    debouncedSearch = value
                }
                MultiSelectFilterButton(
                    title: "Filters",
                    choices: ["Personal", "Business", "Shared", "Archived"],
                    selected: $selectedFilters
                )
                MonthNavigator(month: $selectedMonth)
                DateRangePickerButton(startDate: $rangeStart, endDate: $rangeEnd)
            }

            Section("State") {
                Text("Search: \(debouncedSearch.isEmpty ? "None" : debouncedSearch)")
                Text("Filters: \(selectedFilters.sorted().joined(separator: ", ").isEmpty ? "None" : selectedFilters.sorted().joined(separator: ", "))")
            }

            Section("Navigation") {
                NavigationLink(value: ShellRoute.detail(title: "\(tab.title) Details")) {
                    Label("Open detail", systemImage: "arrow.right.circle")
                }
            }

            if tab == .options {
                Section("Session") {
                    Text("Signed in as \(userId)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Sign Out", role: .destructive, action: onSignOut)
                        .accessibilityIdentifier("sign_out_button")
                }
            }
        }
                .listStyle(.insetGrouped)
                .navigationTitle(tab.title)
                .navigationDestination(for: ShellRoute.self) { route in
            switch route {
            case .detail(let title):
                LoadStateView(state: .content) {
                    Text(title)
                        .font(.title3.weight(.medium))
                        .padding()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
                }
                .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    onQuickAdd()
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityIdentifier("quick_add_button")
                .accessibilityLabel("Quick Add")
            }
                }
            }
        }
    }
}

private struct BreakdownMetricCard: View {
    let title: String
    let total: String
    let perMonth: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline) {
                Text(total).font(.title2.weight(.bold))
                Spacer()
                Text("\(perMonth) /month").font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(tint.opacity(0.45), lineWidth: 1)
        )
    }
}

@MainActor
private final class BreakdownViewModel: ObservableObject {
    @Published var state: ViewLoadState = .loading
    @Published var searchText = ""
    @Published var selectedFilters: Set<String> = []
    @Published var month = Date()
    @Published var startDate = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: Date())) ?? Date()
    @Published var endDate = Date()
    @Published var summary: SummaryRangeResponse?

    private let api: ConvexAPI
    private let calendar = LedgerScopeLogic.calendar

    init(api: ConvexAPI) {
        self.api = api
        let today = Date()
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: today)) ?? today
        let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? today
        startDate = monthStart
        endDate = monthEnd
    }

    func onAppear() {
        Task {
            await load()
        }
    }

    func syncMonthToRange() {
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: month)) ?? month
        let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? monthStart
        startDate = monthStart
        endDate = monthEnd
        Task { await load() }
    }

    func load() async {
        state = .loading
        do {
            summary = try await api.summaries.range(.init(startDate: LedgerScopeLogic.isoDate(startDate), endDate: LedgerScopeLogic.isoDate(endDate)))
            state = .content
        } catch {
            state = .error(message: "Failed to load breakdown")
        }
    }
}

private struct BreakdownFeatureView: View {
    @StateObject private var viewModel: BreakdownViewModel

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: BreakdownViewModel(api: api))
    }

    private let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "ILS"
        f.locale = Locale(identifier: "he_IL")
        return f
    }()

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.load() } }) {
            List {
                Section {
                    DebouncedSearchField(text: $viewModel.searchText) { _ in }
                    MultiSelectFilterButton(title: "Filters", choices: [], selected: $viewModel.selectedFilters)
                    MonthNavigator(month: $viewModel.month)
                        .onChange(of: viewModel.month) { _, _ in viewModel.syncMonthToRange() }
                    DateRangePickerButton(startDate: $viewModel.startDate, endDate: $viewModel.endDate)
                        .onChange(of: viewModel.startDate) { _, _ in Task { await viewModel.load() } }
                        .onChange(of: viewModel.endDate) { _, _ in Task { await viewModel.load() } }
                }

                if let summary = viewModel.summary {
                    Section {
                        BreakdownMetricCard(title: "TOTAL INCOMINGS", total: money(summary.totals.effectiveIncomings), perMonth: monthly(value: summary.totals.effectiveIncomings, count: summary.monthlyBuckets.count), tint: .green)
                        BreakdownMetricCard(title: "TOTAL EXPENSES", total: money(summary.totals.effectiveExpenses), perMonth: monthly(value: summary.totals.effectiveExpenses, count: summary.monthlyBuckets.count), tint: .red)
                        BreakdownMetricCard(title: "TOTAL SAVINGS", total: money(summary.totals.effectiveNet), perMonth: monthly(value: summary.totals.effectiveNet, count: summary.monthlyBuckets.count), tint: .blue)
                    }
                }

                if let summary = viewModel.summary {
                    Section("Per Month") {
                        ForEach(summary.monthlyBuckets, id: \.month) { row in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(row.month).font(.headline)
                                HStack {
                                    Text("Incomings \(money(row.effectiveIncomings))")
                                    Spacer()
                                    Text("Expenses \(money(row.effectiveExpenses))")
                                    Spacer()
                                    Text("Savings \(money(row.effectiveNet))").foregroundStyle(row.effectiveNet >= 0 ? .green : .red)
                                }
                                .font(.footnote)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Breakdown")
            .refreshable { await viewModel.load() }
        }
        .task { viewModel.onAppear() }
    }

    private func money(_ value: Double) -> String {
        formatter.string(from: NSNumber(value: value)) ?? "₪\(value)"
    }

    private func monthly(value: Double, count: Int) -> String {
        guard count > 0 else { return money(value) }
        return money(value / Double(count))
    }
}

struct AppShellView: View {
    let userId: String
    let api: ConvexAPI
    let onSignOut: () -> Void

    @SceneStorage("shell.selectedTab") private var selectedTabRaw = AppTab.defaultTab.rawValue
    @SceneStorage("shell.path.expenses") private var expensesPathData: Data?
    @SceneStorage("shell.path.incomings") private var incomingsPathData: Data?
    @SceneStorage("shell.path.breakdown") private var breakdownPathData: Data?
    @SceneStorage("shell.path.recurrings") private var recurringsPathData: Data?
    @SceneStorage("shell.path.tracking") private var trackingPathData: Data?
    @SceneStorage("shell.path.notepad") private var notepadPathData: Data?
    @SceneStorage("shell.path.options") private var optionsPathData: Data?

    @State private var selectedTab: AppTab = .defaultTab
    @State private var pathByTab: [AppTab: NavigationPath] = [:]
    @State private var quickAddPresented = false
    @StateObject private var quickAddVM = QuickAddFormViewModel()

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                NavigationStack(path: binding(for: tab)) {
                    FeatureRootView(tab: tab, userId: userId, api: api, onSignOut: onSignOut) {
                        quickAddPresented = true
                    }
                }
                .tabItem {
                    Label(tab.title, systemImage: tab.systemImage)
                }
                .tag(tab)
                .accessibilityIdentifier("tab_\(tab.rawValue)")
            }
        }
        .sheet(isPresented: $quickAddPresented, onDismiss: {
            quickAddVM.reset()
        }) {
            QuickAddSheet(viewModel: quickAddVM) {
                quickAddPresented = false
            }
            .presentationDetents([.medium, .large])
            .accessibilityIdentifier("quick_add_sheet")
        }
        .onAppear {
            restoreSelectedTabIfNeeded()
            restorePathsIfNeeded()
        }
        .onChange(of: selectedTab) { _, newValue in
            selectedTabRaw = newValue.rawValue
        }
        .onOpenURL { url in
            apply(deepLink: ShellDeepLink.parse(url: url))
        }
    }

    private func binding(for tab: AppTab) -> Binding<NavigationPath> {
        Binding {
            pathByTab[tab, default: NavigationPath()]
        } set: { newValue in
            pathByTab[tab] = newValue
            persist(path: newValue, for: tab)
        }
    }

    private func restoreSelectedTabIfNeeded() {
        selectedTab = AppTab(rawValue: selectedTabRaw) ?? .defaultTab
    }

    private func restorePathsIfNeeded() {
        for tab in AppTab.allCases {
            pathByTab[tab] = restorePath(for: tab)
        }
    }

    private func apply(deepLink: ShellDeepLink?) {
        guard let deepLink else { return }
        if let tab = deepLink.tab {
            selectedTab = tab
        }
        if let quickAddKind = deepLink.quickAddKind {
            quickAddVM.kind = quickAddKind
            quickAddPresented = true
        }
    }

    private func persist(path: NavigationPath, for tab: AppTab) {
        guard let codable = path.codable else {
            setPathData(nil, for: tab)
            return
        }

        do {
            let data = try JSONEncoder().encode(codable)
            setPathData(data, for: tab)
        } catch {
            setPathData(nil, for: tab)
        }
    }

    private func restorePath(for tab: AppTab) -> NavigationPath {
        guard let data = pathData(for: tab) else { return NavigationPath() }

        do {
            let codable = try JSONDecoder().decode(NavigationPath.CodableRepresentation.self, from: data)
            return NavigationPath(codable)
        } catch {
            return NavigationPath()
        }
    }

    private func pathData(for tab: AppTab) -> Data? {
        switch tab {
        case .expenses: return expensesPathData
        case .incomings: return incomingsPathData
        case .breakdown: return breakdownPathData
        case .recurrings: return recurringsPathData
        case .tracking: return trackingPathData
        case .notepad: return notepadPathData
        case .options: return optionsPathData
        }
    }

    private func setPathData(_ value: Data?, for tab: AppTab) {
        switch tab {
        case .expenses: expensesPathData = value
        case .incomings: incomingsPathData = value
        case .breakdown: breakdownPathData = value
        case .recurrings: recurringsPathData = value
        case .tracking: trackingPathData = value
        case .notepad: notepadPathData = value
        case .options: optionsPathData = value
        }
    }
}

private struct QuickAddSheet: View {
    @ObservedObject var viewModel: QuickAddFormViewModel
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Picker("Type", selection: $viewModel.kind) {
                    ForEach(QuickAddKind.allCases) { kind in
                        Text(kind.title).tag(kind)
                    }
                }

                TextField("Title", text: $viewModel.title)
                TextField("Amount", text: $viewModel.amountText)
                    .keyboardType(.decimalPad)

                Picker("Option", selection: $viewModel.selectedOption) {
                    ForEach(viewModel.optionChoices, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }

                Section("Add missing option") {
                    TextField("New option", text: $viewModel.newOptionName)
                    Button("Add Option") {
                        viewModel.addOptionIfNeeded()
                    }
                }

                if let inlineError = viewModel.inlineError, !inlineError.isEmpty {
                    Text(inlineError)
                        .foregroundStyle(.red)
                        .font(.footnote)
                        .accessibilityIdentifier("quick_add_inline_error")
                }
            }
            .navigationTitle("Quick Add")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close", action: onClose)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") {
                        if viewModel.submit() {
                            onClose()
                        }
                    }
                    .accessibilityIdentifier("quick_add_create")
                }
            }
        }
    }
}
