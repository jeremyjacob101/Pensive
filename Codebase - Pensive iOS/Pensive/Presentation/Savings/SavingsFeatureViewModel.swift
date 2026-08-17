import Foundation

@MainActor
final class SavingsFeatureViewModel: ObservableObject {
    @Published private(set) var banks: [SavingsBankDTO] = []
    @Published private(set) var entries: [SavingsEntryDTO] = []
    @Published private(set) var currencySettings = SavingsCurrencySettings()
    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published private(set) var isRefreshingRate = false
    @Published var errorMessage: String?

    private let api: ConvexAPI
    private let usesPreviewData: Bool

    init(api: ConvexAPI) {
        self.api = api
        #if DEBUG
        usesPreviewData = ProcessInfo.processInfo.environment["UI_TEST_SAVINGS_PREVIEW"] == "1"
        if usesPreviewData {
            let fixture = Self.previewFixture
            banks = fixture.banks
            entries = fixture.entries
            currencySettings = Self.currencySettings(from: fixture.settings)
        }
        #else
        usesPreviewData = false
        #endif
    }

    func load() async {
        guard !usesPreviewData else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await api.savings.list()
            banks = response.banks.sorted { $0.sortOrder < $1.sortOrder }
            entries = response.entries.sorted { $0.date < $1.date }
            currencySettings = Self.currencySettings(from: response.settings)
            errorMessage = nil
            if shouldRefreshRate {
                await refreshExchangeRate(force: false, reportErrors: currencySettings.liveUsdIlsRate == nil)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveBank(_ values: SavingsBankFormValues, editing bank: SavingsBankDTO?) async -> Bool {
        guard !values.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Give this bank a name."
            return false
        }
        guard values.annualInterestRate.isFinite,
              values.annualInterestRate >= 0,
              values.annualInterestRate <= 100 else {
            errorMessage = "Annual rate must be between 0 and 100."
            return false
        }
        if let startingBalance = values.startingBalance,
           (!startingBalance.isFinite || abs(startingBalance) > 1_000_000_000_000_000) {
            errorMessage = "Enter a valid starting balance."
            return false
        }
        return await performSave {
            if self.usesPreviewData {
                self.savePreviewBank(values, editing: bank)
            } else if let bank {
                _ = try await self.api.savings.updateBank(
                    SavingsBankUpdateRequest(
                        id: bank.id,
                        name: values.name,
                        color: values.colorHex,
                        currency: values.currency.rawValue,
                        interestEnabled: values.interestEnabled,
                        annualInterestRate: values.annualInterestRate,
                        compounding: values.compounding
                    )
                )
                await self.load()
            } else {
                _ = try await self.api.savings.createBank(
                    SavingsBankCreateRequest(
                        name: values.name,
                        color: values.colorHex,
                        currency: values.currency.rawValue,
                        interestEnabled: values.interestEnabled,
                        annualInterestRate: values.annualInterestRate,
                        compounding: values.compounding,
                        startingBalance: values.startingBalance,
                        startingDate: values.startingBalance == nil ? nil : SavingsFormatting.isoDate.string(from: values.startingDate),
                        startingNote: values.startingNote.nilIfBlank
                    )
                )
                await self.load()
            }
        }
    }

    func saveEntry(_ values: SavingsEntryFormValues, editing entry: SavingsEntryDTO?) async -> Bool {
        guard banks.contains(where: { $0.id == values.bankID }) else {
            errorMessage = "Choose a bank."
            return false
        }
        guard values.amount.isFinite,
              abs(values.amount) <= 1_000_000_000_000_000 else {
            errorMessage = "Enter a valid balance."
            return false
        }
        return await performSave {
            if self.usesPreviewData {
                self.savePreviewEntry(values, editing: entry)
            } else if let entry {
                _ = try await self.api.savings.updateEntry(
                    SavingsEntryUpdateRequest(
                        id: entry.id,
                        bankId: values.bankID,
                        date: SavingsFormatting.isoDate.string(from: values.date),
                        amount: values.amount,
                        currency: values.currency.rawValue,
                        note: values.note.nilIfBlank
                    )
                )
                await self.load()
            } else {
                _ = try await self.api.savings.createEntry(
                    SavingsEntryCreateRequest(
                        bankId: values.bankID,
                        date: SavingsFormatting.isoDate.string(from: values.date),
                        amount: values.amount,
                        currency: values.currency.rawValue,
                        note: values.note.nilIfBlank
                    )
                )
                await self.load()
            }
        }
    }

    func removeBank(_ bank: SavingsBankDTO) async {
        _ = await performSave {
            if self.usesPreviewData {
                self.banks.removeAll { $0.id == bank.id }
                self.entries.removeAll { $0.bankId == bank.id }
            } else {
                _ = try await self.api.savings.removeBank(id: bank.id)
                await self.load()
            }
        }
    }

    func removeEntry(_ entry: SavingsEntryDTO) async {
        _ = await performSave {
            if self.usesPreviewData {
                self.entries.removeAll { $0.id == entry.id }
            } else {
                _ = try await self.api.savings.removeEntry(id: entry.id)
                await self.load()
            }
        }
    }

    func moveBank(_ bank: SavingsBankDTO, offset: Int) async {
        guard let index = banks.firstIndex(where: { $0.id == bank.id }) else { return }
        let destination = index + offset
        guard banks.indices.contains(destination) else { return }
        var reordered = banks
        reordered.swapAt(index, destination)
        if usesPreviewData {
            banks = reordered
            return
        }
        _ = await performSave {
            _ = try await self.api.savings.reorderBanks(ids: reordered.map(\.id))
            await self.load()
        }
    }

    func saveCurrencySettings(
        displayCurrency: SavingsCurrency,
        manualUsdIlsRate: Double?
    ) async -> Bool {
        if let manualUsdIlsRate,
           (!manualUsdIlsRate.isFinite || manualUsdIlsRate <= 0 || manualUsdIlsRate > 100) {
            errorMessage = "Enter a USD to ILS rate greater than 0 and no more than 100."
            return false
        }
        let previous = currencySettings
        currencySettings.displayCurrency = displayCurrency
        currencySettings.manualUsdIlsRate = manualUsdIlsRate
        guard !usesPreviewData else { return true }

        let saved = await performSave {
            _ = try await self.api.savings.setCurrencySettings(
                SavingsCurrencySettingsRequest(
                    displayCurrency: displayCurrency.rawValue,
                    manualUsdIlsRate: manualUsdIlsRate
                )
            )
        }
        if !saved { currencySettings = previous }
        return saved
    }

    func refreshExchangeRate(force: Bool = true, reportErrors: Bool = true) async {
        guard !usesPreviewData else { return }
        isRefreshingRate = true
        defer { isRefreshingRate = false }
        do {
            let response = try await api.savings.refreshExchangeRate(force: force)
            currencySettings.liveUsdIlsRate = response.rate
            currencySettings.liveRateDate = response.rateDate
            currencySettings.liveRateFetchedAt = response.fetchedAt
            currencySettings.rateSource = response.source
            if !response.isStale { errorMessage = nil }
        } catch {
            if reportErrors { errorMessage = error.localizedDescription }
        }
    }

    private var shouldRefreshRate: Bool {
        guard let fetchedAt = currencySettings.liveRateFetchedAt else { return true }
        return Date().timeIntervalSince1970 * 1_000 - fetchedAt > 12 * 60 * 60 * 1_000
    }

    private static func currencySettings(from dto: SavingsSettingsDTO?) -> SavingsCurrencySettings {
        SavingsCurrencySettings(
            displayCurrency: SavingsCurrency(rawValue: dto?.displayCurrency ?? "") ?? .ils,
            manualUsdIlsRate: dto?.manualUsdIlsRate,
            liveUsdIlsRate: dto?.liveUsdIlsRate,
            liveRateDate: dto?.liveRateDate,
            liveRateFetchedAt: dto?.liveRateFetchedAt,
            rateSource: dto?.rateSource ?? "Frankfurter"
        )
    }

    private func performSave(_ operation: @escaping () async throws -> Void) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await operation()
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func savePreviewBank(_ values: SavingsBankFormValues, editing bank: SavingsBankDTO?) {
        let now = Date().timeIntervalSince1970 * 1_000
        if let bank, let index = banks.firstIndex(where: { $0.id == bank.id }) {
            banks[index] = SavingsBankDTO(
                _id: bank.id,
                _creationTime: bank._creationTime,
                name: values.name,
                color: values.colorHex,
                currency: values.currency.rawValue,
                interestEnabled: values.interestEnabled,
                annualInterestRate: values.annualInterestRate,
                compounding: values.compounding,
                sortOrder: bank.sortOrder,
                createdAt: bank.createdAt,
                updatedAt: now
            )
            return
        }

        let id = "preview-bank-\(UUID().uuidString)"
        banks.append(
            SavingsBankDTO(
                _id: id,
                _creationTime: now,
                name: values.name,
                color: values.colorHex,
                currency: values.currency.rawValue,
                interestEnabled: values.interestEnabled,
                annualInterestRate: values.annualInterestRate,
                compounding: values.compounding,
                sortOrder: Double(banks.count),
                createdAt: now,
                updatedAt: now
            )
        )
        if let amount = values.startingBalance {
            entries.append(
                SavingsEntryDTO(
                    _id: "preview-entry-\(UUID().uuidString)",
                    _creationTime: now,
                    bankId: id,
                    date: SavingsFormatting.isoDate.string(from: values.startingDate),
                    amount: amount,
                    currency: values.currency.rawValue,
                    note: values.startingNote.nilIfBlank,
                    createdAt: now,
                    updatedAt: now
                )
            )
        }
    }

    private func savePreviewEntry(_ values: SavingsEntryFormValues, editing entry: SavingsEntryDTO?) {
        let now = Date().timeIntervalSince1970 * 1_000
        let replacement = SavingsEntryDTO(
            _id: entry?.id ?? "preview-entry-\(UUID().uuidString)",
            _creationTime: entry?._creationTime ?? now,
            bankId: values.bankID,
            date: SavingsFormatting.isoDate.string(from: values.date),
            amount: values.amount,
            currency: values.currency.rawValue,
            note: values.note.nilIfBlank,
            createdAt: entry?.createdAt ?? now,
            updatedAt: now
        )
        if let entry, let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index] = replacement
        } else {
            entries.append(replacement)
        }
    }

    #if DEBUG
    private static var previewFixture: SavingsResponse {
        let bankValues: [(String, String, String, Double, SavingsCurrency)] = [
            ("preview-everyday", "Everyday", "#4389FF", 0.5, .ils),
            ("preview-savings", "Savings", "#FF6758", 2, .usd),
            ("preview-investments", "Investments", "#5EAE8C", 6.5, .ils)
        ]
        let banks = bankValues.enumerated().map { index, value in
            SavingsBankDTO(
                _id: value.0,
                _creationTime: Double(index),
                name: value.1,
                color: value.2,
                currency: value.4.rawValue,
                interestEnabled: true,
                annualInterestRate: value.3,
                compounding: "monthly",
                sortOrder: Double(index),
                createdAt: Double(index),
                updatedAt: Double(index)
            )
        }
        let amounts: [(String, [Double])] = [
            ("2024-01-31", [31_200, 18_100, 70_600]),
            ("2024-08-31", [42_900, 20_400, 82_100]),
            ("2025-03-31", [61_300, 23_800, 101_500]),
            ("2025-10-31", [41_800, 25_600, 120_900]),
            (SavingsFormatting.isoDate.string(from: Date()), [54_760, 26_900, 135_720])
        ]
        var entries: [SavingsEntryDTO] = []
        for (dateIndex, row) in amounts.enumerated() {
            for (bankIndex, amount) in row.1.enumerated() {
                let stamp = Double(dateIndex * 10 + bankIndex)
                entries.append(
                    SavingsEntryDTO(
                        _id: "preview-entry-\(dateIndex)-\(bankIndex)",
                        _creationTime: stamp,
                        bankId: banks[bankIndex].id,
                        date: row.0,
                        amount: amount,
                        currency: banks[bankIndex].currency,
                        note: dateIndex == amounts.count - 1 ? ["Paycheck deposit", "Monthly contribution", "Market close"][bankIndex] : nil,
                        createdAt: stamp,
                        updatedAt: stamp
                    )
                )
            }
        }
        return SavingsResponse(
            banks: banks,
            entries: entries,
            settings: SavingsSettingsDTO(
                displayCurrency: "ILS",
                manualUsdIlsRate: nil,
                liveUsdIlsRate: 3.0009,
                liveRateDate: "2026-08-11",
                liveRateFetchedAt: Date().timeIntervalSince1970 * 1_000,
                rateSource: "Frankfurter"
            )
        )
    }
    #endif
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
