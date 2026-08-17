import XCTest
@testable import Pensive

final class ProjectionCalculatorTests: XCTestCase {
    func testMonthlyCompoundInterestUsesAnnualPercentageRate() {
        let result = ProjectionCalculator.projectedBalance(
            principal: 10_000,
            annualRate: 6,
            compounding: "monthly",
            years: 10
        )

        XCTAssertEqual(result, 18_193.97, accuracy: 0.02)
    }

    func testInterestCanBeDisabledForAFlatProjection() {
        let bank = projectionBank(id: "savings", rate: 7)
        let entry = projectionEntry(bankID: bank.id, amount: 12_345)
        let points = ProjectionCalculator.series(
            banks: [bank],
            entries: [entry],
            selectedBankIDs: [bank.id],
            horizonYears: 5,
            interestOn: false,
            today: ProjectionFormatting.isoDate.date(from: "2026-08-11")!
        )

        XCTAssertEqual(points.last?.total ?? 0, 12_345, accuracy: 0.001)
        XCTAssertEqual(points.filter(\.isProjected).count, 60)
    }

    func testSeriesCombinesOnlySelectedBanksAndLatestSnapshots() {
        let checking = projectionBank(id: "checking", rate: 0)
        let savings = projectionBank(id: "savings", rate: 0)
        let today = ProjectionFormatting.isoDate.date(from: "2026-08-11")!
        let entries = [
            projectionEntry(id: "checking-old", bankID: checking.id, date: "2026-01-01", amount: 4_000),
            projectionEntry(id: "checking-new", bankID: checking.id, date: "2026-08-01", amount: 7_500),
            projectionEntry(id: "savings-new", bankID: savings.id, date: "2026-08-01", amount: 20_000),
        ]

        let selected = ProjectionCalculator.series(
            banks: [checking, savings],
            entries: entries,
            selectedBankIDs: [checking.id],
            horizonYears: 1,
            interestOn: true,
            today: today
        )

        XCTAssertEqual(selected.last(where: { !$0.isProjected })?.total ?? 0, 7_500, accuracy: 0.001)
        XCTAssertNil(selected.last?.values[savings.id])
    }

    func testMixedCurrencySeriesConvertsEverySnapshotIntoDisplayCurrency() {
        let shekelBank = projectionBank(id: "shekels", rate: 0, currency: .ils)
        let dollarBank = projectionBank(id: "dollars", rate: 0, currency: .usd)
        let entries = [
            projectionEntry(bankID: shekelBank.id, amount: 3_000, currency: .ils),
            projectionEntry(id: "usd", bankID: dollarBank.id, amount: 1_000, currency: .usd),
        ]

        let points = ProjectionCalculator.series(
            banks: [shekelBank, dollarBank],
            entries: entries,
            selectedBankIDs: [shekelBank.id, dollarBank.id],
            horizonYears: 1,
            interestOn: false,
            displayCurrency: .ils,
            usdIlsRate: 3,
            today: ProjectionFormatting.isoDate.date(from: "2026-08-11")!
        )

        XCTAssertEqual(points.last(where: { !$0.isProjected })?.total ?? 0, 6_000, accuracy: 0.001)
    }

    func testCurrencyConversionIsReversibleAndNeedsARate() {
        XCTAssertEqual(
            ProjectionCalculator.convert(1_000, from: .usd, to: .ils, usdIlsRate: 3) ?? -1,
            3_000,
            accuracy: 0.001
        )
        XCTAssertEqual(
            ProjectionCalculator.convert(3_000, from: .ils, to: .usd, usdIlsRate: 3) ?? -1,
            1_000,
            accuracy: 0.001
        )
        XCTAssertNil(ProjectionCalculator.convert(1_000, from: .usd, to: .ils, usdIlsRate: nil))
    }

    func testExchangeRateRequirementUsesOnlyTheLatestSnapshotAsOfToday() {
        let bank = projectionBank(id: "checking", rate: 0)
        let today = ProjectionFormatting.isoDate.date(from: "2026-08-11")!
        let entries = [
            projectionEntry(id: "old-usd", bankID: bank.id, date: "2026-01-01", amount: 100, currency: .usd),
            projectionEntry(id: "current-ils", bankID: bank.id, date: "2026-08-01", amount: 350, currency: .ils),
            projectionEntry(id: "future-usd", bankID: bank.id, date: "2026-12-01", amount: 200, currency: .usd)
        ]

        XCTAssertFalse(
            ProjectionCalculator.requiresExchangeRate(
                banks: [bank],
                entries: entries,
                selectedBankIDs: [bank.id],
                displayCurrency: .ils,
                asOf: today
            )
        )
    }

    func testSeriesKeepsCurrentAndProjectedTotalsWhenOnlyHistoryNeedsConversion() {
        let bank = projectionBank(id: "checking", rate: 0)
        let today = ProjectionFormatting.isoDate.date(from: "2026-04-01")!
        let entries = [
            projectionEntry(id: "old-usd", bankID: bank.id, date: "2026-01-01", amount: 100, currency: .usd),
            projectionEntry(id: "current-ils", bankID: bank.id, date: "2026-03-01", amount: 350)
        ]

        let points = ProjectionCalculator.series(
            banks: [bank],
            entries: entries,
            selectedBankIDs: [bank.id],
            horizonYears: 1,
            interestOn: false,
            displayCurrency: .ils,
            usdIlsRate: nil,
            today: today
        )

        XCTAssertEqual(points.last(where: { !$0.isProjected })?.total ?? 0, 350, accuracy: 0.001)
        XCTAssertEqual(points.last?.total ?? 0, 350, accuracy: 0.001)
    }

    private func projectionBank(
        id: String,
        rate: Double,
        currency: ProjectionCurrency = .ils
    ) -> ProjectionBankDTO {
        ProjectionBankDTO(
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

    private func projectionEntry(
        id: String = "entry",
        bankID: String,
        date: String = "2026-08-01",
        amount: Double,
        currency: ProjectionCurrency = .ils
    ) -> ProjectionEntryDTO {
        ProjectionEntryDTO(
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
