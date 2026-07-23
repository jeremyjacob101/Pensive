import SwiftUI

struct MonthNavigator: View {
    @Binding var month: Date

    private var monthFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter
    }

    var body: some View {
        HStack {
            Button {
                month = Calendar.current.date(byAdding: .month, value: -1, to: month) ?? month
            } label: {
                Image(systemName: "chevron.left")
            }
            .accessibilityLabel("Previous month")

            Spacer()
            Text(monthFormatter.string(from: month))
                .font(.headline)
            Spacer()

            Button {
                month = Calendar.current.date(byAdding: .month, value: 1, to: month) ?? month
            } label: {
                Image(systemName: "chevron.right")
            }
            .accessibilityLabel("Next month")
        }
    }
}

struct DateScopeNavigatorRow: View {
    let scope: DateScope
    let onCalendar: () -> Void
    let onShiftMonth: (Int) -> Void
    var onFilter: (() -> Void)?
    var isLoading: Bool = false

    var body: some View {
        HStack(spacing: 6) {
            Button(action: onCalendar) {
                Image(systemName: "calendar")
                    .font(.system(size: 22, weight: .semibold))
                    .frame(width: 46, height: 42)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Date Range")
            .accessibilityIdentifier("ledger_scope_calendar")
            .disabled(isLoading)

            Button {
                onShiftMonth(-1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 34, height: 42)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Previous month")
            .accessibilityIdentifier("ledger_scope_previous")
            .disabled(isLoading)

            ZStack {
                Text(scope.displayLabel)
                    .font(.headline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                    .opacity(isLoading ? 0.42 : 1)

                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .frame(maxWidth: .infinity)
            .animation(.easeInOut(duration: 0.18), value: isLoading)
            .accessibilityIdentifier("ledger_scope_label")

            Button {
                onShiftMonth(1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 34, height: 42)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Next month")
            .accessibilityIdentifier("ledger_scope_next")
            .disabled(isLoading)

            if let onFilter {
                Button(action: onFilter) {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                        .font(.system(size: 22, weight: .semibold))
                        .frame(width: 46, height: 42)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Filters")
                .accessibilityIdentifier("ledger_scope_filter")
                .disabled(isLoading)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
        )
    }
}

extension DateScope {
    var displayLabel: String {
        if isWholeMonthRange {
            let months = LedgerScopeLogic.targetMonths(startDate: startDate, endDate: endDate)
            if let first = months.first, let last = months.last {
                let firstLabel = DateScope.monthLabel(first)
                let lastLabel = DateScope.monthLabel(last)
                return first == last ? firstLabel : "\(firstLabel) - \(lastLabel)"
            }
        }

        let startLabel = DateScope.dayLabel(startDate)
        let endLabel = DateScope.dayLabel(endDate)
        return LedgerScopeLogic.isoDate(startDate) == LedgerScopeLogic.isoDate(endDate)
            ? startLabel
            : "\(startLabel) - \(endLabel)"
    }

    var isWholeMonthRange: Bool {
        let calendar = LedgerScopeLogic.calendar
        guard let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: startDate)),
              let endMonthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: endDate)),
              let endOfMonth = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: endMonthStart) else {
            return false
        }
        return calendar.isDate(startDate, inSameDayAs: startOfMonth) && calendar.isDate(endDate, inSameDayAs: endOfMonth)
    }

    func shiftedByMonths(_ value: Int) -> DateScope {
        let calendar = LedgerScopeLogic.calendar
        if isWholeMonthRange,
           let shiftedStartMonth = calendar.date(byAdding: .month, value: value, to: startDate),
           let endMonthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: endDate)),
           let shiftedEndMonthStart = calendar.date(byAdding: .month, value: value, to: endMonthStart),
           let shiftedEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: shiftedEndMonthStart) {
            return DateScope(
                startDate: shiftedStartMonth,
                endDate: shiftedEnd,
                includeMonthYearOverlapOutsideDate: includeMonthYearOverlapOutsideDate
            )
        }

