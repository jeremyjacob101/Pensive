import Charts
import SwiftUI

struct SavingsFeatureView: View {
    @StateObject private var viewModel: SavingsFeatureViewModel
    @State private var selectedBankIDs: Set<String> = []
    @State private var knownBankIDs: Set<String> = []
    @State private var chartMode: SavingsChartMode = .stacked
    @State private var horizon: SavingsHorizon = .twenty
    @State private var customHorizon = 12
    @State private var showsCustomHorizon = false
    @State private var interestOn = true
    @State private var totalVisible = true
    @State private var presentedSheet: SavingsSheetDestination?
    @State private var showsAddMenu = false
    @State private var deleteTarget: SavingsDeleteTarget?
    @State private var showsAllEntries = false

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: SavingsFeatureViewModel(api: api))
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                summarySection
                    .padding(.top, 10)

                if let errorMessage = viewModel.errorMessage {
                    errorBanner(errorMessage)
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                }

                if viewModel.isLoading && viewModel.banks.isEmpty {
                    ProgressView("Loading savings…")
                        .frame(maxWidth: .infinity, minHeight: 360)
                } else if viewModel.banks.isEmpty {
                    emptyState
                } else {
                    controlsSection
                    chartSection
                    banksSection
                    recentEntriesSection
                }
            }
            .padding(.bottom, 30)
        }
        .background(Color(uiColor: .systemBackground))
        .navigationTitle("Savings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showsAddMenu = true
                } label: {
                    Image(systemName: "plus")
                        // Keep the toolbar action reliably tappable for VoiceOver and UI tests.
                        // The intrinsic symbol size is smaller than the system's recommended
                        // control target and can produce an invalid accessibility hit point
                        // when the page is hosted in a scroll view.
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityIdentifier("savings_add_menu")
                .accessibilityLabel("Add savings item")
            }
        }
        .confirmationDialog("Add savings item", isPresented: $showsAddMenu, titleVisibility: .hidden) {
            Button("Add bank") {
                presentedSheet = .bank(nil)
            }

            Button("Add balance") {
                presentedSheet = .entry(nil, initialBankID: selectedBankIDs.first)
            }
            .disabled(viewModel.banks.isEmpty)

            Button("Currency & rate") {
                presentedSheet = .currency
            }

            Button("Cancel", role: .cancel) {}
        }
        .task {
            await viewModel.load()
            synchronizeBankSelection()
        }
        .onChange(of: viewModel.banks) { _, _ in
            synchronizeBankSelection()
        }
        .sheet(item: $presentedSheet) { destination in
            switch destination {
            case .bank(let bank):
                SavingsBankEditorSheet(viewModel: viewModel, bank: bank)
            case .entry(let entry, let initialBankID):
                SavingsEntryEditorSheet(
                    viewModel: viewModel,
                    entry: entry,
                    initialBankID: initialBankID
                )
            case .currency:
                SavingsCurrencySettingsSheet(viewModel: viewModel)
            }
        }
        .alert(item: $deleteTarget) { target in
            switch target {
            case .bank(let bank):
                Alert(
                    title: Text("Delete bank?"),
                    message: Text("\(bank.name) and all of its balance history will be removed."),
                    primaryButton: .destructive(Text("Delete")) {
                        Task { await viewModel.removeBank(bank) }
                    },
                    secondaryButton: .cancel()
                )
            case .entry(let entry):
                Alert(
                    title: Text("Delete balance?"),
                    message: Text("This snapshot will be removed from the chart history."),
                    primaryButton: .destructive(Text("Delete")) {
                        Task { await viewModel.removeEntry(entry) }
                    },
                    secondaryButton: .cancel()
                )
            }
        }
    }

    private var selectedHorizonYears: Int {
        showsCustomHorizon ? customHorizon : horizon.rawValue
    }

    private var series: [SavingsChartPoint] {
        SavingsCalculator.series(
            banks: viewModel.banks,
            entries: viewModel.entries,
            selectedBankIDs: selectedBankIDs,
            horizonYears: selectedHorizonYears,
            interestOn: interestOn,
            displayCurrency: displayCurrency,
            usdIlsRate: effectiveUsdIlsRate
        )
    }

    private var displayCurrency: SavingsCurrency {
        viewModel.currencySettings.displayCurrency
    }

    private var effectiveUsdIlsRate: Double? {
        viewModel.currencySettings.effectiveUsdIlsRate
    }

    private var hasUsableExchangeRate: Bool {
        guard let effectiveUsdIlsRate else { return false }
        return effectiveUsdIlsRate.isFinite && effectiveUsdIlsRate > 0
    }

    private var conversionBlocked: Bool {
        !hasUsableExchangeRate && SavingsCalculator.requiresExchangeRate(
            banks: viewModel.banks,
            entries: viewModel.entries,
            selectedBankIDs: selectedBankIDs,
            displayCurrency: displayCurrency
        )
    }

    private var latestByBank: [String: SavingsEntryDTO] {
        SavingsCalculator.latestEntries(
            banks: viewModel.banks,
            entries: viewModel.entries
        )
    }

    private var todayTotal: Double? {
        guard !conversionBlocked else { return nil }
        return series.last(where: { !$0.isForecast })?.total ?? 0
    }

    private var forecastTotal: Double? {
        guard !conversionBlocked else { return nil }
        return series.last?.total ?? todayTotal ?? 0
    }

    private var summarySection: some View {
        HStack(spacing: 0) {
            SavingsSummaryMetric(
                value: todayTotal,
                label: "Today",
                currency: displayCurrency,
                usdIlsRate: effectiveUsdIlsRate
            )
            Divider().frame(height: 46)
            SavingsSummaryMetric(
                value: forecastTotal,
                label: "Forecast · \(selectedHorizonYears)Y",
                currency: displayCurrency,
                usdIlsRate: effectiveUsdIlsRate
            )
            Divider().frame(height: 46)
            SavingsSummaryMetric(
                value: forecastTotal.flatMap { forecast in
                    todayTotal.map { forecast - $0 }
                },
                label: "Growth",
                currency: displayCurrency,
                usdIlsRate: effectiveUsdIlsRate,
                tint: (forecastTotal ?? 0) >= (todayTotal ?? 0) ? .green : .red
            )
        }
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) { Divider() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savings_summary")
    }

    private var controlsSection: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Picker(
                    "Display currency",
                    selection: Binding(
                        get: { displayCurrency },
                        set: { currency in
                            Task {
                                _ = await viewModel.saveCurrencySettings(
                                    displayCurrency: currency,
                                    manualUsdIlsRate: viewModel.currencySettings.manualUsdIlsRate
                                )
                            }
                        }
                    )
                ) {
                    ForEach(SavingsCurrency.allCases) { currency in
                        Text(currency.title).tag(currency)
                    }
                }
                .pickerStyle(.segmented)

                Button {
                    presentedSheet = .currency
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(effectiveUsdIlsRate.map {
                            "1 USD = ₪\($0.formatted(.number.precision(.fractionLength(4))))"
                        } ?? "Set exchange rate")
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                        Text(viewModel.currencySettings.usesManualRate ? "Custom rate" : "Live rate")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .frame(minWidth: 102, alignment: .leading)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Currency and exchange-rate settings")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Text("Savings horizon")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        ForEach(SavingsHorizon.allCases) { option in
                            SavingsChoiceButton(
                                title: option.title,
                                isSelected: !showsCustomHorizon && option == horizon
                            ) {
                                horizon = option
                                showsCustomHorizon = false
                            }
                        }
                        SavingsChoiceButton(
                            title: "Custom",
                            isSelected: showsCustomHorizon
                        ) {
                            showsCustomHorizon.toggle()
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .contentMargins(.horizontal, 0, for: .scrollContent)

                if showsCustomHorizon {
                    HStack {
                        Stepper("\(customHorizon) years", value: $customHorizon, in: 1 ... 100)
                            .font(.subheadline)
                    }
                    .padding(.horizontal, 16)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .padding(.vertical, 14)

            Divider()

            HStack(spacing: 16) {
                Toggle("Interest on", isOn: $interestOn)
                    .font(.subheadline.weight(.medium))
                    .tint(Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255))

                Divider().frame(height: 34)

                Picker("Chart mode", selection: $chartMode) {
                    ForEach(SavingsChartMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)

            Divider()

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    SavingsSeriesChip(
                        title: "Total",
                        color: Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255),
                        isSelected: totalVisible
                    ) {
                        totalVisible.toggle()
                    }

                    ForEach(viewModel.banks) { bank in
                        SavingsSeriesChip(
                            title: bank.name,
                            color: Color(savingsHex: bank.color),
                            isSelected: selectedBankIDs.contains(bank.id)
                        ) {
                            if selectedBankIDs.contains(bank.id) {
                                selectedBankIDs.remove(bank.id)
                            } else {
                                selectedBankIDs.insert(bank.id)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .contentMargins(.horizontal, 0, for: .scrollContent)
        }
        .animation(.easeInOut(duration: 0.18), value: showsCustomHorizon)
    }

    private var chartSection: some View {
        SavingsChartView(
            points: series,
            banks: viewModel.banks.filter { selectedBankIDs.contains($0.id) },
            mode: chartMode,
            totalVisible: totalVisible,
            currency: displayCurrency,
            usdIlsRate: effectiveUsdIlsRate,
            emptyMessage: conversionBlocked
                ? "Fetching an exchange rate before combining ILS and USD balances…"
                : nil
        )
        .frame(height: 390)
        .padding(.horizontal, 8)
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) { Divider() }
        .accessibilityIdentifier("savings_chart")
    }

    private var banksSection: some View {
        VStack(spacing: 0) {
            SavingsSectionHeader(title: "Banks") {
                Button("Add bank") { presentedSheet = .bank(nil) }
                    .font(.caption.weight(.semibold))
            }

            ForEach(Array(viewModel.banks.enumerated()), id: \.element.id) { index, bank in
                SavingsBankRow(
                    bank: bank,
                    latestEntry: latestByBank[bank.id],
                    displayCurrency: displayCurrency,
                    usdIlsRate: effectiveUsdIlsRate,
                    isSelected: selectedBankIDs.contains(bank.id),
                    canMoveUp: index > 0,
                    canMoveDown: index < viewModel.banks.count - 1,
                    onToggle: {
                        if selectedBankIDs.contains(bank.id) {
                            selectedBankIDs.remove(bank.id)
                        } else {
                            selectedBankIDs.insert(bank.id)
                        }
                    },
                    onAddBalance: {
                        presentedSheet = .entry(nil, initialBankID: bank.id)
                    },
                    onEdit: { presentedSheet = .bank(bank) },
                    onMoveUp: { Task { await viewModel.moveBank(bank, offset: -1) } },
                    onMoveDown: { Task { await viewModel.moveBank(bank, offset: 1) } },
                    onDelete: { deleteTarget = .bank(bank) }
                )
                .padding(.horizontal, 16)

                if index < viewModel.banks.count - 1 {
                    Divider().padding(.leading, 48)
                }
            }
        }
        .padding(.top, 6)
        .overlay(alignment: .bottom) { Divider() }
    }

    private var recentEntriesSection: some View {
        let sorted = viewModel.entries.sorted {
            $0.date == $1.date ? $0.createdAt > $1.createdAt : $0.date > $1.date
        }
        let visible = showsAllEntries ? sorted : Array(sorted.prefix(6))

        return VStack(spacing: 0) {
            SavingsSectionHeader(title: "Recent balances") {
                if sorted.count > 6 {
                    Button(showsAllEntries ? "Show recent" : "View all") {
                        showsAllEntries.toggle()
                    }
                    .font(.caption.weight(.semibold))
                }
            }

            if visible.isEmpty {
                Text("Add a balance to start your history.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 100)
            } else {
                ForEach(Array(visible.enumerated()), id: \.element.id) { index, entry in
                    if let bank = viewModel.banks.first(where: { $0.id == entry.bankId }) {
                        SavingsEntryRow(
                            entry: entry,
                            bank: bank,
                            displayCurrency: displayCurrency,
                            usdIlsRate: effectiveUsdIlsRate,
                            onEdit: { presentedSheet = .entry(entry, initialBankID: nil) },
                            onDelete: { deleteTarget = .entry(entry) }
                        )
                        .padding(.horizontal, 16)

                        if index < visible.count - 1 {
                            Divider().padding(.leading, 48)
                        }
                    }
                }
            }

            Button {
                presentedSheet = .entry(nil, initialBankID: selectedBankIDs.first)
            } label: {
                Label("Add balance", systemImage: "plus.circle")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 15)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255))
            .accessibilityLabel("Record new balance")
        }
        .padding(.top, 6)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 28, weight: .medium))
                .foregroundStyle(Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255))
                .frame(width: 58, height: 58)
                .background(Color(red: 238 / 255, green: 242 / 255, blue: 1), in: RoundedRectangle(cornerRadius: 16))

            Text("Build your first savings")
                .font(.title3.weight(.semibold))

            Text("Add a bank and its first balance. Savings banks stay separate from the accounts used by expenses and incomings.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)

            Button("Add your first bank") { presentedSheet = .bank(nil) }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255))
        }
        .frame(maxWidth: .infinity, minHeight: 430)
        .padding(24)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
                .font(.footnote)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                viewModel.errorMessage = nil
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(.red)
        .padding(11)
        .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
    }

    private func synchronizeBankSelection() {
        let current = Set(viewModel.banks.map(\.id))
        guard current != knownBankIDs else { return }
        selectedBankIDs.formIntersection(current)
        selectedBankIDs.formUnion(current.subtracting(knownBankIDs))
        if knownBankIDs.isEmpty {
            selectedBankIDs = current
        }
        knownBankIDs = current
    }
}

