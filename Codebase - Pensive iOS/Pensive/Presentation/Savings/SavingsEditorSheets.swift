import SwiftUI

struct SavingsBankEditorSheet: View {
    @ObservedObject var viewModel: SavingsFeatureViewModel
    let bank: SavingsBankDTO?

    @Environment(\.dismiss) private var dismiss
    @State private var values: SavingsBankFormValues
    @State private var startingBalanceText: String
    @FocusState private var focusedField: Field?

    private enum Field { case name, balance, note }
    private let colors = ["#153CF8", "#4389FF", "#FF6758", "#FB8B24", "#5EAE8C", "#8C62E3", "#27A9AE", "#74829A"]

    init(viewModel: SavingsFeatureViewModel, bank: SavingsBankDTO?) {
        self.viewModel = viewModel
        self.bank = bank
        _values = State(initialValue: SavingsBankFormValues(
            name: bank?.name ?? "",
            colorHex: bank?.color ?? "#4389FF",
            currency: bank?.savingsCurrency ?? .ils,
            interestEnabled: bank?.interestEnabled ?? false,
            annualInterestRate: bank?.annualInterestRate ?? 0,
            compounding: bank?.compounding ?? "monthly"
        ))
        _startingBalanceText = State(initialValue: "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Bank") {
                    TextField("Bank name", text: $values.name)
                        .focused($focusedField, equals: .name)

                    Picker("Bank currency", selection: $values.currency) {
                        ForEach(SavingsCurrency.allCases) { currency in
                            Text(currency.title).tag(currency)
                        }
                    }
                    .pickerStyle(.segmented)

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Color")
                            .font(.subheadline)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 13) {
                                ForEach(colors, id: \.self) { hex in
                                    Button {
                                        values.colorHex = hex
                                    } label: {
                                        Circle()
                                            .fill(Color(savingsHex: hex))
                                            .frame(width: 28, height: 28)
                                            .overlay {
                                                if values.colorHex.uppercased() == hex {
                                                    Image(systemName: "checkmark")
                                                        .font(.caption.bold())
                                                        .foregroundStyle(.white)
                                                }
                                            }
                                            .overlay {
                                                Circle()
                                                    .stroke(Color.primary, lineWidth: values.colorHex.uppercased() == hex ? 2 : 0)
                                                    .padding(-4)
                                            }
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("Use color \(hex)")
                                }
                            }
                            .padding(.horizontal, 4)
                            .padding(.vertical, 5)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Growth") {
                    Toggle("Grow with interest", isOn: $values.interestEnabled)

                    TextField(
                        "Annual rate",
                        value: $values.annualInterestRate,
                        format: .number.precision(.fractionLength(0 ... 2))
                    )
                    .keyboardType(.decimalPad)
                    .disabled(!values.interestEnabled)

                    Picker("Compounding", selection: $values.compounding) {
                        Text("Monthly").tag("monthly")
                        Text("Yearly").tag("yearly")
                    }
                    .pickerStyle(.segmented)
                    .disabled(!values.interestEnabled)
                }

                if bank == nil {
                    Section {
                        LabeledContent("Amount") {
                            HStack(spacing: 5) {
                                Text(values.currency.symbol)
                                    .foregroundStyle(.secondary)
                                TextField("0.00", text: $startingBalanceText)
                                    .multilineTextAlignment(.trailing)
                                    .keyboardType(.decimalPad)
                                    .focused($focusedField, equals: .balance)
                            }
                        }

                        DatePicker(
                            "As of date",
                            selection: $values.startingDate,
                            displayedComponents: .date
                        )
                        .disabled(startingBalanceText.trimmingCharacters(in: .whitespaces).isEmpty)

                        TextField("Note (optional)", text: $values.startingNote, axis: .vertical)
                            .lineLimit(2 ... 4)
                            .focused($focusedField, equals: .note)
                            .disabled(startingBalanceText.trimmingCharacters(in: .whitespaces).isEmpty)
                    } header: {
                        Text("Starting balance")
                    } footer: {
                        Text("This creates the bank’s first balance entry.")
                    }
                }

                if let error = viewModel.errorMessage {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(bank == nil ? "Add bank" : "Edit bank")
            .navigationBarTitleDisplayMode(.inline)
            .disabled(viewModel.isSaving)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.isSaving ? "Saving…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(values.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear { focusedField = .name }
        }
        .presentationDetents([.large])
    }

