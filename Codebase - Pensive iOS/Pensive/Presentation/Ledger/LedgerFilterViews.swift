import SwiftUI
import Charts

enum LedgerFilterTab: CaseIterable, Identifiable {
    case account
    case category

    var id: Self { self }

    func label(for kind: LedgerKind) -> String {
        switch self {
        case .account:
            return "Account"
        case .category:
            return kind == .incoming ? "Income Type" : "Category"
        }
    }
}

struct LedgerFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LedgerFeatureViewModel

    @State private var selectedTab: LedgerFilterTab = .account

    var body: some View {
        NavigationStack {
            List {
                Picker("Filter", selection: $selectedTab) {
                    ForEach(LedgerFilterTab.allCases) { tab in
                        Text(tab.label(for: viewModel.kind)).tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                if selectedTab == .account {
                    Section {
                        HStack {
                            Button("Select All") {
                                updateAccountSelection(selectAll: true)
                            }
                            .disabled(allAccountsSelected)
                            Spacer()
                            Button("Deselect All") {
                                updateAccountSelection(selectAll: false)
                            }
                            .disabled(noAccountsSelected)
                        }

                        ForEach(viewModel.accountFilterChoices, id: \.self) { account in
                            LedgerAccountFilterRow(
                                value: account,
                                colorHex: viewModel.accountColor(for: account),
                                isSelected: isSelectedBinding(for: account)
                            )
                        }
                    }
                } else {
                    Section {
                        HStack {
                            Button("Select All") {
                                updateCategorySelection(selectAll: true)
                            }
                            .disabled(allCategoriesSelected)
                            Spacer()
                            Button("Deselect All") {
                                updateCategorySelection(selectAll: false)
                            }
                            .disabled(noCategoriesSelected)
                        }

                        ForEach(viewModel.categoryFilterRows) { row in
                            LedgerCategoryFilterRow(
                                row: row,
                                isSelected: isSelectedBinding(for: row.filterKey)
                            )
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func isSelectedBinding(for value: String) -> Binding<Bool> {
        Binding {
            selectedValues.contains(value)
        } set: { isSelected in
            var next = selectedValues
            if isSelected {
                next.insert(value)
            } else {
                next.remove(value)
            }
            updateSelectedValues(next)
        }
    }

    private var selectedValues: Set<String> {
        selectedTab == .account ? viewModel.selectedAccountFilters : viewModel.selectedCategoryFilters
    }

    private func updateSelectedValues(_ values: Set<String>) {
        if selectedTab == .account {
            viewModel.updateAccountFilters(values)
        } else {
            viewModel.updateCategoryFilters(values)
        }
    }

    private var allAccountsSelected: Bool {
        let accountValues = Set(viewModel.accountFilterChoices)
        return viewModel.selectedAccountFilters.isSuperset(of: accountValues)
    }

    private var noAccountsSelected: Bool {
        let accountValues = Set(viewModel.accountFilterChoices)
        return viewModel.selectedAccountFilters.isDisjoint(with: accountValues)
    }

    private func updateAccountSelection(selectAll: Bool) {
        var next = viewModel.selectedAccountFilters
        let values = Set(viewModel.accountFilterChoices)
        if selectAll {
            next.formUnion(values)
        } else {
            next.subtract(values)
        }
        viewModel.updateAccountFilters(next)
    }

    private var allCategoriesSelected: Bool {
        let categoryValues = Set(viewModel.categoryFilterRows.map(\.filterKey))
        return viewModel.selectedCategoryFilters.isSuperset(of: categoryValues)
    }

    private var noCategoriesSelected: Bool {
        let categoryValues = Set(viewModel.categoryFilterRows.map(\.filterKey))
        return viewModel.selectedCategoryFilters.isDisjoint(with: categoryValues)
    }

    private func updateCategorySelection(selectAll: Bool) {
        var next = viewModel.selectedCategoryFilters
        let values = Set(viewModel.categoryFilterRows.map(\.filterKey))
        if selectAll {
            next.formUnion(values)
        } else {
            next.subtract(values)
        }
        viewModel.updateCategoryFilters(next)
    }
}

struct LedgerAccountFilterRow: View {
    let value: String
    let colorHex: String?
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
                    .fill(hexColor(from: colorHex) ?? .gray)
                    .frame(width: 12, height: 12)
                Text(value)
                    .foregroundStyle(.primary)
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func hexColor(from hex: String?) -> Color? {
        guard let hex else { return nil }
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }
}

struct LedgerCategoryFilterRow: View {
    let row: LedgerFilterOptionRow
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
    }
}

func coloredDotUIImage(color: Color?, size: CGFloat = 14) -> UIImage? {
    guard let color else { return nil }
    let uiColor = UIColor(color)
    UIGraphicsBeginImageContextWithOptions(CGSize(width: size, height: size), false, 0)
    uiColor.setFill()
    UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: size, height: size)).fill()
    let image = UIGraphicsGetImageFromCurrentImageContext()
    UIGraphicsEndImageContext()
    return image
}

struct LedgerBreakdownCard: View {
    @ObservedObject var viewModel: LedgerFeatureViewModel
    private let moneyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "ILS"
        formatter.locale = Locale(identifier: "he_IL")
        return formatter
    }()

    private let fallbackPalette: [Color] = [
        Color(red: 0.71, green: 0.00, blue: 0.00),
        Color(red: 0.18, green: 0.25, blue: 0.91),
        Color(red: 0.16, green: 0.61, blue: 0.88),
        Color(red: 0.92, green: 0.33, blue: 0.34),
        Color(red: 0.98, green: 0.11, blue: 0.10),
        Color(red: 0.10, green: 0.74, blue: 0.11),
        Color(red: 0.82, green: 0.30, blue: 0.78),
        Color(red: 0.29, green: 0.75, blue: 0.88),
        Color(red: 0.53, green: 0.22, blue: 0.92),
        Color(red: 0.35, green: 0.86, blue: 0.68),
        Color(red: 0.95, green: 0.63, blue: 0.10),
        Color(red: 0.84, green: 0.89, blue: 0.14)
    ]

    var body: some View {
        let summary = viewModel.breakdownSummary
        let chartSlices = summary.slices.filter { $0.amount.isFinite && $0.amount > 0 }
        let chartTotal = chartSlices.reduce(0) { $0 + $1.amount }
        let chartIdentity = [
            viewModel.scope.displayLabel,
            viewModel.breakdownMode.rawValue,
            chartSlices.map { "\($0.key):\($0.amount)" }.joined(separator: "|")
        ].joined(separator: "-")
        VStack(alignment: .leading, spacing: 16) {
            Picker("Breakdown Mode", selection: Binding(get: { viewModel.breakdownMode }, set: { viewModel.updateBreakdownMode($0) })) {
                Text("Category").tag(LedgerFeatureViewModel.BreakdownMode.category)
                Text("Subcategory").tag(LedgerFeatureViewModel.BreakdownMode.subcategory)
            }
            .pickerStyle(.segmented)

            if chartSlices.isEmpty || !chartTotal.isFinite || chartTotal <= 0 {
                Text("No rows available for this scope.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Chart(chartSlices) { slice in
                    SectorMark(
                        angle: .value("Amount", slice.amount),
                        innerRadius: .ratio(0.58),
                        outerRadius: .inset(0)
                    )
                    .foregroundStyle(color(for: slice))
                }
                .id(chartIdentity)
                .transaction { transaction in
                    transaction.animation = nil
                }
                .frame(height: 240)
                .chartBackground { _ in
                    VStack(spacing: 4) {
                        Text("TOTAL").font(.caption).foregroundStyle(.secondary)
                        Text(money(summary.totalEffective)).font(.title3.weight(.bold))
                    }
                }

                Divider()

                VStack(spacing: 8) {
                    ForEach(Array(chartSlices.enumerated()), id: \.element.id) { index, slice in
                        HStack {
                            Circle().fill(color(for: slice, fallbackIndex: index)).frame(width: 10, height: 10)
                            Text(slice.label)
                            Spacer()
                            Text(money(slice.amount)).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            HStack {
                Text("Raw: \(money(summary.totalRaw))")
                Spacer()
                Text("Effective: \(money(summary.totalEffective))")
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
        )
    }

    private func money(_ value: Double) -> String {
        moneyFormatter.string(from: NSNumber(value: value)) ?? "₪\(value)"
    }

    private func color(for slice: LedgerBreakdownSlice, fallbackIndex: Int = 0) -> Color {
        if let token = slice.colorToken, let parsed = Color(hex: token) {
            return parsed
        }
        return fallbackPalette[fallbackIndex % fallbackPalette.count]
    }
}

private extension Color {
    init?(hex: String) {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        self.init(red: red, green: green, blue: blue)
    }
}