private enum SavingsSheetDestination: Identifiable {
    case bank(SavingsBankDTO?)
    case entry(SavingsEntryDTO?, initialBankID: String?)
    case currency

    var id: String {
        switch self {
        case .bank(let bank): return "bank-\(bank?.id ?? "new")"
        case .entry(let entry, _): return "entry-\(entry?.id ?? "new")"
        case .currency: return "currency"
        }
    }
}

private enum SavingsDeleteTarget: Identifiable {
    case bank(SavingsBankDTO)
    case entry(SavingsEntryDTO)

    var id: String {
        switch self {
        case .bank(let bank): return "bank-\(bank.id)"
        case .entry(let entry): return "entry-\(entry.id)"
        }
    }
}

private struct SavingsSummaryMetric: View {
    let value: Double?
    let label: String
    let currency: SavingsCurrency
    let usdIlsRate: Double?
    var tint: Color = .primary

    private var secondaryValue: Double? {
        guard let value else { return nil }
        return SavingsCalculator.convert(
            value,
            from: currency,
            to: currency.other,
            usdIlsRate: usdIlsRate
        )
    }

    var body: some View {
        VStack(spacing: 5) {
            Text(value.map { SavingsFormatting.money($0, currency: currency) } ?? "Rate needed")
                .font(.title3.weight(.bold))
                .foregroundStyle(tint)
                .contentTransition(.numericText())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            if let secondaryValue {
                Text("≈ \(SavingsFormatting.money(secondaryValue, currency: currency.other))")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .monospacedDigit()
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 5)
    }
}

private struct SavingsChoiceButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .font(.caption.weight(.semibold))
            .foregroundStyle(isSelected ? Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255) : .primary)
            .padding(.horizontal, 13)
            .frame(height: 36)
            .background(
                isSelected ? Color(red: 238 / 255, green: 242 / 255, blue: 1) : Color(uiColor: .secondarySystemBackground),
                in: RoundedRectangle(cornerRadius: 9)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 9)
                    .stroke(isSelected ? Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255) : Color.secondary.opacity(0.14))
            }
            .buttonStyle(.plain)
    }
}

