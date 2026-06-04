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
                        Button("Done") { isPresented = false }
                    }
                }
            }
        }
    }

    private var selectedLabel: String {
        selected.isEmpty ? title : "\(title) (\(selected.count))"
    }
}

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

struct DateRangePickerButton: View {
    @Binding var startDate: Date
    @Binding var endDate: Date

    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            Label("Date Range", systemImage: "calendar")
        }
        .sheet(isPresented: $isPresented) {
            NavigationStack {
                Form {
                    DatePicker("Start", selection: $startDate, displayedComponents: .date)
                    DatePicker("End", selection: $endDate, in: startDate..., displayedComponents: .date)
                }
                .navigationTitle("Date Range")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { isPresented = false }
                    }
                }
            }
        }
    }
}

enum ViewLoadState {
    case loading
    case empty(message: String)
    case error(message: String)
    case content

    var hasLoadedContent: Bool {
        if case .content = self { return true }
        if case .empty = self { return true }
        return false
    }
}

struct LoadStateView<Content: View>: View {
    let state: ViewLoadState
    let retry: (() -> Void)?
    @ViewBuilder let content: Content

    init(state: ViewLoadState, retry: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.state = state
        self.retry = retry
        self.content = content()
    }

    var body: some View {
        switch state {
        case .loading:
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .empty(let message):
            ContentUnavailableView("Nothing here yet", systemImage: "tray", description: Text(message))
        case .error(let message):
            VStack(spacing: 12) {
                ContentUnavailableView("Something went wrong", systemImage: "exclamationmark.triangle", description: Text(message))
                if let retry {
                    Button("Retry", action: retry)
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding()
        case .content:
            content
        }
    }
}