    private func save() async {
        let normalized = startingBalanceText
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized.isEmpty {
            values.startingBalance = nil
        } else if let amount = Double(normalized), amount.isFinite, abs(amount) <= 1_000_000_000_000_000 {
            values.startingBalance = amount
        } else {
            viewModel.errorMessage = "Enter a valid starting balance."
            return
        }
        guard await viewModel.saveBank(values, editing: bank) else { return }
        dismiss()
    }
}

struct SavingsEntryEditorSheet: View {
    @ObservedObject var viewModel: SavingsFeatureViewModel
    let entry: SavingsEntryDTO?

    @Environment(\.dismiss) private var dismiss
    @State private var values: SavingsEntryFormValues
    @State private var amountText: String
    @FocusState private var focusedField: Field?

    private enum Field { case amount, note }

    init(
        viewModel: SavingsFeatureViewModel,
        entry: SavingsEntryDTO?,
        initialBankID: String?
    ) {
        self.viewModel = viewModel
        self.entry = entry
        let date = entry.flatMap { SavingsFormatting.isoDate.date(from: $0.date) } ?? Date()
        _values = State(initialValue: SavingsEntryFormValues(
            bankID: entry?.bankId ?? initialBankID ?? viewModel.banks.first?.id ?? "",
            amount: entry?.amount ?? 0,
            currency: entry?.savingsCurrency ?? viewModel.banks.first(where: {
                $0.id == (initialBankID ?? viewModel.banks.first?.id)
            })?.savingsCurrency ?? .ils,
            date: date,
            note: entry?.note ?? ""
        ))
        _amountText = State(initialValue: entry.map { String($0.amount) } ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Balance") {
                    Picker("Bank", selection: $values.bankID) {
                        ForEach(viewModel.banks) { bank in
                            Label {
                                Text(bank.name)
                            } icon: {
                                Circle()
                                    .fill(Color(savingsHex: bank.color))
                            }
                            .tag(bank.id)
                        }
                    }
                    .onChange(of: values.bankID) { _, newBankID in
                        guard entry == nil,
                              let bank = viewModel.banks.first(where: { $0.id == newBankID }) else { return }
                        values.currency = bank.savingsCurrency
                    }

                    Picker("Entry currency", selection: $values.currency) {
                        ForEach(SavingsCurrency.allCases) { currency in
                            Text(currency.title).tag(currency)
                        }
                    }
                    .pickerStyle(.segmented)

                    LabeledContent("Amount") {
                        HStack(spacing: 5) {
                            Text(values.currency.symbol)
                                .foregroundStyle(.secondary)
                            TextField("0.00", text: $amountText)
                                .multilineTextAlignment(.trailing)
                                .keyboardType(.decimalPad)
                                .focused($focusedField, equals: .amount)
                        }
                    }

                    DatePicker("As of date", selection: $values.date, displayedComponents: .date)

                    TextField("Note (optional)", text: $values.note, axis: .vertical)
                        .lineLimit(2 ... 4)
                        .focused($focusedField, equals: .note)
                }

                Section {
                    Text("Balance snapshots are independent of your expense and incoming accounts.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if let error = viewModel.errorMessage {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(entry == nil ? "Add balance" : "Edit balance")
            .navigationBarTitleDisplayMode(.inline)
            .disabled(viewModel.isSaving)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.isSaving ? "Saving…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(amountText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || values.bankID.isEmpty)
                }
            }
            .onAppear { focusedField = .amount }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() async {
        let normalized = amountText
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let amount = Double(normalized),
              amount.isFinite,
              abs(amount) <= 1_000_000_000_000_000 else {
            viewModel.errorMessage = "Enter a valid balance."
            return
        }
        values.amount = amount
        guard await viewModel.saveEntry(values, editing: entry) else { return }
        dismiss()
    }
}

struct SavingsCurrencySettingsSheet: View {
    @ObservedObject var viewModel: SavingsFeatureViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var displayCurrency: SavingsCurrency
    @State private var rateMode: RateMode
    @State private var manualRateText: String
    @State private var validationMessage: String?