private struct SavingsSeriesChip: View {
    let title: String
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? color : .secondary)
                Circle()
                    .fill(color)
                    .frame(width: 7, height: 7)
                Text(title)
                    .foregroundStyle(isSelected ? Color.primary : Color.secondary)
            }
            .font(.caption.weight(.medium))
            .padding(.horizontal, 4)
            .frame(height: 32)
        }
        .buttonStyle(.plain)
        .accessibilityValue(isSelected ? "Shown" : "Hidden")
    }
}

private struct SavingsSectionHeader<Accessory: View>: View {
    let title: String
    let accessory: Accessory

    init(title: String, @ViewBuilder accessory: () -> Accessory) {
        self.title = title
        self.accessory = accessory()
    }

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)
            Spacer()
            accessory
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) { Divider() }
    }
}

private struct SavingsBankRow: View {
    let bank: SavingsBankDTO
    let latestEntry: SavingsEntryDTO?
    let displayCurrency: SavingsCurrency
    let usdIlsRate: Double?
    let isSelected: Bool
    let canMoveUp: Bool
    let canMoveDown: Bool
    let onToggle: () -> Void
    let onAddBalance: () -> Void
    let onEdit: () -> Void
    let onMoveUp: () -> Void
    let onMoveDown: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 11) {
            Circle()
                .fill(Color(savingsHex: bank.color))
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 4) {
                Text(bank.name)
                    .font(.subheadline.weight(.semibold))
                Text("\(bank.savingsCurrency.rawValue) · \(bank.interestEnabled ? "\(bank.annualInterestRate.formatted(.number.precision(.fractionLength(2))))% · \(bank.compounding)" : "Interest off")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 4) {
                if let latestEntry {
                    SavingsMoneyPair(
                        amount: latestEntry.amount,
                        enteredCurrency: latestEntry.savingsCurrency,
                        displayCurrency: displayCurrency,
                        usdIlsRate: usdIlsRate
                    )
                } else {
                    Text("—")
                        .font(.subheadline.weight(.semibold))
                }
                Text(latestEntry.flatMap { SavingsFormatting.isoDate.date(from: $0.date) }.map { SavingsFormatting.displayDate.string(from: $0) } ?? "No balance yet")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Menu {
                Button(action: onToggle) {
                    Label(isSelected ? "Hide on chart" : "Show on chart", systemImage: isSelected ? "eye.slash" : "eye")
                }
                Button(action: onAddBalance) { Label("Add balance", systemImage: "plus.circle") }
                Button(action: onEdit) { Label("Edit bank", systemImage: "pencil") }
                Button(action: onMoveUp) { Label("Move up", systemImage: "arrow.up") }
                    .disabled(!canMoveUp)
                Button(action: onMoveDown) { Label("Move down", systemImage: "arrow.down") }
                    .disabled(!canMoveDown)
                Divider()
                Button(role: .destructive, action: onDelete) { Label("Delete bank", systemImage: "trash") }
            } label: {
                Image(systemName: "ellipsis")
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Actions for \(bank.name)")
        }
        .frame(minHeight: 64)
    }
}

