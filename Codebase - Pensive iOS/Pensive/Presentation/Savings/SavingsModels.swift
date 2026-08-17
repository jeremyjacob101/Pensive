import Foundation
import SwiftUI

enum SavingsCurrency: String, Codable, CaseIterable, Identifiable {
    case ils = "ILS"
    case usd = "USD"

    var id: String { rawValue }
    var symbol: String { self == .ils ? "₪" : "$" }
    var title: String { "\(symbol) \(rawValue)" }
    var other: SavingsCurrency { self == .ils ? .usd : .ils }
}

struct SavingsCurrencySettings: Equatable {
    var displayCurrency: SavingsCurrency = .ils
    var manualUsdIlsRate: Double?
    var liveUsdIlsRate: Double?
    var liveRateDate: String?
    var liveRateFetchedAt: Double?
    var rateSource = "Frankfurter"

    var effectiveUsdIlsRate: Double? {
        manualUsdIlsRate ?? liveUsdIlsRate
    }

    var usesManualRate: Bool { manualUsdIlsRate != nil }
}

enum SavingsChartMode: String, CaseIterable, Identifiable {
    case stacked
    case lines
    case total

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

enum SavingsHorizon: Int, CaseIterable, Identifiable {
    case one = 1
    case three = 3
    case five = 5
    case ten = 10
    case fifteen = 15
    case twenty = 20
    case twentyFive = 25
    case thirty = 30
    case forty = 40
    case fifty = 50

    var id: Int { rawValue }
    var title: String { "\(rawValue)Y" }
}

struct SavingsChartPoint: Identifiable, Hashable {
    let date: Date
    let isForecast: Bool
    let total: Double
    let values: [String: Double]

    var id: Date { date }
}

struct SavingsBankFormValues: Equatable {
    var name = ""
    var colorHex = "#4389FF"
    var currency: SavingsCurrency = .ils
    var interestEnabled = false
    var annualInterestRate = 0.0
    var compounding = "monthly"
    var startingBalance: Double?
    var startingDate = Date()
    var startingNote = ""
}

struct SavingsEntryFormValues: Equatable {
    var bankID = ""
    var amount = 0.0
    var currency: SavingsCurrency = .ils
    var date = Date()
    var note = ""
}

enum SavingsFormatting {
    static let isoDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let displayDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static func makeMoneyFormatter(
        currency: SavingsCurrency,
        cents: Bool
    ) -> NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = currency.symbol
        formatter.currencyCode = currency.rawValue
        formatter.maximumFractionDigits = cents ? 2 : 0
        formatter.minimumFractionDigits = cents ? 2 : 0
        return formatter
    }

    private static let wholeILS = makeMoneyFormatter(currency: .ils, cents: false)
    private static let centsILS = makeMoneyFormatter(currency: .ils, cents: true)
    private static let wholeUSD = makeMoneyFormatter(currency: .usd, cents: false)
    private static let centsUSD = makeMoneyFormatter(currency: .usd, cents: true)

    static func money(
        _ value: Double,
        currency: SavingsCurrency = .ils,
        cents: Bool = false
    ) -> String {
        let formatter = switch (currency, cents) {
        case (.ils, false): wholeILS
        case (.ils, true): centsILS
        case (.usd, false): wholeUSD
        case (.usd, true): centsUSD
        }
        return formatter.string(from: NSNumber(value: value)) ?? "\(currency.symbol)0"
    }
}

enum SavingsCalculator {
    static func currency(_ value: String?) -> SavingsCurrency {
        SavingsCurrency(rawValue: value ?? "") ?? .ils
    }

    static func convert(
        _ amount: Double,
        from: SavingsCurrency,
        to: SavingsCurrency,
        usdIlsRate: Double?
    ) -> Double? {
        guard from != to else { return amount }
        guard let usdIlsRate, usdIlsRate.isFinite, usdIlsRate > 0 else {
            return nil
        }
        return from == .usd ? amount * usdIlsRate : amount / usdIlsRate
    }

    static func futureBalance(
        principal: Double,
        annualRate: Double,
        compounding: String,
        years: Double
    ) -> Double {
        guard annualRate.isFinite, annualRate > 0, years.isFinite, years > 0 else { return principal }
        let periods = compounding == "monthly" ? 12.0 : 1.0
        return principal * pow(1 + annualRate / 100 / periods, periods * years)
    }

    private static func isLater(
        _ entry: SavingsEntryDTO,
        than current: SavingsEntryDTO
    ) -> Bool {
        entry.date > current.date ||
            (entry.date == current.date && (
                entry.createdAt > current.createdAt ||
                    (entry.createdAt == current.createdAt &&
                        (entry._creationTime ?? 0) > (current._creationTime ?? 0))
            ))
    }

    static func latestEntries(
        banks: [SavingsBankDTO],
        entries: [SavingsEntryDTO],
        asOf: Date = Date()
    ) -> [String: SavingsEntryDTO] {
        let validBankIDs = Set(banks.map(\.id))
        let asOfKey = SavingsFormatting.isoDate.string(from: asOf)
        var latest: [String: SavingsEntryDTO] = [:]

        for entry in entries where validBankIDs.contains(entry.bankId) && entry.date <= asOfKey {
            guard let current = latest[entry.bankId] else {
                latest[entry.bankId] = entry
                continue
            }
            if isLater(entry, than: current) {
                latest[entry.bankId] = entry
            }
        }
        return latest
    }

