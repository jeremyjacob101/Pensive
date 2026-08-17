import XCTest
@testable import Pensive

final class SavingsCalculatorTests: XCTestCase {
    func testMonthlyCompoundInterestUsesAnnualPercentageRate() {
        let result = SavingsCalculator.futureBalance(
            principal: 10_000,
            annualRate: 6,
            compounding: "monthly",
            years: 10
        )

        XCTAssertEqual(result, 18_193.97, accuracy: 0.02)
    }

    func testInterestCanBeDisabledForAFlatSavings() {
        let bank = savingsBank(id: "savings", rate: 7)
        let entry = savingsEntry(bankID: bank.id, amount: 12_345)
        let points = SavingsCalculator.series(
            banks: [bank],
            entries: [entry],
            selectedBankIDs: [bank.id],
            horizonYears: 5,
            interestOn: false,
            today: SavingsFormatting.isoDate.date(from: "2026-08-11")!
        )

        XCTAssertEqual(points.last?.total ?? 0, 12_345, accuracy: 0.001)
        XCTAssertEqual(points.filter(\.isForecast).count, 60)
    }

    func testSeriesCombinesOnlySelectedBanksAndLatestSnapshots() {
        let checking = savingsBank(id: "checking", rate: 0)
        let savings = savingsBank(id: "savings", rate: 0)
        let today = SavingsFormatting.isoDate.date(from: "2026-08-11")!
        let entries = [
            savingsEntry(id: "checking-old", bankID: checking.id, date: "2026-01-01", amount: 4_000),
            savingsEntry(id: "checking-new", bankID: checking.id, date: "2026-08-01", amount: 7_500),
            savingsEntry(id: "savings-new", bankID: savings.id, date: "2026-08-01", amount: 20_000),
        ]

        let selected = SavingsCalculator.series(
            banks: [checking, savings],
            entries: entries,
            selectedBankIDs: [checking.id],
            horizonYears: 1,
            interestOn: true,
            today: today
        )

        XCTAssertEqual(selected.last(where: { !$0.isForecast })?.total ?? 0, 7_500, accuracy: 0.001)
        XCTAssertNil(selected.last?.values[savings.id])
    }

    func testMixedCurrencySeriesConvertsEverySnapshotIntoDisplayCurrency() {
        let shekelBank = savingsBank(id: "shekels", rate: 0, currency: .ils)
        let dollarBank = savingsBank(id: "dollars", rate: 0, currency: .usd)
        let entries = [
            savingsEntry(bankID: shekelBank.id, amount: 3_000, currency: .ils),
            savingsEntry(id: "usd", bankID: dollarBank.id, amount: 1_000, currency: .usd),
        ]

        let points = SavingsCalculator.series(
            banks: [shekelBank, dollarBank],
            entries: entries,
            selectedBankIDs: [shekelBank.id, dollarBank.id],
            horizonYears: 1,
            interestOn: false,
            displayCurrency: .ils,
            usdIlsRate: 3,
            today: SavingsFormatting.isoDate.date(from: "2026-08-11")!
        )

        XCTAssertEqual(points.last(where: { !$0.isForecast })?.total ?? 0, 6_000, accuracy: 0.001)
    }

    func testCurrencyConversionIsReversibleAndNeedsARate() {
        XCTAssertEqual(
            SavingsCalculator.convert(1_000, from: .usd, to: .ils, usdIlsRate: 3) ?? -1,
            3_000,
            accuracy: 0.001
        )
        XCTAssertEqual(
            SavingsCalculator.convert(3_000, from: .ils, to: .usd, usdIlsRate: 3) ?? -1,
            1_000,
            accuracy: 0.001
        )
        XCTAssertNil(SavingsCalculator.convert(1_000, from: .usd, to: .ils, usdIlsRate: nil))
    }

    func testExchangeRateRequirementUsesOnlyTheLatestSnapshotAsOfToday() {
        let bank = savingsBank(id: "checking", rate: 0)
        let today = SavingsFormatting.isoDate.date(from: "2026-08-11")!
        let entries = [
            savingsEntry(id: "old-usd", bankID: bank.id, date: "2026-01-01", amount: 100, currency: .usd),
            savingsEntry(id: "current-ils", bankID: bank.id, date: "2026-08-01", amount: 350, currency: .ils),
            savingsEntry(id: "future-usd", bankID: bank.id, date: "2026-12-01", amount: 200, currency: .usd)
        ]

        XCTAssertFalse(
            SavingsCalculator.requiresExchangeRate(
                banks: [bank],
                entries: entries,
                selectedBankIDs: [bank.id],
                displayCurrency: .ils,
                asOf: today
            )
        )
    }

    func testSeriesKeepsCurrentAndForecastTotalsWhenOnlyHistoryNeedsConversion() {
        let bank = savingsBank(id: "checking", rate: 0)
        let today = SavingsFormatting.isoDate.date(from: "2026-04-01")!
        let entries = [
            savingsEntry(id: "old-usd", bankID: bank.id, date: "2026-01-01", amount: 100, currency: .usd),
            savingsEntry(id: "current-ils", bankID: bank.id, date: "2026-03-01", amount: 350)
        ]

        let points = SavingsCalculator.series(
            banks: [bank],
            entries: entries,
            selectedBankIDs: [bank.id],
            horizonYears: 1,
            interestOn: false,
            displayCurrency: .ils,
            usdIlsRate: nil,
            today: today
        )

        XCTAssertEqual(points.last(where: { !$0.isForecast })?.total ?? 0, 350, accuracy: 0.001)
        XCTAssertEqual(points.last?.total ?? 0, 350, accuracy: 0.001)
    }

    private func savingsBank(
        id: String,
        rate: Double,
        currency: SavingsCurrency = .ils
    ) -> SavingsBankDTO {
        SavingsBankDTO(
            _id: id,
            _creationTime: 1,
            name: id.capitalized,
            color: "#4389FF",
            currency: currency.rawValue,
            interestEnabled: rate > 0,
            annualInterestRate: rate,
            compounding: "monthly",
            sortOrder: 0,
            createdAt: 1,
            updatedAt: 1
        )
    }

    private func savingsEntry(
        id: String = "entry",
        bankID: String,
        date: String = "2026-08-01",
        amount: Double,
        currency: SavingsCurrency = .ils
    ) -> SavingsEntryDTO {
        SavingsEntryDTO(
            _id: id,
            _creationTime: 1,
            bankId: bankID,
            date: date,
            amount: amount,
            currency: currency.rawValue,
            note: nil,
            createdAt: 1,
            updatedAt: 1
        )
    }
}