private struct SavingsEntryRow: View {
    let entry: SavingsEntryDTO
    let bank: SavingsBankDTO
    let displayCurrency: SavingsCurrency
    let usdIlsRate: Double?
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 11) {
            Circle()
                .fill(Color(savingsHex: bank.color))
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 4) {
                Text(bank.name)
                    .font(.subheadline.weight(.semibold))
                Text(entry.note ?? "Balance snapshot")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 4) {
                SavingsMoneyPair(
                    amount: entry.amount,
                    enteredCurrency: entry.savingsCurrency,
                    displayCurrency: displayCurrency,
                    usdIlsRate: usdIlsRate
                )
                Text(SavingsFormatting.isoDate.date(from: entry.date).map { SavingsFormatting.displayDate.string(from: $0) } ?? entry.date)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Menu {
                Button(action: onEdit) { Label("Edit balance", systemImage: "pencil") }
                Button(role: .destructive, action: onDelete) { Label("Delete balance", systemImage: "trash") }
            } label: {
                Image(systemName: "ellipsis")
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Actions for \(bank.name) balance")
        }
        .frame(minHeight: 62)
    }
}

private struct SavingsMoneyPair: View {
    let amount: Double
    let enteredCurrency: SavingsCurrency
    let displayCurrency: SavingsCurrency
    let usdIlsRate: Double?

