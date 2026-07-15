import SwiftUI

struct OptionsFeatureView: View {
    @StateObject private var viewModel: OptionsViewModel
    @State private var createDraft = OptionCreateDraft()
    @State private var showCreateOption = false
    @State private var renameByRow: [String: String] = [:]
    @State private var colorByRow: [String: String] = [:]
    @State private var rowPendingDelete: OptionsDisplayRow?
    @State private var accountEditorContext: OptionsDisplayRow?
    @State private var isSavingAccount = false
    @State private var accountSaveError: String?
    @State private var selectedAccountID: String?
    @State private var selectedAccountLedgerTab: AccountLedgerTab = .expenses
    @State private var accountPagerResetToken = 0
    @State private var optionEditorContext: OptionsDisplayRow?
    @State private var activeOptionDrag: ActiveOptionDrag?
    @State private var activeOptionDropTargets: [String: String] = [:]
    @State private var isPromoteDropTargeted = false

    init(api: ConvexAPI) {
        _viewModel = StateObject(wrappedValue: OptionsViewModel(api: api))
    }

    var body: some View {
        LoadStateView(state: viewModel.state, retry: { Task { await viewModel.refresh() } }) {
            optionsContent()
            .navigationTitle("Options")
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await viewModel.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        createDraft = OptionCreateDraft()
                        viewModel.inlineError = nil
                        viewModel.successText = nil
                        showCreateOption = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityIdentifier("options_add_toolbar")
                }
            }
            .alert("Delete option?", isPresented: Binding(get: { rowPendingDelete != nil }, set: { if !$0 { rowPendingDelete = nil } })) {
                Button("Delete", role: .destructive) {
                    if let row = rowPendingDelete {
                        Task {
                            await viewModel.remove(kind: row.kind, value: row.value, parentValue: row.parentValue)
                            rowPendingDelete = nil
                        }
                    }
                }
                Button("Cancel", role: .cancel) { rowPendingDelete = nil }
            }
            .sheet(isPresented: $showCreateOption) {
                OptionCreateSheet(
                    viewModel: viewModel,
                    selectedKind: viewModel.selectedKind,
                    draft: $createDraft
                )
            }
            .sheet(item: $optionEditorContext) { row in
                OptionEditSheet(viewModel: viewModel, row: row)
            }
            .sheet(item: $accountEditorContext) { row in
                NavigationStack {
                    Form {
                        Section(row.value) {
                            TextField("Rename", text: Binding(get: { renameByRow[row.selfKey, default: row.value] }, set: { renameByRow[row.selfKey] = $0 }))
                            ColorPicker(
                                "Color",
                                selection: colorSelectionBinding(for: row),
                                supportsOpacity: false
                            )
                            if let accountSaveError {
                                Text(accountSaveError)
                                    .font(.footnote)
                                    .foregroundStyle(.red)
                            }
                        }

                        Section {
                            Button("Delete Account", role: .destructive) {
                                rowPendingDelete = row
                                accountEditorContext = nil
                            }
                        }
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .navigationTitle("Edit Account")
                    .navigationBarTitleDisplayMode(.inline)
                    .presentationDetents([.height(300)])
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Cancel") { accountEditorContext = nil }
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Save") {
                                Task {
                                    isSavingAccount = true
                                    defer { isSavingAccount = false }
                                    if await saveAccountChanges(for: row) {
                                        accountEditorContext = nil
                                    } else {
                                        accountSaveError = viewModel.inlineError ?? "Please check your connection and try again."
                                        viewModel.inlineError = nil
                                    }
                                }
                            }
                            .disabled(!accountHasChanges(row) || isSavingAccount)
                        }
                    }
                    .interactiveDismissDisabled(isSavingAccount)
                }
            }
        }
        .task { viewModel.onAppear() }
        .onChange(of: viewModel.selectedKind) {
            createDraft = OptionCreateDraft()
            showCreateOption = false
            accountEditorContext = nil
            optionEditorContext = nil
            finishOptionDrag()
            selectedAccountID = nil
            selectedAccountLedgerTab = .expenses
            accountPagerResetToken = 0
        }
        .onChange(of: selectedAccountID) { _, _ in
            guard let selectedAccountRow else { return }
            Task { await viewModel.loadInitialLedgerIfNeeded(for: selectedAccountRow, tab: selectedAccountLedgerTab) }
        }
    }

    @ViewBuilder
    private func optionsContent() -> some View {
        ScrollView {
            LazyVStack(spacing: 14) {
                optionsKindPicker()
                    .padding(.horizontal, 16)
                    .padding(.top, 12)

                if viewModel.selectedKind == .account {
                    accountOptionsContent()
                } else {
                    nonAccountOptionsContent()
                }

                accountStatusMessages()
                    .padding(.horizontal, 16)
            }
            .padding(.bottom, 24)
        }
    }

    private func optionsKindPicker() -> some View {
        Picker("Options", selection: $viewModel.selectedKind) {
            ForEach(OptionsKind.selectableCases) { kind in
                Text(kind.displayTitle).tag(kind)
            }
        }
        .pickerStyle(.segmented)
        .opacity(shouldOverlayPromoteDropZone ? 0 : 1)
        .allowsHitTesting(activeOptionDrag == nil)
        .overlay {
            if shouldOverlayPromoteDropZone {
                Label(promoteDropZoneTitle, systemImage: "arrow.up.to.line")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(isPromoteDropTargeted ? Color.accentColor : Color.secondary)
                    .frame(maxWidth: .infinity)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .transition(.opacity)
                    .accessibilityIdentifier("options_promote_drop_target")
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(
                    isPromoteDropTargeted
                        ? Color.accentColor.opacity(0.12)
                        : Color(uiColor: .secondarySystemGroupedBackground)
                )
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(
                    isPromoteDropTargeted ? Color.accentColor.opacity(0.7) : Color.clear,
                    lineWidth: 1.5
            )
        }
        .animation(.easeInOut(duration: 0.16), value: shouldOverlayPromoteDropZone)
        .animation(.easeInOut(duration: 0.16), value: isPromoteDropTargeted)
        .dropDestination(for: OptionDragPayload.self) { payloads, _ in
            guard let payload = payloads.first, canPromoteOption(payload) else { return false }
            finishOptionDrag()
            performPromoteDrop(payload)
            return true
        } isTargeted: { isTargeted in
            isPromoteDropTargeted = isTargeted && activeOptionDrag.map { canPromoteOption($0.payload) } == true
        }
        .accessibilityIdentifier("options_kind_picker")
    }

    @ViewBuilder
    private func nonAccountOptionsContent() -> some View {
        LazyVStack(spacing: 14) {
            if viewModel.selectedKind.supportsNestedOptions {
                ForEach(viewModel.rowGroups) { group in
                    VStack(spacing: 0) {
                        optionCompactRow(for: group.parent, isDragEnabled: group.children.isEmpty)
                        ForEach(group.children, id: \.selfKey) { child in
                            Divider()
                                .padding(.leading, 42)
                            optionCompactRow(for: child, dropTarget: group.parent)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color(uiColor: .secondarySystemGroupedBackground))
                    )
                }
            } else {
                ForEach(viewModel.rowGroups) { group in
                    optionCompactRow(for: group.parent)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color(uiColor: .secondarySystemGroupedBackground))
                        )
                }
            }
        }
        .padding(.horizontal, 24)
    }

    private var promoteDropZoneTitle: String {
        viewModel.selectedKind == .category ? "Drop a Subcategory here to promote" : "Drop an Income Subtype here to promote"
    }

    private var shouldOverlayPromoteDropZone: Bool {
        activeOptionDrag.map { canPromoteOption($0.payload) } == true
    }

    private func accountOptionsContent() -> some View {
        LazyVStack(spacing: 14) {
            if selectedAccountID == nil {
                accountStackOverview()
            } else {
                accountDetailScroller()
            }
        }
    }

    @ViewBuilder
    private func optionsStatusSections() -> some View {
        if viewModel.trackingMismatchCount > 0 {
            Section("Tracking Data Warning") {
                Text("Detected \(viewModel.trackingMismatchCount) tracking rows not reflected in option flags. Showing effective tracking state.")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
        }

        if let inlineError = viewModel.inlineError {
            Section("Error") {
                Text(inlineError).foregroundStyle(.red).font(.footnote)
            }
        }
        if let successText = viewModel.successText {
            Section("Status") {
                Text(successText).font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func accountStatusMessages() -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if viewModel.trackingMismatchCount > 0 {
                Text("Detected \(viewModel.trackingMismatchCount) tracking rows not reflected in option flags. Showing effective tracking state.")
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let inlineError = viewModel.inlineError {
                Text(inlineError)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let successText = viewModel.successText {
                Text(successText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var selectedAccountRow: OptionsDisplayRow? {
        guard let selectedAccountID else { return nil }
        return viewModel.rowGroups.map(\.parent).first { $0.id == selectedAccountID }
    }

    private func accountHasChanges(_ row: OptionsDisplayRow) -> Bool {
        let nextName = renameByRow[row.selfKey, default: row.value].trimmingCharacters(in: .whitespacesAndNewlines)
        let nextColor = normalizedHex(colorByRow[row.selfKey, default: row.color])
        let currentColor = normalizedHex(row.color)
        return !nextName.isEmpty && (nextName != row.value || (nextColor != nil && nextColor != currentColor))
    }

    private func saveAccountChanges(for row: OptionsDisplayRow) async -> Bool {
        let nextName = renameByRow[row.selfKey, default: row.value].trimmingCharacters(in: .whitespacesAndNewlines)
        let nextColor = normalizedHex(colorByRow[row.selfKey, default: row.color]) ?? row.color
        let nameChanged = !nextName.isEmpty && nextName != row.value
        let colorChanged = normalizedHex(nextColor) != normalizedHex(row.color)

        if nameChanged {
            guard await viewModel.rename(
                kind: row.kind,
                value: row.value,
                nextValue: nextName,
                parentValue: row.parentValue
            ) else { return false }
        }

        if colorChanged {
            guard await viewModel.updateColor(
                kind: row.kind,
                value: nameChanged ? nextName : row.value,
                color: nextColor,
                parentValue: row.parentValue
            ) else { return false }
        }
        return true
    }

    @ViewBuilder
    private func accountStackOverview() -> some View {
        let rows = viewModel.rowGroups.map(\.parent)
        let cardHeight: CGFloat = 202

        VStack(alignment: .leading, spacing: 14) {
            if rows.isEmpty {
                Text("No accounts yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 12)
            } else {
                VStack(spacing: -148) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                        accountStackCard(for: row, index: index)
                            .frame(height: cardHeight)
                            .zIndex(Double(index))
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(.top, 2)
        .padding(.horizontal, 24)
        .padding(.bottom, 18)
    }

    @ViewBuilder
    private func accountDetailScroller() -> some View {
        let rows = viewModel.rowGroups.map(\.parent)
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Button {
                    withAnimation(.easeInOut(duration: 0.22)) {
                        selectedAccountID = nil
                        selectedAccountLedgerTab = .expenses
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)

                Spacer()
                Text(selectedAccountRow?.value ?? "Account")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                Spacer()
                Button {
                    if let selectedAccountRow {
                        accountSaveError = nil
                        accountEditorContext = selectedAccountRow
                    }
                } label: {
                    Image(systemName: "pencil")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 4)

            TabView(selection: Binding(get: { selectedAccountID ?? "" }, set: { next in
                guard !next.isEmpty, next != selectedAccountID else { return }
                selectedAccountID = next
                selectedAccountLedgerTab = .expenses
            })) {
                ForEach(rows) { row in
                    accountHeroCard(for: row, isFocused: selectedAccountID == row.id)
                        .padding(.horizontal, 2)
                        .tag(row.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .id("account-pager-\(accountPagerResetToken)")
            .frame(height: 202)

            accountPageDots(rows: rows)
                .frame(maxWidth: .infinity)
                .padding(.top, -12)

            if let selectedAccount = selectedAccountRow {
                accountLedgerTabs(for: selectedAccount)
                    .id("account-ledger-\(selectedAccount.id)")
            }
        }
        .animation(.easeInOut(duration: 0.22), value: selectedAccountID == nil)
        .padding(.top, 8)
        .padding(.horizontal, 24)
        .padding(.bottom, 18)
    }

    @ViewBuilder
    private func accountStackCard(for row: OptionsDisplayRow, index: Int) -> some View {
        accountCardSurface(for: row, isFocused: index == 0, compact: true)
            .background(alignment: .top) {
                if index > 0 {
                    accountStackTopShadow()
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: 20))
            .onTapGesture {
                withAnimation(.easeInOut(duration: 0.24)) {
                    openAccountDetail(for: row)
                }
            }
    }

    private func openAccountDetail(for row: OptionsDisplayRow) {
        accountPagerResetToken += 1
        selectedAccountID = row.id
        selectedAccountLedgerTab = .expenses
        Task { await viewModel.loadInitialLedgerIfNeeded(for: row, tab: .expenses) }
    }

    private func accountStackTopShadow() -> some View {
        RoundedRectangle(cornerRadius: 20)
            .fill(Color.black.opacity(0.24))
            .frame(height: 30)
            .padding(.horizontal, 8)
            .blur(radius: 10)
            .offset(y: -8)
            .allowsHitTesting(false)
    }

    @ViewBuilder
    private func accountHeroCard(for row: OptionsDisplayRow, isFocused: Bool) -> some View {
        accountCardSurface(for: row, isFocused: isFocused, compact: false)
            .frame(height: 202)
            .onTapGesture {
                accountSaveError = nil
                accountEditorContext = row
            }
    }

    private func accountPageDots(rows: [OptionsDisplayRow]) -> some View {
        HStack(spacing: 7) {
            ForEach(rows) { row in
                Circle()
                    .fill(row.id == selectedAccountID ? Color.primary.opacity(0.72) : Color.secondary.opacity(0.28))
                    .frame(width: row.id == selectedAccountID ? 7 : 6, height: row.id == selectedAccountID ? 7 : 6)
            }
        }
        .animation(.easeInOut(duration: 0.18), value: selectedAccountID)
    }

    @ViewBuilder
    private func accountCardSurface(for row: OptionsDisplayRow, isFocused: Bool, compact: Bool) -> some View {
        let accountColor = color(from: row.color) ?? .gray
        let palette = accountPalette(for: accountColor, index: Int(row.id.hashValue.magnitude % 10_000))
        let cornerRadius: CGFloat = compact ? 20 : 22

        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        colors: palette,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Circle()
                .fill(.white.opacity(compact ? 0.13 : 0.18))
                .frame(width: compact ? 136 : 188, height: compact ? 136 : 188)
                .offset(x: compact ? -42 : -34, y: compact ? -68 : -58)

            RoundedRectangle(cornerRadius: 42)
                .fill(.white.opacity(compact ? 0.10 : 0.14))
                .frame(width: compact ? 190 : 236, height: compact ? 116 : 146)
                .rotationEffect(.degrees(-21))
                .offset(x: compact ? 132 : 158, y: compact ? -46 : -56)

            RoundedRectangle(cornerRadius: 52)
                .stroke(.white.opacity(compact ? 0.10 : 0.14), lineWidth: compact ? 20 : 24)
                .frame(width: compact ? 220 : 268, height: compact ? 142 : 178)
                .rotationEffect(.degrees(-24))
                .offset(x: compact ? -82 : -58, y: compact ? 64 : 74)

            VStack(alignment: .leading, spacing: compact ? 14 : 24) {
                HStack(alignment: .center) {
                    accountGlyph(for: row, color: .white.opacity(0.58))
                    Spacer()
                    Text(row.value)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.94))
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }

                if compact {
                    Spacer(minLength: 0)
                    VStack(alignment: .center, spacing: 6) {
                        Text(row.value)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.82))
                            .lineLimit(1)
                            .minimumScaleFactor(0.78)
                        Text("Account")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.98))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    Spacer(minLength: 2)
                } else {
                    Spacer(minLength: 0)

                    VStack(alignment: .center, spacing: 7) {
                        Text(row.value)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.82))
                            .lineLimit(1)
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("ILS")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.72))
                            Text("Account")
                                .font(.largeTitle.weight(.semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                        }
                        Text(isFocused ? "Transactions" : "Account")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(compact ? 18 : 20)

            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(
                    LinearGradient(colors: [.white.opacity(0.34), .white.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing),
                    lineWidth: 1
                )
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .shadow(color: palette[0].opacity(0.26), radius: compact ? 16 : 22, x: 0, y: compact ? 10 : 14)
    }

    private func accountGlyph(for row: OptionsDisplayRow, color: Color) -> some View {
        ZStack {
            Circle()
                .stroke(color, lineWidth: 2)
                .frame(width: 24, height: 24)
            Text(String(row.value.prefix(1)).uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(color)
        }
    }

    private func accountPalette(for color: Color, index: Int) -> [Color] {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0
        guard UIColor(color).getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
            return [
                color.opacity(0.82),
                Color(red: 0.58, green: 0.45, blue: 0.68),
                Color(red: 0.16, green: 0.17, blue: 0.34)
            ]
        }

        let hueShift = CGFloat((index % 3) - 1) * 0.028
        let companionHue = hue + hueShift < 0 ? hue + hueShift + 1 : (hue + hueShift > 1 ? hue + hueShift - 1 : hue + hueShift)
        let vividSaturation = max(0.44, min(0.82, saturation + 0.18))
        let softSaturation = max(0.34, min(0.68, saturation + 0.08))
        let topBrightness = max(0.66, min(0.92, brightness + 0.18))
        let midBrightness = max(0.48, min(0.78, brightness + 0.02))
        let bottomBrightness = max(0.24, min(0.48, brightness - 0.22))

        return [
            Color(hue: Double(companionHue), saturation: Double(softSaturation), brightness: Double(topBrightness)),
            Color(hue: Double(hue), saturation: Double(vividSaturation), brightness: Double(midBrightness)),
            Color(hue: Double(hue), saturation: Double(max(0.38, saturation)), brightness: Double(bottomBrightness))
        ]
    }

    @ViewBuilder
    private func accountLedgerTabs(for row: OptionsDisplayRow) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Picker("Account Ledger", selection: $selectedAccountLedgerTab) {
                ForEach(AccountLedgerTab.allCases) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: selectedAccountLedgerTab) { _, tab in
                Task { await viewModel.loadInitialLedgerIfNeeded(for: row, tab: tab) }
            }
            .task(id: "\(row.selfKey)|\(selectedAccountLedgerTab.rawValue)") {
                await viewModel.loadInitialLedgerIfNeeded(for: row, tab: selectedAccountLedgerTab)
            }

            switch selectedAccountLedgerTab {
            case .expenses:
                accountExpenseFeed(for: row)
            case .incomings:
                accountIncomingFeed(for: row)
            }
        }
        .transaction { transaction in
            transaction.animation = nil
        }
    }

    @ViewBuilder
    private func accountExpenseFeed(for row: OptionsDisplayRow) -> some View {
        let expenses = viewModel.expenses(for: row)
        VStack(alignment: .leading, spacing: 12) {
            Text("Last transactions")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)

            if !viewModel.hasLoadedExpenses(for: row) || (expenses.isEmpty && viewModel.isLoadingExpenses(for: row)) {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 52)
            } else if let error = viewModel.expenseError(for: row) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 1.0, green: 0.55, blue: 0.58))
                    Button("Try Again") {
                        Task { await viewModel.loadMoreExpenses(for: row) }
                    }
                    .font(.footnote.weight(.semibold))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 8)
            } else if expenses.isEmpty {
                Text("No expenses yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(expenses.enumerated()), id: \.element._id) { index, expense in
                        accountExpenseRow(expense)
                        if index < expenses.count - 1 {
                            Divider().padding(.leading, 4)
                        }
                    }
                    if viewModel.isLoadingExpenses(for: row) {
                        ProgressView()
                            .padding(.vertical, 14)
                    } else if !viewModel.isDoneLoadingExpenses(for: row) {
                        Button("Load More") {
                            Task { await viewModel.loadMoreExpenses(for: row) }
                        }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    accountLedgerBottomSentinel()
                }
                .onPreferenceChange(AccountLedgerBottomPreferenceKey.self) { minY in
                    guard shouldLoadAccountLedgerPage(bottomMinY: minY),
                          !viewModel.isLoadingExpenses(for: row),
                          !viewModel.isDoneLoadingExpenses(for: row) else { return }
                    Task { await viewModel.loadMoreExpenses(for: row) }
                }
            }
        }
    }

    @ViewBuilder
    private func accountIncomingFeed(for row: OptionsDisplayRow) -> some View {
        let incomings = viewModel.incomings(for: row)
        VStack(alignment: .leading, spacing: 12) {
            Text("Last transactions")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)

            if !viewModel.hasLoadedIncomings(for: row) || (incomings.isEmpty && viewModel.isLoadingIncomings(for: row)) {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 52)
            } else if let error = viewModel.incomingError(for: row) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color(red: 1.0, green: 0.55, blue: 0.58))
                    Button("Try Again") {
                        Task { await viewModel.loadMoreIncomings(for: row) }
                    }
                    .font(.footnote.weight(.semibold))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 8)
            } else if incomings.isEmpty {
                Text("No incomings yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(incomings.enumerated()), id: \.element._id) { index, incoming in
                        accountIncomingRow(incoming)
                        if index < incomings.count - 1 {
                            Divider().padding(.leading, 4)
                        }
                    }
                    if viewModel.isLoadingIncomings(for: row) {
                        ProgressView()
                            .padding(.vertical, 14)
                    } else if !viewModel.isDoneLoadingIncomings(for: row) {
                        Button("Load More") {
                            Task { await viewModel.loadMoreIncomings(for: row) }
                        }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    accountLedgerBottomSentinel()
                }
                .onPreferenceChange(AccountLedgerBottomPreferenceKey.self) { minY in
                    guard shouldLoadAccountLedgerPage(bottomMinY: minY),
                          !viewModel.isLoadingIncomings(for: row),
                          !viewModel.isDoneLoadingIncomings(for: row) else { return }
                    Task { await viewModel.loadMoreIncomings(for: row) }
                }
            }
        }
    }

    private func shouldLoadAccountLedgerPage(bottomMinY: CGFloat) -> Bool {
        bottomMinY > 0 && bottomMinY < UIScreen.main.bounds.height - 48
    }

    private func accountLedgerBottomSentinel() -> some View {
        Color.clear
            .frame(height: 1)
            .background(
                GeometryReader { proxy in
                    Color.clear.preference(
                        key: AccountLedgerBottomPreferenceKey.self,
                        value: proxy.frame(in: .global).minY
                    )
                }
            )
    }

    private func accountExpenseRow(_ expense: ExpenseDTO) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(expense.expense)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text([expense.category, expense.date].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " • "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(expense.amount, format: .currency(code: Locale.current.currency?.identifier ?? "USD"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 4)
    }

    private func accountIncomingRow(_ incoming: IncomingDTO) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(incoming.incoming)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text([incoming.incomeType, incoming.date].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " • "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(incoming.amount, format: .currency(code: Locale.current.currency?.identifier ?? "USD"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 4)
    }

    private func canDropOption(_ payload: OptionDragPayload, on target: OptionsDisplayRow) -> Bool {
        switch (payload.kind, target.kind) {
        case (.category, .category):
            return payload.value != target.value
        case (.subcategory, .category):
            return payload.parentValue != nil
        case (.incomeType, .incomeType):
            return payload.value != target.value
        case (.incomeSubtype, .incomeType):
            return payload.parentValue != nil
        default:
            return false
        }
    }

    private func beginOptionDrag(_ payload: OptionDragPayload) -> NSItemProvider {
        let sessionID = UUID()
        activeOptionDrag = ActiveOptionDrag(id: sessionID, payload: payload)
        activeOptionDropTargets.removeAll()
        isPromoteDropTargeted = false

        return OptionDragItemProvider(payload: payload) {
            DispatchQueue.main.async {
                finishOptionDrag(sessionID: sessionID)
            }
        }
    }

    private func finishOptionDrag(sessionID: UUID? = nil) {
        if let sessionID, activeOptionDrag?.id != sessionID {
            return
        }
        activeOptionDrag = nil
        activeOptionDropTargets.removeAll()
        isPromoteDropTargeted = false
    }

    private func performOptionDrop(_ payload: OptionDragPayload, on target: OptionsDisplayRow) {
        Task {
            switch (payload.kind, target.kind) {
            case (.category, .category):
                guard payload.value != target.value else { return }
                await viewModel.moveToSubtype(kind: payload.kind, sourceValue: payload.value, targetValue: target.value)
            case (.subcategory, .category):
                if let sourceParent = payload.parentValue, sourceParent != target.value {
                    await viewModel.moveSubtype(kind: payload.kind, value: payload.value, sourceParentValue: sourceParent, targetParentValue: target.value)
                }
            case (.incomeType, .incomeType):
                guard payload.value != target.value else { return }
                await viewModel.moveToSubtype(kind: payload.kind, sourceValue: payload.value, targetValue: target.value)
            case (.incomeSubtype, .incomeType):
                if let sourceParent = payload.parentValue, sourceParent != target.value {
                    await viewModel.moveSubtype(kind: payload.kind, value: payload.value, sourceParentValue: sourceParent, targetParentValue: target.value)
                }
            default:
                break
            }
        }
    }

    private func canPromoteOption(_ payload: OptionDragPayload) -> Bool {
        guard payload.parentValue != nil else { return false }
        return (viewModel.selectedKind == .category && payload.kind == .subcategory)
            || (viewModel.selectedKind == .incomeType && payload.kind == .incomeSubtype)
    }

    private func performPromoteDrop(_ payload: OptionDragPayload) {
        guard let sourceParent = payload.parentValue else { return }
        Task {
            await viewModel.promoteSubtype(kind: payload.kind, value: payload.value, parentValue: sourceParent)
        }
    }

    private func optionDragPreview(for row: OptionsDisplayRow) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color(from: row.color) ?? .gray)
                .frame(width: 12, height: 12)

            Text(row.value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(.regularMaterial, in: Capsule())
        .overlay {
            Capsule()
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
        }
    }

    private func optionCompactRow(
        for row: OptionsDisplayRow,
        dropTarget: OptionsDisplayRow? = nil,
        isDragEnabled: Bool = true
    ) -> some View {
        let resolvedDropTarget = dropTarget ?? row
        let payload = OptionDragPayload(kind: row.kind, value: row.value, parentValue: row.parentValue)
        let isDropTarget = activeOptionDropTargets.values.contains(resolvedDropTarget.id)

        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Button {
                    Task { await viewModel.setDefault(kind: row.kind, value: row.value, isDefault: !row.isDefault, parentValue: row.parentValue) }
                } label: {
                    ZStack {
                        Circle()
                            .fill(color(from: row.color) ?? .gray)
                            .frame(width: row.isDefault ? 18 : 14, height: row.isDefault ? 18 : 14)
                        Circle()
                            .stroke((color(from: row.color) ?? .gray).opacity(row.isDefault ? 0.35 : 0), lineWidth: 7)
                            .frame(width: 24, height: 24)
                    }
                    .frame(width: 32, height: 32)
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(row.isDefault ? "Unset default \(row.value)" : "Set default \(row.value)")
                .accessibilityValue(row.isDefault ? "Default" : "Not default")

                VStack(alignment: .leading, spacing: 2) {
                    Text(row.value)
                        .font(row.indentationLevel == 0 ? .headline : .body.weight(.medium))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                    if row.indentationLevel == 0, row.parentValue?.isEmpty == false, let parent = row.parentValue {
                        Text(parent)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)

                if viewModel.supportsTracking(kind: row.kind) {
                    Button {
                        Task { await viewModel.setTracking(kind: row.kind, value: row.value, isTracking: !row.isTracking, parentValue: row.parentValue) }
                    } label: {
                        Image("lucide-finance-tracking")
                            .renderingMode(.template)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 18, height: 18)
                            .foregroundStyle(row.isTracking ? Color.accentColor : Color.secondary)
                            .frame(width: 34, height: 34)
                            .background(
                                Circle()
                                    .fill(row.isTracking ? Color.accentColor.opacity(0.13) : Color(uiColor: .tertiarySystemGroupedBackground))
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(row.isTracking ? "Disable tracking for \(row.value)" : "Enable tracking for \(row.value)")
                    .accessibilityValue(row.isTracking ? "Tracking enabled" : "Tracking disabled")
                }

                Button {
                    optionEditorContext = row
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit \(row.value)")
            }
            .padding(.leading, CGFloat(row.indentationLevel) * 18)
            .padding(.vertical, 10)
            .padding(.horizontal, 12)
            .contentShape(Rectangle())
        }
        .background {
            if isDropTarget {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.accentColor.opacity(0.12))
            }
        }
        .animation(.easeInOut(duration: 0.16), value: isDropTarget)
        .onTapGesture {
            optionEditorContext = row
        }
        .dropDestination(for: OptionDragPayload.self) { payloads, _ in
            guard let payload = payloads.first,
                  canDropOption(payload, on: resolvedDropTarget) else { return false }
            finishOptionDrag()
            performOptionDrop(payload, on: resolvedDropTarget)
            return true
        } isTargeted: { isTargeted in
            if isTargeted,
               let payload = activeOptionDrag?.payload,
               canDropOption(payload, on: resolvedDropTarget) {
                activeOptionDropTargets[row.id] = resolvedDropTarget.id
                isPromoteDropTargeted = false
            } else {
                activeOptionDropTargets.removeValue(forKey: row.id)
            }
        }
        .modifier(ConditionalOptionDragModifier(
            isEnabled: isDragEnabled,
            itemProvider: { beginOptionDrag(payload) },
            preview: optionDragPreview(for: row)
        ))
        .accessibilityHint(
            isDragEnabled
                ? "Touch and hold, then drag to move this option"
                : "This option contains suboptions and cannot be moved"
        )
    }

    private func color(from hex: String) -> Color? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }

    private func colorSelectionBinding(for row: OptionsDisplayRow) -> Binding<Color> {
        let rowKey = row.selfKey
        return Binding(
            get: { color(from: colorByRow[rowKey, default: row.color]) ?? .gray },
            set: { colorByRow[rowKey] = hex(from: $0) ?? row.color }
        )
    }

    private func hex(from color: Color) -> String? {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard UIColor(color).getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return nil }
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }

    private func normalizedHex(_ hex: String) -> String? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: "#", with: "")
        guard clean.range(of: #"^[0-9A-F]{6}$"#, options: .regularExpression) != nil else { return nil }
        return "#\(clean)"
    }
}

private struct ActiveOptionDrag: Equatable {
    let id: UUID
    let payload: OptionDragPayload
}

private struct ConditionalOptionDragModifier<Preview: View>: ViewModifier {
    let isEnabled: Bool
    let itemProvider: () -> NSItemProvider
    let preview: Preview

    @ViewBuilder
    func body(content: Content) -> some View {
        if isEnabled {
            content.onDrag(itemProvider) {
                preview
            }
        } else {
            content
        }
    }
}