        let shiftedStart = calendar.date(byAdding: .month, value: value, to: startDate) ?? startDate
        let shiftedEnd = calendar.date(byAdding: .month, value: value, to: endDate) ?? endDate
        return DateScope(
            startDate: shiftedStart,
            endDate: shiftedEnd,
            includeMonthYearOverlapOutsideDate: includeMonthYearOverlapOutsideDate
        )
    }

    static func monthLabel(_ month: MonthYear) -> String {
        guard let date = monthDateFormatter.date(from: month.rawValue) else {
            return month.rawValue
        }
        return monthDisplayFormatter.string(from: date)
    }

    static func dayLabel(_ date: Date) -> String {
        dayDisplayFormatter.string(from: date)
    }

    private static let monthDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = LedgerScopeLogic.calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM"
        return formatter
    }()

    private static let monthDisplayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = LedgerScopeLogic.calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM ''yy"
        return formatter
    }()

    private static let dayDisplayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = LedgerScopeLogic.calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d ''yy"
        return formatter
    }()
}

struct DateRangePickerButton: View {
    @Binding var startDate: Date
    @Binding var endDate: Date
    var oldestMonth: MonthYear? = nil
    var newestMonth: MonthYear? = nil

    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            Label("Date Range", systemImage: "calendar")
        }
        .sheet(isPresented: $isPresented) {
            DateRangePickerSheet(
                startDate: $startDate,
                endDate: $endDate,
                oldestMonth: oldestMonth,
                newestMonth: newestMonth
            )
        }
    }
}

struct DateRangePickerSheet: View {
    @Environment(\.dismiss) private var dismiss

    @Binding var startDate: Date
    @Binding var endDate: Date
    var oldestMonth: MonthYear?
    var newestMonth: MonthYear?
    var onApplyRange: ((Date, Date, DateRangePickerMode) -> Void)?

    @State private var mode: DateRangePickerMode
    @State private var draftStartDate: Date
    @State private var draftEndDate: Date
    @State private var draftStartMonth: MonthYear
    @State private var draftEndMonth: MonthYear

    init(
        startDate: Binding<Date>,
        endDate: Binding<Date>,
        oldestMonth: MonthYear? = nil,
        newestMonth: MonthYear? = nil,
        initialMode: DateRangePickerMode? = nil,
        onApplyRange: ((Date, Date, DateRangePickerMode) -> Void)? = nil
    ) {
        _startDate = startDate
        _endDate = endDate
        self.oldestMonth = oldestMonth
        self.newestMonth = newestMonth
        self.onApplyRange = onApplyRange

        let initialScope = DateScope(
            startDate: startDate.wrappedValue,
            endDate: endDate.wrappedValue,
            includeMonthYearOverlapOutsideDate: false
        )
        let currentMonth = DateRangePickerSheet.month(containing: Date())
        let initialMonths = LedgerScopeLogic.targetMonths(
            startDate: startDate.wrappedValue,
            endDate: endDate.wrappedValue
        )
        let initialStartMonth = initialScope.isWholeMonthRange ? (initialMonths.first ?? currentMonth) : currentMonth
        let initialEndMonth = initialScope.isWholeMonthRange ? (initialMonths.last ?? initialStartMonth) : initialStartMonth

        _mode = State(initialValue: initialMode ?? (initialScope.isWholeMonthRange ? .months : .custom))
        _draftStartDate = State(initialValue: startDate.wrappedValue)
        _draftEndDate = State(initialValue: endDate.wrappedValue)
        _draftStartMonth = State(initialValue: initialStartMonth)
        _draftEndMonth = State(initialValue: initialEndMonth)
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Range Mode", selection: $mode) {
                    Text("Months").tag(DateRangePickerMode.months)
                    Text("Custom").tag(DateRangePickerMode.custom)
                }
                .pickerStyle(.segmented)