    private var displayValue: Double? {
        SavingsCalculator.convert(
            amount,
            from: enteredCurrency,
            to: displayCurrency,
            usdIlsRate: usdIlsRate
        )
    }

    private var secondaryValue: Double? {
        guard displayValue != nil else { return nil }
        return SavingsCalculator.convert(
            amount,
            from: enteredCurrency,
            to: displayCurrency.other,
            usdIlsRate: usdIlsRate
        )
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(
                displayValue.map {
                    SavingsFormatting.money($0, currency: displayCurrency, cents: true)
                } ?? SavingsFormatting.money(amount, currency: enteredCurrency, cents: true)
            )
            .font(.subheadline.weight(.semibold))
            .monospacedDigit()

            if let secondaryValue {
                Text("≈ \(SavingsFormatting.money(secondaryValue, currency: displayCurrency.other, cents: true))")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            } else if enteredCurrency != displayCurrency {
                Text("Rate unavailable")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct SavingsChartView: View {
    let points: [SavingsChartPoint]
    let banks: [SavingsBankDTO]
    let mode: SavingsChartMode
    let totalVisible: Bool
    let currency: SavingsCurrency
    let usdIlsRate: Double?
    let emptyMessage: String?

    @State private var selectedDate: Date?

    private var selectionPoint: SavingsChartPoint? {
        guard let selectedDate else { return nil }
        return points.min { abs($0.date.timeIntervalSince(selectedDate)) < abs($1.date.timeIntervalSince(selectedDate)) }
    }

    private var stackedValues: [String: [SavingsStackedPoint]] {
        var result: [String: [SavingsStackedPoint]] = [:]
        for point in points {
            var lower = 0.0
            for bank in banks {
                let upper = lower + (point.values[bank.id] ?? 0)
                result[bank.id, default: []].append(
                    SavingsStackedPoint(point: point, lower: lower, upper: upper)
                )
                lower = upper
            }
        }
        return result
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            if points.isEmpty {
                Text(emptyMessage ?? "Select at least one bank to draw its savings.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Chart {
                    if mode == .stacked {
                        ForEach(banks) { bank in
                            ForEach(stackedValues[bank.id] ?? []) { item in
                                AreaMark(
                                    x: .value("Date", item.point.date),
                                    yStart: .value("Lower", item.lower),
                                    yEnd: .value("Upper", item.upper)
                                )
                                .foregroundStyle(Color(savingsHex: bank.color).opacity(0.24))
                                .interpolationMethod(.catmullRom)

                                LineMark(
                                    x: .value("Date", item.point.date),
                                    y: .value("Cumulative balance", item.upper)
                                )
                                .foregroundStyle(Color(savingsHex: bank.color))
                                .lineStyle(.init(lineWidth: 1.5))
                                .interpolationMethod(.catmullRom)
                            }
                        }
                    } else if mode == .lines {
                        ForEach(banks) { bank in
                            ForEach(points) { point in
                                LineMark(
                                    x: .value("Date", point.date),
                                    y: .value(bank.name, point.values[bank.id] ?? 0),
                                    series: .value("Bank", bank.name)
                                )
                                .foregroundStyle(Color(savingsHex: bank.color))
                                .lineStyle(.init(lineWidth: 2))
                                .interpolationMethod(.catmullRom)
                            }
                        }
                    } else {
                        ForEach(points) { point in
                            AreaMark(
                                x: .value("Date", point.date),
                                y: .value("Total", point.total)
                            )
                            .foregroundStyle(
                                .linearGradient(
                                    colors: [Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255).opacity(0.2), .clear],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .interpolationMethod(.catmullRom)
                        }
                    }

                    if totalVisible {
                        ForEach(points) { point in
                            LineMark(
                                x: .value("Date", point.date),
                                y: .value("Total", point.total)
                            )
                            .foregroundStyle(Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255))
                            .lineStyle(.init(lineWidth: 2.6))
                            .interpolationMethod(.catmullRom)
                        }
                    }

                    RuleMark(x: .value("Today", Calendar.current.startOfDay(for: Date())))
                        .foregroundStyle(Color.secondary.opacity(0.55))
                        .lineStyle(.init(lineWidth: 1, dash: [4, 4]))

                    if let selectionPoint {
                        RuleMark(x: .value("Selected", selectionPoint.date))
                            .foregroundStyle(Color.secondary)
                            .lineStyle(.init(lineWidth: 1))
                        PointMark(
                            x: .value("Selected", selectionPoint.date),
                            y: .value("Selected total", selectionPoint.total)
                        )
                        .symbolSize(55)
                        .foregroundStyle(Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255))
                    }
                }
                .chartLegend(.hidden)
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 6)) { value in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3, 3]))
                            .foregroundStyle(Color.secondary.opacity(0.18))
                        AxisValueLabel(format: .dateTime.year())
                            .font(.caption2)
                            .foregroundStyle(Color.secondary)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { value in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3, 3]))
                            .foregroundStyle(Color.secondary.opacity(0.18))
                        AxisValueLabel {
                            if let amount = value.as(Double.self) {
                                Text(amount >= 1_000 ? "\(currency.symbol)\(Int(amount / 1_000))k" : "\(currency.symbol)\(Int(amount))")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .chartXSelection(value: $selectedDate)
                .padding(.top, selectionPoint == nil ? 8 : 82)
            }

            if let selectionPoint {
                SavingsChartCallout(
                    point: selectionPoint,
                    banks: banks,
                    currency: currency,
                    usdIlsRate: usdIlsRate
                )
                    .padding(.trailing, 8)
                    .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .topTrailing)))
            }
        }
        .animation(.easeOut(duration: 0.15), value: selectionPoint?.id)
    }
}

