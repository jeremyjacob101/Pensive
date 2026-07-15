import SwiftUI


struct DebouncedSearchField: View {
    @Binding var text: String
    let delayNanoseconds: UInt64
    let onDebouncedChange: (String) -> Void

    @State private var debounceTask: Task<Void, Never>?

    init(
        text: Binding<String>,
        delayNanoseconds: UInt64 = 300_000_000,
        onDebouncedChange: @escaping (String) -> Void = { _ in }
    ) {
        _text = text
        self.delayNanoseconds = delayNanoseconds
        self.onDebouncedChange = onDebouncedChange
    }

    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Search", text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .onChange(of: text) { _, newValue in
                    debounceTask?.cancel()
                    debounceTask = Task {
                        try? await Task.sleep(nanoseconds: delayNanoseconds)
                        guard !Task.isCancelled else { return }
                        await MainActor.run { onDebouncedChange(newValue) }
                    }
                }

            if !text.isEmpty {
                Button {
                    text = ""
                    onDebouncedChange("")
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(uiColor: .secondarySystemBackground), in: Capsule())
    }
}

struct SearchSheet: View {
    @Environment(\.dismiss) private var dismiss

    @Binding var text: String
    let onDebouncedChange: (String) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DebouncedSearchField(text: $text, onDebouncedChange: onDebouncedChange)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Search")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        onDebouncedChange(text)
                        dismiss()
                    }
                }
            }
        }
    }
}

struct LedgerToolbarControls: ToolbarContent {
    let onSearch: (() -> Void)?
    let onFilter: (() -> Void)?
    let onCalendar: (() -> Void)?
    let onAdd: (() -> Void)?
    let addTitle: String

    init(
        onSearch: (() -> Void)? = nil,
        onFilter: (() -> Void)? = nil,
        onCalendar: (() -> Void)? = nil,
        onAdd: (() -> Void)? = nil,
        addTitle: String = "Add"
    ) {
        self.onSearch = onSearch
        self.onFilter = onFilter
        self.onCalendar = onCalendar
        self.onAdd = onAdd
        self.addTitle = addTitle
    }

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            if onAdd != nil {
                if let onSearch {
                    Button(action: onSearch) {
                        Image(systemName: "magnifyingglass")
                    }
                    .accessibilityLabel("Search")
                    .accessibilityIdentifier("ledger_search_toolbar")
                }

                toolbarMenu
            } else {
                HStack {
                    if let onSearch {
                        compactToolbarButton(
                            systemImage: "magnifyingglass",
                            label: "Search",
                            identifier: "ledger_search_toolbar",
                            action: onSearch
                        )
                    }

                    if let onFilter {
                        compactToolbarButton(
                            systemImage: "line.3.horizontal.decrease.circle",
                            label: "Filters",
                            identifier: "ledger_filter_toolbar",
                            action: onFilter
                        )
                    }

                    if let onCalendar {
                        compactToolbarButton(
                            systemImage: "calendar",
                            label: "Date Range",
                            identifier: "ledger_calendar_toolbar",
                            action: onCalendar
                        )
                    }
                }
            }
        }
    }

    private var toolbarMenu: some View {
        Button(action: { onAdd?() }) {
            Image(systemName: "plus")
        }
        .accessibilityIdentifier("ledger_add_toolbar")
        .accessibilityLabel(addTitle)
    }

    private func compactToolbarButton(
        systemImage: String,
        label: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 22, weight: .regular))
                .frame(width: 31, height: 48)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }
}

struct MultiSelectFilterButton: View {
    let title: String
    let choices: [String]
    @Binding var selected: Set<String>

    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            Label(selectedLabel, systemImage: "line.3.horizontal.decrease.circle")
                .labelStyle(.titleAndIcon)
        }
        .sheet(isPresented: $isPresented) {
            MultiSelectFilterSheet(title: title, choices: choices, selected: $selected)
        }
    }

    private var selectedLabel: String {
        selected.isEmpty ? title : "\(title) (\(selected.count))"
    }
}

struct MultiSelectFilterSheet: View {
    @Environment(\.dismiss) private var dismiss

    let title: String
    let choices: [String]
    @Binding var selected: Set<String>

    var body: some View {
        NavigationStack {
            List {
                ForEach(choices, id: \.self) { option in
                    Button {
                        if selected.contains(option) {
                            selected.remove(option)
                        } else {
                            selected.insert(option)
                        }
                    } label: {
                        HStack {
                            Text(option)
                            Spacer()
                            if selected.contains(option) {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            }
            .navigationTitle(title)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Clear") { selected.removeAll() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