    private enum RateMode: String, CaseIterable, Identifiable {
        case live
        case custom

        var id: String { rawValue }
        var title: String { rawValue.capitalized }
    }

    init(viewModel: SavingsFeatureViewModel) {
        self.viewModel = viewModel
        let settings = viewModel.currencySettings
        _displayCurrency = State(initialValue: settings.displayCurrency)
        _rateMode = State(initialValue: settings.usesManualRate ? .custom : .live)
        _manualRateText = State(
            initialValue: (settings.manualUsdIlsRate ?? settings.liveUsdIlsRate).map { String($0) } ?? ""
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Display currency") {
                    Picker("Display currency", selection: $displayCurrency) {
                        ForEach(SavingsCurrency.allCases) { currency in
                            Text(currency.title).tag(currency)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    LabeledContent("USD → ILS") {
                        if let rate = viewModel.currencySettings.liveUsdIlsRate {
                            Text("1 USD = ₪\(rate, format: .number.precision(.fractionLength(4)))")
                                .fontWeight(.semibold)
                                .monospacedDigit()
                        } else {
                            Text("Not cached yet")
                                .foregroundStyle(.secondary)
                        }
                    }

                    LabeledContent("Source") {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(viewModel.currencySettings.rateSource)
                            if let key = viewModel.currencySettings.liveRateDate,
                               let date = SavingsFormatting.isoDate.date(from: key) {
                                Text(SavingsFormatting.displayDate.string(from: date))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Button {
                        Task { await viewModel.refreshExchangeRate() }
                    } label: {
                        if viewModel.isRefreshingRate {
                            Label("Refreshing…", systemImage: "arrow.triangle.2.circlepath")
                        } else {
                            Label("Refresh live rate", systemImage: "arrow.clockwise")
                        }
                    }
                    .disabled(viewModel.isRefreshingRate || viewModel.isSaving)
                } header: {
                    Text("Live reference rate")
                } footer: {
                    Text("Daily USD/ILS reference rate from Frankfurter. The last successful rate stays available offline.")
                }

                Section("Rate used for savings") {
                    Picker("Rate mode", selection: $rateMode) {
                        ForEach(RateMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    if rateMode == .custom {
                        LabeledContent("ILS for 1 USD") {
                            HStack(spacing: 5) {
                                Text("₪")
                                    .foregroundStyle(.secondary)
                                TextField("3.0000", text: $manualRateText)
                                    .multilineTextAlignment(.trailing)
                                    .keyboardType(.decimalPad)
                            }
                        }
                    }
                }

                Section {
                    Text("Saved balances keep their original amount and currency. Changing this rate only changes conversions, totals, and the chart.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if let validationMessage {
                    Section {
                        Label(validationMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                } else if let error = viewModel.errorMessage {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Currency & rate")
            .navigationBarTitleDisplayMode(.inline)
            .disabled(viewModel.isSaving)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.isSaving ? "Saving…" : "Save") {
                        Task { await save() }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() async {
        let manualRate: Double?
        if rateMode == .custom {
            let normalized = manualRateText
                .replacingOccurrences(of: ",", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard let parsed = Double(normalized), parsed > 0, parsed <= 100 else {
                validationMessage = "Enter a USD to ILS rate greater than 0 and no more than 100."
                return
            }
            manualRate = parsed
        } else {
            manualRate = nil
        }
        validationMessage = nil
        guard await viewModel.saveCurrencySettings(
            displayCurrency: displayCurrency,
            manualUsdIlsRate: manualRate
        ) else { return }
        dismiss()
    }
}