private struct SavingsChartCallout: View {
    let point: SavingsChartPoint
    let banks: [SavingsBankDTO]
    let currency: SavingsCurrency
    let usdIlsRate: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(SavingsFormatting.displayDate.string(from: point.date))
                .font(.caption.weight(.semibold))
            SavingsCalloutRow(
                title: "Total",
                color: Color(red: 21 / 255, green: 60 / 255, blue: 248 / 255),
                value: point.total,
                currency: currency,
                usdIlsRate: usdIlsRate
            )
            ForEach(Array(banks.reversed())) { bank in
                SavingsCalloutRow(
                    title: bank.name,
                    color: Color(savingsHex: bank.color),
                    value: point.values[bank.id] ?? 0,
                    currency: currency,
                    usdIlsRate: usdIlsRate
                )
            }
        }
        .padding(10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 11))
        .overlay { RoundedRectangle(cornerRadius: 11).stroke(Color.secondary.opacity(0.16)) }
        .shadow(color: .black.opacity(0.1), radius: 12, y: 5)
    }
}

private struct SavingsStackedPoint: Identifiable {
    let point: SavingsChartPoint
    let lower: Double
    let upper: Double

    var id: Date { point.id }
}

private struct SavingsCalloutRow: View {
    let title: String
    let color: Color
    let value: Double
    let currency: SavingsCurrency
    let usdIlsRate: Double?

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(title)
                .foregroundStyle(.secondary)
            Spacer(minLength: 12)
            VStack(alignment: .trailing, spacing: 1) {
                Text(SavingsFormatting.money(value, currency: currency))
                    .fontWeight(.semibold)
                    .monospacedDigit()
                if let converted = SavingsCalculator.convert(
                    value,
                    from: currency,
                    to: currency.other,
                    usdIlsRate: usdIlsRate
                ) {
                    Text("≈ \(SavingsFormatting.money(converted, currency: currency.other))")
                        .font(.system(size: 8))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
        }
        .font(.caption2)
    }
}