                if mode == .months {
                    HStack {
                        Text("Start Month")
                        Spacer()
                        Menu {
                            Picker("Start Month", selection: $draftStartMonth) {
                                ForEach(monthOptions, id: \.self) { month in
                                    Text(DateScope.monthLabel(month)).tag(month)
                                }
                            }
                        } label: {
                            DateRangeValuePill(text: DateScope.monthLabel(draftStartMonth))
                        }
                        .buttonStyle(.plain)
                        .tint(.primary)
                    }
                    .onChange(of: draftStartMonth) { _, newValue in
                        if draftEndMonth < newValue {
                            draftEndMonth = newValue
                        }
                    }

                    HStack {
                        Text("End Month")
                        Spacer()
                        Menu {
                            Picker("End Month", selection: $draftEndMonth) {
                                ForEach(monthOptions.filter { $0 >= draftStartMonth }, id: \.self) { month in
                                    Text(DateScope.monthLabel(month)).tag(month)
                                }
                            }
                        } label: {
                            DateRangeValuePill(text: DateScope.monthLabel(draftEndMonth))
                        }
                        .buttonStyle(.plain)
                        .tint(.primary)
                    }
                } else {
                    HStack {
                        Text("Start Date")
                        Spacer()
                        ZStack(alignment: .trailing) {
                            DatePicker("", selection: $draftStartDate, displayedComponents: .date)
                                .labelsHidden()
                                .frame(minWidth: 180, alignment: .trailing)
                                .opacity(0.02)
                            DateRangeValuePill(text: Self.customDateLabel(draftStartDate))
                                .frame(minWidth: 180, alignment: .trailing)
                                .allowsHitTesting(false)
                        }
                    }

                    HStack {
                        Text("End Date")
                        Spacer()
                        ZStack(alignment: .trailing) {
                            DatePicker("", selection: $draftEndDate, in: draftStartDate..., displayedComponents: .date)
                                .labelsHidden()
                                .frame(minWidth: 180, alignment: .trailing)
                                .opacity(0.02)
                            DateRangeValuePill(text: Self.customDateLabel(draftEndDate))
                                .frame(minWidth: 180, alignment: .trailing)
                                .allowsHitTesting(false)
                        }
                    }
                }
            }
            .navigationTitle("Date Range")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Apply") {
                        apply()
                        dismiss()
                    }
                }
            }
        }
    }

    private var monthOptions: [MonthYear] {
        let fallback = DateRangePickerSheet.month(containing: Date())
        let lower = oldestMonth ?? min(draftStartMonth, fallback)
        let upper = max(newestMonth ?? fallback, fallback)
        guard lower <= upper else { return [fallback] }
        return Array(DateRangePickerSheet.months(from: lower, through: upper).reversed())
    }

    private func apply() {
        let nextStart: Date
        let nextEnd: Date
        switch mode {
        case .months:
            guard let startBounds = LedgerScopeLogic.monthBounds(for: draftStartMonth),
                  let endBounds = LedgerScopeLogic.monthBounds(for: draftEndMonth) else { return }
            nextStart = startBounds.start
            nextEnd = endBounds.end
        case .custom:
            nextStart = draftStartDate
            nextEnd = draftEndDate
        }

        if let onApplyRange {
            onApplyRange(nextStart, nextEnd, mode)
        } else {
            startDate = nextStart
            endDate = nextEnd
        }
    }

    private static func month(containing date: Date) -> MonthYear {
        let calendar = LedgerScopeLogic.calendar
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: date)) ?? date
        let raw = monthStorageFormatter.string(from: start)
        return MonthYear(raw) ?? MonthYear("1970-01")!
    }

    private static func months(from lower: MonthYear, through upper: MonthYear) -> [MonthYear] {
        guard let lowerDate = monthStorageFormatter.date(from: lower.rawValue),
              let upperDate = monthStorageFormatter.date(from: upper.rawValue) else {
            return [lower]
        }
        var result: [MonthYear] = []
        var cursor = lowerDate
        while cursor <= upperDate {
            if let month = MonthYear(monthStorageFormatter.string(from: cursor)) {
                result.append(month)
            }
            guard let next = LedgerScopeLogic.calendar.date(byAdding: .month, value: 1, to: cursor) else { break }
            cursor = next
        }
        return result
    }

    private static func customDateLabel(_ date: Date) -> String {
        date.formatted(
            Date.FormatStyle()
                .day()
                .month(.wide)
                .year()
                .locale(Locale(identifier: "en_GB"))
        )
    }

    private static let monthStorageFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = LedgerScopeLogic.calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM"
        return formatter
    }()
}

enum DateRangePickerMode: Hashable {
    case months
    case custom
}

private struct DateRangeValuePill: View {
    let text: String

    var body: some View {
        Text(text)
            .foregroundStyle(.primary)
            .lineLimit(1)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                Capsule(style: .continuous)
                    .fill(Color(uiColor: .tertiarySystemFill))
            )
            .overlay(
                Capsule(style: .continuous)
                    .stroke(Color(uiColor: .separator).opacity(0.22), lineWidth: 1)
            )
    }
}