    static func requiresExchangeRate(
        banks: [SavingsBankDTO],
        entries: [SavingsEntryDTO],
        selectedBankIDs: Set<String>,
        displayCurrency: SavingsCurrency,
        asOf: Date = Date()
    ) -> Bool {
        let selectedBanks = banks.filter { selectedBankIDs.contains($0.id) }
        return latestEntries(banks: selectedBanks, entries: entries, asOf: asOf)
            .values
            .contains { currency($0.currency) != displayCurrency }
    }

    static func series(
        banks: [SavingsBankDTO],
        entries: [SavingsEntryDTO],
        selectedBankIDs: Set<String>,
        horizonYears: Int,
        interestOn: Bool,
        displayCurrency: SavingsCurrency = .ils,
        usdIlsRate: Double? = nil,
        today: Date = Date(),
        calendar: Calendar = .current
    ) -> [SavingsChartPoint] {
        let selectedBanks = banks.filter { selectedBankIDs.contains($0.id) }
        guard !selectedBanks.isEmpty else { return [] }

        let startOfToday = calendar.startOfDay(for: today)
        let todayKey = SavingsFormatting.isoDate.string(from: startOfToday)
        let selectedIDs = Set(selectedBanks.map(\.id))
        let selectedEntries = entries
            .filter { selectedIDs.contains($0.bankId) && $0.date <= todayKey }
            .sorted {
                if $0.date != $1.date { return $0.date < $1.date }
                if $0.createdAt != $1.createdAt { return $0.createdAt < $1.createdAt }
                return ($0._creationTime ?? 0) < ($1._creationTime ?? 0)
            }
        let currentEntries = latestEntries(banks: selectedBanks, entries: selectedEntries, asOf: startOfToday)
        let currentRequiresRate = currentEntries.values.contains {
            currency($0.currency) != displayCurrency
        }
        let hasUsableRate = usdIlsRate.map { $0.isFinite && $0 > 0 } ?? false
        guard !currentRequiresRate || hasUsableRate else { return [] }
        let keys = Set(selectedEntries.map(\.date) + [todayKey]).sorted()
        var latest: [String: SavingsEntryDTO] = [:]
        var historical: [SavingsChartPoint] = []
        var entryIndex = 0

        for key in keys {
            while entryIndex < selectedEntries.count && selectedEntries[entryIndex].date <= key {
                let entry = selectedEntries[entryIndex]
                let current = latest[entry.bankId]
                if current == nil || isLater(entry, than: current!) {
                    latest[entry.bankId] = entry
                }
                entryIndex += 1
            }
            guard let date = SavingsFormatting.isoDate.date(from: key) else { continue }
            var values: [String: Double] = [:]
            var canRender = true
            for bank in selectedBanks {
                guard let entry = latest[bank.id] else {
                    values[bank.id] = 0
                    continue
                }
                guard let amount = convert(
                    entry.amount,
                    from: currency(entry.currency),
                    to: displayCurrency,
                    usdIlsRate: usdIlsRate
                ) else {
                    canRender = false
                    break
                }
                values[bank.id] = amount
            }
            guard canRender else { continue }
            historical.append(
                SavingsChartPoint(
                    date: date,
                    isForecast: false,
                    total: values.values.reduce(0, +),
                    values: values
                )
            )
        }

        let monthCount = max(1, horizonYears * 12)
        let future: [SavingsChartPoint] = (1 ... monthCount).compactMap { month in
            guard let date = calendar.date(byAdding: .month, value: month, to: startOfToday) else { return nil }
            let years = max(0, date.timeIntervalSince(startOfToday) / (365.2425 * 86_400))
            var values: [String: Double] = [:]
            for bank in selectedBanks {
                let entry = currentEntries[bank.id]
                let principal: Double
                if let entry {
                    guard let converted = convert(
                        entry.amount,
                        from: currency(entry.currency),
                        to: displayCurrency,
                        usdIlsRate: usdIlsRate
                    ) else { return nil }
                    principal = converted
                } else {
                    principal = 0
                }
                values[bank.id] = interestOn && bank.interestEnabled
                    ? futureBalance(
                        principal: principal,
                        annualRate: bank.annualInterestRate,
                        compounding: bank.compounding,
                        years: years
                    )
                    : principal
            }
            return SavingsChartPoint(
                date: date,
                isForecast: true,
                total: values.values.reduce(0, +),
                values: values
            )
        }

        return historical + future
    }
}

extension SavingsBankDTO {
    var savingsCurrency: SavingsCurrency {
        SavingsCalculator.currency(currency)
    }
}

extension SavingsEntryDTO {
    var savingsCurrency: SavingsCurrency {
        SavingsCalculator.currency(currency)
    }
}

extension Color {
    init(savingsHex value: String) {
        let hex = value.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard hex.count == 6, let raw = UInt64(hex, radix: 16) else {
            self = .blue
            return
        }
        self.init(
            red: Double((raw >> 16) & 0xFF) / 255,
            green: Double((raw >> 8) & 0xFF) / 255,
            blue: Double(raw & 0xFF) / 255
        )
    }
}
